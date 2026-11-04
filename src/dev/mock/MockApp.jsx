// DEV ONLY: `npm run mock` → the real UI on fake data, no Supabase.
// Pick who you are with ?as=admin|excel|dika|zaki|arum|ilyas|anne|rina|bagas|out
// (remembered for the tab). ?bar=0 hides the persona bar (for clean screenshots).
import { useCallback, useMemo, useRef, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes, UiProviders } from '../../App.jsx';
import { AuthContext } from '../../auth/AuthContext.js';
import { ApiContext } from '../../data/ApiContext.js';
import { createStore } from './store.js';
import { createMockApi } from './mockApi.js';
import '../dev.css';

const PERSONAS = {
  admin: 'u-admin',
  excel: 'u-excel',
  dika: 'u-dika',
  zaki: 'u-zaki',
  arum: 'u-arum',
  ilyas: 'u-ilyas',
  anne: 'u-anne',
  rina: 'u-rina',
  bagas: 'u-bagas',
  out: null,
};

function read(key, fallback) {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function initialPersona() {
  const params = new URLSearchParams(window.location.search);
  const as = params.get('as');
  if (as && as in PERSONAS) write('mock-as', as);
  if (params.has('bar')) write('mock-bar', params.get('bar'));
  return read('mock-as', 'arum');
}

const store = createStore(); // one store per page load (survives StrictMode re-renders)

export function MockApp() {
  const [persona, setPersona] = useState(initialPersona);
  const [version, setVersion] = useState(0);
  const personaRef = useRef(PERSONAS[persona]);
  personaRef.current = PERSONAS[persona];
  const api = useMemo(() => createMockApi(store, personaRef), []);
  if (typeof window !== 'undefined') window.__mock = { api, store };

  const switchTo = useCallback((next) => {
    write('mock-as', next);
    setPersona(next);
    window.history.replaceState(null, '', '/');
  }, []);

  const person = store.people.find((p) => p.id === PERSONAS[persona]) ?? null;
  const role = person ? store.roles.find((r) => r.id === person.role_id) ?? null : null;

  const auth = useMemo(
    () => ({
      ready: true,
      session: person ? { user: { id: person.id } } : null,
      user: person ? { id: person.id } : null,
      profile: person ? { id: person.id, display_name: person.display_name, role_id: person.role_id, is_active: person.is_active, role } : null,
      profileStatus: person ? 'ready' : 'idle',
      profileError: null,
      async signIn(email) {
        const found = store.people.find((p) => p.email === email.trim().toLowerCase());
        if (!found) return { error: 'Email or password is incorrect.' };
        if (!found.is_active) return { error: 'Your account is inactive. Ask Admin Beyondcy.' };
        const key = Object.keys(PERSONAS).find((k) => PERSONAS[k] === found.id);
        write('mock-as', key);
        setPersona(key);
        return { error: null };
      },
      async signOut() {
        write('mock-as', 'out');
        setPersona('out');
      },
      requestPasswordReset: async () => ({ error: null }),
      updatePassword: async () => ({ error: null }),
      reloadProfile: () => setVersion((v) => v + 1),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona, version, person?.role_id, person?.is_active, person?.display_name],
  );

  const showBar = read('mock-bar', '1') !== '0';

  return (
    <BrowserRouter>
      <ApiContext.Provider value={api}>
        <AuthContext.Provider value={auth}>
          <UiProviders>
            <AppRoutes key={persona} />
            {showBar && (
              <div className="mock-bar">
                <span>Mock data</span>
                <label>
                  <span className="sr-only">View as</span>
                  <select value={persona} onChange={(e) => switchTo(e.target.value)}>
                    {Object.keys(PERSONAS).map((k) => (
                      <option key={k} value={k}>
                        {k === 'out' ? 'signed out' : k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </UiProviders>
        </AuthContext.Provider>
      </ApiContext.Provider>
    </BrowserRouter>
  );
}
