import { Outlet } from 'react-router-dom';
import { MonthProvider } from '../data/MonthContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { SidebarContext, useSidebarController } from './sidebarState.js';

export function Shell() {
  const sidebar = useSidebarController();
  const state = sidebar.pinned ? 'pinned' : 'hidden';
  return (
    <MonthProvider>
      <SidebarContext.Provider value={sidebar}>
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
            <div className="app-content">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarContext.Provider>
    </MonthProvider>
  );
}
