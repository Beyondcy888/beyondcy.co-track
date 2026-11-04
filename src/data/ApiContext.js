import { createContext, useContext } from 'react';

/** The data API (real Supabase in the app, in-memory in the dev mock). See data/api.js. */
export const ApiContext = createContext(null);

export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside an ApiContext provider');
  return api;
}
