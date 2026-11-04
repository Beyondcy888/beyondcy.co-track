import { useCallback, useId, useMemo, useState } from 'react';
import { Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { NoTrackerAccess } from '../auth/guards.jsx';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { TrackerProvider, useTracker } from '../data/TrackerProvider.jsx';
import { PageHeader } from '../layout/PageHeader.jsx';
import { TrackModule } from '../track/TrackModule.jsx';
import { ContentTable } from '../table/ContentTable.jsx';
import { MonthCalendar } from '../calendar/MonthCalendar.jsx';
import { ItemDrawer } from '../drawer/ItemDrawer.jsx';
import { PageMenu, TrackerBanner } from '../banner/TrackerBanner.jsx';
import { useBanner } from '../banner/useBanner.js';
import { Popover } from '../ui/Popover.jsx';
import { Spinner } from '../ui/bits.jsx';
import { useToast } from '../ui/Toast.jsx';
import { friendlyError } from '../lib/errors.js';
import { targetsForMonth } from '../lib/progress.js';
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
        <label className="new-field" htmlFor={`${id}-pic`}>
          <span>PIC</span>
          <select id={`${id}-pic`} className="select" value={pic} onChange={(e) => setPic(e.target.value)} aria-describedby={`${id}-hint`}>
            <option value="">Choose a PIC</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
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

/** One tracker page: banner, the track, the table, the calendar, and the drawer. */
export function TrackerView({ kind }) {
  const { brandId } = useParams();
  const t = useTracker();
  const toast = useToast();
  const { month } = useMonth();
  const banner = useBanner();
  const [searchParams, setSearchParams] = useSearchParams();
  const [picker, setPicker] = useState(null); // { anchor, publishDate }
  const [focusNew, setFocusNew] = useState(null);
  const [creating, setCreating] = useState(false);

  const view = useMemo(
    () => buildView({ role: t.role, brands: t.brands, kind, brandId, isAdmin: t.isAdmin, me: t.me }),
    [t.role, t.brands, kind, brandId, t.isAdmin, t.me],
  );

  const items = useMemo(() => (view.filter ? t.items.filter(view.filter) : []), [t.items, view]);
  const openId = searchParams.get('item');
  const { membersOf, roleId } = t;
  const members = useMemo(() => membersOf(roleId), [membersOf, roleId]);
  // Admin must choose a PIC where the tracker has several people (Behomy); elsewhere the database decides
  const adminPicksPic = t.isAdmin && members.length > 1;

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
          <TrackModule view={view} items={items} />
          <ContentTable view={view} items={items} onOpen={openItem} onCreate={startCreate} openId={openId} />
          <MonthCalendar items={items} onOpen={openItem} onCreate={startCreate} />
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
