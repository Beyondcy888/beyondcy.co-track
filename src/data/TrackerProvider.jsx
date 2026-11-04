import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from './ApiContext.js';
import { useAppData } from './AppDataProvider.jsx';
import { normalizeItem } from './api.js';
import { useAuth } from '../auth/AuthContext.js';
import { friendlyError } from '../lib/errors.js';
import { monthEnd, monthStart } from '../lib/time.js';

const TrackerContext = createContext(null);

/** Is row b at least as new as row a? Unknown or unparseable timestamps count as newer. */
function newer(a, b) {
  const ta = Date.parse(a?.updated_at ?? '');
  const tb = Date.parse(b?.updated_at ?? '');
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
  return tb >= ta;
}

/** Keep object identity for rows that didn't change (fewer re-renders after a refetch). */
function mergeRows(prev, next) {
  const byId = new Map(prev.map((r) => [r.id, r]));
  return next.map((row) => {
    const old = byId.get(row.id);
    return old && old.updated_at === row.updated_at && old.comment_count === row.comment_count ? old : row;
  });
}

/** Replace or add a row by id; DELETE removes it. */
function applyById(list, event, row) {
  if (!row?.id) return list;
  const rest = list.filter((x) => x.id !== row.id);
  if (event === 'DELETE') return rest.length === list.length ? list : rest;
  return [...rest, row];
}

/**
 * Everything for one open tracker: its items (all months; pages filter in the client),
 * targets, banner and people, the mutations, and live updates.
 * Mounted with key={roleId}, so switching trackers starts clean.
 *
 * Without a roleId it serves the Admin dashboard instead: every tracker's items for
 * `month` (plus undated ones), every target, and live updates from all trackers.
 */
export function TrackerProvider({ roleId = null, month = null, children }) {
  const api = useApi();
  const { profile } = useAuth();
  const app = useAppData();
  const all = !roleId;

  const [items, setItems] = useState([]);
  const [targets, setTargets] = useState([]);
  const [banner, setBanner] = useState(undefined); // undefined = loading, null = none
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [live, setLive] = useState('connecting');
  const [loadedMonth, setLoadedMonth] = useState(null);
  const commentListeners = useRef(new Set());
  const countsTimer = useRef(null);
  const lastLoad = useRef(0);
  const monthRef = useRef(month);
  monthRef.current = month;

  const upsert = useCallback((row) => {
    if (!row?.id) return;
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === row.id);
      if (i === -1) return [...prev, normalizeItem(row)];
      if (!newer(prev[i], row)) return prev; // an older echo arriving late
      const next = prev.slice();
      next[i] = normalizeItem(row, prev[i]);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => (prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : prev));
  }, []);

  const bumpComments = useCallback((itemId, delta) => {
    setItems((prev) =>
      prev.map((x) => (x.id === itemId ? { ...x, comment_count: Math.max(0, (x.comment_count ?? 0) + delta) } : x)),
    );
  }, []);

  const range = () => {
    const m = monthRef.current;
    return m ? { start: monthStart(m), end: monthEnd(m) } : null;
  };

  const load = useCallback(
    async ({ quiet = false, reportErrors = !quiet } = {}) => {
      lastLoad.current = Date.now();
      const m = monthRef.current;
      if (!quiet) setStatus('loading');
      const r = range();
      const [i, t, b] = await Promise.all([
        all ? api.listItemsForMonth(r.start, r.end) : api.listItems(roleId),
        all ? api.listAllTargets() : api.listTargets(roleId),
        all ? Promise.resolve({ data: null, error: null }) : api.getBanner(roleId),
      ]);
      if (all && m !== monthRef.current) return; // the month changed meanwhile: a newer load is coming
      const failed = i.error || t.error;
      if (failed) {
        if (reportErrors) {
          setError(friendlyError(failed));
          setStatus('error');
        }
        return;
      }
      setItems((prev) => mergeRows(prev, (i.data ?? []).map((row) => normalizeItem(row))));
      setTargets(t.data ?? []);
      if (!b.error) setBanner(b.data ?? null); // a banner problem never blocks the page
      setError(null);
      setStatus('ready');
      setLoadedMonth(m);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, roleId, all],
  );

  // comment DELETE events carry only an id, so recount (debounced) on any comment event
  const refreshCounts = useCallback(() => {
    clearTimeout(countsTimer.current);
    countsTimer.current = setTimeout(async () => {
      const r = await api.listCommentCounts(roleId, all ? range() : null);
      if (r.error || !r.data) return;
      const counts = new Map(r.data.map((x) => [x.id, x.comments?.[0]?.count ?? 0]));
      setItems((prev) =>
        prev.map((x) =>
          counts.has(x.id) && counts.get(x.id) !== x.comment_count ? { ...x, comment_count: counts.get(x.id) } : x,
        ),
      );
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, roleId, all]);

  // initial load + realtime
  useEffect(() => {
    load();
    let dropped = false;
    const unsubscribe = api.subscribeTracker(roleId, {
      onItem: (event, row) => (event === 'DELETE' ? remove(row?.id) : upsert(row)),
      onComment: (event, row) => {
        refreshCounts();
        commentListeners.current.forEach((listener) => listener(event, row));
      },
      onTarget: (event, row) => setTargets((prev) => applyById(prev, event, row)),
      onBanner: (event, row) => {
        if (!row || row.role_id !== roleId) return;
        setBanner(event === 'DELETE' ? null : row);
      },
      onStatus: (s) => {
        if (s === 'SUBSCRIBED') {
          setLive('live');
          if (dropped) load({ quiet: true }); // catch up on anything missed
          dropped = false;
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setLive('offline');
          dropped = true;
        }
      },
    });
    return () => {
      unsubscribe();
      clearTimeout(countsTimer.current);
    };
  }, [api, roleId, load, upsert, remove, refreshCounts]);

  // dashboard: a new month means a new slice of items
  useEffect(() => {
    if (all && loadedMonth && month !== loadedMonth) load({ quiet: true, reportErrors: true });
  }, [all, month, loadedMonth, load]);

  // if realtime dropped, refetch when the tab regains focus (throttled)
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLoad.current < 5000) return;
      load({ quiet: true });
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [load]);

  // ------------------------------------------------------------ mutations
  const createItem = useCallback(
    async ({ brandId, publishDate = null, picId = null }) => {
      const r = await api.createItem({ roleId, brandId, publishDate, picId });
      if (!r.error && r.data) upsert(r.data);
      return r;
    },
    [api, roleId, upsert],
  );

  const updateItem = useCallback(
    async (id, patch) => {
      const r = await api.updateItem(id, patch);
      if (!r.error && r.data) upsert(r.data);
      return r;
    },
    [api, upsert],
  );

  const deleteItem = useCallback(
    async (id) => {
      const r = await api.deleteItem(id);
      if (!r.error) remove(id);
      return r;
    },
    [api, remove],
  );

  /** Admin: change a target's "Status & notes" (dashboard). */
  const updateTargetNote = useCallback(
    async (id, note) => {
      const r = await api.updateTargetNote(id, note);
      if (!r.error && r.data) setTargets((prev) => applyById(prev, 'UPDATE', r.data));
      return r;
    },
    [api],
  );

  const addComment = useCallback(
    async (itemId, body) => {
      const r = await api.addComment(itemId, body);
      if (!r.error && r.data) {
        bumpComments(itemId, 1);
        commentListeners.current.forEach((listener) => listener('INSERT', r.data));
      }
      return r;
    },
    [api, bumpComments],
  );

  const deleteComment = useCallback(
    async (comment) => {
      const r = await api.deleteComment(comment.id);
      if (!r.error) {
        bumpComments(comment.item_id, -1);
        commentListeners.current.forEach((listener) => listener('DELETE', { id: comment.id }));
      }
      return r;
    },
    [api, bumpComments],
  );

  /** Subscribe to comment events (the open drawer uses this). Returns an unsubscribe. */
  const onCommentEvent = useCallback((listener) => {
    commentListeners.current.add(listener);
    return () => commentListeners.current.delete(listener);
  }, []);

  const role = roleId ? app.rolesById[roleId] : null;
  const brands = roleId ? app.brandsForRole(roleId) : app.brands;
  const team = useMemo(() => (roleId ? app.people.filter((p) => p.role_id === roleId) : app.people), [app.people, roleId]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  /** The active people of a tracker: who can be an item's PIC. */
  const membersOf = useCallback(
    (rid) => app.people.filter((p) => p.role_id === rid && p.is_active).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [app.people],
  );

  const value = useMemo(
    () => ({
      roleId,
      all,
      role,
      brands,
      team,
      membersOf,
      brandsForRole: app.brandsForRole,
      rolesById: app.rolesById,
      pillarsByBrand: app.pillarsByBrand,
      brandsById: app.brandsById,
      peopleById: app.peopleById,
      me: profile?.id,
      isAdmin: Boolean(profile?.role?.is_admin),
      items,
      itemsById,
      targets,
      banner,
      setBanner,
      status,
      error,
      live,
      loadedMonth,
      reload: load,
      createItem,
      updateItem,
      deleteItem,
      updateTargetNote,
      addComment,
      deleteComment,
      onCommentEvent,
      api,
    }),
    [
      roleId, all, role, brands, team, membersOf, app.brandsForRole, app.rolesById, app.pillarsByBrand, app.brandsById,
      app.peopleById, profile, items, itemsById, targets, banner, status, error, live, loadedMonth, load,
      createItem, updateItem, deleteItem, updateTargetNote, addComment, deleteComment, onCommentEvent, api,
    ],
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used inside TrackerProvider');
  return ctx;
}
