// A matching skeleton for every area (update v4, file 11 table). Each mirrors the real
// layout (same classes for the outer boxes where possible), so nothing jumps when data arrives.
import { useEffect, useRef } from 'react';
import { CAL_WEEKDAYS, calendarWeeks } from '../../lib/time.js';
import { SkeletonBlock, SkeletonCircle, SkeletonLine, SkeletonRegion, SkeletonRows } from './Skeleton.jsx';

/** 4 boxes the same size as the real ones: label line, big number, short line; no illustration. */
export function BoxesSkeleton({ className = '' }) {
  return (
    <div className={`stat-boxes sk-boxes ${className}`}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="sk-box">
          <SkeletonLine width={84} size="sm" />
          <SkeletonLine width={i === 3 ? 104 : 72} size="num" className="sk-box-num" />
          <SkeletonLine width={i === 1 ? 128 : 96} size="sm" />
        </div>
      ))}
    </div>
  );
}

/** The progress module: a big numeral, the ring, three legend lines; the reminder: a heading + 4 rows. */
export function ModuleSkeleton({ reminder = true }) {
  return (
    <div className="track sk-track">
      <div className={`track-top${reminder ? ' has-aside' : ''}`}>
        <div className="sk-headline">
          <SkeletonBlock width={240} height={72} radius={14} />
          <SkeletonLine width={150} size="sm" />
        </div>
        <SkeletonCircle size={150} className="sk-ring" />
        <div className="sk-legend">
          <SkeletonLine width="72%" size="md" />
          <SkeletonLine width="88%" size="sm" />
          <SkeletonLine width="60%" size="sm" />
        </div>
        {reminder && (
          <div className="track-aside">
            <div className="sk-reminder">
              <SkeletonLine width="44%" size="sm" />
              <SkeletonLine width="70%" size="md" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="sk-wr-row">
                  <SkeletonBlock width={34} height={34} radius={9} />
                  <div className="sk-row-lines">
                    <SkeletonLine width={`${70 - i * 9}%`} size="sm" />
                    <SkeletonLine width="34%" size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* lanes: a name line + a row of small dots per lane */}
      <div className="sk-lanes">
        {[0, 1].map((l) => (
          <div key={l} className="sk-lane">
            <SkeletonLine width={110} size="sm" />
            <div className="sk-dots">
              {Array.from({ length: 18 }, (_, i) => (
                <SkeletonCircle key={i} size={11} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The real header row + ~8 rows of cell lines in the real column widths. */
export function TableSkeleton({ columns = [260, 150, 116, 280, 280, 280, 136, 220, 220, 160], rows = 8 }) {
  const total = columns.reduce((a, b) => a + b, 0);
  return (
    <div className="content-section sk-table-section">
      <div className="toolbar">
        <SkeletonBlock width={136} height={36} radius={999} />
        <SkeletonBlock width={260} height={36} radius={999} />
        <SkeletonBlock width={120} height={36} radius={999} />
        <SkeletonBlock width={110} height={36} radius={999} />
      </div>
      <div className="table-wrap sk-table-wrap">
        <div className="sk-table" style={{ minWidth: total }}>
          <div className="sk-tr sk-th">
            {columns.map((w, i) => (
              <span key={i} style={{ width: w }} className="sk-td">
                <SkeletonLine width={Math.min(70, w * 0.4)} size="sm" />
              </span>
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="sk-tr">
              {columns.map((w, i) => (
                <span key={i} style={{ width: w }} className="sk-td">
                  {i === 1 || i === 2 ? (
                    <SkeletonBlock width={i === 1 ? 84 : 70} height={22} radius={999} />
                  ) : (
                    <>
                      <SkeletonLine width={`${78 - ((r + i) % 3) * 16}%`} size="sm" />
                      {i >= 3 && i <= 5 && (r + i) % 2 === 0 && <SkeletonLine width="52%" size="sm" />}
                    </>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The real month grid (Sun-first, red-tinted Sunday) with 1–2 chip blocks in some days. */
export function CalendarSkeleton({ month }) {
  const weeks = calendarWeeks(month);
  return (
    <div className="cal-section sk-cal">
      <div className="section-head cal-head">
        <SkeletonLine width={110} size="lg" />
      </div>
      <div className="cal-layout">
        <table className="cal" aria-hidden="true">
          <thead>
            <tr>
              {CAL_WEEKDAYS.map((d, i) => (
                <th key={d} className={i === 0 ? 'is-sun' : undefined}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, w) => (
              <tr key={w}>
                {week.map(({ date, inMonth }, col) => {
                  const n = Number(date.slice(8));
                  const chips = inMonth ? (n * 7 + w) % 5 === 0 ? 2 : (n * 3) % 4 === 0 ? 1 : 0 : 0;
                  return (
                    <td key={date} className={`cal-day${inMonth ? '' : ' is-out'}${col === 0 ? ' is-sun' : ''}`}>
                      <div className="cal-cell sk-cal-cell">
                        <SkeletonLine width={16} size="sm" className="sk-cal-num" />
                        {Array.from({ length: chips }, (_, i) => (
                          <SkeletonBlock key={i} height={20} radius={999} width={i ? '62%' : '86%'} />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="nodate sk-nodate">
          <SkeletonLine width={90} size="sm" />
          <SkeletonBlock height={24} radius={999} />
          <SkeletonBlock height={24} radius={999} width="80%" />
        </div>
      </div>
    </div>
  );
}

/** 5 columns with header lines + 3 card blocks each. */
export function BoardSkeleton() {
  return (
    <div className="board-section sk-board">
      <div className="section-head">
        <SkeletonLine width={130} size="lg" />
      </div>
      <div className="board">
        {[0, 1, 2, 3, 4].map((c) => (
          <div key={c} className="bcol">
            <div className="sk-bcol-head">
              <SkeletonLine width={90} size="sm" />
              <SkeletonLine width={40} size="num" />
              <SkeletonLine width={120} size="xs" />
            </div>
            {[0, 1, 2].map((k) => (
              <SkeletonBlock key={k} height={c === 3 ? 96 : 84} radius={10} className="sk-card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A whole tracker page while it loads: boxes, module + reminder, lanes, then the views. */
export function TrackerPageSkeleton({ month, stacked = true }) {
  return (
    <SkeletonRegion label="Loading the tracker" className="sk-page">
      <BoxesSkeleton className="stat-boxes--page" />
      <ModuleSkeleton />
      {stacked ? (
        <>
          <TableSkeleton />
          <CalendarSkeleton month={month} />
          <BoardSkeleton />
        </>
      ) : (
        <>
          <div className="sk-tabs">
            <SkeletonBlock width={128} height={30} radius={8} />
            <SkeletonBlock width={100} height={30} radius={8} />
            <SkeletonBlock width={120} height={30} radius={8} />
          </div>
          <TableSkeleton />
        </>
      )}
    </SkeletonRegion>
  );
}

/** Header + ~6 rows (Performance per PIC, Detail per PIC and brand). */
export function DashTableSkeleton({ rows = 6, cols = 7 }) {
  return (
    <div className="dash-section">
      <div className="section-head">
        <SkeletonLine width={180} size="lg" />
      </div>
      <div className="table-wrap sk-dash-table">
        {Array.from({ length: rows + 1 }, (_, r) => (
          <div key={r} className={`sk-dash-row${r === 0 ? ' is-head' : ''}`}>
            {Array.from({ length: cols }, (_, c) => (
              <span key={c} className="sk-dash-cell">
                {c === 0 && r > 0 ? <SkeletonCircle size={24} /> : null}
                <SkeletonLine width={r === 0 ? 64 : `${60 + ((r + c) % 3) * 12}%`} size={r === 0 ? 'xs' : 'sm'} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Admin Dashboard: 4 boxes, 9 equal brand cards (circle + 2 lines), the calendar, two tables. */
export function DashboardSkeleton({ month }) {
  return (
    <SkeletonRegion label="Loading the dashboard" className="sk-page">
      <BoxesSkeleton />
      <div className="dash-section">
        <div className="section-head">
          <SkeletonLine width={90} size="lg" />
        </div>
        <div className="brand-cards sk-brand-cards" style={{ '--count': 9 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="sk-brand-card">
              <SkeletonCircle size={44} />
              <div className="sk-row-lines">
                <SkeletonLine width="70%" size="sm" />
                <SkeletonLine width="44%" size="lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <CalendarSkeleton month={month} />
      <DashTableSkeleton />
      <DashTableSkeleton cols={9} />
    </SkeletonRegion>
  );
}

/** Projects / lists: rows of a circle (photo) + 2 lines. */
export function ListSkeleton({ label = 'Loading', count = 5 }) {
  return (
    <SkeletonRegion label={label} className="sk-list">
      <SkeletonRows count={count} circle={34} widths={['36%', '64%']} />
    </SkeletonRegion>
  );
}

/** Targets: grouped rows of input-sized blocks. */
export function TargetsSkeleton() {
  return (
    <SkeletonRegion label="Loading targets" className="sk-targets">
      {[3, 1, 4].map((rows, g) => (
        <div key={g} className="sk-tg-group">
          <SkeletonLine width={170} size="lg" />
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="sk-tg-row">
              <SkeletonCircle size={28} />
              <SkeletonLine width={120} size="sm" />
              <SkeletonLine width={90} size="sm" />
              <SkeletonBlock width={76} height={36} radius={10} />
              <SkeletonBlock width={76} height={36} radius={10} />
              <SkeletonLine width={40} size="sm" />
              <SkeletonBlock width={220} height={36} radius={10} className="sk-tg-note" />
            </div>
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Comments and history in the drawer / project popup: circle + 2 lines × 3. */
export function ThreadSkeleton({ label = 'Loading' }) {
  return (
    <SkeletonRegion label={label} className="sk-thread">
      <SkeletonRows count={3} circle={24} widths={['30%', '78%']} />
    </SkeletonRegion>
  );
}

/** The drawer while its tracker loads: label lines + field blocks, in a real drawer frame. */
export function DrawerSkeleton({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label="Loading the item"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="drawer-inner">
        <SkeletonRegion label="Loading the item" className="sk-drawer">
          <SkeletonBlock width={84} height={24} radius={999} />
          <SkeletonLine width="68%" size="xl" />
          <SkeletonLine width="40%" size="sm" />
          <div className="sk-drawer-tabs">
            <SkeletonLine width={60} size="sm" />
            <SkeletonLine width={80} size="sm" />
            <SkeletonLine width={60} size="sm" />
          </div>
          {[44, 44, 80, 80, 44].map((h, i) => (
            <div key={i} className="sk-field">
              <SkeletonLine width={70 + (i % 3) * 20} size="sm" />
              <SkeletonBlock height={h} radius={10} />
            </div>
          ))}
        </SkeletonRegion>
      </div>
    </dialog>
  );
}

/** Before the person and the app's setup data are known: the shell (sidebar + header). */
export function AppSkeleton({ label = 'Loading' }) {
  return (
    <SkeletonRegion label={label} className="sk-app">
      <div className="sk-app-side">
        <SkeletonBlock width={120} height={26} radius={8} />
        <div className="sk-app-nav">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonLine key={i} width={`${70 - i * 6}%`} size="md" />
          ))}
        </div>
        <div className="sk-app-who">
          <SkeletonCircle size={32} />
          <SkeletonLine width={90} size="sm" />
        </div>
      </div>
      <div className="sk-app-main">
        <div className="sk-app-head">
          <SkeletonLine width={140} size="lg" />
          <SkeletonBlock width={260} height={30} radius={999} />
        </div>
        <SkeletonLine width={300} size="xl" />
        <BoxesSkeleton />
        <SkeletonBlock height={180} radius={14} />
      </div>
    </SkeletonRegion>
  );
}
