// "This week", deadlines and the status board (update v3, files 05 and 06).
// Pure functions only: no React, no Supabase. Tested in week.test.js.
//
// Rules (the owner's, v3):
//   - a week is Monday–Sunday in WIB; the reminder always covers exactly the current week,
//     even across a month boundary
//   - the reminder lists only Not started and Planned content (never Uploaded), plus open
//     projects due this week; anything still open from before this week is "overdue"
//   - the status board is display only: three columns by status, sorted by publish date
import { addDays, dayDiff, formatDayMonth, weekdayIndex, WEEKDAYS_SHORT } from './time.js';

const STATUS_RANK = { not_started: 0, planned: 1, uploaded: 2 };

/** Monday–Sunday of the week that contains `today` ('YYYY-MM-DD'). */
export function weekRange(today) {
  const start = addDays(today, -weekdayIndex(today));
  return { start, end: addDays(start, 6) };
}

export function isInWeek(isoDate, week) {
  return typeof isoDate === 'string' && isoDate >= week.start && isoDate <= week.end;
}

/** '9–15 Nov', or '30 Nov – 6 Dec' when the week crosses a month. */
export function weekLabel(week) {
  if (week.start.slice(0, 7) === week.end.slice(0, 7)) return `${Number(week.start.slice(8))}–${formatDayMonth(week.end)}`;
  return `${formatDayMonth(week.start)} – ${formatDayMonth(week.end)}`;
}

/** 'Wed, 4 Nov' (toasts after a drag). */
export function formatDropDate(isoDate) {
  if (!isoDate) return '';
  return `${WEEKDAYS_SHORT[weekdayIndex(isoDate)]}, ${formatDayMonth(isoDate)}`;
}

/** { weekday: 'Wed', day: 11 } for the reminder's small date block. */
export function dayParts(isoDate) {
  return { weekday: WEEKDAYS_SHORT[weekdayIndex(isoDate)], day: Number(isoDate.slice(8)) };
}

/** A title cut for a toast: 'Deep Clean E…' */
export function shortTitle(text, max = 18) {
  const s = (text ?? '').trim() || 'Untitled';
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * How far away a deadline is, in words.
 *   list:  'today' · 'tomorrow' · 'in 3 days' · '1 day overdue' · '2 days overdue'
 *   popup: the same, but 'overdue by 2 days'
 */
export function deadlineHint(due, today, { popup = false } = {}) {
  const diff = dayDiff(due, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1) return `in ${diff} days`;
  const n = -diff;
  const days = `${n} ${n === 1 ? 'day' : 'days'}`;
  return popup ? `overdue by ${days}` : `${days} overdue`;
}

/** Content still to do: anything that isn't uploaded. */
export function isOpenItem(item) {
  return item.status !== 'uploaded';
}

/** Dated, the date has passed, and it still isn't uploaded. */
export function isOverdueItem(item, today) {
  return Boolean(item.publish_date) && item.publish_date < today && item.status !== 'uploaded';
}

export function isOverdueProject(project, today) {
  return project.status === 'open' && project.due_date < today;
}

function byDateThenStatus(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === 'item' ? -1 : 1; // content first, then projects
  if (a.kind === 'item') {
    const rank = STATUS_RANK[a.item.status] - STATUS_RANK[b.item.status];
    if (rank) return rank;
    return (a.item.created_at ?? '') < (b.item.created_at ?? '') ? -1 : 1;
  }
  return (a.project.created_at ?? '') < (b.project.created_at ?? '') ? -1 : 1;
}

/**
 * Everything the this-week reminder shows.
 *   rows:    open content dated this week + open projects due this week
 *            (each { kind, id, date, item | project, today, late })
 *   overdue: open content and projects dated before this week
 *   state:   'list' (something to do) · 'done' (the week had work, all finished) · 'empty'
 *   scheduled / finished: what the week held, any status (for "7 of 7 uploaded")
 */
export function reminder({ items = [], projects = [], today }) {
  const week = weekRange(today);
  const rows = [];
  const overdue = [];
  let scheduled = 0;
  let finished = 0;

  for (const item of items) {
    const date = item.publish_date;
    if (!date) continue;
    const open = isOpenItem(item);
    if (isInWeek(date, week)) {
      scheduled += 1;
      if (!open) finished += 1;
      else rows.push({ kind: 'item', id: item.id, date, item, today: date === today, late: date < today });
    } else if (date < week.start && open) {
      overdue.push({ kind: 'item', id: item.id, date, item, today: false, late: true });
    }
  }

  for (const project of projects) {
    const date = project.due_date;
    const open = project.status === 'open';
    if (isInWeek(date, week)) {
      scheduled += 1;
      if (!open) finished += 1;
      else rows.push({ kind: 'project', id: project.id, date, project, today: date === today, late: date < today });
    } else if (date < week.start && open) {
      overdue.push({ kind: 'project', id: project.id, date, project, today: false, late: true });
    }
  }

  rows.sort(byDateThenStatus);
  overdue.sort(byDateThenStatus);
  const toGo = rows.length;
  // what comes next: today's or the nearest upcoming one; if only late ones are left, the first of those
  const next = rows.find((r) => !r.late) ?? rows[0] ?? null;
  return {
    week,
    rows,
    overdue,
    toGo,
    scheduled,
    finished,
    next,
    state: toGo > 0 ? 'list' : scheduled > 0 ? 'done' : 'empty',
  };
}

/** Publish date ascending, items without a date last, then by creation. */
export function byPublishDate(a, b) {
  const da = a.publish_date;
  const db = b.publish_date;
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
}

/**
 * The status board: one column per status, in the order Not started · Planned · Uploaded.
 * Each column: { key, items, total, reels, feed, untyped }.
 */
export function boardColumns(items) {
  const columns = ['not_started', 'planned', 'uploaded'].map((key) => ({ key, items: [], total: 0, reels: 0, feed: 0, untyped: 0 }));
  const byKey = Object.fromEntries(columns.map((c) => [c.key, c]));
  for (const item of items) {
    const col = byKey[item.status] ?? byKey.not_started;
    col.items.push(item);
    col.total += 1;
    if (item.type === 'reels') col.reels += 1;
    else if (item.type === 'feed') col.feed += 1;
    else col.untyped += 1;
  }
  for (const col of columns) col.items.sort(byPublishDate);
  return columns;
}

/** Projects page tabs: upcoming (open, not past), overdue (open, past), done. */
export function projectBuckets(projects, today) {
  const upcoming = [];
  const overdue = [];
  const done = [];
  for (const p of projects) {
    if (p.status === 'done') done.push(p);
    else if (p.due_date < today) overdue.push(p);
    else upcoming.push(p);
  }
  const asc = (a, b) => (a.due_date === b.due_date ? ((a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1) : a.due_date < b.due_date ? -1 : 1);
  upcoming.sort(asc);
  overdue.sort(asc);
  // done: most recently finished first
  done.sort((a, b) => ((a.completed_at ?? a.updated_at ?? '') < (b.completed_at ?? b.updated_at ?? '') ? 1 : -1));
  return { upcoming, overdue, done };
}
