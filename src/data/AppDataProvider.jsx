import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from './ApiContext.js';
import { friendlyError } from '../lib/errors.js';

const AppDataContext = createContext(null);
const EMPTY = [];
const URL_TTL = 3600 * 1000; // signed photo URLs last an hour
const REFRESH_EARLY = 5 * 60 * 1000; // …and are renewed five minutes before that
const FOCUS_THROTTLE = 30 * 1000;

const photoKey = (p) => `${p.avatar_path}|${p.avatar_updated_at ?? ''}`;

/**
 * Setup data every page needs, loaded once after sign-in:
 * roles (trackers), brands, which brands belong to which tracker, Homy8 pillars,
 * and the people directory: everyone's name, tracker and photo (the `people` view, no emails).
 *
 * Photos (update v3, file 03) live in a private bucket, so each needs a signed URL.
 * They are fetched in ONE batch, cached by path + "updated at", renewed before they expire,
 * and refreshed with the directory when the tab regains focus or a photo changes.
 */
export function AppDataProvider({ children }) {
  const api = useApi();
  const [state, setState] = useState({
    status: 'loading',
    error: null,
    roles: [],
    brands: [],
    roleBrands: [],
    pillars: [],
    people: [],
  });
  const [photoUrls, setPhotoUrls] = useState({}); // person id → signed URL
  const urlCache = useRef(new Map()); // photoKey → { url, expires }
  const renewTimer = useRef(null);
  const lastPeopleLoad = useRef(0);
  const peopleRef = useRef([]);

  /** Sign any photo that has no (fresh) URL yet, then publish id → url. */
  const signPhotos = useCallback(
    async (people) => {
      const now = Date.now();
      const withPhoto = people.filter((p) => p.avatar_path);
      const stale = withPhoto.filter((p) => {
        const hit = urlCache.current.get(photoKey(p));
        return !hit || hit.expires - REFRESH_EARLY <= now;
      });
      if (stale.length) {
        const { data } = await api.avatarUrls([...new Set(stale.map((p) => p.avatar_path))]);
        if (data) {
          const expires = Date.now() + URL_TTL;
          for (const p of stale) if (data[p.avatar_path]) urlCache.current.set(photoKey(p), { url: data[p.avatar_path], expires });
        }
      }
      const next = {};
      let soonest = Infinity;
      for (const p of withPhoto) {
        const hit = urlCache.current.get(photoKey(p));
        if (!hit) continue;
        next[p.id] = hit.url;
        soonest = Math.min(soonest, hit.expires);
      }
      setPhotoUrls((prev) => {
        const a = Object.keys(prev);
        const same = a.length === Object.keys(next).length && a.every((id) => prev[id] === next[id]);
        return same ? prev : next;
      });
      clearTimeout(renewTimer.current);
      if (soonest !== Infinity) {
        renewTimer.current = setTimeout(() => signPhotos(peopleRef.current), Math.max(soonest - REFRESH_EARLY - Date.now(), 30000));
      }
    },
    [api],
  );

  const load = useCallback(async () => {
    const results = await Promise.all([
      api.listRoles(),
      api.listBrands(),
      api.listRoleBrands(),
      api.listPillars(),
      api.listProfiles(),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) {
      setState((s) => ({ ...s, status: 'error', error: friendlyError(failed.error) }));
      return;
    }
    const [roles, brands, roleBrands, pillars, people] = results.map((r) => r.data ?? []);
    lastPeopleLoad.current = Date.now();
    peopleRef.current = people;
    setState({ status: 'ready', error: null, roles, brands, roleBrands, pillars, people });
    signPhotos(people);
  }, [api, signPhotos]);

  /** Re-read the directory (after a name, role or photo change, and when the tab comes back). */
  const reloadPeople = useCallback(async () => {
    lastPeopleLoad.current = Date.now();
    const { data, error } = await api.listProfiles();
    if (error || !data) return;
    peopleRef.current = data;
    setState((s) => ({ ...s, people: data }));
    await signPhotos(data);
  }, [api, signPhotos]);

  useEffect(() => {
    load();
    return () => clearTimeout(renewTimer.current);
  }, [load]);

  // a view can't be subscribed to: refresh names and photos when the tab regains focus
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastPeopleLoad.current < FOCUS_THROTTLE) return;
      reloadPeople();
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [reloadPeople]);

  const value = useMemo(() => {
    const rolesById = Object.fromEntries(state.roles.map((r) => [r.id, r]));
    const brandsById = Object.fromEntries(state.brands.map((b) => [b.id, b]));
    const brandsByRole = {};
    for (const { role_id, brand_id } of state.roleBrands) {
      if (!brandsById[brand_id]) continue;
      (brandsByRole[role_id] ??= []).push(brandsById[brand_id]);
    }
    for (const list of Object.values(brandsByRole)) list.sort((a, b) => a.sort_order - b.sort_order);
    const pillarsByBrand = {};
    for (const p of [...state.pillars].sort((a, b) => a.sort_order - b.sort_order)) {
      (pillarsByBrand[p.brand_id] ??= []).push(p.name);
    }
    const peopleById = Object.fromEntries(state.people.map((p) => [p.id, p]));
    const trackers = state.roles.filter((r) => !r.is_admin).sort((a, b) => a.sort_order - b.sort_order);
    // brand id → the tracker (role) it belongs to
    const roleOfBrand = Object.fromEntries(state.roleBrands.map((rb) => [rb.brand_id, rb.role_id]));
    return {
      ...state,
      rolesById,
      brandsById,
      brandsForRole: (roleId) => brandsByRole[roleId] ?? EMPTY,
      pillarsByBrand,
      peopleById,
      trackers,
      roleOfBrand,
      photoUrls,
      reload: load,
      reloadPeople,
    };
  }, [state, photoUrls, load, reloadPeople]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}

/** The directory where it exists, else null (the letter avatar also works on bare screens). */
export function useAppDataOptional() {
  return useContext(AppDataContext);
}
