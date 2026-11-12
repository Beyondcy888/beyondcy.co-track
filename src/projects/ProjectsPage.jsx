// /admin/projects (file 06): one-off projects Admin assigns to staff.
// Upcoming (nearest deadline first) · Overdue (open, deadline passed) · Done.
import { useMemo, useState } from 'react';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useToday } from '../data/useNow.js';
import { PageHeader } from '../layout/PageHeader.jsx';
import { formatWeekdayDate } from '../lib/time.js';
import { projectBuckets } from '../lib/week.js';
import { AvatarStack, namesOf } from '../people/Avatar.jsx';
import { Spinner } from '../ui/bits.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { IconCheck, IconFlag, IconPencil, IconPlus, IconTrash, IconUndo } from '../ui/icons.jsx';
import { useToast } from '../ui/Toast.jsx';
import { DeadlineHint } from './ProjectPopup.jsx';
import { projectError, useProjects } from './ProjectsProvider.jsx';
import { descriptionPreview, PROJECT_STATUS_LABELS } from './projectText.js';

const TABS = [
  ['upcoming', 'Upcoming'],
  ['overdue', 'Overdue'],
  ['done', 'Done'],
];

const EMPTY_TEXT = {
  upcoming: ['Nothing upcoming.', 'Create a project to hand a one-off job to your team. It shows up in their calendars on the deadline.'],
  overdue: ['Nothing is overdue.', 'Open projects whose deadline has passed appear here.'],
  done: ['No finished projects yet.', 'Projects marked as done by you or the assigned staff appear here.'],
};

function ProjectRow({ project, today }) {
  const ps = useProjects();
  const app = useAppData();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const done = project.status === 'done';
  const preview = descriptionPreview(project.description);
  const names = namesOf(app, project.assignees);

  const toggle = async () => {
    setBusy(true);
    const r = await ps.setProjectStatus(project.id, done ? 'open' : 'done');
    setBusy(false);
    if (r.error) toast(projectError(r.error), { tone: 'danger', duration: 6000 });
    else toast(done ? 'Project reopened' : 'Project marked as done');
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this project?',
      body: `"${project.name}" disappears for everyone assigned to it. A copy stays in the activity log.`,
      confirmLabel: 'Delete project',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const r = await ps.remove(project.id);
    setBusy(false);
    if (r.error) toast(projectError(r.error), { tone: 'danger', duration: 6000 });
    else toast('Project deleted');
  };

  return (
    <li className={`prow${done ? ' is-done' : ''}${!done && project.due_date < today ? ' is-late' : ''}`}>
      <button type="button" className="prow-main" onClick={() => ps.openProject(project.id)}>
        <span className="prow-icon" aria-hidden="true">
          {done ? <IconCheck width={15} height={15} /> : <IconFlag width={15} height={15} />}
        </span>
        <span className="prow-text">
          <span className="prow-name">{project.name}</span>
          {preview && <span className="prow-desc truncate">{preview}</span>}
        </span>
      </button>

      <div className="prow-due">
        <span className="mono">{formatWeekdayDate(project.due_date)}</span>
        {done ? <span className="due-hint due-hint--done">{project.completed_by_name ? `by ${project.completed_by_name}` : 'done'}</span> : <DeadlineHint project={project} today={today} />}
      </div>

      <div className="prow-people" title={names}>
        <AvatarStack ids={project.assignees} size={28} max={4} />
        <span className="prow-names truncate">{names || 'No one assigned'}</span>
      </div>

      <span className={`pstatus pstatus--${project.status}`}>
        {done && <IconCheck width={12} height={12} />}
        {PROJECT_STATUS_LABELS[project.status]}
      </span>

      <div className="prow-actions">
        <button type="button" className="icon-btn" onClick={toggle} disabled={busy} title={done ? 'Reopen' : 'Mark as done'}>
          {done ? <IconUndo /> : <IconCheck />}
          <span className="sr-only">
            {done ? 'Reopen' : 'Mark as done'}: {project.name}
          </span>
        </button>
        <button type="button" className="icon-btn" onClick={() => ps.editProject(project)} disabled={busy} title="Edit">
          <IconPencil />
          <span className="sr-only">Edit {project.name}</span>
        </button>
        <button type="button" className="icon-btn prow-delete" onClick={remove} disabled={busy} title="Delete">
          <IconTrash />
          <span className="sr-only">Delete {project.name}</span>
        </button>
      </div>
    </li>
  );
}

export function ProjectsPage() {
  const ps = useProjects();
  const today = useToday();
  const [tab, setTab] = useState(null);
  const buckets = useMemo(() => projectBuckets(ps.projects, today), [ps.projects, today]);
  const active = tab ?? 'upcoming';
  const list = buckets[active];

  const onTabKey = (e) => {
    const i = TABS.findIndex(([k]) => k === active);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length][0];
    if (e.key === 'ArrowLeft') next = TABS[(i + TABS.length - 1) % TABS.length][0];
    if (next) {
      e.preventDefault();
      setTab(next);
      requestAnimationFrame(() => document.getElementById(`ptab-${next}`)?.focus());
    }
  };

  return (
    <div className="projects-page">
      <PageHeader title="Projects" />

      <div className="projects-top">
        <p className="projects-intro">
          One-off jobs outside the monthly content. Assigned staff see a project in their calendar on its deadline, and can mark it done.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => ps.newProject()}>
          <IconPlus />
          New project
        </button>
      </div>

      <div className="ptabs" role="tablist" aria-label="Projects">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            id={`ptab-${key}`}
            type="button"
            role="tab"
            className={`ptab ptab--${key}`}
            aria-selected={active === key}
            aria-controls="ptab-panel"
            tabIndex={active === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={onTabKey}
          >
            {label}
            <span className={`ptab-count mono${key === 'overdue' && buckets.overdue.length ? ' is-alert' : ''}`}>{buckets[key].length}</span>
          </button>
        ))}
      </div>

      <div id="ptab-panel" role="tabpanel" aria-labelledby={`ptab-${active}`}>
        {ps.status === 'loading' && (
          <div className="loading-block">
            <Spinner label="Loading projects" /> Loading projects
          </div>
        )}
        {ps.status === 'error' && (
          <div className="notice notice-danger" role="alert">
            <div>
              <p>{ps.error}</p>
              <button type="button" className="link-btn" onClick={() => ps.reload()}>
                Try again
              </button>
            </div>
          </div>
        )}
        {ps.status === 'ready' && list.length === 0 && (
          <div className="projects-empty">
            <span className="projects-empty-icon" aria-hidden="true">
              <IconFlag width={22} height={22} />
            </span>
            <strong>{EMPTY_TEXT[active][0]}</strong>
            <p>{EMPTY_TEXT[active][1]}</p>
            {active === 'upcoming' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => ps.newProject()}>
                <IconPlus /> New project
              </button>
            )}
          </div>
        )}
        {ps.status === 'ready' && list.length > 0 && (
          <>
            <div className="prow-head" aria-hidden="true">
              <span>Project</span>
              <span>Deadline</span>
              <span>Assigned</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="prows">
              {list.map((project) => (
                <ProjectRow key={project.id} project={project} today={today} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
