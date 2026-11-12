// New project / Edit project (Admin only; file 06): a centred dialog with the name,
// a plain-text description, the deadline, and who it's assigned to.
import { useId, useMemo, useState } from 'react';
import { useAppData } from '../data/AppDataProvider.jsx';
import { Avatar } from '../people/Avatar.jsx';
import { IconCheck, IconSearch, IconX } from '../ui/icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../ui/Toast.jsx';
import { projectError, useProjects } from './ProjectsProvider.jsx';
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX, validateProject } from './projectText.js';

/**
 * Assign staff: photo + display name, grouped by tracker ("Behomy: Arum, Ilyas, Anne"),
 * with search. Only active staff can be assigned (not Admin; they must have a tracker).
 * Someone already assigned who has since left stays listed, so they can be removed.
 */
function AssigneePicker({ value, onChange, invalid, describedBy }) {
  const app = useAppData();
  const id = useId();
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const match = (p) => !q || p.display_name.toLocaleLowerCase().includes(q) || (app.rolesById[p.role_id]?.name ?? '').toLocaleLowerCase().includes(q);
    const assignable = app.people.filter((p) => p.is_active && p.role_id && !app.rolesById[p.role_id]?.is_admin);
    const byTracker = app.trackers
      .map((role) => ({
        key: role.id,
        label: role.name,
        people: assignable.filter((p) => p.role_id === role.id && match(p)).sort((a, b) => a.display_name.localeCompare(b.display_name)),
      }))
      .filter((g) => g.people.length);
    const gone = value
      .filter((pid) => !assignable.some((p) => p.id === pid))
      .map((pid) => app.peopleById[pid] ?? { id: pid, display_name: 'Former member' })
      .filter((p) => !q || p.display_name.toLocaleLowerCase().includes(q));
    if (gone.length) byTracker.push({ key: '__gone', label: 'No longer active', people: gone, gone: true });
    return byTracker;
  }, [app.people, app.trackers, app.rolesById, app.peopleById, query, value]);

  const toggle = (pid) => onChange(selected.has(pid) ? value.filter((x) => x !== pid) : [...value, pid]);
  const setGroup = (people, on) => {
    const ids = people.map((p) => p.id);
    onChange(on ? [...new Set([...value, ...ids])] : value.filter((x) => !ids.includes(x)));
  };

  return (
    <div className={`assign${invalid ? ' is-invalid' : ''}`}>
      {value.length > 0 && (
        <ul className="assign-chosen" aria-label="Assigned">
          {value.map((pid) => {
            const name = app.peopleById[pid]?.display_name ?? 'Former member';
            return (
              <li key={pid}>
                <span className="assign-chip">
                  <Avatar id={pid} size={20} />
                  <span className="truncate">{name}</span>
                  <button type="button" className="assign-chip-x" onClick={() => toggle(pid)} title={`Remove ${name}`}>
                    <IconX width={12} height={12} />
                    <span className="sr-only">Remove {name}</span>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="assign-box">
        <label className="assign-search">
          <IconSearch />
          <span className="sr-only">Search staff</span>
          <input type="search" value={query} placeholder="Search by name or tracker" onChange={(e) => setQuery(e.target.value)} aria-controls={`${id}-list`} />
        </label>
        <div id={`${id}-list`} className="assign-list" role="group" aria-label="Staff" aria-describedby={describedBy}>
          {groups.length === 0 && <p className="assign-none">{query ? `No one matches "${query}".` : 'There is no active staff to assign yet.'}</p>}
          {groups.map((g) => {
            const allOn = g.people.every((p) => selected.has(p.id));
            return (
              <fieldset key={g.key} className="assign-group">
                <legend className="assign-group-head">
                  <span>{g.label}</span>
                  {!g.gone && g.people.length > 1 && (
                    <button type="button" className="link-btn assign-all" onClick={() => setGroup(g.people, !allOn)}>
                      {allOn ? 'Clear' : 'Select all'}
                    </button>
                  )}
                </legend>
                <ul>
                  {g.people.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <li key={p.id}>
                        <label className={`assign-row${on ? ' is-on' : ''}`}>
                          <input type="checkbox" checked={on} disabled={g.gone && !on} onChange={() => toggle(p.id)} />
                          <span className="assign-check" aria-hidden="true">
                            {on && <IconCheck width={12} height={12} />}
                          </span>
                          <Avatar id={p.id} size={28} />
                          <span className="assign-name truncate">{p.display_name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProjectDialog({ project = null, draftDate = null, onClose }) {
  const ps = useProjects();
  const toast = useToast();
  const id = useId();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [dueDate, setDueDate] = useState(project?.due_date ?? draftDate ?? '');
  const [assignees, setAssignees] = useState(project?.assignees ?? []);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // the project exists but assigning people failed: saving again only fixes the assignees
  const [createdId, setCreatedId] = useState(null);

  const existing = project ?? (createdId ? ps.byId.get(createdId) : null);
  const editing = Boolean(project);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validateProject({ name, dueDate, assignees });
    setErrors(found);
    if (Object.keys(found).length) {
      // move focus to the first problem
      const first = found.name ? 'name' : found.dueDate ? 'due' : 'assign';
      document.getElementById(`${id}-${first}`)?.focus?.();
      return;
    }
    setBusy(true);
    setError(null);
    const input = { name: name.trim(), description: description.trim(), dueDate, assignees };
    const r = existing ? await ps.update(existing, input) : await ps.create(input);
    setBusy(false);
    if (r.error) {
      if (r.projectId) setCreatedId(r.projectId);
      setError(projectError(r.error));
      return;
    }
    onClose();
    toast(editing ? 'Project saved' : 'Project created');
  };

  const clear = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  return (
    <Modal onClose={onClose} labelledBy={`${id}-title`} className="pd" sheet dismissable={!busy}>
      <form className="pd-form" onSubmit={submit} noValidate>
        <header className="modal-head">
          <h2 id={`${id}-title`} className="modal-title">
            {editing ? 'Edit project' : 'New project'}
          </h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} disabled={busy}>
            <IconX width={18} height={18} />
            <span className="sr-only">Cancel</span>
          </button>
        </header>

        <div className="pd-body">
          <div className="pd-field">
            <div className="pd-label-row">
              <label htmlFor={`${id}-name`}>Project name</label>
              <span className={`pd-count mono${name.length > PROJECT_NAME_MAX - 20 ? ' is-near' : ''}`}>
                {name.length} / {PROJECT_NAME_MAX}
              </span>
            </div>
            <input
              id={`${id}-name`}
              className="input"
              value={name}
              maxLength={PROJECT_NAME_MAX}
              placeholder="e.g. Company profile video shoot"
              data-autofocus
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
              onChange={(e) => {
                setName(e.target.value);
                clear('name');
              }}
            />
            {errors.name && (
              <p className="field-error" id={`${id}-name-error`} role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div className="pd-field">
            <label htmlFor={`${id}-desc`}>Description</label>
            <textarea
              id={`${id}-desc`}
              className="textarea pd-desc"
              rows={5}
              value={description}
              maxLength={PROJECT_DESCRIPTION_MAX}
              placeholder="What needs to be done? Links you paste become clickable."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pd-field pd-field--date">
            <label htmlFor={`${id}-due`}>Deadline</label>
            <input
              id={`${id}-due`}
              type="date"
              className="input"
              value={dueDate}
              min="2000-01-01"
              max="2100-12-31"
              aria-invalid={errors.dueDate ? 'true' : undefined}
              aria-describedby={errors.dueDate ? `${id}-due-error` : undefined}
              onChange={(e) => {
                setDueDate(e.target.value);
                clear('dueDate');
              }}
            />
            {errors.dueDate && (
              <p className="field-error" id={`${id}-due-error`} role="alert">
                {errors.dueDate}
              </p>
            )}
          </div>

          <div className="pd-field">
            <div className="pd-label-row">
              <span id={`${id}-assign`} tabIndex={-1} className="pd-label">
                Assign staff
              </span>
              <span className="pd-count">{assignees.length ? `${assignees.length} selected` : 'At least one person'}</span>
            </div>
            <AssigneePicker
              value={assignees}
              invalid={Boolean(errors.assignees)}
              describedBy={errors.assignees ? `${id}-assign-error` : undefined}
              onChange={(next) => {
                setAssignees(next);
                clear('assignees');
              }}
            />
            {errors.assignees && (
              <p className="field-error" id={`${id}-assign-error`} role="alert">
                {errors.assignees}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="pd-error" role="alert">
            <p className="field-error">{error}</p>
            {createdId && <p className="dim">The project itself was saved. Fix who it's assigned to, then save again.</p>}
          </div>
        )}

        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : createdId ? 'Save assignees' : 'Create project'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
