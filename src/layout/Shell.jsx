import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useApi } from '../data/ApiContext.js';
import { MonthProvider } from '../data/MonthContext.jsx';
import { MaintenanceBar } from '../maintenance/MaintenanceAdminPage.jsx';
import { listenForNavigation, resync } from '../push/push.js';
import { Sidebar } from './Sidebar.jsx';
import { SidebarContext, useSidebarController } from './sidebarState.js';

/** Push notifications (update v4, file 06): re-save this device silently, and follow taps on notifications. */
function PushHooks() {
  const api = useApi();
  const navigate = useNavigate();
  useEffect(() => {
    resync(api);
  }, [api]);
  useEffect(() => listenForNavigation(navigate), [navigate]);
  return null;
}

export function Shell() {
  const sidebar = useSidebarController();
  const state = sidebar.pinned ? 'pinned' : 'hidden';
  return (
    <MonthProvider>
      <SidebarContext.Provider value={sidebar}>
        <PushHooks />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="app" data-sidebar={state}>
          <Sidebar />
          {sidebar.peekAllowed && (
            // the far-left hot zone: hold the cursor here to peek at the hidden sidebar
            <div className="peek-zone" aria-hidden="true" onMouseEnter={sidebar.edgeEnter} onMouseLeave={sidebar.edgeLeave} />
          )}
          <main className="app-main" id="main" tabIndex={-1}>
            {/* Admin Beyondcy only, while maintenance is on (update v4, file 10) */}
            <MaintenanceBar />
            <div className="app-content">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarContext.Provider>
    </MonthProvider>
  );
}
