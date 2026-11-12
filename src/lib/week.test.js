import { describe, expect, it } from 'vitest';
import {
  boardColumns,
  dayParts,
  deadlineHint,
  formatDropDate,
  isOverdueItem,
  projectBuckets,
  reminder,
  shortTitle,
  weekLabel,
  weekRange,
} from './week.js';

const item = (id, publish_date, status, extra = {}) => ({ id, publish_date, status, created_at: `2026-11-01T00:00:0${id.length}Z`, ...extra });
const project = (id, due_date, status = 'open', extra = {}) => ({ id, due_date, status, created_at: '2026-11-01T00:00:00Z', ...extra });

describe('weekRange', () => {
  it('runs Monday to Sunday', () => {
    expect(weekRange('2026-11-11')).toEqual({ start: '2026-11-09', end: '2026-11-15' }); // a Wednesday
    expect(weekRange('2026-11-09')).toEqual({ start: '2026-11-09', end: '2026-11-15' }); // Monday
    expect(weekRange('2026-11-15')).toEqual({ start: '2026-11-09', end: '2026-11-15' }); // Sunday
  });

  it('covers exactly one week across a month boundary', () => {
    expect(weekRange('2026-12-02')).toEqual({ start: '2026-11-30', end: '2026-12-06' });
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('labels', () => {
  it('weekLabel', () => {
    expect(weekLabel({ start: '2026-11-09', end: '2026-11-15' })).toBe('9–15 Nov');
    expect(weekLabel({ start: '2026-11-30', end: '2026-12-06' })).toBe('30 Nov – 6 Dec');
  });

  it('formatDropDate and dayParts', () => {
    expect(formatDropDate('2026-11-04')).toBe('Wed, 4 Nov');
    expect(formatDropDate('2026-11-20')).toBe('Fri, 20 Nov');
    expect(dayParts('2026-11-11')).toEqual({ weekday: 'Wed', day: 11 });
  });

  it('shortTitle', () => {
    expect(shortTitle('Deep Clean Everything in the house', 14)).toBe('Deep Clean Ev…');
    expect(shortTitle('Short')).toBe('Short');
    expect(shortTitle('')).toBe('Untitled');
    expect(shortTitle(null)).toBe('Untitled');
  });

  it('deadlineHint', () => {
    const today = '2026-11-12';
    expect(deadlineHint('2026-11-12', today)).toBe('today');
    expect(deadlineHint('2026-11-13', today)).toBe('tomorrow');
    expect(deadlineHint('2026-11-15', today)).toBe('in 3 days');
    expect(deadlineHint('2026-11-11', today)).toBe('1 day overdue');
    expect(deadlineHint('2026-11-10', today)).toBe('2 days overdue');
    expect(deadlineHint('2026-11-10', today, { popup: true })).toBe('overdue by 2 days');
    expect(deadlineHint('2026-11-15', today, { popup: true })).toBe('in 3 days');
  });
});

describe('reminder', () => {
  const today = '2026-11-11'; // Wednesday; the week is 9–15 Nov

  it('lists only Not started and Planned content of this week, never Uploaded', () => {
    const r = reminder({
      today,
      items: [
        item('a', '2026-11-12', 'planned'),
        item('b', '2026-11-12', 'not_started'),
        item('c', '2026-11-10', 'uploaded'),
        item('d', '2026-11-16', 'planned'), // next week
        item('e', null, 'not_started'), // no date
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['b', 'a']); // same day: Not started before Planned
    expect(r.toGo).toBe(2);
    expect(r.scheduled).toBe(3);
    expect(r.finished).toBe(1);
    expect(r.state).toBe('list');
  });

  it('sorts by date, marks today and days already passed', () => {
    const r = reminder({
      today,
      items: [item('late', '2026-11-09', 'planned'), item('now', '2026-11-11', 'not_started'), item('soon', '2026-11-14', 'planned')],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['late', 'now', 'soon']);
    expect(r.rows[0]).toMatchObject({ late: true, today: false });
    expect(r.rows[1]).toMatchObject({ late: false, today: true });
    expect(r.next.id).toBe('now');
  });

  it('puts older open work in Overdue, even from last month', () => {
    const r = reminder({
      today,
      items: [item('old', '2026-10-28', 'planned'), item('older', '2026-11-03', 'not_started'), item('done', '2026-11-02', 'uploaded')],
      projects: [project('p-old', '2026-11-06'), project('p-done', '2026-11-05', 'done')],
    });
    expect(r.overdue.map((x) => x.id)).toEqual(['old', 'older', 'p-old']);
    expect(r.rows).toEqual([]);
    expect(r.state).toBe('empty'); // nothing scheduled this week, but Overdue still shows
  });

  it('includes open projects due this week, after content on the same day', () => {
    const r = reminder({
      today,
      items: [item('a', '2026-11-13', 'planned')],
      projects: [project('p1', '2026-11-13'), project('p2', '2026-11-12'), project('p3', '2026-11-13', 'done')],
    });
    expect(r.rows.map((x) => `${x.kind}:${x.id}`)).toEqual(['project:p2', 'item:a', 'project:p1']);
    expect(r.scheduled).toBe(4);
    expect(r.finished).toBe(1);
  });

  it('says "done" when the week had content and all of it is finished', () => {
    const r = reminder({ today, items: [item('a', '2026-11-10', 'uploaded'), item('b', '2026-11-13', 'uploaded')], projects: [project('p', '2026-11-12', 'done')] });
    expect(r.state).toBe('done');
    expect(r.scheduled).toBe(3);
    expect(r.finished).toBe(3);
    expect(r.next).toBe(null);
  });

  it('says "empty" when nothing is scheduled this week', () => {
    expect(reminder({ today, items: [item('a', '2026-11-20', 'planned')] }).state).toBe('empty');
    expect(reminder({ today }).state).toBe('empty');
  });

  it('works across a month boundary', () => {
    const r = reminder({ today: '2026-12-01', items: [item('nov', '2026-11-30', 'planned'), item('dec', '2026-12-05', 'not_started')] });
    expect(r.week).toEqual({ start: '2026-11-30', end: '2026-12-06' });
    expect(r.rows.map((x) => x.id)).toEqual(['nov', 'dec']);
    expect(r.overdue).toEqual([]);
  });
});

describe('boardColumns', () => {
  it('groups by status with the Reels / Feed split and sorts by publish date, no date last', () => {
    const cols = boardColumns([
      item('a', '2026-11-20', 'planned', { type: 'reels' }),
      item('b', null, 'not_started', { type: null }),
      item('c', '2026-11-05', 'not_started', { type: 'feed' }),
      item('d', '2026-11-02', 'uploaded', { type: 'reels' }),
      item('e', '2026-11-08', 'planned', { type: 'feed' }),
      item('f', '2026-11-01', 'uploaded', { type: 'feed' }),
    ]);
    expect(cols.map((c) => c.key)).toEqual(['not_started', 'planned', 'uploaded']);
    expect(cols[0].items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(cols[0]).toMatchObject({ total: 2, reels: 0, feed: 1, untyped: 1 });
    expect(cols[1].items.map((i) => i.id)).toEqual(['e', 'a']);
    expect(cols[1]).toMatchObject({ total: 2, reels: 1, feed: 1, untyped: 0 });
    expect(cols[2].items.map((i) => i.id)).toEqual(['f', 'd']);
  });

  it('isOverdueItem', () => {
    expect(isOverdueItem(item('a', '2026-11-10', 'planned'), '2026-11-11')).toBe(true);
    expect(isOverdueItem(item('a', '2026-11-11', 'planned'), '2026-11-11')).toBe(false);
    expect(isOverdueItem(item('a', '2026-11-10', 'uploaded'), '2026-11-11')).toBe(false);
    expect(isOverdueItem(item('a', null, 'not_started'), '2026-11-11')).toBe(false);
  });
});

describe('projectBuckets', () => {
  it('splits into upcoming (nearest first), overdue and done', () => {
    const b = projectBuckets(
      [
        project('far', '2026-12-01'),
        project('near', '2026-11-13'),
        project('today', '2026-11-12'),
        project('late', '2026-11-10'),
        project('done-1', '2026-11-01', 'done', { completed_at: '2026-11-02T00:00:00Z' }),
        project('done-2', '2026-11-20', 'done', { completed_at: '2026-11-11T00:00:00Z' }),
      ],
      '2026-11-12',
    );
    expect(b.upcoming.map((p) => p.id)).toEqual(['today', 'near', 'far']);
    expect(b.overdue.map((p) => p.id)).toEqual(['late']);
    expect(b.done.map((p) => p.id)).toEqual(['done-2', 'done-1']);
  });
});
