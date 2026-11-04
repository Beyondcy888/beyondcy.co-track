import { createContext, useContext } from 'react';

/**
 * Shape of the auth context (the real provider and the dev mock both fill it):
 * {
 *   ready: boolean,                 // first session check finished
 *   session, user,
 *   profile: { id, display_name, role_id, is_active, role: { id, name, is_admin, layout } } | null,
 *   profileStatus: 'idle' | 'loading' | 'ready' | 'error',
 *   profileError: string | null,
 *   signIn(email, password) → { error },
 *   signOut(),
 *   requestPasswordReset(email) → { error },
 *   updatePassword(password) → { error },
 *   reloadProfile(),
 * }
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

/** Convenience: is the signed-in person Admin? */
export function useIsAdmin() {
  return Boolean(useAuth().profile?.role?.is_admin);
}
