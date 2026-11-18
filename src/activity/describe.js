// Activity Logs (update v4, file 05): one activity_log row → who did it, what in plain words,
// and the details to expand. Pure functions (tested in describe.test.js).
//
//   who:   { kind: 'person', id, name } · { kind: 'supabase' } (changed directly in Supabase)
//          · { kind: 'timer' } (maintenance switched off by its timer, file 10 §5)
//   parts: [{ text } | { strong, itemId?, roleId? }] — a sentence; `strong` is bolded and,
//          for content, can open the item's drawer
//   quote: a revision note, a comment, a target note
//   details: [{ label, old?, new?, value?, kind?: 'text' | 'links' | 'pictures' }]
import { FIELD_LABELS, STATUS_LABELS, TYPE_LABELS, joinWords } from '../lib/fields.js';
import { formatValue, itemChangeText, preview } from '../lib/history.js';
import { formatDate } from '../lib/time.js';

const T = (text) => ({ text });
const S = (strong, extra = {}) => ({ strong, ...extra });
const untitled = (s) => (s && String(s).trim()) || 'Untitled';
const SITE = { dashboard: 'Dashboard', tracker: 'Tracker' };

/** 30 → '30 min', 60 → '1 hour', 120 → '2 hours' */
export function minutesText(n) {
  const m = Number(n) || 0;
  if (m < 60) return `${m} min`;
  const h = m / 60;
  return Number.isInteger(h) ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${m} min`;
}

/** The filter categories (chips) and what each sends to search_activity. */
export function categoryOf(entry) {
  return entry.category ?? 'other';
}

/** Which "type" an entry is, for the optional Created / Edited / Deleted filter. */
export function kindOf(action = '') {
  if (/_(created|set|added|started)$/.test(action)) return 'created';
  if (/_(deleted|removed)$/.test(action)) return 'deleted';
  return 'edited';
}

export function whoOf(entry) {
  if (entry.action === 'maintenance_ended' && entry.changes?.reason === 'timer finished') return { kind: 'timer' };
  if (entry.source === 'supabase') return { kind: 'supabase' };
  return { kind: 'person', id: entry.actor_id ?? null, name: entry.actor_name || 'Someone' };
}

const textOrDash = (v) => (v == null || v === '' ? '—' : String(v));

function itemDetails(changes, ctx) {
  return itemChangeText(changes, ctx).details.map((d) => ({
    label: d.label,
    old: d.field === 'links' || d.field === 'note_images' ? d.oldRaw ?? [] : d.old,
    new: d.field === 'links' || d.field === 'note_images' ? d.newRaw ?? [] : d.new,
    kind: d.field === 'links' ? 'links' : d.field === 'note_images' ? 'pictures' : 'text',
  }));
}

function deletedItemPreview(row, ctx) {
  if (!row) return [];
  const rows = [
    ['Content', untitled(row.content)],
    ['Brand', ctx.brandName?.(row.brand_id) ?? row.brand_id],
    ['Type', row.type ? TYPE_LABELS[row.type] : '—'],
    ['Status', STATUS_LABELS[row.status] ?? row.status ?? '—'],
    ['Publish date', row.publish_date ? formatDate(String(row.publish_date).slice(0, 10)) : '—'],
    ['PIC', row.pic_id ? ctx.personName?.(row.pic_id) ?? 'Former member' : '—'],
    ['Brief', textOrDash(row.brief)],
    ['Caption', textOrDash(row.caption)],
    ['Notes', textOrDash(row.notes)],
  ].map(([label, value]) => ({ label, value, kind: 'text' }));
  const links = row.links?.length ? row.links : row.instagram_url ? [row.instagram_url] : [];
  if (links.length) rows.push({ label: 'Links', value: links, kind: 'links' });
  if (row.note_images?.length) rows.push({ label: 'Notes pictures', value: `${row.note_images.length} (deleted with the content)`, kind: 'text' });
  return rows;
}

function personDetails(changes, ctx) {
  return ['display_name', 'role_id', 'is_active', 'email']
    .filter((f) => changes[f])
    .map((f) => ({
      label: { display_name: 'Display name', role_id: 'Role', is_active: 'Active', email: 'Email' }[f],
      old: f === 'role_id' ? (changes[f].old ? ctx.roleName?.(changes[f].old) ?? changes[f].old : 'No role') : formatValue(f, changes[f].old, ctx),
      new: f === 'role_id' ? (changes[f].new ? ctx.roleName?.(changes[f].new) ?? changes[f].new : 'No role') : formatValue(f, changes[f].new, ctx),
      kind: 'text',
    }));
}

const projectLabel = { name: 'Name', description: 'Description', due_date: 'Deadline', status: 'Status' };
function projectDetails(changes, ctx) {
  return Object.keys(changes)
    .filter((f) => projectLabel[f])
    .map((f) => ({
      label: projectLabel[f],
      old: f === 'status' ? textOrDash(changes[f].old === 'done' ? 'Done' : changes[f].old === 'open' ? 'Open' : changes[f].old) : formatValue(f, changes[f].old, ctx),
      new: f === 'status' ? textOrDash(changes[f].new === 'done' ? 'Done' : changes[f].new === 'open' ? 'Open' : changes[f].new) : formatValue(f, changes[f].new, ctx),
      kind: 'text',
    }));
}

/** "7 Reels + 12 Feed" */
const split = (reels, feed) => `${reels ?? 0} Reels + ${feed ?? 0} Feed`;

/**
 * One log row → { who, parts, quote, details, brandId, itemId, roleId }.
 * ctx: { brandName(id), personName(id), roleName(id), deletedItems: Set<itemId> }
 */
export function describeLogEntry(entry, ctx = {}) {
  const who = whoOf(entry);
  const c = entry.changes || {};
  const title = untitled(entry.summary);
  const canOpen = Boolean(entry.item_id) && !ctx.deletedItems?.has(entry.item_id);
  const item = S(title, canOpen ? { itemId: entry.item_id, roleId: entry.role_id } : {});
  const base = { who, quote: null, details: [], brandId: entry.brand_id ?? null };

  switch (entry.action) {
    // ---------------------------------------------------------------- content
    case 'item_created':
      return { ...base, parts: [T('created '), item] };
    case 'item_deleted':
      return { ...base, parts: [T('deleted '), S(title)], details: deletedItemPreview(c.deleted_row, ctx), deleted: true };
    case 'item_updated': {
      const { text, step, quote } = itemChangeText(c, ctx);
      const details = itemDetails(c, ctx);
      if (step === 'revision') return { ...base, parts: [T('requested a revision on '), item], quote, details };
      if (step === 'marked_done') return { ...base, parts: [T('marked '), item, T(' as Done')], details };
      if (step === 'approved') return { ...base, parts: [T('marked '), item, T(' as Uploaded')], details };
      if (step === 'moved_back') return { ...base, parts: [T('moved '), item, T(' back to Done')], details };
      const linksAdded = c.links && !(c.links.old?.length) && c.links.new?.length;
      if (linksAdded && Object.keys(c).every((f) => ['links', 'self_posted', 'review_state', 'status'].includes(f))) {
        return {
          ...base,
          parts: [T('added links to '), item, T(c.self_posted?.new ? ' and posted it themselves' : ' · waiting for review')],
          details,
        };
      }
      // "changed Caption · status → Planned" → "edited Caption on X · status → Planned"
      const [head, tail] = text.split(' · ');
      const verb = head.replace(/\bchanged (?=[A-Z])/g, 'edited ');
      return { ...base, parts: [T(`${verb} on `), item, ...(tail ? [T(` · ${tail}`)] : [])], details };
    }
    case 'comment_added':
      return { ...base, parts: [T('commented on '), item], quote: preview(c.body, 300) };
    case 'comment_deleted':
      return { ...base, parts: [T('deleted a comment on '), item], quote: preview(c.body, 300) };

    // ---------------------------------------------------------------- targets
    case 'target_set':
    case 'target_removed': {
      const person = c.profile_id ? ctx.personName?.(c.profile_id) ?? 'Former member' : 'someone';
      const brand = ctx.brandName?.(typeof c.brand_id === 'string' ? c.brand_id : null) ?? 'a brand';
      // the database writes 'November 2026' → '(Nov 2026)'
      const period = entry.summary ? ` (${String(entry.summary).replace(/^([A-Za-z]{3})[A-Za-z]* (\d{4})$/, '$1 $2')})` : '';
      const reels = c.reels ?? {};
      const feed = c.feed ?? {};
      const note = c.note ?? {};
      const details = [
        ...(reels.old !== reels.new ? [{ label: 'Reels', old: textOrDash(reels.old), new: textOrDash(reels.new), kind: 'text' }] : []),
        ...(feed.old !== feed.new ? [{ label: 'Feed', old: textOrDash(feed.old), new: textOrDash(feed.new), kind: 'text' }] : []),
        ...((note.old ?? null) !== (note.new ?? null) ? [{ label: 'Status & notes', old: textOrDash(note.old), new: textOrDash(note.new), kind: 'text' }] : []),
      ];
      if (entry.action === 'target_removed') return { ...base, parts: [T('removed '), S(`${person}'s ${brand} target`), T(period)], details };
      const onlyNote = reels.old === reels.new && feed.old === feed.new && (note.old ?? null) !== (note.new ?? null);
      if (onlyNote) return { ...base, parts: [T('updated the note on '), S(`${person}'s ${brand} target`), T(period)], quote: note.new ? preview(note.new, 300) : null, details };
      const verb = reels.old == null && feed.old == null ? 'set' : 'changed';
      return { ...base, parts: [T(`${verb} `), S(`${person}'s ${brand} target`), T(` to ${split(reels.new, feed.new)}${period}`)], details };
    }

    // ---------------------------------------------------------------- projects
    case 'project_created':
      return {
        ...base,
        parts: [T('created project '), S(title)],
        details: c.due_date ? [{ label: 'Deadline', value: formatDate(String(c.due_date).slice(0, 10)), kind: 'text' }] : [],
      };
    case 'project_updated':
      return { ...base, parts: [T('edited project '), S(title)], details: projectDetails(c, ctx) };
    case 'project_completed':
      return { ...base, parts: [T('marked project '), S(title), T(' as done')], details: projectDetails(c, ctx) };
    case 'project_reopened':
      return { ...base, parts: [T('reopened project '), S(title)], details: projectDetails(c, ctx) };
    case 'project_deleted':
      return { ...base, parts: [T('deleted project '), S(title)], deleted: true, details: projectDetails({ name: { old: c.deleted_row?.name, new: null }, due_date: { old: c.deleted_row?.due_date, new: null } }, ctx).map((d) => ({ label: d.label, value: d.old, kind: 'text' })) };

    // ---------------------------------------------------------------- people
    case 'person_created':
      return { ...base, parts: [T('new account: '), S(title)], details: c.email ? [{ label: 'Email', value: c.email, kind: 'text' }] : [] };
    case 'person_deleted':
      return { ...base, parts: [T('deleted the account of '), S(title)], deleted: true };
    case 'person_updated': {
      const name = title;
      const phrases = [];
      if (c.role_id) {
        const from = c.role_id.old ? ctx.roleName?.(c.role_id.old) ?? c.role_id.old : null;
        const to = c.role_id.new ? ctx.roleName?.(c.role_id.new) ?? c.role_id.new : null;
        if (from && to) phrases.push(`changed ${name}'s role from ${from} to ${to}`);
        else if (to) phrases.push(`gave ${name} the ${to} role`);
        else phrases.push(`removed ${name}'s role`);
      }
      if (c.display_name) phrases.push(`renamed ${textOrDash(c.display_name.old)} to ${textOrDash(c.display_name.new)}`);
      if (c.is_active) phrases.push(c.is_active.new ? `reactivated ${name}` : `deactivated ${name}`);
      if (c.email) phrases.push(`changed ${name}'s email`);
      return { ...base, parts: [T(phrases.length ? joinWords(phrases) : `updated ${name}`)], details: personDetails(c, ctx) };
    }

    // ---------------------------------------------------------------- maintenance (file 10 §5)
    case 'maintenance_started': {
      const site = SITE[c.site] ?? entry.summary ?? 'site';
      return {
        ...base,
        parts: [T(`turned on ${site} maintenance for ${minutesText(c.minutes)}`)],
        details: c.ends_at ? [{ label: 'Until', value: wibTime(c.ends_at), kind: 'text' }] : [],
      };
    }
    case 'maintenance_extended': {
      const site = SITE[c.site] ?? entry.summary ?? 'site';
      return {
        ...base,
        parts: [T(`added ${minutesText(c.added_minutes)} to ${site} maintenance`)],
        details: c.ends_at ? [{ label: 'Now until', value: wibTime(c.ends_at), kind: 'text' }] : [],
      };
    }
    case 'maintenance_ended': {
      const site = SITE[c.site] ?? entry.summary ?? 'site';
      if (c.reason === 'timer finished') return { ...base, parts: [S(`${site} maintenance ended`), T(': timer finished')] };
      return { ...base, parts: [T(`ended ${site} maintenance early`)] };
    }

    default:
      return { ...base, parts: [T(String(entry.action || 'made a change').replace(/_/g, ' '))] };
  }
}

/** '14:30 WIB' (with the date when it isn't today's). */
export function wibTime(ts) {
  const d = new Date(ts);
  const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', ...opts }).format(d);
  return `${fmt({ day: 'numeric', month: 'short' })}, ${fmt({ hour: '2-digit', minute: '2-digit', hour12: false })} WIB`;
}

export { FIELD_LABELS };
