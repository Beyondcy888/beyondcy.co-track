// /admin/activity (update v4, file 05): every change across the tracker, newest first.
// Search (titles, names, actions and the changed values) · filter by brand, Projects, People
// or Maintenance · grouped by day · "Changed in Supabase" when a row was edited directly.
// Refreshes by itself every 60 s (the log isn't in the realtime feed). Admin only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { brandStyle, orderBrands } from '../config/brandStyle.js';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { TrackerProvider, useTracker } from '../data/TrackerProvider.jsx';
import { useToday } from '../data/useNow.js';
import { ItemDrawer } from '../drawer/ItemDrawer.jsx';
import { PageHeader } from '../layout/PageHeader.jsx';
import { friendlyError } from '../lib/errors.js';
import { addDays, dateOfTimestampWIB, formatDayMonth, WEEKDAYS_SHORT, weekdayIndex } from '../lib/time.js';
import { safeHref, shortLink } from '../lib/links.js';
import { useNoteImageUrls } from '../notes/noteImages.js';
import { Avatar } from '../people/Avatar.jsx';
import { FadeIn, SkeletonCircle, SkeletonLine, SkeletonRegion } from '../components/skeleton/Skeleton.jsx';
import { DrawerSkeleton } from '../components/skeleton/PageSkeletons.jsx';
import { RelativeTime } from '../ui/bits.jsx';
import { IconClock, IconDatabase, IconRefresh, IconSearch, IconWrench } from '../ui/icons.jsx';
import { describeLogEntry, kindOf } from './describe.js';

const PAGE = 100;
const BASE = import.meta.env.BASE_URL;
const LONG = 220;

const KINDS = [
  ['', 'Everything'],
  ['created', 'Created'],
  ['edited', 'Edited'],
  ['deleted', 'Deleted'],
];

/** 'Today' · 'Yesterday' · 'Sun, 15 Nov' (· year when it isn't this year), in WIB. */
function dayLabel(day, today) {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const label = `${WEEKDAYS_SHORT[weekdayIndex(day)]}, ${formatDayMonth(day)}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${day.slice(0, 4)}`;
}

/** Long text shortened, with "show more". */
function LongText({ value }) {
  const [open, setOpen] = useState(false);
  const s = String(value ?? '');
  if (s.length <= LONG) return <span className="al-val">{s}</span>;
  return (
    <span className="al-val">
      {open ? s : `${s.slice(0, LONG).trimEnd()}…`}{' '}
      <button type="button" className="link-btn al-more" onClick={() => setOpen((v) => !v)}>
        {open ? 'show less' : 'show more'}
      </button>
    </span>
  );
}

function LinkList({ links }) {
  if (!links?.length) return <span className="al-val dim">—</span>;
  return (
    <span className="al-links">
      {links.map((l) => {
        const href = safeHref(l);
        return href ? (
          <a key={l} href={href} target="_blank" rel="noopener noreferrer" title={l}>
            {shortLink(l)}
          </a>
        ) : (
          <span key={l}>{l}</span>
        );
      })}
    </span>
  );
}

/** Notes pictures that still exist show as small previews; removed ones as a count. */
function PictureList({ paths }) {
  const api = useApi();
  const { urls } = useNoteImageUrls(api, paths ?? []);
  if (!paths?.length) return <span className="al-val dim">—</span>;
  return (
    <span className="al-pics">
      {paths.map((p) =>
        urls[p] ? (
          <a key={p} href={urls[p]} target="_blank" rel="noopener noreferrer" className="al-pic">
            <img src={urls[p]} alt="Notes picture" loading="lazy" />
          </a>
        ) : (
          <span key={p} className="al-pic al-pic--gone" title="This picture was removed">
            ✕
          </span>
        ),
      )}
    </span>
  );
}

function Value({ kind, value }) {
  if (kind === 'links') return <LinkList links={value} />;
  if (kind === 'pictures') return <PictureList paths={value} />;
  return <LongText value={value} />;
}

function Details({ details }) {
  return (
    <dl className="al-details">
      {details.map((d, i) => (
        <div key={i} className="al-change">
          <dt>{d.label}</dt>
          <dd>
            {'value' in d ? (
              <Value kind={d.kind} value={d.value} />
            ) : (
              <>
                <span className="al-old">
                  <Value kind={d.kind} value={d.old} />
                </span>
                <span className="al-arrow" aria-label="changed to">
                  →
                </span>
                <span className="al-new">
                  <Value kind={d.kind} value={d.new} />
                </span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Who({ who }) {
  if (who.kind === 'supabase') {
    return (
      <span className="al-badge al-badge--db" title="Edited directly in the Supabase dashboard, not in the app">
        <IconDatabase width={13} height={13} />
        Changed in Supabase
      </span>
    );
  }
  if (who.kind === 'timer') {
    return (
      <span className="al-badge al-badge--timer">
        <IconClock width={13} height={13} />
        Maintenance timer
      </span>
    );
  }
  return (
    <span className="al-person">
      <Avatar id={who.id} name={who.name} size={20} />
      <strong>{who.name}</strong>
    </span>
  );
}

function BrandChip({ brandId, brandsById }) {
  const brand = brandsById[brandId];
  if (!brand) return null;
  const style = brandStyle(brandId);
  return (
    <span className="al-brand" style={{ '--brand': style.glow }}>
      {style.logo ? <img src={`${BASE}${style.logo}`} alt="" /> : <span className="al-brand-dot" aria-hidden="true" />}
      {brand.name}
    </span>
  );
}

function Entry({ entry, ctx, onOpenItem }) {
  const d = useMemo(() => describeLogEntry(entry, ctx), [entry, ctx]);
  const hasDetails = d.details.length > 0;
  return (
    <li className={`al-entry al-entry--${entry.category ?? 'other'}${d.deleted ? ' is-deleted' : ''}`}>
      <span className="al-time mono">
        <RelativeTime value={entry.created_at} />
      </span>
      <div className="al-main">
        <p className="al-line">
          <Who who={d.who} />{' '}
          {d.parts.map((p, i) =>
            'text' in p ? (
              <span key={i}>{p.text}</span>
            ) : p.itemId ? (
              <button key={i} type="button" className="al-title link-btn" onClick={() => onOpenItem(p.itemId, p.roleId)}>
                {p.strong}
              </button>
            ) : (
              <strong key={i} className="al-strong">
                {p.strong}
              </strong>
            ),
          )}
          {d.brandId && <BrandChip brandId={d.brandId} brandsById={ctx.brandsById} />}
        </p>
        {d.quote && <p className="al-quote">{d.quote}</p>}
        {hasDetails && (
          <details className="al-more-details">
            <summary>{d.deleted ? 'What was deleted' : d.details.length > 1 ? `Show ${d.details.length} changes` : 'Show the change'}</summary>
            <Details details={d.details} />
          </details>
        )}
      </div>
    </li>
  );
}

function LogSkeleton() {
  return (
    <SkeletonRegion label="Loading activity" className="al-sk">
      {[5, 4].map((n, g) => (
        <div key={g} className="al-day">
          <SkeletonLine width={90} size="sm" className="al-sk-day" />
          <div className="al-sk-rows">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="al-sk-row">
                <SkeletonLine width={52} size="xs" />
                <SkeletonCircle size={20} />
                <div className="sk-row-lines">
                  <SkeletonLine width={`${58 - ((i * 13) % 24)}%`} size="sm" />
                  {i % 2 === 0 && <SkeletonLine width="26%" size="xs" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** The drawer for a content title, opened in place over the log. */
function LogDrawer({ itemId, onClose }) {
  const t = useTracker();
  if (t.status === 'loading') return <DrawerSkeleton onClose={onClose} />;
  return <ItemDrawer itemId={itemId} view={{ key: 'activity', showBrand: true, brandChoices: null }} onClose={onClose} />;
}

export function ActivityPage() {
  const api = useApi();
  const app = useAppData();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [filter, setFilter] = useState(''); // '' · a brand id · 'project' · 'people' · 'maintenance'
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false); // another page may exist
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState(null); // { itemId, roleId }
  const ticket = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // debounce the search box (~300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const brands = useMemo(() => orderBrands(app.brands), [app.brands]);
  const params = useMemo(() => {
    const isBrand = filter && !['project', 'people', 'maintenance'].includes(filter);
    return { query: search || null, brand: isBrand ? filter : null, category: isBrand ? null : filter || null };
  }, [filter, search]);

  const fetchPage = useCallback((before = null) => api.searchActivity({ ...params, before, limit: PAGE }), [api, params]);

  // first page whenever the search or filter changes
  useEffect(() => {
    const mine = ++ticket.current;
    setRows(null);
    setError(null);
    fetchPage().then((r) => {
      if (mine !== ticket.current) return;
      if (r.error) {
        setError(friendlyError(r.error));
        setRows([]);
        return;
      }
      setRows(r.data ?? []);
      setMore((r.data?.length ?? 0) === PAGE);
    });
  }, [fetchPage]);

  /** Newer entries on top, keeping what's loaded below (Refresh button and every 60 s). */
  const refresh = useCallback(async () => {
    const mine = ticket.current;
    setRefreshing(true);
    const r = await fetchPage();
    setRefreshing(false);
    if (mine !== ticket.current || r.error || !r.data) return;
    setRows((prev) => {
      if (!prev) return r.data;
      const known = new Set(prev.map((x) => x.id));
      const fresh = r.data.filter((x) => !known.has(x.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, [fetchPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const loadMore = async () => {
    const list = rowsRef.current;
    if (!list?.length) return;
    const mine = ticket.current;
    setLoadingMore(true);
    const r = await fetchPage(list[list.length - 1].created_at);
    setLoadingMore(false);
    if (mine !== ticket.current) return;
    if (r.error) {
      setError(friendlyError(r.error));
      return;
    }
    const known = new Set(list.map((x) => x.id));
    setRows([...list, ...(r.data ?? []).filter((x) => !known.has(x.id))]);
    setMore((r.data?.length ?? 0) === PAGE);
  };

  const ctx = useMemo(() => {
    const deletedItems = new Set((rows ?? []).filter((r) => r.action === 'item_deleted' && r.item_id).map((r) => r.item_id));
    return {
      brandsById: app.brandsById,
      brandName: (id) => app.brandsById[id]?.name ?? id,
      personName: (id) => app.peopleById[id]?.display_name,
      roleName: (id) => app.rolesById[id]?.name ?? id,
      deletedItems,
    };
  }, [rows, app.brandsById, app.peopleById, app.rolesById]);

  const shown = useMemo(() => (rows ?? []).filter((r) => !kind || kindOf(r.action) === kind), [rows, kind]);
  const days = useMemo(() => {
    const groups = [];
    for (const r of shown) {
      const day = dateOfTimestampWIB(r.created_at);
      if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, rows: [] });
      groups[groups.length - 1].rows.push(r);
    }
    return groups;
  }, [shown]);

  const filterName = filter === 'project' ? 'Projects' : filter === 'people' ? 'People' : filter === 'maintenance' ? 'Maintenance' : app.brandsById[filter]?.name;
  let empty = null;
  if (rows && !shown.length) {
    if (search) empty = `No activity matches "${search}"${filterName ? ` in ${filterName}` : ''}.`;
    else if (kind && rows.length) empty = `Nothing ${KINDS.find((k) => k[0] === kind)[1].toLowerCase()} in what's loaded.${more ? ' Load more to look further back.' : ''}`;
    else if (filterName) empty = `No activity for ${filterName} yet.`;
    else empty = 'No activity yet.';
  }

  const chip = (value, label, extra = null) => (
    <button key={value || 'all'} type="button" className={`al-chip${filter === value ? ' is-on' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
      {extra}
      {label}
    </button>
  );

  return (
    <div className="activity-page">
      <PageHeader title="Activity Logs" />

      <div className="al-top">
        <label className="search al-search">
          <IconSearch />
          <span className="sr-only">Search the activity</span>
          <input
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, names, actions and changed text (e.g. a caption word)"
          />
        </label>
        <button type="button" className="btn btn-secondary al-refresh" onClick={refresh} disabled={refreshing || !rows}>
          <IconRefresh width={15} height={15} className={refreshing ? 'is-spinning' : ''} />
          Refresh
        </button>
      </div>

      <div className="al-filters" role="group" aria-label="Show activity for">
        {chip('', 'All brands')}
        {brands.map((b) => {
          const style = brandStyle(b.id);
          return chip(b.id, b.name, style.logo ? <img src={`${BASE}${style.logo}`} alt="" className="al-chip-logo" /> : null);
        })}
        <span className="al-chip-sep" aria-hidden="true" />
        {chip('project', 'Projects')}
        {chip('people', 'People')}
        {chip('maintenance', 'Maintenance', <IconWrench width={13} height={13} />)}
      </div>

      <div className="al-kinds" role="group" aria-label="Type of change">
        {KINDS.map(([value, label]) => (
          <button key={value || 'all'} type="button" className={`al-kind${kind === value ? ' is-on' : ''}`} aria-pressed={kind === value} onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
        <span className="al-note">Kept forever. Banner changes aren't logged. Updates every minute.</span>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      )}

      {!rows && !error && <LogSkeleton />}

      {rows && (
        <FadeIn className="al-list">
          {empty && <p className="al-empty">{empty}</p>}
          {days.map((g) => (
            <section key={g.day} className="al-day" aria-label={dayLabel(g.day, today)}>
              <h2 className="al-day-title">{dayLabel(g.day, today)}</h2>
              <ol className="al-entries">
                {g.rows.map((entry) => (
                  <Entry key={entry.id} entry={entry} ctx={ctx} onOpenItem={(itemId, roleId) => setOpenItem({ itemId, roleId })} />
                ))}
              </ol>
            </section>
          ))}
          {more && (
            <div className="al-load">
              <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </FadeIn>
      )}

      {openItem && openItem.roleId && app.rolesById[openItem.roleId] && (
        <TrackerProvider key={openItem.roleId} roleId={openItem.roleId}>
          <LogDrawer itemId={openItem.itemId} onClose={() => setOpenItem(null)} />
        </TrackerProvider>
      )}
    </div>
  );
}
