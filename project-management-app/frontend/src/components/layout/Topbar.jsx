import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import NotificationBell from '../notification/NotificationBell';
import { getPageNavigationMeta } from './navigationConfig';
import { logoutSession } from '../../logic/services/authApi';
import { useUiStore } from '../../store/uiStore';

// Header atas yang menampilkan judul halaman sesuai URL aktif.
function Topbar() {
  const location = useLocation();
  const pageMeta = getPageNavigationMeta(location.pathname);
  const currentUser = useUiStore((state) => state.currentUser);
  const isSidebarHidden = useUiStore((state) => state.isSidebarHidden);
  const logout = useUiStore((state) => state.logout);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const handleLogout = async () => {
    try {
      await logoutSession();
    } catch (_error) {
      // Sesi lokal tetap dibersihkan meski token di server sudah kedaluwarsa.
    } finally {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:px-6">
      <div
        className={[
          'mx-auto flex flex-wrap items-center justify-between gap-3',
          isSidebarHidden ? 'max-w-none' : 'max-w-[1600px]',
        ].join(' ')}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{pageMeta.section}</p>
          <h2 className="text-xl font-bold tracking-tight text-text-dark">{pageMeta.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={isSidebarHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
            aria-pressed={isSidebarHidden}
            className="btn-secondary hidden h-10 w-10 px-0 lg:inline-flex"
            title={isSidebarHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
            type="button"
            onClick={toggleSidebar}
          >
            {isSidebarHidden ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div className="hidden min-w-0 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm sm:block">
            <p className="max-w-40 truncate font-semibold leading-none text-text-dark">{currentUser?.name}</p>
            <p className="mt-1 max-w-40 truncate text-xs leading-none text-text-muted">{currentUser?.role || 'admin'}</p>
          </div>
          <NotificationBell />
          <button className="btn-secondary" type="button" onClick={handleLogout}>
            Logout
          </button>
          <Link className="btn-secondary lg:hidden" to="/projects">
            Projects
          </Link>
          <Link className="btn-primary" to="/gantt">
            Open Gantt
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
