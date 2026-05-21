import { NavLink } from 'react-router-dom';

// Daftar menu utama di sidebar.
const navigation = [
  { label: 'Dashboard', path: '/' },
  { label: 'Projects', path: '/projects' },
  { label: 'Task List', path: '/tasks' },
  { label: 'Gantt', path: '/gantt' },
  { label: 'Department Gantt', path: '/departments/gantt' },
  { label: 'Team', path: '/team' },
  { label: 'Lokasi', path: '/locations' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Settings', path: '/settings' },
];

// Membuat inisial pendek dari nama menu untuk ikon fallback.
const getInitials = (label) =>
  label
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

// Sidebar navigasi utama aplikasi.
function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-white px-4 py-4 lg:flex lg:flex-col">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-black text-white shadow-sm">
          PG
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Planner Gantt</p>
          <h1 className="text-base font-bold leading-tight text-text-dark">Department Timeline Hub</h1>
        </div>
      </div>

      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Workspace</p>
      <nav className="space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            end={item.path === '/'}
            to={item.path}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-primary-light text-primary-dark ring-1 ring-primary/10'
                  : 'text-text-muted hover:bg-slate-100 hover:text-text-dark',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black transition',
                    isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white',
                  ].join(' ')}
                >
                  {getInitials(item.label)}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
