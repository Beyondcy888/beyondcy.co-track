// Pieces shared by the Admin dashboard's tables and tracker list.
import { Link } from 'react-router-dom';
import { formatAchievement, trackAriaLabel } from '../lib/progress.js';
import { TypeIcon } from '../ui/bits.jsx';
import { IconChevronRight, IconInfo } from '../ui/icons.jsx';

/** "17 (▶17 / ▦0)": total, then the split with the type icons. */
export function SplitCell({ set }) {
  if (!set) return <span className="dim">–</span>;
  return (
    <span className="split-cell">
      <span className="mono split-total">{set.total}</span>
      <span className="split-types">
        (<TypeIcon type="reels" size={10} />
        <span className="sr-only">Reels </span>
        <span className="mono">{set.reels}</span> / <TypeIcon type="feed" size={10} />
        <span className="sr-only">Feed </span>
        <span className="mono">{set.feed}</span>)
      </span>
    </span>
  );
}

/** The achievement number, a thin bar, and the mix note (icon + small text) when relevant. */
export function AchievementCell({ stats }) {
  const value = stats.achievement;
  return (
    <div className="ach">
      <div className="ach-row">
        <span className={`mono ach-num${value != null && value >= 100 ? ' is-done' : ''}`}>{formatAchievement(value)}</span>
        {value != null && (
          <span className="ach-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(value, 100)}%` }} />
          </span>
        )}
        {stats.mixNote && (
          <span className="ach-mix" title={stats.mixNote}>
            <IconInfo width={13} height={13} />
          </span>
        )}
      </div>
      {stats.mixNote && <p className="ach-note">{stats.mixNote}</p>}
    </div>
  );
}

/** Done · On track · Behind · Not reached · Upcoming · No target (always a word, never colour alone). */
export function StatusChip({ status }) {
  return <span className={`tstatus tstatus--${status.key}`}>{status.label}</span>;
}

/** A thin line version of the track: uploaded, planned, remaining, and the pace tick. */
function MiniTrack({ stats }) {
  const uploaded = stats.uploaded.total;
  const target = stats.target?.total ?? null;
  const label = trackAriaLabel({ uploaded, planned: stats.planned, notStarted: stats.notStarted, target, pace: stats.pace });
  if (target == null) return <span className="mini mini--none" role="img" aria-label={label} />;
  const scale = Math.max(target, uploaded, 1);
  const up = Math.min(uploaded, target);
  const pl = Math.min(stats.planned, Math.max(scale - uploaded, 0));
  const tick = stats.pace?.phase === 'current' ? Math.min(stats.pace.expected / scale, 1) : null;
  return (
    <span className="mini" role="img" aria-label={label}>
      <span className="mini-up" style={{ width: `${(up / scale) * 100}%` }} />
      <span className="mini-pl" style={{ width: `${(pl / scale) * 100}%` }} />
      {uploaded > target && <span className="mini-bonus" style={{ width: `${((uploaded - target) / scale) * 100}%` }} />}
      {tick != null && <span className="mini-tick" style={{ left: `${tick * 100}%` }} />}
    </span>
  );
}

/** §9.5: one row per tracker (name, people, mini progress line) linking to the tracker. */
export function TrackerList({ rows, loading }) {
  return (
    <ul className="choose-list">
      {rows.map(({ role, stats, people, brands }) => (
        <li key={role.id}>
          <Link to={`/t/${role.id}`} className="choose-row">
            <span className="choose-name">
              <span className="choose-title">{role.name}</span>
              <span className="choose-people">{people.length ? people.join(', ') : 'No one assigned yet'}</span>
            </span>
            <span className="choose-brands">{brands.length > 1 ? brands.join(' · ') : ''}</span>
            <span className="choose-progress">
              {loading ? (
                <span className="dim">Loading…</span>
              ) : (
                <>
                  <MiniTrack stats={stats} />
                  <span className="choose-numbers">
                    <span className="mono">
                      {stats.uploaded.total}
                      <span className="dim"> / {stats.target?.total ?? '–'}</span>
                    </span>
                    {stats.achievement != null && (
                      <span className={`mono choose-pct${stats.achievement >= 100 ? ' is-over' : ''}`}>{formatAchievement(stats.achievement)}</span>
                    )}
                  </span>
                  <span className="choose-pace">{stats.target ? stats.pace.sentence : 'No target set'}</span>
                </>
              )}
            </span>
            <IconChevronRight className="choose-chev" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
