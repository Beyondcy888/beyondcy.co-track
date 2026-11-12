import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { TrackerProvider, useTracker } from '../data/TrackerProvider.jsx';
import { useToday } from '../data/useNow.js';
import { PageHeader } from '../layout/PageHeader.jsx';
import { brandNamer, CalendarLegend, MonthCalendar } from '../calendar/MonthCalendar.jsx';
import { useCalendarMoves } from '../calendar/useCalendarMoves.js';
import { ItemDrawer } from '../drawer/ItemDrawer.jsx';
import { friendlyError } from '../lib/errors.js';
import { STATUS_LABELS, STATUS_ORDER, TYPE_LABELS } from '../lib/fields.js';
import { groupStats, performance } from '../lib/progress.js';
import { monthLabel } from '../lib/time.js';
import { Person } from '../people/Avatar.jsx';
import { PersonSelect } from '../people/PersonSelect.jsx';
import { useProjects } from '../projects/ProjectsProvider.jsx';
import { SummaryBoxes } from '../track/SummaryBoxes.jsx';
import { Spinner, TypeIcon } from '../ui/bits.jsx';
import { IconAlert, IconCheck } from '../ui/icons.jsx';
import { BrandCards } from './BrandCards.jsx';
import { AchievementCell, SplitCell, StatusChip, TrackerList } from './perf.jsx';

const DASH_VIEW = { key: 'dashboard', showBrand: true, brandChoices: null };
const NO_PIC = '__none';
const NO_FILTERS = { tracker: '', brand: '', pic: '', type: '', status: '' };

/** "/" for Admin: the month across every tracker (09 §9, reordered by update v3 file 04). */
export function Dashboard() {
  const { month } = useMonth();
  return (
    <TrackerProvider month={month}>
      <DashboardView />
    </TrackerProvider>
  );
}

// ------------------------------------------------------------------ all-brands calendar
function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter">
      <span className="sr-only">{label}</span>
      <select className={`select filter-select${value ? ' is-set' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Every brand's content on its publish date and every project on its deadline.
 * Admin can drag any content (except Uploaded) and any project to another day (04 §3).
 */
function AllBrandsCalendar({ items, onOpen }) {
  const app = useAppData();
  const ps = useProjects();
  const moves = useCalendarMoves();
  const [f, setF] = useState(NO_FILTERS);
  const set = (key) => (value) =>
    setF((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'tracker' && value && next.brand && !app.brandsForRole(value).some((b) => b.id === next.brand)) next.brand = '';
      return next;
    });

  const brandOptions = (f.tracker ? app.brandsForRole(f.tracker) : app.brands).map((b) => [b.id, b.name]);
  const picOptions = useMemo(() => {
    const ids = new Set(app.people.filter((p) => p.role_id && !app.rolesById[p.role_id]?.is_admin && p.is_active).map((p) => p.id));
    items.forEach((i) => i.pic_id && ids.add(i.pic_id));
    const list = [...ids]
      .map((id) => ({ value: id, label: app.peopleById[id]?.display_name ?? 'Former member', personId: id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const options = [{ value: '', label: 'Every PIC' }, ...list];
    if (items.some((i) => !i.pic_id)) options.push({ value: NO_PIC, label: 'Needs a PIC', tone: 'warn' });
    return options;
  }, [app, items]);

  const filtered = useMemo(
    () =>
      f.type === 'project'
        ? []
        : items.filter(
            (i) =>
              (!f.tracker || i.role_id === f.tracker) &&
              (!f.brand || i.brand_id === f.brand) &&
              (f.pic === NO_PIC ? !i.pic_id : !f.pic || i.pic_id === f.pic) &&
              (f.type === 'none' ? !i.type : !f.type || i.type === f.type) &&
              (!f.status || i.status === f.status),
          ),
    [items, f],
  );

  // projects have no brand, type or content status: they show with "All types" or "Projects",
  // and follow the Tracker and PIC filters through the people they're assigned to
  const projects = useMemo(() => {
    if ((f.type && f.type !== 'project') || f.brand || f.status || f.pic === NO_PIC) return [];
    return ps.projects.filter(
      (p) => (!f.tracker || p.assignees.some((id) => app.peopleById[id]?.role_id === f.tracker)) && (!f.pic || p.assignees.includes(f.pic)),
    );
  }, [ps.projects, f, app.peopleById]);

  const on = Object.values(f).some(Boolean);

  const tools = (
    <div className="toolbar dash-cal-tools">
      <FilterSelect label="Tracker" value={f.tracker} onChange={set('tracker')} options={[['', 'All trackers'], ...app.trackers.map((r) => [r.id, r.name])]} />
      <FilterSelect label="Brand" value={f.brand} onChange={set('brand')} options={[['', 'All brands'], ...brandOptions]} />
      <PersonSelect label="PIC" value={f.pic} onChange={set('pic')} options={picOptions} />
      <FilterSelect
        label="Type"
        value={f.type}
        onChange={set('type')}
        options={[['', 'All types'], ['reels', `▶ ${TYPE_LABELS.reels}`], ['feed', `▦ ${TYPE_LABELS.feed}`], ['none', 'No type'], ['project', '⚑ Projects']]}
      />
      <FilterSelect label="Status" value={f.status} onChange={set('status')} options={[['', 'All statuses'], ...STATUS_ORDER.map((s) => [s, STATUS_LABELS[s]])]} />
      {on && (
        <button type="button" className="link-btn" onClick={() => setF(NO_FILTERS)}>
          Clear filters
        </button>
      )}
      <CalendarLegend />
    </div>
  );

  return (
    <MonthCalendar
      items={filtered}
      projects={projects}
      onOpen={onOpen}
      onOpenProject={ps.openProject}
      brandName={brandNamer(app.brandsById)}
      showPic
      title="All brands"
      tools={tools}
      drag={moves}
    />
  );
}

// ------------------------------------------------------------------ performance per PIC
function personLabel(app, id) {
  const p = app.peopleById[id];
  if (!p) return 'Former member';
  return p.is_active ? p.display_name : `${p.display_name} (inactive)`;
}

function PicTable({ pics, total }) {
  const app = useAppData();
  const rows = [...pics].sort(
    (a, b) =>
      (app.rolesById[a.roleId]?.sort_order ?? 99) - (app.rolesById[b.roleId]?.sort_order ?? 99) ||
      personLabel(app, a.picId).localeCompare(personLabel(app, b.picId)),
  );
  return (
    <section className="dash-section" aria-labelledby="pic-title">
      <div className="section-head">
        <h2 id="pic-title">Performance per PIC</h2>
        <p className="section-meta">Everyone with a target or uploads this month</p>
      </div>
      <div className="table-wrap dash-wrap">
        <table className="table dash-table pic-table">
          <colgroup>
            <col style={{ width: 170 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 230 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">PIC</th>
              <th scope="col">Tracker</th>
              <th scope="col">
                Target <TypeHead />
              </th>
              <th scope="col">
                Uploaded <TypeHead />
              </th>
              <th scope="col">Remaining</th>
              <th scope="col">Achievement</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="dash-empty">
                  No targets or uploads this month yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="dash-name">
                  <Person id={r.picId} name={personLabel(app, r.picId)} size={28} />
                </th>
                <td className="dim">{app.rolesById[r.roleId]?.name ?? '–'}</td>
                <td>
                  <SplitCell set={r.target} />
                </td>
                <td>
                  <SplitCell set={r.uploaded} />
                </td>
                <td>
                  <RemainingCell stats={r} />
                </td>
                <td className="wrap">
                  <AchievementCell stats={r} />
                </td>
                <td>
                  <StatusChip status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="total-row">
                <th scope="row">Total</th>
                <td />
                <td>
                  <SplitCell set={total.target} />
                </td>
                <td>
                  <SplitCell set={total.uploaded} />
                </td>
                <td>
                  <RemainingCell stats={total} />
                </td>
                <td className="wrap">
                  <AchievementCell stats={total} />
                </td>
                <td>
                  <StatusChip status={total.status} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function TypeHead() {
  return (
    <span className="th-types">
      (<TypeIcon type="reels" size={10} /> / <TypeIcon type="feed" size={10} /> / total)
    </span>
  );
}

function RemainingCell({ stats }) {
  if (stats.remaining == null) return <span className="dim">–</span>;
  if (stats.over > 0) return <span className="mono is-over-text">+{stats.over} over</span>;
  return <span className="mono">{stats.remaining}</span>;
}

// ------------------------------------------------------------------ detail per PIC and brand
/** Admin's "Status & notes": an inline text box that saves on blur. */
function NoteCell({ row, label }) {
  const t = useTracker();
  const target = row.targetRow;
  const server = target?.note ?? '';
  const [value, setValue] = useState(server);
  const [state, setState] = useState(null); // 'saving' | 'saved' | { error }
  const focused = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!focused.current) setValue(server);
  }, [server]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!target) return <span className="dim note-none">Set a target first</span>;

  const commit = async () => {
    focused.current = false;
    const next = value.trim();
    if (next === server) return;
    setState('saving');
    const r = await t.updateTargetNote(target.id, next || null);
    if (r.error) {
      setState({ error: friendlyError(r.error) });
      return;
    }
    setState('saved');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 2500);
  };

  return (
    <div className="note-cell">
      <input
        className="input note-input"
        value={value}
        maxLength={500}
        placeholder="Add a note"
        aria-label={`Status and notes: ${label}`}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setValue(server);
            focused.current = false;
            e.currentTarget.blur();
          }
        }}
      />
      <span className="note-state" aria-live="polite">
        {state === 'saving' && 'Saving…'}
        {state === 'saved' && (
          <span className="saved-tick">
            <IconCheck width={13} height={13} /> Saved
          </span>
        )}
      </span>
      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

function DetailTable({ cells, total, needPic, month }) {
  const app = useAppData();
  const period = monthLabel(month);
  const rows = [...cells].sort(
    (a, b) =>
      (app.rolesById[a.roleId]?.sort_order ?? 99) - (app.rolesById[b.roleId]?.sort_order ?? 99) ||
      personLabel(app, a.picId).localeCompare(personLabel(app, b.picId)) ||
      (app.brandsById[a.brandId]?.sort_order ?? 99) - (app.brandsById[b.brandId]?.sort_order ?? 99),
  );
  const num = (v) => <span className="mono">{v ?? '–'}</span>;

  return (
    <section className="dash-section" aria-labelledby="detail-title">
      <div className="section-head">
        <h2 id="detail-title">Detail per PIC and brand</h2>
        <p className="section-meta">Status & notes are yours: type, then click away to save</p>
      </div>
      <div className="table-wrap dash-wrap detail-wrap">
        <table className="table dash-table detail-table">
          <colgroup>
            <col style={{ width: 124 }} />
            <col style={{ width: 148 }} />
            <col style={{ width: 136 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 230 }} />
            <col style={{ width: 280 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="stick-pic">
                PIC
              </th>
              <th scope="col" className="stick-brand">
                Brand
              </th>
              <th scope="col" className="th-type th-type--reels">
                <TypeIcon type="reels" size={10} /> Target Reels
              </th>
              <th scope="col" className="th-type th-type--feed">
                <TypeIcon type="feed" size={10} /> Target Feed
              </th>
              <th scope="col" className="th-type th-type--reels">
                <TypeIcon type="reels" size={10} /> Uploaded Reels
              </th>
              <th scope="col" className="th-type th-type--feed">
                <TypeIcon type="feed" size={10} /> Uploaded Feed
              </th>
              <th scope="col">Total target</th>
              <th scope="col">Total uploaded</th>
              <th scope="col">Remaining</th>
              <th scope="col">Achievement</th>
              <th scope="col">Status &amp; notes</th>
            </tr>
          </thead>
          <tbody>
            {needPic.all > 0 && (
              <tr className="warn-row">
                <td colSpan={12}>
                  <IconAlert width={14} height={14} />
                  {needPic.all === 1 ? '1 item needs a PIC' : `${needPic.all} items need a PIC`}
                  {needPic.uploaded > 0 && ` (${needPic.uploaded} uploaded, counted for no one yet)`}. Filter the calendar above by
                  PIC → “Needs a PIC”, open each item and choose one.
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="dash-empty">
                  No targets or uploads this month yet. <Link to={`/admin/targets?month=${month}`}>Set targets</Link>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const pic = personLabel(app, r.picId);
              const brand = app.brandsById[r.brandId]?.name ?? r.brandId;
              return (
                <tr key={r.key} className={r.target ? '' : 'is-untargeted'}>
                  <td className="dim">{period}</td>
                  <th scope="row" className="stick-pic dash-name">
                    <Person id={r.picId} name={pic} size={20} />
                  </th>
                  <td className="stick-brand">{brand}</td>
                  <td>{num(r.target?.reels)}</td>
                  <td>{num(r.target?.feed)}</td>
                  <td>{num(r.uploaded.reels)}</td>
                  <td>{num(r.uploaded.feed)}</td>
                  <td>{num(r.target?.total)}</td>
                  <td>{num(r.uploaded.total)}</td>
                  <td>
                    <RemainingCell stats={r} />
                  </td>
                  <td className="wrap">
                    <AchievementCell stats={r} />
                  </td>
                  <td className="wrap">
                    <NoteCell row={r} label={`${pic}, ${brand}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="total-row">
                <td />
                <th scope="row" className="stick-pic">
                  Total
                </th>
                <td className="stick-brand" />
                <td>{num(total.target?.reels)}</td>
                <td>{num(total.target?.feed)}</td>
                <td>{num(total.uploaded.reels)}</td>
                <td>{num(total.uploaded.feed)}</td>
                <td>{num(total.target?.total)}</td>
                <td>{num(total.uploaded.total)}</td>
                <td>
                  <RemainingCell stats={total} />
                </td>
                <td className="wrap">
                  <AchievementCell stats={total} />
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ the page
function DashboardView() {
  const t = useTracker();
  const app = useAppData();
  const { month } = useMonth();
  const today = useToday();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('item');

  const perf = useMemo(
    () => performance({ items: t.items, targets: t.targets, month, today, brandRole: app.roleOfBrand }),
    [t.items, t.targets, month, today, app.roleOfBrand],
  );

  const trackerRows = useMemo(
    () =>
      app.trackers.map((role) => ({
        role,
        stats: groupStats({
          items: t.items.filter((i) => i.role_id === role.id),
          targetRows: t.targets.filter((r) => r.role_id === role.id),
          month,
          today,
        }),
        people: app.people.filter((p) => p.role_id === role.id && p.is_active).map((p) => p.id),
        brands: app.brandsForRole(role.id).map((b) => b.name),
      })),
    [app, t.items, t.targets, month, today],
  );

  const openItem = useCallback(
    (id) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('item', id);
        return next;
      }),
    [setSearchParams],
  );
  const closeItem = useCallback(
    () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('item');
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const stale = t.status === 'ready' && t.loadedMonth !== month;
  const unassigned = app.people.filter((p) => !p.role_id && p.is_active).length;

  return (
    <div className="dashboard">
      <PageHeader title="Dashboard" showMonth />

      {t.status === 'loading' && (
        <div className="loading-block">
          <Spinner label="Loading the dashboard" /> Loading the dashboard
        </div>
      )}
      {t.status === 'error' && (
        <div className="notice notice-danger" role="alert">
          <div>
            <p>{t.error}</p>
            <button type="button" className="link-btn" onClick={() => t.reload()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {t.status === 'ready' && (
        <div className={`dash-body${stale ? ' is-stale' : ''}`} aria-busy={stale}>
          <SummaryBoxes stats={perf.total} month={month} today={today} targetsHref={`/admin/targets?month=${month}`} />
          <BrandCards items={t.items} month={month} />
          <AllBrandsCalendar items={t.items} onOpen={openItem} />
          <PicTable pics={perf.pics} total={perf.total} />
          <DetailTable cells={perf.cells} total={perf.total} needPic={perf.needPic} month={month} />
          <section className="dash-section" aria-labelledby="trackers-title">
            <div className="section-head">
              <h2 id="trackers-title">Trackers</h2>
              <p className="section-meta">Progress for {monthLabel(month)}</p>
            </div>
            <TrackerList rows={trackerRows} loading={stale} />
            {unassigned > 0 && (
              <p className="choose-note">
                {unassigned === 1 ? 'One person has' : `${unassigned} people have`} no tracker yet.{' '}
                <Link to="/admin/people">Give them a role in People</Link>.
              </p>
            )}
          </section>
        </div>
      )}

      {openId && t.status === 'ready' && <ItemDrawer key={openId} itemId={openId} view={DASH_VIEW} onClose={closeItem} />}
    </div>
  );
}
