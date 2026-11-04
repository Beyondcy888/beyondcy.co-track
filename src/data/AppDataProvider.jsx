import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApi } from './ApiContext.js';
import { friendlyError } from '../lib/errors.js';

const AppDataContext = createContext(null);
const EMPTY = [];

/**
 * Setup data every page needs, loaded once after sign-in:
 * roles (trackers), brands, which brands belong to which tracker, Homy8 pillars,
 * and the profiles this person may see (for names).
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
    setState({ status: 'ready', error: null, roles, brands, roleBrands, pillars, people });
  }, [api]);

  const reloadPeople = useCallback(async () => {
    const { data, error } = await api.listProfiles();
    if (!error && data) setState((s) => ({ ...s, people: data }));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

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
    return {
      ...state,
      rolesById,
      brandsById,
      brandsForRole: (roleId) => brandsByRole[roleId] ?? EMPTY,
      pillarsByBrand,
      peopleById,
      trackers,
      reload: load,
      reloadPeople,
    };
  }, [state, load, reloadPeople]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
