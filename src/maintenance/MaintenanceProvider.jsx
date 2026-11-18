// Maintenance mode (update v4, file 10): the switch for the Dashboard and the Tracker.
//   - site_maintenance is readable by everyone, even signed out: read it before routing,
//     follow it live (realtime) and re-check every 60 s
//   - "active" = is_on and now < ends_at
//   - only the Admin Beyondcy account is exempt (rpc is_maintenance_exempt, by account id);
//     every other person, other admins included, is locked out of the Tracker
//   - a failed check never locks anyone out
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { useApi } from '../data/ApiContext.js';

const MaintenanceContext = createContext(null);
const POLL = 60 * 1000;

/**
 * Working copies on this computer (npm run dev, vite preview) ignore Tracker maintenance, so the
 * agent doing the updates can still open, build and check the site while it's on (owner, 18 Nov).
 * The live site is never on localhost, so it stays locked for everyone except Admin Beyondcy, and
 * the database keeps refusing tracker data to every other signed-in account either way.
 * The sample-data mock (npm run mock) still enforces maintenance, so it can be tested there.
 */
export const LOCAL_BYPASS =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && import.meta.env.MODE !== 'mock';
const FIRST_READ_LIMIT = 4000; // never hold the app back longer than this on a slow network

/** is_on and the end is still ahead. */
export function isActive(row, now = Date.now()) {
  return Boolean(row?.is_on && row.ends_at && now < Date.parse(row.ends_at));
}

export function MaintenanceProvider({ children }) {
  const api = useApi();
  const { session, user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState({}); // { dashboard, tracker }
  const [loaded, setLoaded] = useState(false); // the first read answered (or failed / timed out)
  const [exempt, setExempt] = useState(null); // null = unknown or signed out
  const alive = useRef(true);

  const put = useCallback((row) => {
    if (!row?.site) return;
    setRows((prev) => ({ ...prev, [row.site]: row }));
  }, []);

  const read = useCallback(async () => {
    const r = await api.getMaintenance();
    if (!alive.current) return null;
    if (!r.error && r.data) {
      const next = {};
      for (const row of r.data) next[row.site] = row;
      setRows(next);
    }
    setLoaded(true); // a failed check still lets the app open
    return r.error ? null : r.data;
  }, [api]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // first read, the 60 s re-check, and a re-check when the tab comes back
  useEffect(() => {
    read();
    const fallback = setTimeout(() => setLoaded(true), FIRST_READ_LIMIT);
    const timer = setInterval(read, POLL);
    const onBack = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      clearTimeout(fallback);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [read]);

  // live updates; subscribed again whenever the person signs in or out (signing out removes
  // every realtime channel), with a fresh read so nothing is missed in between
  useEffect(() => {
    const unsubscribe = api.subscribeMaintenance(put);
    read();
    return () => unsubscribe();
  }, [api, put, read, userId]);

  // only the Admin Beyondcy account is exempt; signed out = not exempt
  useEffect(() => {
    if (!session) {
      setExempt(null);
      return undefined;
    }
    let live = true;
    setExempt(null);
    api.isMaintenanceExempt().then((r) => {
      if (live) setExempt(r.error ? false : Boolean(r.data));
    });
    return () => {
      live = false;
    };
  }, [api, session, userId]);

  // the exempt account switches maintenance on and off (RPCs; the database checks everything)
  const act = useCallback(
    async (call) => {
      const r = await call();
      if (!r.error && r.data) put(Array.isArray(r.data) ? r.data[0] : r.data);
      return r;
    },
    [put],
  );
  const start = useCallback((site, minutes) => act(() => api.startMaintenance(site, minutes)), [act, api]);
  const extend = useCallback((site, minutes) => act(() => api.extendMaintenance(site, minutes)), [act, api]);
  const end = useCallback((site) => act(() => api.endMaintenance(site)), [act, api]);

  const value = useMemo(
    () => ({ rows, tracker: rows.tracker ?? null, dashboard: rows.dashboard ?? null, loaded, exempt, signedIn: Boolean(session), refresh: read, start, extend, end }),
    [rows, loaded, exempt, session, read, start, extend, end],
  );

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance must be used inside MaintenanceProvider');
  return ctx;
}
