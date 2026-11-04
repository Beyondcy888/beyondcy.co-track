import { describe, expect, it } from 'vitest';
import {
  calendarWeeks,
  clockLabel,
  currentMonthWIB,
  daysInMonth,
  formatDate,
  formatWeekdayDate,
  greetingForHour,
  greetingWIB,
  monthEnd,
  monthLabel,
  relativeTime,
  shiftMonth,
  todayWIB,
  weekdayIndex,
} from './time.js';

// 2026-11-02T17:30:00Z is 3 Nov 2026 00:30 in Jakarta (UTC+7)
const LATE_UTC = Date.parse('2026-11-02T17:30:00Z');

describe('WIB dates', () => {
  it('uses Jakarta for today, not the device time zone', () => {
    expect(todayWIB(LATE_UTC)).toBe('2026-11-03');
    expect(currentMonthWIB(Date.parse('2026-10-31T18:00:00Z'))).toBe('2026-11');
  });

  it('formats the live clock', () => {
    expect(clockLabel(Date.parse('2026-11-03T07:32:07Z'))).toBe('Tue 3 Nov · 14:32:07 WIB');
  });

  it('greets by WIB hour (switching at 04:00, 11:00 and 18:00)', () => {
    expect(greetingForHour(3)).toBe('Good evening');
    expect(greetingForHour(4)).toBe('Good morning');
    expect(greetingForHour(10)).toBe('Good morning');
    expect(greetingForHour(11)).toBe('Good afternoon');
    expect(greetingForHour(17)).toBe('Good afternoon');
    expect(greetingForHour(18)).toBe('Good evening');
    expect(greetingForHour(23)).toBe('Good evening');
    // 07:32 UTC = 14:32 WIB
    expect(greetingWIB(Date.parse('2026-11-03T07:32:00Z'))).toBe('Good afternoon');
    // 21:30 UTC = 04:30 WIB the next day
    expect(greetingWIB(Date.parse('2026-11-02T21:30:00Z'))).toBe('Good morning');
  });
});

describe('months', () => {
  it('knows month lengths and labels', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(monthEnd('2026-12')).toBe('2026-12-31');
    expect(monthLabel('2026-11')).toBe('November 2026');
  });

  it('shifts across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('plain dates', () => {
  it('formats dates', () => {
    expect(formatDate('2026-11-03')).toBe('3 Nov 2026');
    expect(formatWeekdayDate('2026-11-05')).toBe('Thu 5 Nov');
    expect(weekdayIndex('2026-11-02')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-08')).toBe(6); // Sunday
  });

  it('builds a Monday-first calendar grid', () => {
    const weeks = calendarWeeks('2026-11'); // 1 Nov 2026 is a Sunday
    expect(weeks[0][0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(weeks[0][6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(weeks.length).toBe(6);
    expect(weeks.at(-1).at(-1).date).toBe('2026-12-06');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-03T07:00:00Z'); // 14:00 WIB
  it('describes recent moments', () => {
    expect(relativeTime('2026-11-03T06:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-11-03T06:57:00Z', now)).toBe('3 min ago');
    expect(relativeTime('2026-11-03T05:00:00Z', now)).toBe('2 h ago');
  });
  it('uses WIB days for yesterday and older', () => {
    // 2 Nov 16:00 UTC = 2 Nov 23:00 WIB → yesterday
    expect(relativeTime('2026-11-02T16:00:00Z', now)).toBe('yesterday');
    // 2 Nov 17:30 UTC = 3 Nov 00:30 WIB → same WIB day
    expect(relativeTime('2026-11-02T17:30:00Z', now)).toBe('13 h ago');
    expect(relativeTime('2026-10-30T07:00:00Z', now)).toBe('4 days ago');
    expect(relativeTime('2026-10-01T07:00:00Z', now)).toBe('1 Oct');
    expect(relativeTime('2025-10-01T07:00:00Z', now)).toBe('1 Oct 2025');
  });
});
