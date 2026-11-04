import { useEffect } from 'react';
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { trackerPages } from './nav.js';
import { useSidebar } from './sidebarState.js';
import { Initial, Logo, LogoMark } from '../ui/bits.jsx';
import { IconGrid, IconLayers, IconLogOut, IconMenu, IconPanel, IconTarget, IconUser, IconUsers, IconX } from '../ui/icons.jsx';

function NavIcon({ icon, initial }) {
  if (icon === 'master') return <IconLayers />;
  if (icon === 'me') return <IconUser />;
  if (icon === 'people') return <IconUsers />;
  if (icon === 'grid') return <IconGrid />;
  if (icon === 'target') return <IconTarget />;
  return <span className="nav-initial">{initial}</span>;
}

function NavItem({ to, end, label, icon, initial, className = '' }) {
  return (
    <NavLink to={to} end={end} className={`nav-item ${className}`} title={label}>
      <span className="nav-icon" aria-hidden="true">
        <NavIcon icon={icon} initial={initial} />
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

const SHORTCUT = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform ?? '') ? '⌘\\' : 'Ctrl+\\';

/** Shown at the top-left of the page header while the sidebar is hidden (desktop). */
export function SidebarReveal() {
  const sb = useSidebar();
  if (!sb || sb.mobile || sb.pinned) return null;
  return (
    <div className="page-reveal">
      <button
        type="button"
        className="icon-btn"
        data-sidebar-toggle="outside"
        aria-expanded={sb.peek}
        aria-controls="sidebar"
        title={`Show sidebar (${SHORTCUT})`}
        onClick={(e) => sb.setPinned(true, { keyboard: e.detail === 0 })}
      >
        <IconPanel width={18} height={18} />
        <span className="sr-only">Show sidebar</span>
      </button>
      <Link to="/" className="page-reveal-mark">
        <LogoMark height={22} />
      </Link>
    </div>
  );
}

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const app = useAppData();
  const sb = useSidebar();
  const location = useLocation();
  const match = useMatch('/t/:roleId/*');

  const isAdmin = Boolean(profile?.role?.is_admin);
  const currentRoleId = match?.params.roleId ?? null;
  const myRole = app.rolesById[profile?.role_id];
  const { openDrawer } = sb;

  // a page change closes the phone drawer
  useEffect(() => openDrawer(false), [location.pathname, openDrawer]);

  const currentRole = isAdmin ? app.rolesById[currentRoleId] : myRole;
  const currentPages = currentRole ? trackerPages(currentRole, app.brandsForRole(currentRole.id), isAdmin) : [];

  return (
    <>
      <div className="topbar">
        <Link to="/" className="topbar-mark">
          <LogoMark height={26} />
        </Link>
        <button
          type="button"
          className="icon-btn"
          data-sidebar-toggle="outside"
          aria-expanded={sb.drawer}
          aria-controls="sidebar"
          onClick={(e) => sb.openDrawer(!sb.drawer, { keyboard: e.detail === 0 })}
        >
          <IconMenu width={20} height={20} />
          <span className="sr-only">Open menu</span>
        </button>
      </div>

      <aside
        id="sidebar"
        ref={sb.sidebarRef}
        className="sidebar"
        aria-label="Sidebar"
        data-open={sb.drawer}
        data-peek={sb.peek}
        inert={!sb.shown}
        onMouseEnter={sb.peek ? sb.panelEnter : undefined}
        onMouseLeave={sb.peek ? sb.panelLeave : undefined}
      >
        <div className="sidebar-head">
          <Link to="/" className="sidebar-mark">
            <Logo height={26} className="sidebar-logo" />
            <LogoMark height={26} className="sidebar-logo-mark" />
          </Link>
          {sb.mobile ? (
            <button type="button" className="icon-btn sidebar-toggle" onClick={() => sb.openDrawer(false)}>
              <IconX width={18} height={18} />
              <span className="sr-only">Close menu</span>
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn sidebar-toggle"
              aria-expanded="true"
              aria-controls="sidebar"
              title={sb.peek ? 'Keep the sidebar open' : `Hide sidebar (${SHORTCUT})`}
              onClick={(e) => sb.setPinned(!sb.pinned || sb.peek, { keyboard: e.detail === 0 })}
            >
              <IconPanel width={18} height={18} />
              <span className="sr-only">{sb.peek ? 'Keep the sidebar open' : 'Hide sidebar'}</span>
            </button>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          {isAdmin ? (
            <>
              <NavItem to="/" end label="Dashboard" icon="grid" />
              <NavItem to="/admin/targets" label="Targets" icon="target" />

              <p className="nav-section nav-wide">Trackers</p>
              <ul className="nav-wide">
                {app.trackers.map((t) => {
                  const pages = trackerPages(t, app.brandsForRole(t.id), true);
                  const active = t.id === currentRoleId;
                  const hasSub = pages.length > 1;
                  return (
                    <li key={t.id}>
                      <Link
                        to={`/t/${t.id}`}
                        className={`nav-item nav-tracker${active ? ' is-open' : ''}`}
                        aria-current={active && !hasSub ? 'page' : undefined}
                        title={t.name}
                      >
                        <span className="nav-icon" aria-hidden="true">
                          <span className={`nav-dot${active ? ' is-active' : ''}`} />
                        </span>
                        <span className="nav-label">{t.name}</span>
                      </Link>
                      {active && hasSub && (
                        <ul className="nav-sub">
                          {pages.map((p) => (
                            <li key={p.to}>
                              <NavItem {...p} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* icon rail: only the open tracker's pages */}
              {currentPages.length > 0 && (
                <ul className="nav-rail">
                  {currentPages.map((p) => (
                    <li key={p.to}>
                      <NavItem {...p} />
                    </li>
                  ))}
                </ul>
              )}

              <span className="nav-sep" aria-hidden="true" />
              <NavItem to="/admin/people" label="People" icon="people" />
            </>
          ) : (
            <>
              {myRole && <p className="nav-section nav-wide">{myRole.name}</p>}
              <ul>
                {currentPages.map((p) => (
                  <li key={p.to}>
                    <NavItem {...p} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <Initial name={profile?.display_name} />
          <div className="who">
            <span className="who-name truncate">{profile?.display_name}</span>
            <span className="who-role">
              <span className="truncate">{profile?.role?.name}</span>
              <span aria-hidden="true"> · </span>
              <button type="button" className="link-btn who-signout" onClick={signOut}>
                Sign out
              </button>
            </span>
          </div>
          <button type="button" className="icon-btn rail-signout" onClick={signOut} title="Sign out">
            <IconLogOut />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </aside>
      {sb.drawer && <div className="sidebar-scrim" onClick={() => sb.openDrawer(false)} aria-hidden="true" />}
    </>
  );
}
