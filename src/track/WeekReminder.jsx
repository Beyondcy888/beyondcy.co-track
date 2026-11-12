// The this-week reminder (update v3, 05 §2): sits to the right of the progress module.
// It should read in two seconds: who it's for, how many are left, and which is next.
//   - Monday–Sunday of the CURRENT week (WIB), whatever month the page is showing
//   - only Not started and Planned content (never Uploaded), plus open projects due this week
//   - anything still open from before this week sits in a small Overdue group on top
//     (Claude's default; remove the group if the owner prefers only this week)
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useToday } from '../data/useNow.js';
import { brandShort, STATUS_LABELS, TYPE_LABELS } from '../lib/fields.js';
import { formatDayMonth } from '../lib/time.js';
import { dayParts, reminder, weekLabel } from '../lib/week.js';
import { Avatar, AvatarStack } from '../people/Avatar.jsx';
import { StatusMark, TypeIcon } from '../ui/bits.jsx';
import { IconAlert, IconArrowDown, IconCalendar, IconFlag } from '../ui/icons.jsx';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The personal line: who this is for, in the page's words. */
function personalLine({ name, view, role, isAdmin, state, scheduled }) {
  const hi = `Hi ${name},`;
  if (isAdmin) {
    const where = view.key === 'master' ? role?.name ?? 'this tracker' : view.title;
    if (state === 'done') return `${hi} ${where} is all caught up this week.`;
    if (state === 'empty') return `${hi} nothing is scheduled in ${where} this week yet.`;
    return `${hi} here's what's still open in ${where} this week.`;
  }
  const team = view.lanes === 'people';
  if (state === 'done') return team ? `${hi} the ${role?.name ?? ''} team is all caught up.`.replace('  ', ' ') : `${hi} you're all caught up.`;
  if (state === 'empty') return team ? `${hi} the team's week is still open.` : `${hi} your week is still open.`;
  if (team) return `${hi} here's what the ${role?.name ?? ''} team still has this week.`.replace('  ', ' ');
  return scheduled > 0 ? `${hi} here's what to finish before the week ends.` : `${hi} here's what needs you.`;
}

function DateBlock({ date, overdue }) {
  const { weekday, day } = dayParts(date);
  return (
    <span className="wr-date" aria-hidden="true">
      <span className="wr-wd">{overdue ? MONTHS_SHORT[Number(date.slice(5, 7)) - 1] : weekday}</span>
      <span className="wr-day mono">{day}</span>
    </span>
  );
}

function Row({ row, view, overdue = false, isNext = false, onOpen, onOpenProject, brandsById }) {
  const when = overdue ? `${formatDayMonth(row.date)}, overdue` : `${dayParts(row.date).weekday} ${dayParts(row.date).day}${row.today ? ', today' : row.late ? ', late' : ''}`;
  const cls = `wr-row${row.today ? ' is-today' : ''}${row.late ? ' is-late' : ''}${isNext ? ' is-next' : ''}`;

  if (row.kind === 'project') {
    const p = row.project;
    return (
      <li>
        <button type="button" className={`${cls} wr-row--project`} onClick={() => onOpenProject(p.id)}>
          <DateBlock date={row.date} overdue={overdue} />
          <span className="wr-main">
            <span className="wr-title">
              <IconFlag className="wr-flag" width={12} height={12} />
              <span className="truncate">{p.name}</span>
            </span>
            <span className="wr-sub">
              <span className="wr-tag wr-tag--project">Project</span>
              {row.today && <span className="wr-tag wr-tag--today">Due today</span>}
              {row.late && <span className="wr-tag wr-tag--late">{overdue ? 'Overdue' : 'Late'}</span>}
            </span>
          </span>
          <AvatarStack ids={p.assignees} size={20} max={3} className="wr-who" />
          <span className="sr-only">
            Project, {when}
          </span>
        </button>
      </li>
    );
  }

  const item = row.item;
  const brand = view.showBrand ? brandShort(brandsById[item.brand_id]) : null;
  return (
    <li>
      <button type="button" className={cls} onClick={() => onOpen(item.id)}>
        <DateBlock date={row.date} overdue={overdue} />
        <span className="wr-main">
          <span className="wr-title">
            {item.type ? <TypeIcon type={item.type} size={11} /> : <span className="chip-notype" aria-hidden="true" />}
            <span className={`truncate${item.content ? '' : ' dim'}`}>{item.content || 'Untitled'}</span>
          </span>
          <span className="wr-sub">
            <span className="wr-status">
              <StatusMark status={item.status} />
              {STATUS_LABELS[item.status]}
            </span>
            {brand && <span className="wr-brand truncate">{brand}</span>}
            {row.today && <span className="wr-tag wr-tag--today">Today</span>}
            {row.late && <span className="wr-tag wr-tag--late">{overdue ? 'Overdue' : 'Late'}</span>}
          </span>
        </span>
        {view.showPic && item.pic_id && <Avatar id={item.pic_id} size={20} className="wr-who" labelled />}
        <span className="sr-only">
          {item.type ? TYPE_LABELS[item.type] : 'No type'}, {when}
        </span>
      </button>
    </li>
  );
}

/** The small win: a check mark on the brand green, with the dot motif behind it. */
function DoneMark() {
  return (
    <span className="wr-done-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
        <g className="wr-done-dots" fill="currentColor">
          {[
            [6, 12, 2.2],
            [58, 18, 1.8],
            [10, 52, 1.6],
            [56, 50, 2.4],
            [32, 3, 1.6],
            [3, 32, 1.4],
            [61, 34, 1.4],
            [30, 61, 1.8],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        <circle className="wr-done-disc" cx="32" cy="32" r="20" fill="currentColor" />
        <path className="wr-done-tick" d="m23 32.5 6.2 6.2L41.5 26" stroke="#131218" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </svg>
    </span>
  );
}

/**
 * `items` and `projects` are already narrowed to the page (My work = mine, Master = the
 * tracker, a brand page = that brand). `onShowWeek` scrolls to the calendar and highlights
 * this week.
 */
export function WeekReminder({ view, items, projects, onOpen, onOpenProject, onShowWeek }) {
  const t = useTracker();
  const { profile } = useAuth();
  const today = useToday();
  const r = useMemo(() => reminder({ items, projects, today }), [items, projects, today]);
  const name = profile?.display_name ?? 'there';
  const line = personalLine({ name, view, role: t.role, isAdmin: t.isAdmin, state: r.state, scheduled: r.scheduled });
  const rowProps = { view, onOpen, onOpenProject, brandsById: t.brandsById };
  const hasList = r.rows.length > 0 || r.overdue.length > 0;

  return (
    <aside className={`wr wr--${r.state}${r.overdue.length ? ' has-overdue' : ''}`} aria-labelledby="wr-title">
      <header className="wr-head">
        <div className="wr-head-text">
          <p className="wr-eyebrow" id="wr-title">
            This week <span aria-hidden="true">·</span> <span className="mono">{weekLabel(r.week)}</span>
          </p>
          <p className="wr-line">{line}</p>
        </div>
        {r.state === 'list' ? (
          <p className="wr-count" aria-label={`${r.toGo} to go this week`}>
            <span className="wr-count-num mono">{r.toGo}</span>
            <span className="wr-count-label">to go</span>
          </p>
        ) : r.state === 'done' ? (
          <p className="wr-count wr-count--done" aria-label={`All ${r.scheduled} done this week`}>
            <span className="wr-count-num mono">
              {r.finished}/{r.scheduled}
            </span>
            <span className="wr-count-label">done</span>
          </p>
        ) : null}
      </header>

      <div className="wr-body">
        {r.state === 'done' && (
          <div className="wr-state wr-state--done">
            <DoneMark />
            <p>
              <strong>All done for this week.</strong>
              <span>Everything is uploaded{r.scheduled > 1 ? `: ${r.finished} of ${r.scheduled}` : ''}. Nice work.</span>
            </p>
          </div>
        )}

        {r.state === 'empty' && (
          <div className="wr-state wr-state--empty">
            <span className="wr-empty-mark" aria-hidden="true">
              <IconCalendar width={20} height={20} />
            </span>
            <p>
              <strong>Nothing planned for this week yet.</strong>
              <span>
                Give content a date in the{' '}
                <button type="button" className="link-btn" onClick={onShowWeek}>
                  calendar
                </button>{' '}
                and it shows up here.
              </span>
            </p>
          </div>
        )}

        {hasList && (
          <div className="wr-scroll" tabIndex={-1}>
            {r.overdue.length > 0 && (
              <section className="wr-group wr-group--overdue" aria-label={`Overdue: ${r.overdue.length}`}>
                <h3 className="wr-group-title">
                  <IconAlert width={12} height={12} /> Overdue <span className="mono">{r.overdue.length}</span>
                </h3>
                <ul className="wr-list">
                  {r.overdue.map((row) => (
                    <Row key={`${row.kind}:${row.id}`} row={row} overdue {...rowProps} />
                  ))}
                </ul>
              </section>
            )}
            {r.rows.length > 0 && (
              <section className="wr-group" aria-label="This week">
                {r.overdue.length > 0 && <h3 className="wr-group-title">This week</h3>}
                <ul className="wr-list">
                  {r.rows.map((row) => (
                    <Row key={`${row.kind}:${row.id}`} row={row} isNext={r.next === row} {...rowProps} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {r.rows.length > 0 && (
        <footer className="wr-foot">
          <button type="button" className="wr-more" onClick={onShowWeek}>
            Show this week in the calendar <IconArrowDown width={13} height={13} />
          </button>
        </footer>
      )}
    </aside>
  );
}
