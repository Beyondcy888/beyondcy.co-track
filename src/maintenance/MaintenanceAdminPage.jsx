// The Admin "Maintenance" page (update v4, file 10 §1), the slim "maintenance is on" bar and
// the preview. Only the Admin Beyondcy account sees and uses any of it (rpc is_maintenance_exempt):
// any other admin is locked out like staff, and the database refuses them anyway.
import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { homePathFor } from '../layout/nav.js';
import { PageHeader } from '../layout/PageHeader.jsx';
import { useNow } from '../data/useNow.js';
import { friendlyError } from '../lib/errors.js';
import { AppSkeleton } from '../components/skeleton/PageSkeletons.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { IconArrowUpRight, IconClock, IconWrench } from '../ui/icons.jsx';
import { isActive, LOCAL_BYPASS, useMaintenance } from './MaintenanceProvider.jsx';
import { MaintenanceScreen } from './MaintenanceScreen.jsx';
import { formatCountdown, formatWib } from './page/maintenance.js';

const BASE = import.meta.env.BASE_URL;
const DURATIONS = [
  [30, '30 min'],
  [60, '1 hour'],
  [120, '2 hours'],
  [180, '3 hours'],
];
const LABEL = { dashboard: 'Dashboard', tracker: 'Tracker' };
const durationText = (m) => DURATIONS.find((d) => d[0] === m)?.[1] ?? `${m} min`;
/** '00:42:10' → '42:10' (the bar); hours stay when there are any. */
const shortCountdown = (ms) => formatCountdown(ms).replace(/^00:/, '');

/** Only the exempt account; everyone else goes home (another admin included). */
export function RequireExempt({ children }) {
  const m = useMaintenance();
  const { profile } = useAuth();
  if (m.exempt === null) return <AppSkeleton label="Checking access" />;
  if (!m.exempt) return <Navigate to={homePathFor(profile)} replace />;
  return children;
}

/** /maintenance-preview?site=tracker|dashboard: the page as others see it (the real end time when it's on). */
export function MaintenancePreview() {
  const [params] = useSearchParams();
  const m = useMaintenance();
  const site = params.get('site') === 'dashboard' ? 'dashboard' : 'tracker';
  const row = m.rows[site];
  // when it isn't on, a sample end time an hour from now
  const sample = useMemo(() => new Date(Date.now() + 3600 * 1000).toISOString(), []);
  const endsAt = isActive(row) ? row.ends_at : sample;
  return <MaintenanceScreen site={LABEL[site]} endsAt={endsAt} state="counting" signIn={site === 'tracker'} />;
}

/**
 * Every tracker page while any maintenance is on (10 §1): for the exempt account, and on a working
 * copy on this computer (where maintenance is ignored so the agent doing the updates keeps access).
 */
export function MaintenanceBar() {
  const m = useMaintenance();
  const now = useNow(1000);
  const exempt = m.exempt === true;
  if (!exempt && !LOCAL_BYPASS) return null;
  const on = ['tracker', 'dashboard'].filter((site) => isActive(m.rows[site], now));
  if (!on.length) return null;
  return (
    <div className="mbar-stack">
      {on.map((site) => (
        <p key={site} className={`mbar mbar--${site}`} role="status">
          <IconWrench width={14} height={14} />
          <span>
            <strong>{LABEL[site]} maintenance is on.</strong> Everyone else sees the maintenance page
            {!exempt && LOCAL_BYPASS
              ? site === 'tracker'
                ? '; this copy on your computer ignores it so updates can be built and checked. Tracker data stays locked for every account except Admin Beyondcy.'
                : '; this copy on your computer is not affected.'
              : '.'}{' '}
            Ends in <span className="mono">{shortCountdown(Date.parse(m.rows[site].ends_at) - now)}</span>
          </span>
          {exempt && (
            <Link to="/admin/maintenance" className="mbar-link">
              Manage
            </Link>
          )}
        </p>
      ))}
    </div>
  );
}

function SiteCard({ site }) {
  const m = useMaintenance();
  const confirm = useConfirm();
  const toast = useToast();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const row = m.rows[site];
  const on = isActive(row, now);
  const name = LABEL[site];
  const address = site === 'tracker' ? 'track.beyondcy.co' : 'dash.beyondcy.co';

  const run = async (call, done) => {
    setBusy(true);
    const r = await call();
    setBusy(false);
    if (r.error) toast(friendlyError(r.error, { refused: 'Only Admin Beyondcy can change maintenance.' }), { tone: 'danger', duration: 6500 });
    else if (done) toast(done);
  };

  const turnOn = async (minutes) => {
    const ok = await confirm({
      title: `Turn on ${name} maintenance for ${durationText(minutes)}?`,
      body:
        site === 'tracker'
          ? 'Everyone except you will see the maintenance page. Open tracker tabs switch within seconds.'
          : 'Everyone visiting the dashboard will see the maintenance page. Open dashboard tabs switch within a minute.',
      confirmLabel: `Turn on for ${durationText(minutes)}`,
    });
    if (ok) run(() => m.start(site, minutes), `${name} maintenance is on for ${durationText(minutes)}`);
  };

  const addTime = (minutes) => run(() => m.extend(site, minutes), `Added ${durationText(minutes)} to ${name} maintenance`);

  const endNow = async () => {
    const ok = await confirm({
      title: `End ${name} maintenance now?`,
      body: site === 'tracker' ? 'Everyone gets the tracker back within seconds.' : 'The dashboard opens again for everyone.',
      confirmLabel: 'End now',
      tone: 'danger',
    });
    if (ok) run(() => m.end(site), `${name} maintenance ended`);
  };

  return (
    <section className={`mcard${on ? ' is-on' : ''}`} aria-labelledby={`mcard-${site}`}>
      <header className="mcard-head">
        <h2 id={`mcard-${site}`} className="mcard-name">
          {name}
        </h2>
        <span className={`mcard-status${on ? ' is-on' : ''}`}>
          <span className="mcard-dot" aria-hidden="true" />
          {on ? 'On' : 'Off'}
        </span>
      </header>
      <p className="mcard-where">{address}</p>

      {on ? (
        <>
          <div className="mcard-count">
            <span className="mcard-count-label">Ends in</span>
            <span className="mcard-count-num mono" aria-live="off">
              {formatCountdown(Date.parse(row.ends_at) - now)}
            </span>
            <span className="mcard-count-end">around {formatWib(row.ends_at)} WIB</span>
          </div>
          <p className="mcard-auto">
            <IconClock width={14} height={14} /> Reopens automatically when the timer ends.
            {row.set_by_name && <span className="dim"> Turned on by {row.set_by_name}.</span>}
          </p>
          <div className="mcard-row">
            <span className="mcard-row-label">Add time</span>
            <div className="mcard-btns">
              {DURATIONS.map(([min, label]) => (
                <button key={min} type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => addTime(min)}>
                  +{label}
                </button>
              ))}
            </div>
          </div>
          <div className="mcard-foot">
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={endNow}>
              End now
            </button>
            <a className="mcard-preview" href={`${BASE}maintenance-preview?site=${site}`} target="_blank" rel="noopener noreferrer">
              Preview page <IconArrowUpRight width={13} height={13} />
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mcard-off">
            {row?.ended_reason === 'timer'
              ? 'Open for everyone. Last time it reopened by itself when the timer ended.'
              : row?.ended_reason === 'ended_early'
                ? 'Open for everyone. Last time it was ended early.'
                : 'Open for everyone.'}
          </p>
          <div className="mcard-row">
            <span className="mcard-row-label">Turn on for</span>
            <div className="mcard-btns">
              {DURATIONS.map(([min, label]) => (
                <button key={min} type="button" className="btn btn-secondary btn-sm" disabled={busy || !row} onClick={() => turnOn(min)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mcard-foot">
            <span className="dim mcard-note">Reopens automatically when the timer ends.</span>
            <a className="mcard-preview" href={`${BASE}maintenance-preview?site=${site}`} target="_blank" rel="noopener noreferrer">
              Preview page <IconArrowUpRight width={13} height={13} />
            </a>
          </div>
        </>
      )}
    </section>
  );
}

export function MaintenanceAdminPage() {
  const m = useMaintenance();
  return (
    <div className="maintenance-page">
      <PageHeader title="Maintenance" />
      <div className="people-intro">
        <p>
          Switch the Dashboard and/or the Tracker into maintenance for a set time. Everyone except you (other admins
          included) sees the maintenance page with a countdown, and open tabs switch over after saving what's being typed.
        </p>
        <p className="dim">
          Notifications pause during Tracker maintenance. Backups keep running. Every start, extension and end is recorded
          in <Link to="/admin/activity">Activity Logs</Link>.
        </p>
      </div>
      {!m.loaded ? null : (
        <div className="mcards">
          <SiteCard site="dashboard" />
          <SiteCard site="tracker" />
        </div>
      )}
    </div>
  );
}
