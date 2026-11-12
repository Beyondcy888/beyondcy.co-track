// The project popup (file 06): a centred modal, NOT the right-side drawer used for content,
// so nobody mistakes a project for a post. Assigned staff and Admin can mark it done;
// only Admin can edit or delete.
import { useEffect, useId, useState } from 'react';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useToday } from '../data/useNow.js';
import { dateOfTimestampWIB, formatDayMonth, formatWeekdayDate } from '../lib/time.js';
import { deadlineHint } from '../lib/week.js';
import { Avatar } from '../people/Avatar.jsx';
import { RelativeTime, Spinner } from '../ui/bits.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { IconCheck, IconCheckCircle, IconClock, IconFlag, IconHistory, IconPencil, IconTrash, IconUndo, IconX } from '../ui/icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../ui/Toast.jsx';
import { projectError, useProjects } from './ProjectsProvider.jsx';
import { describeProjectActivity, descriptionLines, PROJECT_STATUS_LABELS } from './projectText.js';

/** Plain text with clickable links; line breaks kept. */
export function ProjectDescription({ text }) {
  const lines = descriptionLines(text);
  if (!lines.length) return <p className="pp-desc pp-desc--none">No description.</p>;
  return (
    <div className="pp-desc">
      {lines.map((parts, i) => (
        <p key={i} className={parts.length ? '' : 'pp-desc-gap'}>
          {parts.map((p, j) =>
            p.type === 'link' ? (
              <a key={j} href={p.href} target="_blank" rel="noopener noreferrer">
                {p.value}
              </a>
            ) : (
              <span key={j}>{p.value}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/** "in 3 days" / "today" / "overdue by 2 days", with its tone. */
export function DeadlineHint({ project, today, popup = false }) {
  if (project.status === 'done') return null;
  const hint = deadlineHint(project.due_date, today, { popup });
  const tone = project.due_date < today ? 'late' : project.due_date === today ? 'today' : 'soon';
  return <span className={`due-hint due-hint--${tone}`}>{hint}</span>;
}

function History({ projectId, stamp }) {
  const { api } = useProjects();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.listProjectHistory(projectId).then((r) => {
      if (!alive) return;
      if (r.error) setError(projectError(r.error));
      else setEntries(r.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [api, projectId, stamp]);

  if (error) return <p className="field-error">{error}</p>;
  if (!entries) {
    return (
      <p className="pp-history-loading">
        <Spinner label="Loading history" /> Loading history
      </p>
    );
  }
  if (!entries.length) return <p className="dim">No history yet.</p>;
  return (
    <ol className="pp-history">
      {entries.map((entry) => {
        const d = describeProjectActivity(entry);
        return (
          <li key={entry.id}>
            <Avatar id={entry.actor_id} name={entry.actor_name} size={20} />
            <span>
              <strong>{d.actor}</strong> {d.text}
              {d.detail && <span className="dim"> · {d.detail}</span>}
              <span className="dim">
                {' · '}
                <RelativeTime value={entry.created_at} />
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProjectPopup({ projectId, onClose }) {
  const ps = useProjects();
  const app = useAppData();
  const today = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const project = ps.byId.get(projectId);

  if (!project) {
    return (
      <Modal onClose={onClose} labelledBy={titleId} className="pp" sheet>
        <div className="pp-gone">
          <h2 id={titleId} className="modal-title">
            Not available
          </h2>
          <p className="dim">This project is no longer available. It may have been deleted, or you are no longer assigned to it.</p>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-autofocus>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  const done = project.status === 'done';
  const assigned = project.assignees.includes(ps.me);
  const canToggle = ps.isAdmin || assigned;
  const late = !done && project.due_date < today;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const r = await ps.setProjectStatus(project.id, done ? 'open' : 'done');
    setBusy(false);
    if (r.error) setError(projectError(r.error));
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
    if (r.error) {
      setError(projectError(r.error));
      return;
    }
    onClose();
    toast('Project deleted');
  };

  return (
    <Modal onClose={onClose} labelledBy={titleId} className={`pp${done ? ' is-done' : ''}`} sheet>
      <header className="pp-head">
        <div className="pp-top">
          <span className="pp-kind">
            <IconFlag width={14} height={14} /> Project
          </span>
          <span className={`pstatus pstatus--${project.status}`}>
            {done && <IconCheck width={12} height={12} />}
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <button type="button" className="icon-btn modal-close" onClick={onClose}>
            <IconX width={18} height={18} />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <h2 id={titleId} className="pp-title">
          {project.name}
        </h2>

        <dl className="pp-meta">
          <div className={`pp-meta-item${late ? ' is-late' : ''}`}>
            <dt>
              <IconClock width={14} height={14} /> Deadline
            </dt>
            <dd>
              <span className="mono">
                {formatWeekdayDate(project.due_date)} {project.due_date.slice(0, 4)}
              </span>
              <DeadlineHint project={project} today={today} popup />
            </dd>
          </div>
          {done && (
            <div className="pp-meta-item is-finished">
              <dt>
                <IconCheckCircle width={14} height={14} /> Finished
              </dt>
              <dd>
                Done by {project.completed_by_name ?? 'someone'}
                {project.completed_at && <span className="dim"> · {formatDayMonth(dateOfTimestampWIB(project.completed_at))}</span>}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <div className="pp-body">
        <section aria-label="Description">
          <h3 className="pp-label">Description</h3>
          <ProjectDescription text={project.description} />
        </section>

        <section aria-label="Assigned">
          <h3 className="pp-label">
            Assigned <span className="mono dim">{project.assignees.length}</span>
          </h3>
          {project.assignees.length ? (
            <ul className="pp-people">
              {project.assignees.map((id) => {
                const person = app.peopleById[id];
                return (
                  <li key={id} className="pp-person">
                    <Avatar id={id} size={40} />
                    <span className="pp-person-text">
                      <span className="pp-person-name">
                        {person?.display_name ?? 'Former member'}
                        {id === ps.me && <span className="badge pp-you">You</span>}
                      </span>
                      <span className="pp-person-role">{person?.role_name ?? (person ? 'No tracker' : '')}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="dim">No one is assigned yet.</p>
          )}
        </section>

        <p className="pp-created">
          Created by {project.created_by_name ?? 'someone'}
          {project.created_at && ` · ${formatDayMonth(dateOfTimestampWIB(project.created_at))}`}
        </p>

        {ps.isAdmin && (
          <section className="pp-history-wrap">
            <button type="button" className="link-btn pp-history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
              <IconHistory width={14} height={14} /> {showHistory ? 'Hide history' : 'History'}
            </button>
            {showHistory && <History projectId={project.id} stamp={project.updated_at} />}
          </section>
        )}
      </div>

      {error && (
        <p className="field-error pp-error" role="alert">
          {error}
        </p>
      )}

      <footer className="pp-foot">
        {ps.isAdmin && (
          <div className="pp-admin">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ps.editProject(project)} disabled={busy}>
              <IconPencil width={14} height={14} /> Edit
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>
              <IconTrash width={14} height={14} /> Delete
            </button>
          </div>
        )}
        {canToggle ? (
          <button type="button" className={`btn ${done ? 'btn-secondary' : 'btn-primary'} pp-toggle`} onClick={toggle} disabled={busy} data-autofocus>
            {done ? <IconUndo width={15} height={15} /> : <IconCheck width={15} height={15} />}
            {busy ? 'Saving…' : done ? 'Reopen' : 'Mark as done'}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary pp-toggle" onClick={onClose} data-autofocus>
            Close
          </button>
        )}
      </footer>
    </Modal>
  );
}
