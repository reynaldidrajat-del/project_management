import { Link, useLocation } from 'react-router-dom';

import { useUiStore } from '../../store/uiStore';

// Pasangan URL dan judul halaman yang tampil di topbar.
const titleByPath = [
  { match: '/projects', title: 'Project Workspace' },
  { match: '/tasks', title: 'Task List' },
  { match: '/gantt', title: 'Gantt Monitoring' },
  { match: '/departments/gantt', title: 'Department Gantt' },
  { match: '/locations', title: 'Lokasi' },
  { match: '/team', title: 'Team & PIC' },
  { match: '/calendar', title: 'Working Calendar' },
  { match: '/settings', title: 'Settings' },
];

// Header atas yang menampilkan judul halaman sesuai URL aktif.
function Topbar() {
  const location = useLocation();
  const pageTitle = titleByPath.find((item) => location.pathname.startsWith(item.match))?.title || 'Dashboard';
  const currentUser = useUiStore((state) => state.currentUser);
  const isSidebarHidden = useUiStore((state) => state.isSidebarHidden);
  const logout = useUiStore((state) => state.logout);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:px-6">
      <div
        className={[
          'mx-auto flex flex-wrap items-center justify-between gap-3',
          isSidebarHidden ? 'max-w-none' : 'max-w-[1600px]',
        ].join(' ')}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Project Control Center</p>
          <h2 className="text-xl font-bold tracking-tight text-text-dark">{pageTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={isSidebarHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
            aria-pressed={isSidebarHidden}
            className="btn-secondary hidden lg:inline-flex"
            title={isSidebarHidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
            type="button"
            onClick={toggleSidebar}
          >
            <span aria-hidden="true">{isSidebarHidden ? '>>' : '<<'}</span>
            {isSidebarHidden ? 'Tampilkan Sidebar' : 'Sembunyikan Sidebar'}
          </button>
          <div className="hidden min-w-0 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm sm:block">
            <p className="max-w-40 truncate font-semibold leading-none text-text-dark">{currentUser?.name}</p>
            <p className="mt-1 max-w-40 truncate text-xs leading-none text-text-muted">{currentUser?.role || 'admin'}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={logout}>
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
