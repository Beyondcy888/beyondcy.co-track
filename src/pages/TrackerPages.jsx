import { useCallback, useId, useMemo, useState } from 'react';
import { Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { NoTrackerAccess } from '../auth/guards.jsx';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { TrackerProvider, useTracker } from '../data/TrackerProvider.jsx';
import { useCurrentMonth, useToday } from '../data/useNow.js';
import { PageHeader } from '../layout/PageHeader.jsx';
import { TrackModule } from '../track/TrackModule.jsx';
import { SummaryBoxes } from '../track/SummaryBoxes.jsx';
import { WeekReminder } from '../track/WeekReminder.jsx';
import { ContentTable } from '../table/ContentTable.jsx';
import { useContentFilters } from '../table/useContentFilters.js';
import { MonthCalendar } from '../calendar/MonthCalendar.jsx';
import { useCalendarMoves } from '../calendar/useCalendarMoves.js';
import { StatusBoard } from '../board/StatusBoard.jsx';
import { ItemDrawer } from '../drawer/ItemDrawer.jsx';
import { PageMenu, TrackerBanner } from '../banner/TrackerBanner.jsx';
import { useBanner } from '../banner/useBanner.js';
import { Avatar } from '../people/Avatar.jsx';
import { useProjects } from '../projects/ProjectsProvider.jsx';
import { Popover } from '../ui/Popover.jsx';
import { Spinner } from '../ui/bits.jsx';
import { useToast } from '../ui/Toast.jsx';
import { friendlyError } from '../lib/errors.js';
import { pageStats, targetsForMonth } from '../lib/progress.js';
import { monthName } from '../lib/time.js';
import { weekRange } from '../lib/week.js';
import { buildView } from './view.js';

/**
 * /t/:roleId — the convenience lock. RLS is the real one: if this check were
 * skipped the database would still return nothing. No data loads on refusal.
 */
export function TrackerRoute() {
  const { roleId } = useParams();
  const { profile } = useAuth();
  const app = useAppData();
  const isAdmin = Boolean(profile?.role?.is_admin);
  const role = app.rolesById[roleId];

  if (!isAdmin && roleId !== profile?.role_id) return <NoTrackerAccess />;
  if (!role || role.is_admin || !role.layout) return <NoTrackerAccess />;

  return (
    <TrackerProvider key={roleId} roleId={roleId}>
      <Outlet />
    </TrackerProvider>
  );
}

function BrandPicker({ anchor, brands, onPick, onClose }) {
  return (
    <Popover anchor={anchor} onClose={onClose} label="Choose a brand" width={250}>
      <p className="popover-title">Which brand is it for?</p>
      {brands.map((b) => (
        <button key={b.id} type="button" className="menu-item" onClick={() => onPick(b.id)}>
          {b.name}
        </button>
      ))}
    </Popover>
  );
}

/**
 * Admin creating content in Behomy (several people): Brand and PIC (09 §6).
 * When exactly one person has a target for the brand that month, they're pre-selected.
 * The PIC is chosen from the members' photos and names (update v3, file 03).
 */
function BrandPicPicker({ anchor, brands, members, targets, month, onPick, onClose }) {
  const id = useId();
  const [brand, setBrand] = useState(brands.length === 1 ? brands[0].id : '');
  const suggest = (brandId) => {
    const rows = targetsForMonth(targets, month).filter(
      (r) => r.brand_id === brandId && r.target_reels + r.target_feed > 0 && members.some((m) => m.id === r.profile_id),
    );
    return rows.length === 1 ? rows[0].profile_id : '';
  };
  const [pic, setPic] = useState(() => (brand ? suggest(brand) : ''));
  const suggested = brand && pic && pic === suggest(brand);

  return (
    <Popover anchor={anchor} onClose={onClose} label="New content" width={300} className="new-pop">
      <form
        className="new-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (brand && pic) onPick(brand, pic);
        }}
      >
        <p className="popover-title">New content</p>
        <label className="new-field" htmlFor={`${id}-brand`}>
          <span>Brand</span>
          <select
            id={`${id}-brand`}
            className="select"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPic(suggest(e.target.value));
            }}
          >
            <option value="">Choose a brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="new-field new-pics" aria-describedby={`${id}-hint`}>
          <legend>PIC</legend>
          <div className="new-pic-list">
            {members.map((m) => (
              <label key={m.id} className={`new-pic${pic === m.id ? ' is-on' : ''}`}>
                <input type="radio" name={`${id}-pic`} value={m.id} checked={pic === m.id} onChange={() => setPic(m.id)} />
                <Avatar id={m.id} size={28} />
                <span className="truncate">{m.display_name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="new-hint" id={`${id}-hint`}>
          {suggested ? 'Pre-selected: the only person with a target for this brand this month.' : 'The PIC is whose target this content counts toward.'}
        </p>
        <div className="new-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!brand || !pic}>
            Create
          </button>
        </div>
      </form>
    </Popover>
  );
}

/**
 * One tracker page, top to bottom (update v3, file 05):
 * banner · greeting · four summary boxes · progress module with the this-week reminder ·
 * lanes · content table · calendar (drag to change a date) · status board; and the drawer.
 * Every section uses the same items as the page (My work = mine, Master = the tracker,
 * a brand page = that brand).
 */
export function TrackerView({ kind }) {
  const { brandId } = useParams();
  const t = useTracker();
  const ps = useProjects();
  const toast = useToast();
  const { month, setMonth } = useMonth();
  const today = useToday();
  const currentMonth = useCurrentMonth();
  const banner = useBanner();
  const moves = useCalendarMoves();
  const [searchParams, setSearchParams] = useSearchParams();
  const [picker, setPicker] = useState(null); // { anchor, publishDate }
  const [focusNew, setFocusNew] = useState(null);
  const [creating, setCreating] = useState(false);
  const [flashWeek, setFlashWeek] = useState(null);

  const view = useMemo(
    () => buildView({ role: t.role, brands: t.brands, kind, brandId, isAdmin: t.isAdmin, me: t.me }),
    [t.role, t.brands, kind, brandId, t.isAdmin, t.me],
  );

  const items = useMemo(() => (view.filter ? t.items.filter(view.filter) : []), [t.items, view]);
  const filters = useContentFilters({ items, month, view: view.filter ? view : EMPTY_VIEW });
  const openId = searchParams.get('item');
  const { membersOf, roleId } = t;
  const members = useMemo(() => membersOf(roleId), [membersOf, roleId]);
  // Admin must choose a PIC where the tracker has several people (Behomy); elsewhere the database decides
  const adminPicksPic = t.isAdmin && members.length > 1;

  // the boxes and the progress module read the same numbers (05 §1)
  const stats = useMemo(
    () => (view.filter ? pageStats({ view, items, allItems: t.items, targets: t.targets, me: t.me, month, today }) : null),
    [view, items, t.items, t.targets, t.me, month, today],
  );

  // projects: staff see their own on every page of their tracker; Admin sees this tracker's people's
  const projects = useMemo(() => ps.forTracker(roleId), [ps, roleId]);

  const openItem = useCallback(
    (id) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('item', id);
        return next;
      });
    },
    [setSearchParams],
  );

  const closeItem = useCallback(() => {
    setFocusNew(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  /** From the reminder: show the current month, scroll to the calendar, flash this week. */
  const showWeek = useCallback(() => {
    if (month !== currentMonth) setMonth(currentMonth);
    setFlashWeek({ start: weekRange(today).start, key: Date.now() });
  }, [month, currentMonth, setMonth, today]);

  const create = async (brand, publishDate, picId = null) => {
    setPicker(null);
    if (creating) return;
    setCreating(true);
    const result = await t.createItem({ brandId: brand, publishDate, picId });
    setCreating(false);
    if (result.error) {
      toast(friendlyError(result.error), { tone: 'danger', duration: 6000 });
      return;
    }
    setFocusNew(result.data.id);
    openItem(result.data.id);
  };

  // New content: ask for the brand where there are several (and the PIC where Admin must choose)
  const startCreate = (anchor, publishDate = null) => {
    if (!adminPicksPic && view.brandChoices.length === 1) create(view.brandChoices[0].id, publishDate);
    else setPicker({ anchor, publishDate });
  };

  if (view.redirect) return <Navigate to={view.redirect} replace />;

  const scopeText = filters.allMonths ? 'All months' : `${monthName(month)}, plus items with no date`;

  return (
    <div className="tracker-page">
      <PageHeader
        crumb={view.crumb}
        title={view.title}
        showMonth
        menu={t.status === 'ready' ? <PageMenu ctl={banner} /> : null}
        top={t.status === 'ready' ? <TrackerBanner ctl={banner} /> : null}
      />

      {t.status === 'loading' && (
        <div className="loading-block">
          <Spinner label="Loading the tracker" /> Loading the tracker
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
        <>
          <SummaryBoxes
            stats={stats}
            month={month}
            today={today}
            targetsHref={t.isAdmin ? `/admin/targets?month=${month}` : null}
            label={`${view.title} in numbers`}
            className="stat-boxes--page"
          />
          <TrackModule
            view={view}
            items={items}
            aside={<WeekReminder view={view} items={items} projects={projects} onOpen={openItem} onOpenProject={ps.openProject} onShowWeek={showWeek} />}
          />
          <ContentTable view={view} items={items} filters={filters} onOpen={openItem} onCreate={startCreate} openId={openId} />
          <MonthCalendar
            items={items}
            projects={projects}
            onOpen={openItem}
            onOpenProject={ps.openProject}
            onCreate={startCreate}
            showPic={view.showPic}
            drag={moves}
            flashWeek={flashWeek}
          />
          <StatusBoard
            view={view}
            items={filters.filtered}
            onOpen={openItem}
            filtersOn={filters.on}
            onClearFilters={filters.clear}
            scopeText={scopeText}
            progress={!filters.on && !filters.allMonths && stats?.target ? { uploaded: stats.uploaded.total, target: stats.target.total } : null}
          />
        </>
      )}

      {picker &&
        (adminPicksPic ? (
          <BrandPicPicker
            anchor={picker.anchor}
            brands={view.brandChoices}
            members={members}
            targets={t.targets}
            month={picker.publishDate ? picker.publishDate.slice(0, 7) : month}
            onPick={(brand, pic) => create(brand, picker.publishDate, pic)}
            onClose={() => setPicker(null)}
          />
        ) : (
          <BrandPicker
            anchor={picker.anchor}
            brands={view.brandChoices}
            onPick={(id) => create(id, picker.publishDate)}
            onClose={() => setPicker(null)}
          />
        ))}

      {openId && t.status === 'ready' && (
        <ItemDrawer key={openId} itemId={openId} view={view} onClose={closeItem} focusContent={focusNew === openId} />
      )}
    </div>
  );
}

const EMPTY_VIEW = { showBrand: false, brandChoices: [] };
