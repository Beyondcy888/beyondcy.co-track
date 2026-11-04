import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { useAuth } from './auth/AuthContext.js';
import { LoginPage } from './auth/LoginPage.jsx';
import { ResetPasswordPage } from './auth/ResetPasswordPage.jsx';
import { FullScreenLoading, RequireAdmin, RequireAuth } from './auth/guards.jsx';
import { ApiContext } from './data/ApiContext.js';
import { supabaseApi } from './data/api.js';
import { AppDataProvider, useAppData } from './data/AppDataProvider.jsx';
import { Shell } from './layout/Shell.jsx';
import { TrackerRoute, TrackerView } from './pages/TrackerPages.jsx';
import { Dashboard } from './admin/Dashboard.jsx';
import { PeoplePage } from './admin/PeoplePage.jsx';
import { TargetsPage } from './admin/TargetsPage.jsx';
import { ToastProvider } from './ui/Toast.jsx';
import { ConfirmProvider } from './ui/Confirm.jsx';
import { PageHeader } from './layout/PageHeader.jsx';

// The connection-test page only exists on the dev server (08 §5); it is not in production builds.
const DevCheck = import.meta.env.DEV ? lazy(() => import('./dev/DevCheck.jsx')) : null;

/** "/" → Admin's Dashboard (09 §9); everyone else goes to their own tracker. */
function Home() {
  const { profile } = useAuth();
  if (profile.role?.is_admin) return <Dashboard />;
  return <Navigate to={`/t/${profile.role_id}`} replace />;
}

function AppDataGate({ children }) {
  const app = useAppData();
  if (app.status === 'loading') return <FullScreenLoading />;
  if (app.status === 'error') {
    return (
      <div className="center-screen">
        <div className="notice notice-danger" role="alert">
          <div>
            <p>{app.error}</p>
            <button type="button" className="link-btn" onClick={app.reload}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}

function SignedInLayout() {
  const { user } = useAuth();
  return (
    <AppDataProvider key={user?.id}>
      <AppDataGate>
        <Shell />
      </AppDataGate>
    </AppDataProvider>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <div className="notice">
        <p>
          This page doesn't exist. <Link to="/">Go to your tracker</Link>
        </p>
      </div>
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {DevCheck && (
        <Route
          path="/dev-check"
          element={
            <Suspense fallback={<FullScreenLoading />}>
              <DevCheck />
            </Suspense>
          }
        />
      )}
      <Route element={<RequireAuth />}>
        <Route element={<SignedInLayout />}>
          <Route index element={<Home />} />
          <Route
            path="admin/targets"
            element={
              <RequireAdmin>
                <TargetsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/people"
            element={
              <RequireAdmin>
                <PeoplePage />
              </RequireAdmin>
            }
          />
          <Route path="t/:roleId" element={<TrackerRoute />}>
            <Route index element={<TrackerView kind="main" />} />
            <Route path="master" element={<TrackerView kind="master" />} />
            <Route path="brand/:brandId" element={<TrackerView kind="brand" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** Shared UI providers (also used by the dev mock). */
export function UiProviders({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ApiContext.Provider value={supabaseApi}>
        <AuthProvider>
          <UiProviders>
            <AppRoutes />
          </UiProviders>
        </AuthProvider>
      </ApiContext.Provider>
    </BrowserRouter>
  );
}
