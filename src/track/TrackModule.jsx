import { useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { useCurrentMonth, useToday } from '../data/useNow.js';
import { TYPE_LABELS, TYPE_ORDER } from '../lib/fields.js';
import {
  brandLanes,
  brandSplit,
  formatAchievement,
  groupStats,
  myBrandLanes,
  needPicCount,
  paceShort,
  personLanes,
  trackAriaLabel,
} from '../lib/progress.js';
import { monthName as nameOfMonth } from '../lib/time.js';
import { animateTrack } from '../lib/motion.js';
import { TypeCounts, TypeIcon } from '../ui/bits.jsx';
import { IconAlert, IconInfo, IconTarget } from '../ui/icons.jsx';
import { Dots } from './Dots.jsx';
import { TypeRing } from './TypeRing.jsx';

/** "12 / 25 · 48%": Martian Mono 700, the uploaded count in --text, "/ target" dim, % in green from 100%. */
function Headline({ stats, caption }) {
  const { uploaded, target, achievement } = stats;
  const over = achievement != null && achievement >= 100;
  return (
    <div className="headline">
      <p className="hl-num">
        <span className="hl-up mono">{uploaded.total}</span>
        {target && (
          <span className="hl-of mono">
            <span className="hl-sep">/</span>
            {target.total}
          </span>
        )}
        {achievement != null && (
          <span className={`hl-pct mono${over ? ' is-over' : ''}`}>
            <span className="hl-dot" aria-hidden="true">
              ·
            </span>
            {formatAchievement(achievement)}
          </span>
        )}
      </p>
      <p className="hl-caption">{caption}</p>
    </div>
  );
}

/** ▶ Reels 5 / 8 · ▦ Feed 7 / 17 · Planned · Not started · No date (symbols match the dots and rings). */
function Legend({ stats }) {
  return (
    <ul className="legend">
      {TYPE_ORDER.map((type) => {
        const t = stats.target ? stats.target[type] : null;
        return (
          <li key={type} className={`lg-type lg-type--${type}`}>
            <TypeIcon type={type} />
            {TYPE_LABELS[type]}{' '}
            <b className="mono">
              {stats.uploaded[type]}
              {t ? <span className="lg-of"> / {t}</span> : null}
            </b>
            {stats.target && t === 0 && <span className="lg-none">no {TYPE_LABELS[type]} target</span>}
          </li>
        );
      })}
      <li title="Ready, not posted yet">
        <span className="lg lg-p" aria-hidden="true" />
        Planned <b className="mono">{stats.planned}</b>
      </li>
      <li>
        <span className="lg lg-n" aria-hidden="true" />
        Not started <b className="mono">{stats.notStarted}</b>
      </li>
      <li className="legend-nodate">
        No date <b className="mono">{stats.noDate}</b>
      </li>
    </ul>
  );
}

function MixNote({ text, className = '' }) {
  return (
    <p className={`mix-note ${className}`}>
      <IconInfo width={14} height={14} />
      <span>{text}</span>
    </p>
  );
}

/** Behomy Master: target and uploaded per brand, in one hue (uploaded green). */
function BrandLine({ items, brands, targets, month }) {
  const { parts } = brandSplit({ items, brands, targets, month });
  return (
    <div className="split">
      <p className="split-title">By brand</p>
      <ul className="split-list">
        {parts.map((p) => {
          const ratio = p.target ? Math.min(p.uploaded / p.target, 1) : 0;
          return (
            <li key={p.brandId} className="split-item">
              <span className="split-name">{p.label}</span>
              <span
                className={`split-meter${p.target ? '' : ' is-none'}`}
                role="img"
                aria-label={`${p.label}: ${p.uploaded} uploaded${p.target ? ` of ${p.target}` : ', no target'}`}
              >
                <span style={{ width: `${ratio * 100}%` }} />
              </span>
              <span className="mono split-num">
                {p.uploaded}
                <span className="dim"> / {p.target ?? '–'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The progress module v2 (09 §8): the big number, the Reels/Feed ring, the legend and
 * mix note; then the dots (one big row on single-lane pages, stacked lanes elsewhere).
 *   Dika / Zaki:      person (tracker) total · one lane (their brand)
 *   Excel Master:     Excel total · one lane per brand
 *   Excel brand page: that brand · that brand only
 *   Behomy My work:   my total (PIC = me) · one lane per brand I have a target or uploads for
 *   Behomy Master:    team total · one lane per PIC, plus "By brand"
 */
export function TrackModule({ view, items }) {
  const t = useTracker();
  const { month } = useMonth();
  const today = useToday();
  const currentMonth = useCurrentMonth();
  const ref = useRef(null);
  const mName = nameOfMonth(month);

  const { head, lanes, team, needPic } = useMemo(() => {
    let headStats;
    let list;
    if (view.lanes === 'brands') {
      const brandIds = new Set(view.laneBrands.map((b) => b.id));
      headStats = groupStats({ items, targetRows: t.targets.filter((r) => brandIds.has(r.brand_id)), month, today });
      list = brandLanes({ items, brands: view.laneBrands, targets: t.targets, month, today });
    } else if (view.lanes === 'me') {
      headStats = groupStats({ items, targetRows: t.targets.filter((r) => r.profile_id === t.me), month, today });
      list = myBrandLanes({ items: t.items, brands: t.brands, targets: t.targets, me: t.me, month, today });
    } else {
      headStats = groupStats({ items: t.items, targetRows: t.targets, month, today });
      list = personLanes({ items: t.items, people: t.team, targets: t.targets, month, today });
    }
    return {
      head: headStats,
      lanes: list,
      team: view.teamLine ? groupStats({ items: t.items, targetRows: t.targets, month, today }) : null,
      needPic: needPicCount(view.lanes === 'people' ? t.items : items, month),
    };
  }, [view, items, t.items, t.team, t.targets, t.brands, t.me, month, today]);

  // the one orchestrated moment: dots fill and rings draw when the page (or month) loads
  useLayoutEffect(() => animateTrack(ref.current), [view.key, month]);

  const singleLane = view.lanes === 'brands' && lanes.length === 1;
  const targetsHref = `/admin/targets?month=${month}`;
  const scope = view.lanes === 'people' ? ` · ${t.role?.name} team` : view.lanes === 'me' ? ' · you' : lanes.length > 1 ? ' · all brands' : '';
  const caption = `${month === currentMonth ? 'uploaded this month' : `uploaded in ${mName}`}${scope}`;
  const noTarget = `No target set for ${mName} yet.${t.isAdmin ? '' : ' Admin Beyondcy sets targets.'}`;
  // where the dots would be, a dashed box carries the no-target message; then the words don't repeat it
  const noTargetBox = singleLane ? !lanes[0].target : lanes.length === 0 && view.lanes === 'me' && !head.target;

  return (
    <section ref={ref} className="track" aria-labelledby="track-title">
      <h2 id="track-title" className="sr-only">
        Progress in {mName}
      </h2>

      <div className="track-top">
        <Headline stats={head} caption={caption} />
        <TypeRing target={head.target} uploaded={head.uploaded} achievement={head.achievement} />
        <div className="track-words">
          {(head.target || !noTargetBox) && <p className="track-sentence">{head.target ? head.pace.sentence : noTarget}</p>}
          <Legend stats={head} />
          {head.mixNote && <MixNote text={head.mixNote} />}
          {needPic.all > 0 && (
            <p className="track-warn">
              <IconAlert width={14} height={14} />
              {needPic.all === 1 ? '1 item needs a PIC' : `${needPic.all} items need a PIC`}
              {needPic.uploaded > 0 && ` (${needPic.uploaded} uploaded, not counted yet)`}
              {t.isAdmin ? '. Open it and choose one.' : '. Admin Beyondcy picks the PIC.'}
            </p>
          )}
          {team && (
            <p className="track-team">
              Team:{' '}
              <span className="mono">
                {team.uploaded.total} / {team.target?.total ?? '–'}
              </span>
            </p>
          )}
          {t.isAdmin && (
            <Link className="track-targets-link" to={targetsHref}>
              <IconTarget width={14} height={14} />
              {head.target ? `Targets for ${mName}` : 'Set targets'}
            </Link>
          )}
        </div>
      </div>

      {singleLane && (
        <div className="track-dots">
          {lanes[0].target ? (
            <Dots
              size="lg"
              target={lanes[0].target.total}
              uploaded={lanes[0].uploaded.total}
              planned={lanes[0].planned}
              pace={lanes[0].pace}
              label={trackAriaLabel({ ...lanes[0], uploaded: lanes[0].uploaded.total, target: lanes[0].target.total })}
              showPaceLabel
            />
          ) : (
            <p className="no-target">{noTarget}</p>
          )}
        </div>
      )}

      {!singleLane && lanes.length > 0 && (
        <ol className={`lanes${t.isAdmin ? ' lanes--admin' : ''}`}>
          {lanes.map((lane, i) => (
            <li key={lane.key} className="lane">
              <span className="lane-name truncate" title={lane.label}>
                {lane.label}
              </span>
              <div className="lane-track">
                {lane.target ? (
                  <Dots
                    size="sm"
                    target={lane.target.total}
                    uploaded={lane.uploaded.total}
                    planned={lane.planned}
                    pace={lane.pace}
                    label={`${lane.label}: ${trackAriaLabel({ ...lane, uploaded: lane.uploaded.total, target: lane.target.total })}`}
                    showPaceLabel={i === 0}
                  />
                ) : (
                  <span className="lane-empty">No target{t.isAdmin ? '' : ' yet'}</span>
                )}
              </div>
              <span className="lane-count mono">
                {lane.uploaded.total}
                <span className="dim"> / {lane.target?.total ?? '–'}</span>
              </span>
              <TypeCounts uploaded={lane.uploaded} target={lane.target} className="lane-types" />
              <span className={`lane-pace${lane.pace.reached ? ' is-reached' : ''}`}>{paceShort(lane.pace) ?? ''}</span>
              <span className="lane-mix">
                {lane.mixNote && (
                  <span className="lane-mix-icon" title={lane.mixNote}>
                    <IconInfo width={14} height={14} />
                    <span className="sr-only">Mix note</span>
                  </span>
                )}
              </span>
              {t.isAdmin && (
                <Link className="icon-btn lane-link" to={targetsHref} title={`Targets for ${mName}`}>
                  <IconTarget width={15} height={15} />
                  <span className="sr-only">
                    Edit {lane.label}'s targets on the Targets page
                  </span>
                </Link>
              )}
              {lane.mixNote && <MixNote text={lane.mixNote} className="lane-note" />}
            </li>
          ))}
        </ol>
      )}

      {!singleLane && noTargetBox && <p className="no-target">{noTarget}</p>}

      {view.extras && <BrandLine items={t.items} brands={t.brands} targets={t.targets} month={month} />}
    </section>
  );
}
