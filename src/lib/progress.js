// Targets, progress and pace (09_UPDATE_V2.md §7–§9). Pure functions only: no React,
// no Supabase. Tested in progress.test.js.
//
// Rules (the owner's, v2):
//   - targets are per person (PIC) × brand × month, split into Reels + Feed; total = Reels + Feed
//   - an item counts when status = 'uploaded' and its publish_date is in the month; it counts
//     toward its PIC × brand × type. Items without a PIC count toward no one ("needs a PIC").
//   - achievement uses the totals: extra items of one type do count (the mix rule), but a short
//     note explains it whenever a type is over its own target
//   - pace = round(target total × today's day ÷ days in month), in WIB
import { daysInMonth, isInMonth, monthStart } from './time.js';

export const TYPES = ['reels', 'feed'];
const TYPE_NAMES = { reels: 'Reels', feed: 'Feed' };

export const STATUS_TEXT = {
  done: 'Done',
  on_track: 'On track',
  behind: 'Behind',
  not_reached: 'Not reached',
  upcoming: 'Upcoming',
  none: 'No target',
};

// ------------------------------------------------------------------ counting
/** Counts of uploaded / planned / not started items whose publish date is in the month. */
export function countStatuses(items, month) {
  let uploaded = 0;
  let planned = 0;
  let notStarted = 0;
  for (const item of items) {
    if (!isInMonth(item.publish_date, month)) continue;
    if (item.status === 'uploaded') uploaded += 1;
    else if (item.status === 'planned') planned += 1;
    else notStarted += 1;
  }
  return { uploaded, planned, notStarted };
}

/** Items with no publish date (all of them, whatever the month). */
export function countNoDate(items) {
  let n = 0;
  for (const item of items) if (!item.publish_date) n += 1;
  return n;
}

/** Does this item count toward a target in this month? */
export function countsToward(item, month) {
  return item.status === 'uploaded' && item.pic_id != null && isInMonth(item.publish_date, month);
}

/** Uploaded Reels / Feed / total in the month (items without a PIC count toward no one). */
export function uploadedByType(items, month) {
  let reels = 0;
  let feed = 0;
  for (const item of items) {
    if (!countsToward(item, month)) continue;
    if (item.type === 'reels') reels += 1;
    else if (item.type === 'feed') feed += 1;
  }
  return { reels, feed, total: reels + feed };
}

/** Items in the month (any status) that have no PIC yet. */
export function needPicCount(items, month) {
  let all = 0;
  let uploaded = 0;
  for (const item of items) {
    if (item.pic_id != null || !isInMonth(item.publish_date, month)) continue;
    all += 1;
    if (item.status === 'uploaded') uploaded += 1;
  }
  return { all, uploaded };
}

// ------------------------------------------------------------------ targets
/** Target rows for one month. `month` is 'YYYY-MM'; DB months are 'YYYY-MM-01'. */
export function targetsForMonth(targets, month) {
  const start = monthStart(month);
  return targets.filter((t) => String(t.month).slice(0, 10) === start);
}

/** Σ target rows → { reels, feed, total }, or null when there are no rows. */
export function sumTargets(rows) {
  if (!rows.length) return null;
  let reels = 0;
  let feed = 0;
  for (const row of rows) {
    reels += Number(row.target_reels) || 0;
    feed += Number(row.target_feed) || 0;
  }
  return { reels, feed, total: reels + feed };
}

/** uploaded ÷ target as a percentage with one decimal; null without a (positive) target. */
export function achievement(uploaded, target) {
  if (target == null || target <= 0) return null;
  return Math.round((uploaded / target) * 1000) / 10;
}

/** 80.3 → '80.3%', 100 → '100%', null → '–' */
export function formatAchievement(value) {
  if (value == null) return '–';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

/**
 * The mix note (owner's rule, §7). Shown when a type is over its own target, so a total
 * that looks fine never hides a shortfall in the other type.
 *   10+10 target, 14 Reels + 6 Feed → 'Reels 14/10 (+4 over) · Feed 6/10 (4 short). Total target met with extra Reels.'
 *   10+10 target, 12 Reels + 3 Feed → 'Reels +2 over · Feed 7 short.'
 *   10+10 target, 20 Reels + 10 Feed → 'Reels +10 over.'
 */
export function mixNote(target, uploaded) {
  if (!target || !(target.total > 0)) return null;
  const types = TYPES.map((key) => ({ name: TYPE_NAMES[key], t: target[key] ?? 0, u: uploaded[key] ?? 0 }));
  const over = types.filter((x) => x.u > x.t);
  if (!over.length) return null;
  const off = types.filter((x) => x.u !== x.t);
  const short = types.filter((x) => x.u < x.t);
  if (short.length && uploaded.total >= target.total) {
    const parts = off.map((x) => `${x.name} ${x.u}/${x.t} (${x.u > x.t ? `+${x.u - x.t} over` : `${x.t - x.u} short`})`);
    return `${parts.join(' · ')}. Total target met with extra ${over.map((x) => x.name).join(' and ')}.`;
  }
  return `${off.map((x) => (x.u > x.t ? `${x.name} +${x.u - x.t} over` : `${x.name} ${x.t - x.u} short`)).join(' · ')}.`;
}

// ------------------------------------------------------------------ pace and status
/** How many should be uploaded by today (current month only), else null. */
export function paceExpected(target, month, today) {
  if (target == null || today.slice(0, 7) !== month) return null;
  return Math.round((target * Number(today.slice(8, 10))) / daysInMonth(month));
}

/**
 * Done · On track · Behind · Not reached · Upcoming · No target (§7).
 * `target` and `uploaded` are totals; `today` is the WIB date 'YYYY-MM-DD'.
 */
export function progressStatus({ target, uploaded, month, today }) {
  if (target == null || target <= 0) return { key: 'none', label: STATUS_TEXT.none };
  if (uploaded >= target) return { key: 'done', label: STATUS_TEXT.done };
  const todayMonth = today.slice(0, 7);
  if (month < todayMonth) return { key: 'not_reached', label: STATUS_TEXT.not_reached };
  if (month > todayMonth) return { key: 'upcoming', label: STATUS_TEXT.upcoming };
  const expected = paceExpected(target, month, today);
  if (uploaded >= expected) return { key: 'on_track', label: STATUS_TEXT.on_track };
  return { key: 'behind', label: STATUS_TEXT.behind, behind: expected - uploaded };
}

/**
 * Pace for a month, as a sentence. `today` is the WIB date 'YYYY-MM-DD'.
 *   current month: expected = round(target × day ÷ days in month)
 *   past month:    the final result
 *   future month:  no pace
 */
export function paceInfo({ target, uploaded, month, today }) {
  if (target == null || target <= 0) return { phase: 'none', sentence: null };
  const todayMonth = today.slice(0, 7);
  const toGo = Math.max(0, target - uploaded);
  const reached = uploaded >= target;

  if (month < todayMonth) {
    return {
      phase: 'past',
      reached,
      toGo,
      sentence: reached ? 'Target reached' : `Ended ${toGo} short of the target`,
    };
  }
  if (month > todayMonth) {
    return { phase: 'future', reached, toGo, sentence: "This month hasn't started yet" };
  }

  const dim = daysInMonth(month);
  const day = Number(today.slice(8, 10));
  const expected = paceExpected(target, month, today);
  const daysLeft = dim - day;
  if (reached) {
    return { phase: 'current', reached, toGo: 0, expected, daysLeft, behind: 0, onPace: true, sentence: 'Target reached' };
  }
  const behind = Math.max(0, expected - uploaded);
  const when = daysLeft === 0 ? 'today' : `in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  const sentence = behind === 0 ? `On pace, ${toGo} to go ${when}` : `${behind} behind pace, ${toGo} to go ${when}`;
  return { phase: 'current', reached, toGo, expected, daysLeft, behind, onPace: behind === 0, sentence };
}

/** A short version for lanes: 'On pace', '3 behind', 'Reached', 'Short by 2'. */
export function paceShort(pace) {
  if (!pace || pace.phase === 'none') return null;
  if (pace.reached) return 'Reached';
  if (pace.phase === 'current') return pace.onPace ? 'On pace' : `${pace.behind} behind`;
  if (pace.phase === 'past') return `Short by ${pace.toGo}`;
  return null;
}

/** The dot row's aria-label: "7 of 10 uploaded, 2 planned, 1 not started, on pace". */
export function trackAriaLabel({ uploaded, planned, notStarted, target, pace }) {
  if (target == null) {
    return `${uploaded} uploaded, ${planned} planned, ${notStarted} not started, no target set`;
  }
  const parts = [`${uploaded} of ${target} uploaded`, `${planned} planned`, `${notStarted} not started`];
  if (pace?.phase === 'current' || pace?.phase === 'past') {
    if (pace.reached) parts.push('target reached');
    else if (pace.phase === 'current') parts.push(pace.onPace ? 'on pace' : `${pace.behind} behind pace`);
    else parts.push(`ended ${pace.toGo} short`);
  }
  return parts.join(', ');
}

/**
 * How the dot row is drawn: one dot per unit of target, in order
 * filled (uploaded) → ring (planned) → empty (remaining); uploads beyond the
 * target continue as "bonus" dots after a small gap.
 */
export function dotPlan({ target, uploaded, planned }) {
  const total = Math.max(0, Number(target) || 0);
  const filled = Math.min(uploaded, total);
  const ring = Math.min(planned, total - filled);
  const empty = total - filled - ring;
  const bonus = Math.max(0, uploaded - total);
  return { total, filled, ring, empty, bonus };
}

// ------------------------------------------------------------------ groups
/**
 * Every number for one group (a PIC × brand cell, a person, a brand, a tracker or everything).
 * `items` and `targetRows` must already be narrowed to the group; rows are filtered to the month here.
 *   target: { reels, feed, total } | null   (null = no target; a 0 total counts as no target)
 *   uploaded: { reels, feed, total }        (items with a PIC only)
 */
export function groupStats({ items, targetRows, month, today }) {
  const rows = targetsForMonth(targetRows, month);
  const summed = sumTargets(rows);
  const target = summed && summed.total > 0 ? summed : null;
  const uploaded = uploadedByType(items, month);
  const { planned, notStarted } = countStatuses(items, month);
  const t = target?.total ?? null;
  return {
    target,
    targetRows: rows,
    uploaded,
    planned,
    notStarted,
    noDate: countNoDate(items),
    remaining: t == null ? null : Math.max(t - uploaded.total, 0),
    over: t == null ? 0 : Math.max(uploaded.total - t, 0),
    achievement: achievement(uploaded.total, t),
    mixNote: mixNote(target, uploaded),
    status: progressStatus({ target: t, uploaded: uploaded.total, month, today }),
    pace: paceInfo({ target: t, uploaded: uploaded.total, month, today }),
  };
}

/** One lane per brand (single and multi_brand trackers): every PIC's items for that brand. */
export function brandLanes({ items, brands, targets, month, today }) {
  return brands.map((brand) => ({
    key: brand.id,
    kind: 'brand',
    label: brand.name,
    brandId: brand.id,
    ...groupStats({
      items: items.filter((i) => i.brand_id === brand.id),
      targetRows: targets.filter((t) => t.brand_id === brand.id),
      month,
      today,
    }),
  }));
}

/**
 * One lane per PIC (Behomy Master). Active people always get a lane; anyone else only
 * when they have a target or items that month (so past months stay readable after someone leaves).
 */
export function personLanes({ items, people, targets, month, today }) {
  const rows = targetsForMonth(targets, month);
  const byId = new Map(people.map((p) => [p.id, p]));
  const monthPics = new Set(items.filter((i) => i.pic_id && isInMonth(i.publish_date, month)).map((i) => i.pic_id));
  const sorted = [...people].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const ids = sorted
    .filter((p) => p.is_active || rows.some((r) => r.profile_id === p.id) || monthPics.has(p.id))
    .map((p) => p.id);
  for (const id of [...rows.map((r) => r.profile_id), ...monthPics]) if (!ids.includes(id)) ids.push(id);

  return ids.map((id) => ({
    key: id,
    kind: 'person',
    label: byId.get(id)?.display_name ?? 'Former member',
    profileId: id,
    ...groupStats({
      items: items.filter((i) => i.pic_id === id),
      targetRows: rows.filter((r) => r.profile_id === id),
      month,
      today,
    }),
  }));
}

/** Behomy My work: one lane per brand where I have a target or uploads this month. */
export function myBrandLanes({ items, brands, targets, me, month, today }) {
  const rows = targetsForMonth(targets, month).filter((r) => r.profile_id === me);
  const mine = items.filter((i) => i.pic_id === me);
  return brands
    .filter((b) => rows.some((r) => r.brand_id === b.id) || mine.some((i) => i.brand_id === b.id && countsToward(i, month)))
    .map((brand) => ({
      key: brand.id,
      kind: 'brand',
      label: brand.name,
      brandId: brand.id,
      ...groupStats({
        items: mine.filter((i) => i.brand_id === brand.id),
        targetRows: rows.filter((r) => r.brand_id === brand.id),
        month,
        today,
      }),
    }));
}

/** Target and uploaded per brand (Behomy Master's "By brand" line). */
export function brandSplit({ items, brands, targets, month }) {
  const rows = targetsForMonth(targets, month);
  const parts = brands.map((brand) => {
    const target = sumTargets(rows.filter((r) => r.brand_id === brand.id));
    return {
      brandId: brand.id,
      label: brand.name,
      uploaded: uploadedByType(
        items.filter((i) => i.brand_id === brand.id),
        month,
      ).total,
      target: target && target.total > 0 ? target.total : null,
    };
  });
  return { parts, total: parts.reduce((s, p) => s + p.uploaded, 0) };
}

/**
 * The Admin dashboard's tables (§9.3, §9.4) for one month.
 *   cells: one per PIC × brand with a target or uploads (rows with uploads but no target included)
 *   pics:  one per PIC × tracker with a target or uploads
 *   total: everything
 *   needPic: month items without a PIC ({ all, uploaded })
 * `brandRole` maps brand id → tracker (role) id.
 */
export function performance({ items, targets, month, today, brandRole }) {
  const rows = targetsForMonth(targets, month);
  const counted = items.filter((i) => countsToward(i, month));

  const cellKeys = new Map();
  const addCell = (picId, brandId) => {
    const key = `${picId}|${brandId}`;
    if (!cellKeys.has(key)) cellKeys.set(key, { key, picId, brandId, roleId: brandRole[brandId] ?? null });
  };
  rows.forEach((r) => addCell(r.profile_id, r.brand_id));
  counted.forEach((i) => addCell(i.pic_id, i.brand_id));

  const cells = [...cellKeys.values()].map((c) => {
    const cellRows = rows.filter((r) => r.profile_id === c.picId && r.brand_id === c.brandId);
    return {
      ...c,
      targetRow: cellRows[0] ?? null,
      ...groupStats({
        items: items.filter((i) => i.pic_id === c.picId && i.brand_id === c.brandId),
        targetRows: cellRows,
        month,
        today,
      }),
    };
  });

  const picKeys = new Map();
  for (const c of cells) {
    const key = `${c.picId}|${c.roleId}`;
    if (!picKeys.has(key)) picKeys.set(key, { key, picId: c.picId, roleId: c.roleId });
  }
  const pics = [...picKeys.values()].map((p) => ({
    ...p,
    ...groupStats({
      items: items.filter((i) => i.pic_id === p.picId && (brandRole[i.brand_id] ?? i.role_id) === p.roleId),
      targetRows: rows.filter((r) => r.profile_id === p.picId && (brandRole[r.brand_id] ?? r.role_id) === p.roleId),
      month,
      today,
    }),
  }));

  return {
    cells,
    pics,
    total: groupStats({ items, targetRows: rows, month, today }),
    needPic: needPicCount(items, month),
  };
}
