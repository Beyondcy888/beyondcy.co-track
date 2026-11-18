// Tracker maintenance in force (update v4, file 10 §2). Sits around every route.
//   - before the first read of site_maintenance: the app's skeleton (no flash of the app)
//   - Tracker maintenance active and not exempt → the maintenance page on every route
//       signed out: with a quiet "Sign in"; the login page opens only from that link (so
//       Admin Beyondcy can get in); everyone else stays on the page
//       signed in: the page, without signing out; the session stays for when it reopens
//   - switching over while the app is open: save the field being typed (blur), close dialogs,
//     then swap the app for the page (unmounting saves the rest); the database still accepts
//     saves for 60 s after the start
//   - when the countdown ends: re-read; still on (the timer job runs once a minute) → "Finishing
//     up…" and re-check every 15 s; off → "We're back!" for a moment, then the app, freshly
//     mounted (anything read during the lock was empty)
//   - the Admin Beyondcy account is never locked out (and never sees "We're back!")
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { AppSkeleton } from '../components/skeleton/PageSkeletons.jsx';
import { isActive, LOCAL_BYPASS, useMaintenance } from './MaintenanceProvider.jsx';
import { MaintenanceScreen } from './MaintenanceScreen.jsx';

const ALWAYS_OPEN = ['/maintenance-preview', '/reset-password'];
const SWITCH_MS = 350;
const BACK_MS = 1600;
const FINISHING_RECHECK = 15000;

/** Save what's being typed and close open dialogs, before the page replaces the app. */
function flushOpenWork() {
  const el = document.activeElement;
  if (el && el !== document.body && typeof el.blur === 'function') el.blur(); // fields save on blur
  document.querySelectorAll('dialog[open]').forEach((d) => {
    try {
      d.close();
    } catch {
      /* already closing */
    }
  });
}

export function MaintenanceGate({ children }) {
  const m = useMaintenance();
  const { ready: authReady } = useAuth();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  // null (the app) · 'switching' (saving, then the page) · 'counting' · 'finishing' · 'back'
  const [phase, setPhase] = useState(null);
  const pageUp = useRef(false); // the page is on screen (or about to be)
  const appVisible = useRef(false); // the app is what was rendered last

  const row = m.tracker;
  const active = isActive(row, now);
  const exempt = m.exempt === true;
  const checkingExempt = m.signedIn && m.exempt === null;
  // a working copy on this computer is never locked: the agent doing the updates keeps access
  const locked = active && !exempt && !LOCAL_BYPASS;
  const path = location.pathname;
  const alwaysOpen = ALWAYS_OPEN.includes(path);
  const loginOpen = path === '/login' && !m.signedIn && location.state?.maintenanceSignIn === true;

  // a clock while it's on, so the end time passing is noticed
  useEffect(() => {
    if (!row?.is_on) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [row?.is_on]);

  // where the page should be
  useEffect(() => {
    if (exempt) {
      pageUp.current = false;
      if (phase) setPhase(null);
      return;
    }
    if (locked) {
      if (checkingExempt) return;
      if (!pageUp.current) {
        pageUp.current = true;
        if (appVisible.current) {
          // the app is open: save first, then swap
          flushOpenWork();
          setPhase('switching');
          return;
        }
        setPhase('counting');
        return;
      }
      if (phase !== 'counting' && phase !== 'switching') setPhase('counting');
      return;
    }
    if (!pageUp.current) return;
    if (row?.is_on) {
      if (phase !== 'finishing') setPhase('finishing'); // time's up; the timer job hasn't run yet
      return;
    }
    if (phase !== 'back') setPhase('back');
  }, [exempt, locked, checkingExempt, phase, row?.is_on]);

  // 'switching' → the page; 'back' → the app
  useEffect(() => {
    if (phase === 'switching') {
      const timer = setTimeout(() => setPhase('counting'), SWITCH_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'back') {
      const timer = setTimeout(() => {
        pageUp.current = false;
        setPhase(null);
      }, BACK_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  // "Finishing up…": re-check every 15 s until it's off
  const { refresh } = m;
  useEffect(() => {
    if (phase !== 'finishing') return undefined;
    refresh();
    const timer = setInterval(refresh, FINISHING_RECHECK);
    return () => clearInterval(timer);
  }, [phase, refresh]);

  const onCountdownEnd = useCallback(() => {
    setNow(Date.now());
    refresh();
  }, [refresh]);

  const screen = (state) => {
    appVisible.current = false;
    return <MaintenanceScreen site="Tracker" endsAt={row?.ends_at ?? null} state={state} signIn={!m.signedIn} onCountdownEnd={onCountdownEnd} />;
  };
  const app = () => {
    appVisible.current = true;
    return children;
  };

  // wait for the switch AND the session: a slow session refresh must not show a signed-in
  // person the signed-out page (with "Sign in") for a moment
  if (!m.loaded || !authReady) return <AppSkeleton label="Loading" />;
  if (alwaysOpen) return app();
  if (locked && loginOpen) return app(); // the login page, opened from the page's "Sign in"
  if (locked && checkingExempt) return <AppSkeleton label="Checking access" />;
  if (phase === 'switching') return children; // a moment to save what's being typed
  if (phase) return screen(phase);
  if (locked) return screen('counting'); // a fresh load during maintenance: straight to the page
  return app();
}
