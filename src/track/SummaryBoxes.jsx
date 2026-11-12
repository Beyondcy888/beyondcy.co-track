// The four summary boxes: Total target · Uploaded · Remaining · Achievement.
// ONE shared component (update v3, 04 §1 and 05 §1): the Admin Dashboard shows it for every
// tracker, and each tracker page shows it for that page's scope. It takes the same numbers
// as the progress module (lib/progress.js), so the two always agree.
import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatAchievement } from '../lib/progress.js';
import { daysInMonth } from '../lib/time.js';
import { TypeIcon } from '../ui/bits.jsx';
import { Gauge, IllusCards, IllusHourglass, IllusPhone } from './illustrations.jsx';

const fmt = (n) => Number(n).toLocaleString('en-US');

/**
 * One box. The box keeps its size; the number is as big as fits (it shrinks only for long
 * values), and the illustration behind it grows into whatever room the number leaves,
 * so it never sits on top of the number or the line below.
 */
function StatBox({ label, value, frac = null, unit = null, line, illus, className = '' }) {
  const boxRef = useRef(null);
  const numRef = useRef(null);
  const text = String(value);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const num = numRef.current;
    if (!box || !num) return undefined;
    const measure = () => {
      const n = num.getBoundingClientRect();
      // how wide the number is, and where its bottom edge sits inside the box
      box.style.setProperty('--num-w', `${Math.ceil(n.width)}px`);
      box.style.setProperty('--num-b', `${Math.ceil(n.bottom - box.getBoundingClientRect().top)}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure); // also fires when the web font arrives
    ro.observe(num);
    return () => ro.disconnect();
  }, []);

  return (
    <li ref={boxRef} className={`stat-box ${className}`}>
      <p className="stat-label">{label}</p>
      {/* --chars: how many characters must fit (the smaller parts count for less) */}
      <p className="stat-num mono" style={{ '--chars': Math.max(text.length + (frac ? frac.length * 0.56 : 0) + (unit ? unit.length * 0.42 + 0.3 : 0), 3) }}>
        <span ref={numRef} className="stat-num-in">
          {text}
          {frac && <span className="stat-frac">{frac}</span>}
          {unit && <span className="stat-unit">{unit}</span>}
        </span>
      </p>
      <p className="stat-line">{line}</p>
      <span className="stat-illus" aria-hidden="true">
        {illus}
      </span>
    </li>
  );
}

function TypeWord({ type, children }) {
  return (
    <span className={`tw tw--${type}`}>
      <TypeIcon type={type} size={11} />
      {children}
    </span>
  );
}

/**
 * `stats` is a groupStats() result. `targetsHref` (Admin) links "Set targets" where there
 * is no target yet; staff read "No target yet" instead.
 */
export function SummaryBoxes({ stats, month, today, targetsHref = null, label = 'This month in numbers', className = '' }) {
  const t = stats.target;
  const u = stats.uploaded;
  const todayMonth = today.slice(0, 7);
  const daysLeft = daysInMonth(month) - Number(today.slice(8));
  const when =
    month === todayMonth ? (daysLeft === 0 ? 'last day' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`) : month < todayMonth ? 'month ended' : 'not started yet';
  const status = stats.status;
  const paceText =
    status.key === 'on_track' ? 'On pace' : status.key === 'behind' ? `${status.behind} behind pace` : status.key === 'none' ? 'No targets set yet' : status.label;
  const noTarget = targetsHref ? <Link to={targetsHref}>Set targets</Link> : <span>No target yet</span>;
  // "41.8%" → big "41", smaller ".8%": the digits that matter stay big, and the gauge keeps its room
  const pct = stats.achievement == null ? null : formatAchievement(stats.achievement).match(/^([0-9]+)(.*)$/);

  return (
    <ul className={`stat-boxes ${className}`} aria-label={label}>
      <StatBox
        label="Total target"
        value={t ? fmt(t.total) : '–'}
        line={
          t ? (
            <>
              <TypeWord type="reels">{fmt(t.reels)} Reels</TypeWord>
              <TypeWord type="feed">{fmt(t.feed)} Feed</TypeWord>
            </>
          ) : (
            noTarget
          )
        }
        illus={<IllusCards />}
      />
      <StatBox
        label="Uploaded"
        value={fmt(u.total)}
        line={
          <>
            <TypeWord type="reels">
              {fmt(u.reels)}/{t ? fmt(t.reels) : '–'} Reels
            </TypeWord>
            <TypeWord type="feed">
              {fmt(u.feed)}/{t ? fmt(t.feed) : '–'} Feed
            </TypeWord>
          </>
        }
        illus={<IllusPhone />}
      />
      <StatBox
        label="Remaining"
        value={!t ? '–' : stats.over > 0 ? `+${fmt(stats.over)}` : fmt(stats.remaining)}
        unit={t && stats.over > 0 ? 'over' : null}
        className={stats.over > 0 ? 'is-over' : ''}
        line={
          t ? (
            <>
              <span className="stat-togo">
                <TypeWord type="reels">{fmt(Math.max(t.reels - u.reels, 0))}</TypeWord>
                <TypeWord type="feed">{fmt(Math.max(t.feed - u.feed, 0))}</TypeWord>
                <span>to go</span>
              </span>
              <span>{when}</span>
            </>
          ) : (
            <span>{when}</span>
          )
        }
        illus={<IllusHourglass />}
      />
      <StatBox
        label="Achievement"
        value={pct ? pct[1] : '–'}
        frac={pct ? pct[2] : null}
        className={`stat-box--gauge${stats.achievement != null && stats.achievement >= 100 ? ' is-done' : ''}`}
        line={<span className={`stat-status stat-status--${status.key}`}>{paceText}</span>}
        illus={<Gauge value={stats.achievement} />}
      />
    </ul>
  );
}
