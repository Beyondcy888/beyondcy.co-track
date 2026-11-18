// The maintenance page in the tracker: a thin React wrapper around the shared, framework-free
// module in ./page/. The dash repo (beyondcy.co-dash) has byte-identical copies of those two
// files in its maintenance/ folder: KEEP THEM IDENTICAL (change them here, then copy both there).
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mountMaintenance } from './page/maintenance.js';
import './page/maintenance.css';

const BASE = import.meta.env.BASE_URL;

/**
 * site: 'Tracker' | 'Dashboard' · endsAt · state: 'counting' | 'finishing' | 'back'
 * signIn: show the quiet "Sign in" link (tracker, signed out) · onCountdownEnd()
 */
export function MaintenanceScreen({ site = 'Tracker', endsAt = null, state = 'counting', signIn = false, onCountdownEnd }) {
  const ref = useRef(null);
  const page = useRef(null);
  const navigate = useNavigate();
  const endRef = useRef(onCountdownEnd);
  endRef.current = onCountdownEnd;

  const signInOption = signIn
    ? {
        href: `${BASE}login`,
        onClick: (e) => {
          e.preventDefault();
          // the gate opens the login page only when it comes from this link
          navigate('/login', { state: { maintenanceSignIn: true } });
        },
      }
    : null;

  useEffect(() => {
    page.current = mountMaintenance(ref.current, {
      site,
      endsAt,
      state,
      logoSrc: `${BASE}logo-beyondcy.png`,
      signIn: signInOption,
      onCountdownEnd: () => endRef.current?.(),
    });
    const title = document.title;
    document.title = `Maintenance · Beyondcy ${site}`;
    return () => {
      page.current?.destroy();
      page.current = null;
      document.title = title;
    };
    // mounted once; changes go through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    page.current?.update({ site, endsAt, state, signIn: signInOption });
    // signInOption is rebuilt every render; `signIn` (the boolean) is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, endsAt, state, signIn]);

  return <div ref={ref} className="maintenance-host" />;
}
