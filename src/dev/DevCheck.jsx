// DEV ONLY (08 §5): the connection test. Registered only when import.meta.env.DEV,
// so it is not part of production builds. Delete this file once the owner has run it.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.js';
import { Logo } from '../ui/bits.jsx';
import './dev.css';

export default function DevCheck() {
  const { session, profile, signOut } = useAuth();
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  async function run() {
    const out = [];
    const add = (name, pass, detail) => {
      out.push({ name, pass, detail });
      setResults([...out]);
    };
    setRunning(true);
    setResults([]);

    // 1. Signed out: a separate client with no session must be refused.
    const anon = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'dev-check-anon' },
    });
    const a = await anon.from('content_items').select('id').limit(1);
    add(
      'Signed out: content_items returns an error, not rows',
      Boolean(a.error),
      a.error ? `${a.error.code ?? ''} ${a.error.message}` : `returned ${a.data?.length ?? 0} rows`,
    );

    if (!session) {
      add('Sign in to run the other checks', null, 'Sign in, then come back to /dev-check.');
      setRunning(false);
      return;
    }

    // 2. Profile
    add(
      'Profile loads with a role',
      Boolean(profile?.role_id),
      profile ? `${profile.display_name} · role ${profile.role_id} · is_admin ${profile.role?.is_admin}` : 'no profile',
    );

    if (profile?.role?.is_admin) {
      const [r, b, p] = await Promise.all([
        supabase.from('roles').select('id'),
        supabase.from('brands').select('id'),
        supabase.from('brand_pillars').select('id'),
      ]);
      add('Admin: roles → 5 rows', r.data?.length === 5, r.error?.message ?? `${r.data?.length} rows`);
      add('Admin: brands → 9 rows', b.data?.length === 9, b.error?.message ?? `${b.data?.length} rows`);
      add('Admin: brand_pillars → 5 rows', p.data?.length === 5, p.error?.message ?? `${p.data?.length} rows`);
      const [ct, tb] = await Promise.all([
        supabase.from('content_targets').select('id', { count: 'exact', head: true }),
        supabase.from('tracker_banners').select('role_id'),
      ]);
      add('Admin: content_targets readable (v2)', !ct.error, ct.error?.message ?? `${ct.count ?? 0} rows`);
      add('Admin: tracker_banners readable (v2)', !tb.error, tb.error?.message ?? `${tb.data?.length ?? 0} banners`);
    }

    if (profile?.role_id === 'beefix') {
      const ins = await supabase
        .from('content_items')
        .insert({ role_id: 'beefix', brand_id: 'beefix', content: 'Connection test' })
        .select()
        .single();
      add('Dika: insert into Beefix → status not_started', ins.data?.status === 'not_started', ins.error?.message ?? `status ${ins.data?.status}`);
      add('Dika: the new item's PIC is Dika (v2)', ins.data?.pic_id === profile.id, ins.error?.message ?? `pic_id ${ins.data?.pic_id}`);
      if (ins.data) {
        const del = await supabase.from('content_items').delete().eq('id', ins.data.id).select('id');
        add('Dika: delete the test row', del.data?.length === 1, del.error?.message ?? `${del.data?.length} row deleted`);
      }
      const bad = await supabase
        .from('content_items')
        .insert({ role_id: 'behomy', brand_id: 'behomy', content: 'Should be refused' })
        .select()
        .single();
      add('Dika: insert into Behomy is refused by RLS', Boolean(bad.error), bad.error ? bad.error.message : 'NOT refused');
      if (bad.data) await supabase.from('content_items').delete().eq('id', bad.data.id);
      const tgt = await supabase
        .from('content_targets')
        .insert({ month: '2026-01-01', brand_id: 'beefix', profile_id: profile.id, target_reels: 1, target_feed: 1 })
        .select();
      add('Dika: setting a target is refused (Admin only, v2)', Boolean(tgt.error), tgt.error ? tgt.error.message : 'NOT refused');
      if (tgt.data?.[0]) await supabase.from('content_targets').delete().eq('id', tgt.data[0].id);
      const ban = await supabase.from('tracker_banners').select('role_id').eq('role_id', 'behomy');
      add("Dika: can't read Behomy's banner row (v2)", !ban.error && ban.data?.length === 0, ban.error?.message ?? `${ban.data?.length} rows`);
      const files = await supabase.storage.from('tracker-banners').list('behomy');
      add("Dika: can't list Behomy's banner files (v2)", Boolean(files.error) || files.data?.length === 0, files.error?.message ?? `${files.data?.length} files`);
    }

    setRunning(false);
  }

  return (
    <div className="center-screen">
      <div className="devcheck">
        <Logo height={28} />
        <h1 className="auth-title" style={{ marginTop: 32 }}>
          Connection check
        </h1>
        <p className="auth-text">
          Dev server only. Signed in as: <strong>{profile ? profile.display_name : 'nobody'}</strong>. Run it signed in as
          Admin Beyondcy and as Dika (08 §5).
        </p>
        <div className="blocked-actions">
          <button type="button" className="btn btn-primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run checks'}
          </button>
          {session ? (
            <button type="button" className="btn btn-secondary" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <Link className="btn btn-secondary" to="/login" state={{ from: '/dev-check' }}>
              Sign in
            </Link>
          )}
        </div>
        <ul className="devcheck-list">
          {results.map((r) => (
            <li key={r.name} className={r.pass === true ? 'ok' : r.pass === false ? 'fail' : ''}>
              <strong>{r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : 'INFO'}</strong> {r.name}
              <span className="dim"> · {r.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
