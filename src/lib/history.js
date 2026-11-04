// activity_log rows → plain sentences for the History tab (02 §5, 04 "Activity log format").
// Rendered with the stored actor_name, so names stay right after people move roles.
import { FIELD_LABELS, STATUS_LABELS, TYPE_LABELS, joinWords } from './fields.js';
import { formatDate } from './time.js';

const PREVIEW = 140;

function isEmpty(value) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function preview(text, max = PREVIEW) {
  if (text == null) return '';
  const s = String(text);
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/** A field value as people read it ('feed' → 'Feed', dates → '5 Nov 2026', …). */
export function formatValue(field, value, ctx = {}) {
  if (isEmpty(value)) return '—';
  switch (field) {
    case 'type':
      return TYPE_LABELS[value] ?? String(value);
    case 'status':
      return STATUS_LABELS[value] ?? String(value);
    case 'brand_id':
      return ctx.brandName?.(value) ?? String(value);
    case 'publish_date':
      return formatDate(String(value).slice(0, 10));
    case 'content_pillars':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'instagram_url':
      return String(value);
    case 'pic_id':
      return ctx.personName?.(value) ?? 'Former member';
    default:
      return preview(value);
  }
}

function phrase(field, change, ctx) {
  const label = FIELD_LABELS[field] ?? field;
  const wasEmpty = isEmpty(change?.old);
  const nowEmpty = isEmpty(change?.new);
  if (field === 'instagram_url') {
    if (wasEmpty) return 'added the Instagram link';
    if (nowEmpty) return 'removed the Instagram link';
    return 'changed the Instagram link';
  }
  if (field === 'brand_id') return `moved it to ${formatValue('brand_id', change?.new, ctx)}`;
  if (field === 'pic_id') {
    if (nowEmpty) return 'removed the PIC';
    return `${wasEmpty ? 'set' : 'changed'} the PIC to ${formatValue('pic_id', change?.new, ctx)}`;
  }
  if (wasEmpty) return field === 'type' || field === 'publish_date' ? `set ${label}` : `added ${label}`;
  if (nowEmpty) return `cleared ${label}`;
  return `changed ${label}`;
}

/**
 * → { actor, text, details: [{ field, label, old, new }], quote? }
 * e.g. { actor: 'Dika', text: 'added the Instagram link · status → Uploaded' }
 */
export function describeActivity(entry, ctx = {}) {
  const actor = entry.actor_name || 'Someone';
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
      const fields = Object.keys(changes).filter((f) => f !== 'status');
      const status = changes.status ? STATUS_LABELS[changes.status.new] ?? changes.status.new : null;
      let text;
      if (fields.length) {
        text = joinWords(fields.map((f) => phrase(f, changes[f], ctx)));
        if (status) text += ` · status → ${status}`;
      } else {
        text = status ? `changed the status to ${status}` : 'updated this item';
      }
      const details = Object.keys(changes).map((f) => ({
        field: f,
        label: FIELD_LABELS[f] ?? f,
        old: formatValue(f, changes[f]?.old, ctx),
        new: formatValue(f, changes[f]?.new, ctx),
      }));
      return { actor, text, details };
    }
    default:
      return { actor, text: String(entry.action || 'made a change'), details: [] };
  }
}
