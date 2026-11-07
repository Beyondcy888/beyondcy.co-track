import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { friendlyError, loginError } from '../lib/errors.js';
import { AuthContext } from './AuthContext.js';

const PROFILE_SELECT = 'id, display_name, role_id, is_active, role:roles(id, name, is_admin, layout)';
const INACTIVE = 'Your account is inactive. Ask Admin Beyondcy.';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profileState, setProfileState] = useState({ status: 'idle', profile: null, error: null });
  const request = useRef(0);

  // 1. session: read once, then follow changes. Never call Supabase inside the
  //    onAuthStateChange callback itself (it can deadlock the auth client).
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  // 2. profile + role for the signed-in person
  const loadProfile = useCallback(async (id) => {
    const ticket = ++request.current;
    // a reload keeps showing the current profile; only a first load shows "loading"
    setProfileState((s) => (s.profile?.id === id ? s : { status: 'loading', profile: null, error: null }));
    const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', id).maybeSingle();
    if (ticket !== request.current) return; // a newer request won
    setProfileState({
      status: error ? 'error' : 'ready',
      profile: data ?? null,
      error: error ? friendlyError(error) : null,
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      request.current += 1;
      setProfileState({ status: 'idle', profile: null, error: null });
      return;
    }
    loadProfile(userId);
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: loginError(error) };
    const { data: me } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).maybeSingle();
    if (me && me.is_active === false) {
      await supabase.auth.signOut({ scope: 'local' });
      return { error: INACTIVE };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.removeAllChannels();
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
    });
    return { error: error ? loginError(error) : null };
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? friendlyError(error) : null };
  }, []);

  const reloadProfile = useCallback(() => {
    if (userId) loadProfile(userId);
  }, [userId, loadProfile]);

  const value = useMemo(
    () => ({
      ready: session !== undefined,
      session: session ?? null,
      user: session?.user ?? null,
      profile: profileState.profile,
      profileStatus: profileState.status,
      profileError: profileState.error,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      reloadProfile,
    }),
    [session, profileState, signIn, signOut, requestPasswordReset, updatePassword, reloadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
