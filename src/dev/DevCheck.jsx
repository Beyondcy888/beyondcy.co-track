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

    // 3. Update v3 (06_update_v3.sql): for anyone signed in. Nothing is written.
    {
      const people = await supabase.from('people').select('id, display_name, avatar_path, role_id, role_name, is_admin, is_active');
      add('v3: the people view lists everyone (names + photos)', !people.error && (people.data?.length ?? 0) >= 2, people.error?.message ?? `${people.data?.length} people`);
      const email = await supabase.from('people').select('email').limit(1);
      add('v3: the people view has no emails', Boolean(email.error), email.error ? email.error.message : 'email column is readable: NOT expected');
      const projects = await supabase.from('projects').select('id, project_assignees(profile_id)');
      add(
        profile?.role?.is_admin ? 'v3: Admin reads every project' : 'v3: projects readable (only the ones you are assigned to)',
        !projects.error,
        projects.error?.message ?? `${projects.data?.length} projects`,
      );
      if (!profile?.role?.is_admin && projects.data) {
        const mine = projects.data.every((p) => p.project_assignees.some((a) => a.profile_id === profile.id));
        add('v3: every project you can see is assigned to you', mine, mine ? 'yes' : 'a project you are not assigned to is visible');
      }
      const files = await supabase.storage.from('avatars').list(profile?.id ?? 'none');
      add('v3: the avatars bucket answers', !files.error, files.error?.message ?? `${files.data?.length} files in your folder`);
      // changing a photo that isn't yours: staff are refused; Admin passes the check and is told the person doesn't exist
      const rpc = await supabase.rpc('set_profile_avatar', { p_profile_id: '00000000-0000-0000-0000-000000000000', p_path: null });
      const expected = profile?.role?.is_admin ? 'Person not found.' : 'You can only change your own photo.';
      add(`v3: set_profile_avatar on someone else → "${expected}"`, rpc.error?.message === expected, rpc.error?.message ?? 'no error: NOT expected');
      if (!profile?.role?.is_admin) {
        const p = await supabase.from('projects').insert({ name: 'Connection test (should be refused)', due_date: '2030-01-01' }).select('id');
        add('v3: staff cannot create a project (Admin only)', Boolean(p.error), p.error ? p.error.message : 'NOT refused');
        if (p.data?.[0]) await supabase.from('projects').delete().eq('id', p.data[0].id);
      }
    }

    if (profile?.role?.is_admin) {
      const [r, b, p] = await Promise.all([
        supabase.from('roles').select('id'),
        supabase.from('brands').select('id'),
        supabase.from('brand_pillars').select('id'),
      ]);
      add('Admin: roles → 5 rows', r.data?.length === 5, r.error?.message ?? `${r.data?.length} rows`);
      add('Admin: brands → 9 rows', b.data?.length === 9, b.error?.message ?? `${b.data?.length} rows`);
      add('Admin: brand_pillars → 5 rows', p.data?.length === 5, p.error?.message ?? `${p.data?.length} rows`);
      const [ct, ub] = await Promise.all([
        supabase.from('content_targets').select('id', { count: 'exact', head: true }),
        supabase.from('user_banners').select('profile_id'),
      ]);
      add('Admin: content_targets readable (v2)', !ct.error, ct.error?.message ?? `${ct.count ?? 0} rows`);
      add('Admin: user_banners readable (v4)', !ub.error, ub.error?.message ?? `${ub.data?.length ?? 0} banners`);
      const log = await supabase.rpc('search_activity', { p_limit: 5 });
      add('Admin: search_activity answers (v4)', !log.error, log.error?.message ?? `${log.data?.length ?? 0} recent entries`);
      const ex = await supabase.rpc('is_maintenance_exempt');
      add('v4: is_maintenance_exempt', !ex.error, ex.error?.message ?? (ex.data ? 'true: this is the Admin Beyondcy account' : 'false: locked out during maintenance'));
    }

    // v4: everyone (even signed out) reads the maintenance switch
    const m = await supabase.from('site_maintenance').select('site, is_on, ends_at');
    add('v4: site_maintenance readable → 2 rows', m.data?.length === 2, m.error?.message ?? m.data?.map((r) => `${r.site} ${r.is_on ? 'ON' : 'off'}`).join(', '));
    if (session) {
      const items = await supabase.from('content_items').select('id, links, self_posted, review_state, note_images').limit(1);
      add('v4: content_items has links / review / note_images', !items.error, items.error?.message ?? 'columns present');
    }

    if (profile?.role_id === 'beefix') {
      const ins = await supabase
        .from('content_items')
        .insert({ role_id: 'beefix', brand_id: 'beefix', content: 'Connection test' })
        .select()
        .single();
      add('Dika: insert into Beefix → status not_started', ins.data?.status === 'not_started', ins.error?.message ?? `status ${ins.data?.status}`);
      add("Dika: the new item's PIC is Dika (v2)", ins.data?.pic_id === profile.id, ins.error?.message ?? `pic_id ${ins.data?.pic_id}`);
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
      const notes = await supabase.storage.from('note-images').list('behomy');
      add("Dika: can't list Behomy's Notes pictures (v4)", Boolean(notes.error) || notes.data?.length === 0, notes.error?.message ?? `${notes.data?.length} files`);
      const rev = await supabase.rpc('start_maintenance', { p_site: 'tracker', p_minutes: 30 });
      add('Dika: turning on maintenance is refused (v4)', Boolean(rev.error), rev.error ? rev.error.message : 'NOT refused: end it on the Maintenance page now');
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
