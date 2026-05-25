import { useEffect, useState } from 'react';

import { ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import {
  getSidebarActiveGroupId,
  getSidebarInitialCollapsedGroupIds,
  sidebarNavigationGroups,
} from './navigationConfig';

const SIDEBAR_COLLAPSED_GROUPS_STORAGE_KEY = 'project-management-sidebar-collapsed-groups';

const getStoredCollapsedGroupIds = () => {
  if (typeof window === 'undefined') {
    return getSidebarInitialCollapsedGroupIds();
  }

  try {
    const storedCollapsedGroupIds = window.localStorage.getItem(SIDEBAR_COLLAPSED_GROUPS_STORAGE_KEY);

    if (!storedCollapsedGroupIds) {
      return getSidebarInitialCollapsedGroupIds();
    }

    const parsedCollapsedGroupIds = JSON.parse(storedCollapsedGroupIds);

    if (!Array.isArray(parsedCollapsedGroupIds)) {
      return getSidebarInitialCollapsedGroupIds();
    }

    const validGroupIds = new Set(sidebarNavigationGroups.map((group) => group.id));

    return parsedCollapsedGroupIds.filter((groupId) => validGroupIds.has(groupId));
  } catch (_error) {
    return getSidebarInitialCollapsedGroupIds();
  }
};

// Sidebar navigasi utama aplikasi.
function Sidebar() {
  const location = useLocation();
  const activeGroupId = getSidebarActiveGroupId(location.pathname);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(getStoredCollapsedGroupIds);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    setCollapsedGroupIds((currentGroupIds) => currentGroupIds.filter((groupId) => groupId !== activeGroupId));
  }, [activeGroupId, location.pathname]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(collapsedGroupIds));
  }, [collapsedGroupIds]);

  const toggleGroup = (groupId) => {
    setCollapsedGroupIds((currentGroupIds) =>
      currentGroupIds.includes(groupId)
        ? currentGroupIds.filter((currentGroupId) => currentGroupId !== groupId)
        : [...currentGroupIds, groupId],
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-border bg-white px-4 py-4 lg:flex lg:flex-col">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-black text-white shadow-sm">
          PG
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Planner Gantt</p>
          <h1 className="text-base font-bold leading-tight text-text-dark">Department Timeline Hub</h1>
        </div>
      </div>

      <nav className="space-y-3">
        {sidebarNavigationGroups.map((group) => {
          const GroupIcon = group.icon;
          const isCollapsed = collapsedGroupIds.includes(group.id);
          const isGroupActive = group.items.some((item) => item.match(location.pathname));

          return (
            <section key={group.id} className="space-y-2">
              <button
                aria-expanded={!isCollapsed}
                className={[
                  'group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition',
                  isGroupActive
                    ? 'border-primary/15 bg-primary-light text-primary-dark'
                    : 'border-transparent bg-slate-50 text-text-muted hover:border-border hover:bg-slate-100 hover:text-text-dark',
                ].join(' ')}
                type="button"
                onClick={() => toggleGroup(group.id)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                      isGroupActive ? 'bg-primary text-white' : 'bg-white text-slate-500 group-hover:text-text-dark',
                    ].join(' ')}
                  >
                    <GroupIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">{group.label}</span>
                </span>
                <ChevronDown
                  className={[
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    isCollapsed ? 'rotate-180' : 'rotate-0',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </button>

              {!isCollapsed ? (
                <div className="space-y-1 pl-2">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = item.match(location.pathname);

                    return (
                      <Link
                        key={item.path}
                        aria-current={isActive ? 'page' : undefined}
                        className={[
                          'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                          isActive
                            ? 'border-primary/15 bg-primary-light text-primary-dark shadow-sm'
                            : 'border-transparent text-text-muted hover:border-border hover:bg-slate-100 hover:text-text-dark',
                        ].join(' ')}
                        to={item.path}
                      >
                        <span
                          className={[
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                            isActive ? 'bg-primary text-white' : 'bg-white text-slate-500 group-hover:text-text-dark',
                          ].join(' ')}
                        >
                          <ItemIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
