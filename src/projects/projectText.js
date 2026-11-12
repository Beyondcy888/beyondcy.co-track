// Words for projects (update v3, file 06). Pure functions; tested in projectText.test.js.
import { linkifyLine } from '../lib/links.js';
import { formatDate, formatDayMonth } from '../lib/time.js';

export const PROJECT_NAME_MAX = 200;
export const PROJECT_DESCRIPTION_MAX = 10000;

export const PROJECT_STATUS_LABELS = { open: 'Open', done: 'Done' };

/**
 * A plain-text description → lines of text and link parts. Line breaks are kept (empty
 * lines too); only http(s) links become clickable. Never rendered as HTML.
 */
export function descriptionLines(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => linkifyLine(line));
}

/** The first non-empty line, for the list's one-line preview. */
export function descriptionPreview(text) {
  if (!text) return '';
  return (
    String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  );
}

/** What the dialog checks before saving → { name?, dueDate?, assignees? } messages. */
export function validateProject({ name, dueDate, assignees }) {
  const errors = {};
  const n = (name ?? '').trim();
  if (!n) errors.name = 'Give the project a name.';
  else if (n.length > PROJECT_NAME_MAX) errors.name = `Keep the name under ${PROJECT_NAME_MAX} characters.`;
  if (!dueDate) errors.dueDate = 'Choose a deadline.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < '2000-01-01' || dueDate > '2100-12-31') errors.dueDate = 'That date is not valid.';
  if (!assignees?.length) errors.assignees = 'Assign at least one person.';
  return errors;
}

const FIELD_WORDS = { name: 'the name', description: 'the description', due_date: 'the deadline' };

function joinWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * activity_log rows with role_id 'projects' → { actor, text, detail? }.
 *   project_created · project_updated · project_completed · project_reopened · project_deleted
 */
export function describeProjectActivity(entry) {
  const actor = entry.actor_name || 'Someone';
  const changes = entry.changes || {};
  switch (entry.action) {
    case 'project_created':
      return { actor, text: 'created this project', detail: changes.due_date ? `Deadline ${formatDate(String(changes.due_date).slice(0, 10))}` : null };
    case 'project_completed':
      return { actor, text: 'marked it as done', detail: null };
    case 'project_reopened':
      return { actor, text: 'reopened it', detail: null };
    case 'project_deleted':
      return { actor, text: 'deleted this project', detail: null };
    case 'project_updated': {
      const fields = Object.keys(FIELD_WORDS).filter((f) => changes[f]);
      const text = fields.length ? `changed ${joinWords(fields.map((f) => FIELD_WORDS[f]))}` : 'updated this project';
      const due = changes.due_date;
      const detail = due?.old && due?.new ? `${formatDayMonth(String(due.old).slice(0, 10))} → ${formatDayMonth(String(due.new).slice(0, 10))}` : null;
      return { actor, text, detail };
    }
    default:
      return { actor, text: String(entry.action || 'made a change'), detail: null };
  }
}
