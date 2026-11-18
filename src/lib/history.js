// activity_log rows → plain sentences for the History tab (02 §5, 04 "Activity log format",
// update v4 files 01 and 05). Rendered with the stored actor_name, so names stay right after
// people move roles. The Activity Logs page builds on itemChangeText() and formatValue().
import { FIELD_LABELS, STATUS_LABELS, TYPE_LABELS, joinWords } from './fields.js';
import { shortLink } from './links.js';
import { formatDate } from './time.js';

const PREVIEW = 140;
const REVIEW_LABELS = { done: 'Done', revision: 'Revision', approved: 'Approved by Admin' };

function isEmpty(value) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function preview(text, max = PREVIEW) {
  if (text == null) return '';
  const s = String(text);
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A field value as people read it ('feed' → 'Feed', dates → '5 Nov 2026', …). */
export function formatValue(field, value, ctx = {}) {
  if (isEmpty(value)) return '—';
  switch (field) {
    case 'type':
      return TYPE_LABELS[value] ?? String(value);
    case 'status':
      return STATUS_LABELS[value] ?? String(value);
    case 'review_state':
      return REVIEW_LABELS[value] ?? String(value);
    case 'brand_id':
      return ctx.brandName?.(value) ?? String(value);
    case 'publish_date':
    case 'due_date':
      return formatDate(String(value).slice(0, 10));
    case 'content_pillars':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'links':
      return Array.isArray(value) ? value.map((l) => shortLink(l)).join(' · ') : String(value);
    case 'note_images':
      return Array.isArray(value) ? plural(value.length, 'picture') : String(value);
    case 'self_posted':
      return value ? 'Yes' : 'No';
    case 'instagram_url':
      return String(value);
    case 'pic_id':
    case 'profile_id':
      return ctx.personName?.(value) ?? 'Former member';
    case 'role_id':
      return ctx.roleName?.(value) ?? String(value);
    case 'is_active':
      return value ? 'Active' : 'Inactive';
    default:
      return preview(value);
  }
}

/**
 * The review step an update made, read from the transition (never from review_state alone:
 * rows migrated in v4 have links, self_posted true and review_state NULL, so their first edit
 * logs null → done without anyone marking anything).
 */
export function reviewStep(changes) {
  const rs = changes?.review_state;
  if (!rs) return null;
  const from = rs.old ?? null;
  const to = rs.new ?? null;
  if (from === 'done' && to === 'revision') return 'revision';
  if (from === 'revision' && to === 'done') return 'marked_done';
  if (from === 'done' && to === 'approved') return 'approved';
  if (from === 'approved' && to === 'done') return 'moved_back';
  return null;
}

const REVIEW_PHRASES = {
  revision: 'requested a revision',
  marked_done: 'marked as Done',
  approved: 'marked as Uploaded',
  moved_back: 'moved it back to Done',
};

function fieldPhrase(field, change, ctx) {
  const label = FIELD_LABELS[field] ?? field;
  const wasEmpty = isEmpty(change?.old);
  const nowEmpty = isEmpty(change?.new);
  switch (field) {
    case 'links':
      if (wasEmpty) return 'added links';
      if (nowEmpty) return 'removed the links';
      return 'changed the links';
    case 'self_posted':
      return change?.new ? 'posted it themselves' : 'unticked "I posted this myself"';
    case 'note_images': {
      const before = Array.isArray(change?.old) ? change.old.length : 0;
      const after = Array.isArray(change?.new) ? change.new.length : 0;
      if (after > before) return `added ${after - before === 1 ? 'a picture' : `${after - before} pictures`} to Notes`;
      if (after < before) return `removed ${before - after === 1 ? 'a picture' : `${before - after} pictures`} from Notes`;
      return 'changed the Notes pictures';
    }
    case 'revision_note':
      return nowEmpty ? 'cleared the revision note' : 'changed the revision note';
    case 'instagram_url': // old entries (before v4)
      if (wasEmpty) return 'added the Instagram link';
      if (nowEmpty) return 'removed the Instagram link';
      return 'changed the Instagram link';
    case 'brand_id':
      return `moved it to ${formatValue('brand_id', change?.new, ctx)}`;
    case 'pic_id':
      if (nowEmpty) return 'removed the PIC';
      return `${wasEmpty ? 'set' : 'changed'} the PIC to ${formatValue('pic_id', change?.new, ctx)}`;
    default:
      if (wasEmpty) return field === 'type' || field === 'publish_date' ? `set ${label}` : `added ${label}`;
      if (nowEmpty) return `cleared ${label}`;
      return `changed ${label}`;
  }
}

/**
 * An item_updated entry's changes → { text, quote, step, details }.
 *   text:    'added links and posted it themselves · status → Uploaded', 'requested a revision', …
 *   quote:   the revision note when a revision was requested
 *   step:    the review step (see reviewStep), or null
 *   details: [{ field, label, old, new, oldRaw, newRaw }] for "Show changes"
 */
export function itemChangeText(changes = {}, ctx = {}) {
  const step = reviewStep(changes);
  // review_state itself is never phrased: the step (or the links change) says it
  const hide = new Set(['status', 'review_state']);
  if (step === 'revision') hide.add('revision_note'); // part of the request, shown as the quote
  const fields = Object.keys(changes).filter((f) => !hide.has(f));
  const phrases = [];
  if (step) phrases.push(REVIEW_PHRASES[step]);
  for (const f of fields) phrases.push(fieldPhrase(f, changes[f], ctx));

  const status = changes.status ? STATUS_LABELS[changes.status.new] ?? changes.status.new : null;
  let text;
  if (phrases.length) {
    text = joinWords(phrases);
    // a review step already says where it went; otherwise show the new status
    if (status && !step) text += ` · status → ${status}`;
  } else {
    text = status ? `changed the status to ${status}` : 'updated this item';
  }

  const quote = step === 'revision' ? preview(changes.revision_note?.new, 300) || null : null;
  const details = Object.keys(changes)
    .filter((f) => !(f === 'review_state' && (changes[f]?.old == null || changes[f]?.new == null)))
    .map((f) => ({
      field: f,
      label: FIELD_LABELS[f] ?? f,
      old: formatValue(f, changes[f]?.old, ctx),
      new: formatValue(f, changes[f]?.new, ctx),
      oldRaw: changes[f]?.old ?? null,
      newRaw: changes[f]?.new ?? null,
    }));
  return { text, quote, step, details };
}

/**
 * → { actor, text, details: [{ field, label, old, new }], quote? }
 * e.g. { actor: 'Dika', text: 'added links · status → Done' }
 */
export function describeActivity(entry, ctx = {}) {
  const actor = entry.actor_name || (entry.source === 'supabase' ? 'Supabase' : 'Someone');
  const changes = entry.changes || {};

  switch (entry.action) {
    case 'item_created':
      return { actor, text: 'created this item', details: [] };
    case 'item_deleted':
      return { actor, text: 'deleted this item', details: [] };
    case 'comment_added':
      return { actor, text: 'commented', details: [], quote: preview(changes.body, 200) };
    case 'comment_deleted':
      return { actor, text: 'deleted a comment', details: [], quote: preview(changes.body, 200) };
    case 'item_updated': {
      const { text, quote, details } = itemChangeText(changes, ctx);
      return { actor, text: quote ? `${text}:` : text, details, quote };
    }
    default:
      return { actor, text: String(entry.action || 'made a change'), details: [] };
  }
}
