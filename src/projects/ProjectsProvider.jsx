// Projects (update v3, file 06): one-off jobs Admin assigns to staff.
// Loaded once after sign-in for the whole app: the database returns only what this person
// may see (staff: the projects they're assigned to; Admin: all), and live updates keep it
// current. Calendars, the this-week reminder and the Projects page all read from here.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { normalizeProject } from '../data/api.js';
import { friendlyError, ONLY_ADMIN } from '../lib/errors.js';
import { ProjectDialog } from './ProjectDialog.jsx';
import { ProjectPopup } from './ProjectPopup.jsx';

const ProjectsContext = createContext(null);
const EMPTY = [];

/** What the database's refusals mean here (07: "Only Admin can do this."). */
export const projectError = (err) => friendlyError(err, { refused: ONLY_ADMIN });

const byDue = (a, b) => (a.due_date === b.due_date ? ((a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1) : a.due_date < b.due_date ? -1 : 1);

export function ProjectsProvider({ children }) {
  const api = useApi();
  const app = useAppData();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null · 'new' · { project } · { draftDate }
  const lastLoad = useRef(0);
  const refetchTimer = useRef(null);

  const me = profile?.id ?? null;
  const isAdmin = Boolean(profile?.role?.is_admin);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      lastLoad.current = Date.now();
      if (!quiet) setStatus('loading');
      const r = await api.listProjects();
      if (r.error) {
        if (!quiet) {
          setError(projectError(r.error));
          setStatus('error');
        }
        return;
      }
      setProjects((r.data ?? []).map((row) => normalizeProject(row)).sort(byDue));
      setError(null);
      setStatus('ready');
    },
    [api],
  );

  // first load + live updates. Assignee changes decide what a staff member can see at all,
  // so any event simply re-reads the (small) list, debounced.
  useEffect(() => {
    load();
    const unsubscribe = api.subscribeProjects(() => {
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => load({ quiet: true }), 250);
    });
    return () => {
      unsubscribe();
      clearTimeout(refetchTimer.current);
    };
  }, [api, load]);

  // if realtime dropped, catch up when the tab regains focus (throttled)
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLoad.current < 5000) return;
      load({ quiet: true });
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [load]);

  const put = useCallback((row) => {
    setProjects((prev) => {
      const old = prev.find((p) => p.id === row.id);
      const next = normalizeProject(row, old);
      return [...prev.filter((p) => p.id !== row.id), next].sort(byDue);
    });
  }, []);

  // ------------------------------------------------------------ mutations
  /**
   * Admin: create a project, then assign people. If the project is created but assigning
   * fails, `projectId` comes back with the error so the dialog can retry the assignees only.
   */
  const create = useCallback(
    async ({ name, description, dueDate, assignees }) => {
      const r = await api.createProject({ name, description, dueDate });
      if (r.error || !r.data) return { error: r.error ?? { message: 'The project could not be created.' } };
      const made = normalizeProject(r.data); // the new row has no assignees yet
      const a = await api.addProjectAssignees(made.id, assignees);
      if (a.error) {
        put({ ...made, assignees: [] });
        return { error: a.error, projectId: made.id };
      }
      put({ ...made, assignees });
      return { data: made, error: null };
    },
    [api, put],
  );

  /** Admin: change the fields that differ, then add and remove the assignee differences. */
  const update = useCallback(
    async (project, { name, description, dueDate, assignees }) => {
      const patch = {};
      if (name !== undefined && name !== project.name) patch.name = name;
      if (description !== undefined && (description || null) !== (project.description ?? null)) patch.description = description || null;
      if (dueDate !== undefined && dueDate !== project.due_date) patch.due_date = dueDate;
      let row = project;
      if (Object.keys(patch).length) {
        const r = await api.updateProject(project.id, patch);
        if (r.error) return { error: r.error };
        row = normalizeProject(r.data, project);
      }
      let current = project.assignees ?? [];
      if (assignees) {
        const added = assignees.filter((id) => !current.includes(id));
        const removed = current.filter((id) => !assignees.includes(id));
        // add first: a project is never left without anyone if removing then fails
        const a = await api.addProjectAssignees(project.id, added);
        if (a.error) {
          put({ ...row, assignees: current });
          return { error: a.error };
        }
        current = [...current, ...added];
        const d = await api.removeProjectAssignees(project.id, removed);
        if (d.error) {
          put({ ...row, assignees: current });
          return { error: d.error };
        }
        current = current.filter((id) => !removed.includes(id));
      }
      put({ ...row, assignees: current });
      return { data: row, error: null };
    },
    [api, put],
  );

  /** Optimistic change of one field (status or due_date); puts the old row back if refused. */
  const quickUpdate = useCallback(
    async (id, patch) => {
      let before = null;
      setProjects((prev) =>
        prev
          .map((p) => {
            if (p.id !== id) return p;
            before = p;
            return { ...p, ...patch };
          })
          .sort(byDue),
      );
      const r = await api.updateProject(id, patch);
      if (r.error) {
        if (before) setProjects((prev) => prev.map((p) => (p.id === id ? before : p)).sort(byDue));
        return { error: r.error };
      }
      put(r.data);
      return { data: r.data, error: null };
    },
    [api, put],
  );

  /** Admin or an assigned staff member: mark done / reopen. */
  const setProjectStatus = useCallback((id, next) => quickUpdate(id, { status: next }), [quickUpdate]);
  /** Admin: move the deadline (calendar drag). */
  const setDueDate = useCallback((id, date) => quickUpdate(id, { due_date: date }), [quickUpdate]);

  const remove = useCallback(
    async (id) => {
      const r = await api.deleteProject(id);
      if (!r.error) setProjects((prev) => prev.filter((p) => p.id !== id));
      return r;
    },
    [api],
  );

  // ------------------------------------------------------------ the popup (?project=<id>)
  const openId = searchParams.get('project');
  const openProject = useCallback(
    (id) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('project', id);
        return next;
      }),
    [setSearchParams],
  );
  const closeProject = useCallback(
    () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('project');
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  /**
   * The projects a tracker's pages show: for staff, every project they can see (their own);
   * for Admin, the projects of that tracker's people.
   */
  const forTracker = useCallback(
    (roleId) => {
      if (!isAdmin) return projects;
      const list = projects.filter((p) => p.assignees.some((id) => app.peopleById[id]?.role_id === roleId));
      return list.length ? list : EMPTY;
    },
    [isAdmin, projects, app.peopleById],
  );

  const value = useMemo(
    () => ({
      projects,
      byId,
      status,
      error,
      me,
      isAdmin,
      reload: load,
      create,
      update,
      setProjectStatus,
      setDueDate,
      remove,
      forTracker,
      openProject,
      closeProject,
      /** Admin: open the dialog for a new project (optionally with the deadline filled in). */
      newProject: (draftDate = null) => setEditing({ draftDate }),
      /** Admin: open the dialog to edit a project. */
      editProject: (project) => setEditing({ project }),
      api,
    }),
    [projects, byId, status, error, me, isAdmin, load, create, update, setProjectStatus, setDueDate, remove, forTracker, openProject, closeProject, api],
  );

  return (
    <ProjectsContext.Provider value={value}>
      {children}
      {openId && status !== 'loading' && <ProjectPopup key={openId} projectId={openId} onClose={closeProject} />}
      {editing && isAdmin && (
        <ProjectDialog
          key={editing.project?.id ?? 'new'}
          project={editing.project ?? null}
          draftDate={editing.draftDate ?? null}
          onClose={() => setEditing(null)}
        />
      )}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider');
  return ctx;
}
