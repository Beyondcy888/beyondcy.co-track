import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { Logo, Spinner } from '../ui/bits.jsx';
import { homePathFor } from '../layout/nav.js';
import { SidebarReveal } from '../layout/Sidebar.jsx';

export const NO_TRACKER = "Your account doesn't have a tracker yet. Ask Admin Beyondcy.";
export const INACTIVE = 'Your account is inactive. Ask Admin Beyondcy.';

export function FullScreenLoading({ label = 'Loading' }) {
  return (
    <div className="center-screen">
      <Spinner label={label} />
    </div>
  );
}

/** A clear message and nothing else (01 security rule 4). */
export function BlockedScreen({ message, onRetry }) {
  const { signOut } = useAuth();
  return (
    <div className="center-screen">
      <div className="blocked">
        <Logo height={28} />
        <p className="blocked-message" role="alert">
          {message}
        </p>
        <div className="blocked-actions">
          {onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Try again
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Signed-out → /login. Signed-in without a usable profile → the blocked message. */
export function RequireAuth() {
  const { ready, session, profile, profileStatus, profileError, reloadProfile } = useAuth();
  const location = useLocation();

  if (!ready) return <FullScreenLoading />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (profileStatus === 'idle' || profileStatus === 'loading') return <FullScreenLoading />;
  if (profileStatus === 'error') return <BlockedScreen message={profileError} onRetry={reloadProfile} />;
  if (!profile) return <BlockedScreen message={NO_TRACKER} />;
  if (!profile.is_active) return <BlockedScreen message={INACTIVE} />;
  if (!profile.role_id || !profile.role) return <BlockedScreen message={NO_TRACKER} />;
  if (!profile.role.is_admin && !profile.role.layout) return <BlockedScreen message={NO_TRACKER} />;
  return <Outlet />;
}

export function RequireAdmin({ children }) {
  const { profile } = useAuth();
  if (!profile?.role?.is_admin) return <Navigate to={homePathFor(profile)} replace />;
  return children;
}

/** Shown inside the shell when the URL points at a tracker this person can't open. */
export function NoTrackerAccess() {
  const { profile } = useAuth();
  return (
    <div className="no-access">
      <header className="page-header">
        <div className="page-title">
          <SidebarReveal />
          <h1>No access</h1>
        </div>
      </header>
      <div className="notice notice-danger" role="alert">
        <div>
          <p>You don't have access to this tracker.</p>
          <p className="no-access-link">
            <Link to={homePathFor(profile)}>Go to your tracker</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
