import { describe, expect, it } from 'vitest';
import {
  achievement,
  brandLanes,
  brandSplit,
  countNoDate,
  countStatuses,
  countsToward,
  dotPlan,
  formatAchievement,
  groupStats,
  mixNote,
  myBrandLanes,
  needPicCount,
  paceExpected,
  paceInfo,
  paceShort,
  performance,
  personLanes,
  progressStatus,
  sumTargets,
  targetsForMonth,
  trackAriaLabel,
  uploadedByType,
} from './progress.js';

const month = '2026-11';
const today = '2026-11-12'; // 30-day month, day 12

let n = 0;
/** An item; uploaded items get a PIC unless one is given (null = needs a PIC). */
const item = (status, publish_date, extra = {}) => ({ id: `i${(n += 1)}`, status, publish_date, type: 'feed', pic_id: 'u-arum', ...extra });
const many = (count, status, extra) => Array.from({ length: count }, (_, i) => item(status, `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, extra));
const target = (profile_id, brand_id, reels, feed, extra = {}) => ({
  id: `t-${profile_id}-${brand_id}-${extra.month ?? '2026-11-01'}`,
  month: '2026-11-01',
  profile_id,
  brand_id,
  target_reels: reels,
  target_feed: feed,
  target_total: reels + feed,
  note: null,
  ...extra,
});

describe('counting', () => {
  it('counts statuses only for items dated in the month', () => {
    const items = [
      item('uploaded', '2026-11-02'),
      item('uploaded', '2026-11-30'),
      item('planned', '2026-11-15'),
      item('not_started', '2026-11-20'),
      item('uploaded', '2026-10-31'), // other month
      item('not_started', null), // no date: never counts
    ];
    expect(countStatuses(items, month)).toEqual({ uploaded: 2, planned: 1, notStarted: 1 });
    expect(countNoDate([item('planned', null), item('uploaded', '2026-11-01'), item('not_started', null)])).toBe(2);
  });

  it('counts an item toward a target only when uploaded, dated in the month and with a PIC', () => {
    expect(countsToward(item('uploaded', '2026-11-03'), month)).toBe(true);
    expect(countsToward(item('planned', '2026-11-03'), month)).toBe(false);
    expect(countsToward(item('uploaded', '2026-10-03'), month)).toBe(false);
    expect(countsToward(item('uploaded', '2026-11-03', { pic_id: null }), month)).toBe(false);
  });

  it('splits uploads by type and skips items without a PIC', () => {
    const items = [
      item('uploaded', '2026-11-01', { type: 'reels' }),
      item('uploaded', '2026-11-02', { type: 'reels' }),
      item('uploaded', '2026-11-03', { type: 'feed' }),
      item('uploaded', '2026-11-04', { type: 'feed', pic_id: null }),
      item('planned', '2026-11-05', { type: 'reels' }),
    ];
    expect(uploadedByType(items, month)).toEqual({ reels: 2, feed: 1, total: 3 });
    expect(needPicCount(items, month)).toEqual({ all: 1, uploaded: 1 });
  });
});

describe('targets and achievement', () => {
  it('sums Reels and Feed; null when no rows', () => {
    expect(sumTargets([])).toBeNull();
    expect(sumTargets([target('a', 'x', 7, 12), target('a', 'y', 0, 5)])).toEqual({ reels: 7, feed: 17, total: 24 });
  });

  it('filters target rows by month', () => {
    const rows = [target('a', 'x', 1, 1), target('a', 'x', 2, 2, { month: '2026-10-01' })];
    expect(targetsForMonth(rows, month)).toHaveLength(1);
  });

  it('has one decimal, and no achievement without a target', () => {
    expect(achievement(98, 122)).toBe(80.3);
    expect(achievement(30, 20)).toBe(150);
    expect(achievement(5, null)).toBeNull();
    expect(achievement(5, 0)).toBeNull();
    expect(formatAchievement(80.3)).toBe('80.3%');
    expect(formatAchievement(100)).toBe('100%');
    expect(formatAchievement(null)).toBe('–');
  });
});

describe('the mix rule (owner examples, §7)', () => {
  const t = { reels: 10, feed: 10, total: 20 };

  it('10+10, uploaded 14 Reels + 6 Feed → 100% with the explanatory note', () => {
    const items = [...many(14, 'uploaded', { type: 'reels' }), ...many(6, 'uploaded', { type: 'feed' })];
    const s = groupStats({ items, targetRows: [target('u-arum', 'behomy', 10, 10)], month, today });
    expect(s.achievement).toBe(100);
    expect(formatAchievement(s.achievement)).toBe('100%');
    expect(s.status.key).toBe('done');
    expect(s.mixNote).toBe('Reels 14/10 (+4 over) · Feed 6/10 (4 short). Total target met with extra Reels.');
  });

  it('10+10, uploaded 12 Reels + 3 Feed → 75%', () => {
    expect(mixNote(t, { reels: 12, feed: 3, total: 15 })).toBe('Reels +2 over · Feed 7 short.');
    expect(achievement(15, 20)).toBe(75);
  });

  it('10+10, uploaded 30 (20 Reels + 10 Feed) → 150%', () => {
    expect(mixNote(t, { reels: 20, feed: 10, total: 30 })).toBe('Reels +10 over.');
    expect(achievement(30, 20)).toBe(150);
  });

  it('says nothing when no type is over its target, or without a target', () => {
    expect(mixNote(t, { reels: 5, feed: 9, total: 14 })).toBeNull();
    expect(mixNote(t, { reels: 10, feed: 10, total: 20 })).toBeNull();
    expect(mixNote(null, { reels: 3, feed: 0, total: 3 })).toBeNull();
  });

  it('handles a type with a zero target', () => {
    expect(mixNote({ reels: 17, feed: 0, total: 17 }, { reels: 15, feed: 2, total: 17 })).toBe(
      'Reels 15/17 (2 short) · Feed 2/0 (+2 over). Total target met with extra Feed.',
    );
    expect(mixNote({ reels: 10, feed: 10, total: 20 }, { reels: 12, feed: 15, total: 27 })).toBe('Reels +2 over · Feed +5 over.');
  });
});

describe('status and pace', () => {
  it('computes every status', () => {
    // 12 Nov, target 25 → pace round(25 × 12/30) = 10
    expect(paceExpected(25, month, today)).toBe(10);
    expect(progressStatus({ target: 25, uploaded: 25, month, today }).key).toBe('done');
    expect(progressStatus({ target: 25, uploaded: 30, month: '2026-10', today }).key).toBe('done');
    expect(progressStatus({ target: 25, uploaded: 10, month, today }).key).toBe('on_track');
    expect(progressStatus({ target: 25, uploaded: 7, month, today })).toEqual({ key: 'behind', label: 'Behind', behind: 3 });
    expect(progressStatus({ target: 25, uploaded: 20, month: '2026-10', today }).label).toBe('Not reached');
    expect(progressStatus({ target: 25, uploaded: 0, month: '2026-12', today }).label).toBe('Upcoming');
    expect(progressStatus({ target: null, uploaded: 3, month, today }).label).toBe('No target');
    expect(progressStatus({ target: 0, uploaded: 3, month, today }).label).toBe('No target');
  });

  it('is on pace early in the month', () => {
    const p = paceInfo({ target: 10, uploaded: 7, month, today: '2026-11-03' });
    expect(p.phase).toBe('current');
    expect(p.expected).toBe(1);
    expect(p.sentence).toBe('On pace, 3 to go in 27 days');
  });

  it('is behind pace', () => {
    const p = paceInfo({ target: 25, uploaded: 7, month, today });
    expect(p.behind).toBe(3);
    expect(p.sentence).toBe('3 behind pace, 18 to go in 18 days');
  });

  it('says target reached, including over target', () => {
    expect(paceInfo({ target: 10, uploaded: 10, month, today: '2026-11-20' }).sentence).toBe('Target reached');
    expect(paceInfo({ target: 25, uploaded: 30, month, today: '2026-11-20' }).sentence).toBe('Target reached');
  });

  it('uses singular and "today" near the end of the month', () => {
    expect(paceInfo({ target: 30, uploaded: 29, month, today: '2026-11-29' }).sentence).toBe('On pace, 1 to go in 1 day');
    expect(paceInfo({ target: 30, uploaded: 27, month, today: '2026-11-30' }).sentence).toBe('3 behind pace, 3 to go today');
  });

  it('rounds the expected count', () => {
    expect(paceInfo({ target: 10, uploaded: 5, month: '2026-12', today: '2026-12-16' }).expected).toBe(5);
    expect(paceInfo({ target: 10, uploaded: 5, month: '2026-12', today: '2026-12-18' }).sentence).toBe('1 behind pace, 5 to go in 13 days');
  });

  it('shows the final result for past months, nothing for future months or without a target', () => {
    expect(paceInfo({ target: 25, uploaded: 22, month: '2026-10', today }).sentence).toBe('Ended 3 short of the target');
    expect(paceInfo({ target: 25, uploaded: 0, month: '2026-12', today }).phase).toBe('future');
    expect(paceInfo({ target: null, uploaded: 3, month, today }).phase).toBe('none');
    expect(paceInfo({ target: 0, uploaded: 3, month, today }).phase).toBe('none');
  });

  it('has short labels for lanes and an aria label', () => {
    expect(paceShort(paceInfo({ target: 8, uploaded: 8, month, today }))).toBe('Reached');
    expect(paceShort(paceInfo({ target: 25, uploaded: 10, month, today }))).toBe('On pace');
    expect(paceShort(paceInfo({ target: 25, uploaded: 7, month, today }))).toBe('3 behind');
    expect(paceShort(paceInfo({ target: 25, uploaded: 20, month: '2026-10', today }))).toBe('Short by 5');
    const pace = paceInfo({ target: 10, uploaded: 7, month, today: '2026-11-03' });
    expect(trackAriaLabel({ uploaded: 7, planned: 2, notStarted: 1, target: 10, pace })).toBe('7 of 10 uploaded, 2 planned, 1 not started, on pace');
  });
});

describe('dotPlan', () => {
  it('orders uploaded, planned, then remaining; bonus past the target', () => {
    expect(dotPlan({ target: 10, uploaded: 7, planned: 2 })).toEqual({ total: 10, filled: 7, ring: 2, empty: 1, bonus: 0 });
    expect(dotPlan({ target: 10, uploaded: 7, planned: 9 })).toEqual({ total: 10, filled: 7, ring: 3, empty: 0, bonus: 0 });
    expect(dotPlan({ target: 25, uploaded: 30, planned: 4 })).toEqual({ total: 25, filled: 25, ring: 0, empty: 0, bonus: 5 });
  });
});

describe('groups', () => {
  it('reports remaining and over', () => {
    const under = groupStats({ items: many(7, 'uploaded'), targetRows: [target('u-arum', 'behomy', 0, 10)], month, today });
    expect([under.remaining, under.over, under.achievement]).toEqual([3, 0, 70]);
    const over = groupStats({ items: many(12, 'uploaded'), targetRows: [target('u-arum', 'behomy', 0, 10)], month, today });
    expect([over.remaining, over.over, over.achievement]).toEqual([0, 2, 120]);
  });

  it('shows uploads with no target as "No target" with no achievement', () => {
    const s = groupStats({ items: many(3, 'uploaded'), targetRows: [], month, today });
    expect(s.target).toBeNull();
    expect(s.uploaded.total).toBe(3);
    expect(s.achievement).toBeNull();
    expect(s.status.label).toBe('No target');
    expect(s.remaining).toBeNull();
  });

  const brands = [
    { id: 'lahap', name: 'Lahap' },
    { id: 'kedai_makmoer_88', name: 'Kedai Makmoer 88' },
  ];

  it('builds one lane per brand (Excel master), counting every PIC', () => {
    const items = [
      item('uploaded', '2026-11-01', { brand_id: 'lahap', pic_id: 'u-excel', type: 'reels' }),
      item('uploaded', '2026-11-02', { brand_id: 'lahap', pic_id: 'u-excel' }),
      item('planned', '2026-11-03', { brand_id: 'lahap', pic_id: 'u-excel' }),
      item('uploaded', '2026-11-04', { brand_id: 'kedai_makmoer_88', pic_id: 'u-excel' }),
    ];
    const targets = [target('u-excel', 'lahap', 5, 8), target('u-excel', 'kedai_makmoer_88', 4, 8)];
    const lanes = brandLanes({ items, brands, targets, month, today });
    expect(lanes.map((l) => [l.label, l.uploaded.reels, l.uploaded.feed, l.target.total, l.planned])).toEqual([
      ['Lahap', 1, 1, 13, 1],
      ['Kedai Makmoer 88', 0, 1, 12, 0],
    ]);
  });

  describe('Behomy (PIC lanes)', () => {
    const people = [
      { id: 'u-arum', display_name: 'Arum', is_active: true },
      { id: 'u-ilyas', display_name: 'Ilyas', is_active: true },
      { id: 'u-anne', display_name: 'Anne', is_active: true },
      { id: 'u-old', display_name: 'Old', is_active: false },
    ];
    const targets = [
      target('u-arum', 'behomy', 2, 5),
      target('u-arum', 'corvel', 3, 0),
      target('u-ilyas', 'behomy', 17, 0),
      target('u-anne', 'hoteru', 4, 4),
    ];
    const items = [
      item('uploaded', '2026-11-01', { pic_id: 'u-arum', brand_id: 'behomy', owner_id: 'u-admin' }), // Admin made it, Arum is PIC
      item('uploaded', '2026-11-02', { pic_id: 'u-arum', brand_id: 'purnava', type: 'reels' }), // no target for Purnava
      item('planned', '2026-11-05', { pic_id: 'u-ilyas', brand_id: 'behomy' }),
      item('uploaded', '2026-11-06', { pic_id: 'u-anne', brand_id: 'hoteru', type: 'reels' }),
      item('uploaded', '2026-11-07', { pic_id: null, brand_id: 'behomy' }), // needs a PIC
    ];

    it('builds a lane per person by PIC, sorted by name', () => {
      const lanes = personLanes({ items, people, targets, month, today });
      expect(lanes.map((l) => [l.label, l.uploaded.total, l.planned, l.target.total])).toEqual([
        ['Anne', 1, 0, 8],
        ['Arum', 2, 0, 10],
        ['Ilyas', 0, 1, 17],
      ]);
    });

    it('keeps a lane for someone who left but had a target that month', () => {
      const lanes = personLanes({ items, people: people.filter((p) => p.id !== 'u-anne'), targets, month, today });
      expect(lanes.map((l) => l.label)).toEqual(['Arum', 'Ilyas', 'Former member']);
    });

    it("My work: a lane per brand I have a target or uploads for", () => {
      const allBrands = ['behomy', 'behomy_group', 'corvel', 'hoteru', 'purnava'].map((id) => ({ id, name: id }));
      const lanes = myBrandLanes({ items, brands: allBrands, targets, me: 'u-arum', month, today });
      expect(lanes.map((l) => [l.label, l.uploaded.total, l.target?.total ?? null])).toEqual([
        ['behomy', 1, 7],
        ['corvel', 0, 3],
        ['purnava', 1, null],
      ]);
    });

    it('splits target and uploaded by brand', () => {
      const split = brandSplit({ items, brands: [{ id: 'behomy', name: 'Behomy' }, { id: 'hoteru', name: 'Hoteru' }, { id: 'purnava', name: 'Purnava' }], targets, month });
      expect(split.parts.map((p) => [p.label, p.uploaded, p.target])).toEqual([
        ['Behomy', 1, 24],
        ['Hoteru', 1, 8],
        ['Purnava', 1, null],
      ]);
    });

    it('builds the dashboard tables; the totals equal the sum of the rows', () => {
      const brandRole = { behomy: 'behomy', corvel: 'behomy', hoteru: 'behomy', purnava: 'behomy', behomy_group: 'behomy' };
      const p = performance({ items, targets, month, today, brandRole });
      const cell = (pic, brand) => p.cells.find((c) => c.picId === pic && c.brandId === brand);
      expect(p.cells).toHaveLength(5); // 4 target rows + Arum × Purnava (uploads, no target)
      expect(cell('u-arum', 'purnava').status.label).toBe('No target');
      expect(cell('u-arum', 'purnava').achievement).toBeNull();
      expect(cell('u-ilyas', 'behomy').target).toEqual({ reels: 17, feed: 0, total: 17 });
      expect(p.pics.map((x) => [x.picId, x.roleId, x.uploaded.total, x.target.total])).toEqual(
        expect.arrayContaining([
          ['u-arum', 'behomy', 2, 10],
          ['u-ilyas', 'behomy', 0, 17],
          ['u-anne', 'behomy', 1, 8],
        ]),
      );
      expect(p.total.target.total).toBe(p.cells.reduce((s, c) => s + (c.target?.total ?? 0), 0));
      expect(p.total.uploaded.total).toBe(p.cells.reduce((s, c) => s + c.uploaded.total, 0));
      expect(p.total.uploaded.total).toBe(3); // the item without a PIC counts toward no one
      expect(p.needPic).toEqual({ all: 1, uploaded: 1 });
    });
  });
});
