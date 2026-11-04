import { useAuth } from '../auth/AuthContext.js';
import { useMonth } from '../data/MonthContext.jsx';
import { useCurrentMonth, useNow } from '../data/useNow.js';
import { clockLabel, greetingWIB, monthLabel } from '../lib/time.js';
import { IconChevronLeft, IconChevronRight } from '../ui/icons.jsx';
import { SidebarReveal } from './Sidebar.jsx';

/** "Tue 3 Nov · 14:32:07 WIB", ticking every second. */
export function LiveClock() {
  const now = useNow(1000);
  return (
    <span className="clock mono" title="Jakarta time (WIB)">
      {clockLabel(now)}
    </span>
  );
}

/** The shared month switcher: ‹ November 2026 › Today */
export function MonthSwitcher() {
  const { month, prev, next, goToday } = useMonth();
  const current = useCurrentMonth();
  return (
    <div className="month-switcher" role="group" aria-label="Month">
      <button type="button" className="icon-btn" onClick={prev} aria-label="Previous month">
        <IconChevronLeft />
      </button>
      <span className="month-label" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button type="button" className="icon-btn" onClick={next} aria-label="Next month">
        <IconChevronRight />
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={goToday} disabled={month === current}>
        Today
      </button>
    </div>
  );
}

/**
 * Page title, month switcher, clock (and an optional "⋯" menu); then the greeting.
 * `top` sits between the header and the greeting: the tracker's banner (or its quiet "Add banner").
 */
export function PageHeader({ crumb, title, showMonth = false, menu = null, top = null }) {
  const { profile } = useAuth();
  const now = useNow(30000);
  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <SidebarReveal />
          {crumb && (
            <>
              <span className="page-crumb truncate">{crumb}</span>
              <span className="page-sep" aria-hidden="true">
                ·
              </span>
            </>
          )}
          <h1 className="truncate">{title}</h1>
        </div>
        <div className="page-tools">
          {showMonth && <MonthSwitcher />}
          <LiveClock />
          {menu}
        </div>
      </header>
      <div className="page-top">
        {top}
        <p className="greeting truncate">
          {greetingWIB(now)}, {profile?.display_name}
        </p>
      </div>
    </>
  );
}
