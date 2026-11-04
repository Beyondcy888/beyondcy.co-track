// Time helpers. Everything "human" (today, the clock, greetings, the default month)
// is computed in Jakarta time (WIB, UTC+7), whatever the device's own time zone is.
//
// Conventions:
//   - a plain date is an ISO string 'YYYY-MM-DD' (what Postgres `date` returns)
//   - a month is 'YYYY-MM'
//   - timestamps are ISO strings from Postgres `timestamptz`
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const TZ = 'Asia/Jakarta';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Monday first
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export { WEEKDAYS_SHORT };

/** The current moment as a date that reads its parts in WIB. */
export function nowWIB(ms = Date.now()) {
  return new TZDate(ms, TZ);
}

/** 'YYYY-MM-DD' for a moment (default: now), in WIB. */
export function todayWIB(ms = Date.now()) {
  return format(nowWIB(ms), 'yyyy-MM-dd');
}

/** 'YYYY-MM' for a moment (default: now), in WIB. */
export function currentMonthWIB(ms = Date.now()) {
  return todayWIB(ms).slice(0, 7);
}

/** The WIB calendar date of a timestamp, as 'YYYY-MM-DD'. */
export function dateOfTimestampWIB(ts) {
  return todayWIB(new Date(ts).getTime());
}

// ------------------------------------------------------------------ months
function splitMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return { y, m };
}

export function isValidMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthStart(month) {
  return `${month}-01`;
}

export function daysInMonth(month) {
  const { y, m } = splitMonth(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthEnd(month) {
  return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
}

export function shiftMonth(month, delta) {
  const { y, m } = splitMonth(month);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isInMonth(isoDate, month) {
  return typeof isoDate === 'string' && isoDate.slice(0, 7) === month;
}

/** 'November 2026' */
export function monthLabel(month) {
  const { y, m } = splitMonth(month);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 'November' */
export function monthName(month) {
  return MONTHS[splitMonth(month).m - 1];
}

// ------------------------------------------------------------------ plain dates
function utc(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(isoDate) {
  return (utc(isoDate).getUTCDay() + 6) % 7;
}

export function addDays(isoDate, n) {
  const d = utc(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return isoFromUtc(d);
}

/** Whole calendar days from b to a (a - b). */
export function dayDiff(a, b) {
  return Math.round((utc(a) - utc(b)) / 86400000);
}

/** '3 Nov 2026' */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = utc(isoDate);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** '3 Nov' */
export function formatDayMonth(isoDate) {
  if (!isoDate) return '';
  const d = utc(isoDate);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** 'Thu 5 Nov' */
export function formatWeekdayDate(isoDate) {
  if (!isoDate) return '';
  return `${WEEKDAYS_SHORT[weekdayIndex(isoDate)]} ${formatDayMonth(isoDate)}`;
}

/** 'Thursday 5 November 2026' (for screen readers) */
export function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const d = utc(isoDate);
  return `${WEEKDAYS_LONG[weekdayIndex(isoDate)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The calendar grid for a month: weeks start on Monday, leading and trailing
 * days from the neighbouring months fill the first and last week.
 * Returns [{ date: 'YYYY-MM-DD', inMonth: boolean }][] (one array per week).
 */
export function calendarWeeks(month) {
  const first = monthStart(month);
  const lead = weekdayIndex(first);
  const total = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
  const start = addDays(first, -lead);
  const weeks = [];
  for (let i = 0; i < total; i += 1) {
    const date = addDays(start, i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ date, inMonth: isInMonth(date, month) });
  }
  return weeks;
}

// ------------------------------------------------------------------ greeting and clock
/** 04:00–10:59 morning, 11:00–17:59 afternoon, 18:00–03:59 evening. */
export function greetingForHour(hour) {
  if (hour >= 4 && hour < 11) return 'Good morning';
  if (hour >= 11 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function greetingWIB(ms = Date.now()) {
  return greetingForHour(nowWIB(ms).getHours());
}

/** 'Tue 3 Nov · 14:32:07 WIB' */
export function clockLabel(ms = Date.now()) {
  const d = nowWIB(ms);
  return `${format(d, 'EEE d MMM')} · ${format(d, 'HH:mm:ss')} WIB`;
}

// ------------------------------------------------------------------ relative time
/**
 * 'just now', '3 min ago', '2 h ago', 'yesterday', '4 days ago', '3 Nov', '3 Nov 2025'.
 * Day boundaries are WIB days.
 */
export function relativeTime(ts, nowMs = Date.now()) {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  const seconds = Math.max(0, (nowMs - t) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  const then = dateOfTimestampWIB(ts);
  const days = dayDiff(todayWIB(nowMs), then);
  if (days <= 0) return `${Math.floor(seconds / 3600)} h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.slice(0, 4) === todayWIB(nowMs).slice(0, 4) ? formatDayMonth(then) : formatDate(then);
}
