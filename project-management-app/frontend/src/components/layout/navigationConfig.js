import {
  Bell,
  CalendarDays,
  ChartGantt,
  ClipboardList,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Settings2,
  Users,
} from 'lucide-react';

const createExactMatcher = (path) => (pathname) => pathname === path;

const createPrefixMatcher = (path) => (pathname) => pathname === path || pathname.startsWith(`${path}/`);

export const sidebarNavigationGroups = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    defaultCollapsed: false,
    items: [
      {
        label: 'Dashboard',
        title: 'Dashboard',
        path: '/',
        icon: LayoutDashboard,
        match: createExactMatcher('/'),
      },
      {
        label: 'Projects',
        title: 'Project Workspace',
        path: '/projects',
        icon: FolderKanban,
        match: createPrefixMatcher('/projects'),
      },
    ],
  },
  {
    id: 'work-management',
    label: 'Work Management',
    icon: ClipboardList,
    defaultCollapsed: false,
    items: [
      {
        label: 'My Tasks',
        title: 'My Tasks',
        path: '/my-tasks',
        icon: ListTodo,
        match: createExactMatcher('/my-tasks'),
      },
      {
        label: 'Task List',
        title: 'Task List',
        path: '/tasks',
        icon: ListTodo,
        match: createExactMatcher('/tasks'),
      },
      {
        label: 'Task Calendar',
        title: 'Task Calendar',
        path: '/tasks/calendar',
        icon: CalendarDays,
        match: createExactMatcher('/tasks/calendar'),
      },
      {
        label: 'Gantt',
        title: 'Gantt Monitoring',
        path: '/gantt',
        icon: ChartGantt,
        match: createExactMatcher('/gantt'),
      },
      {
        label: 'Department Gantt',
        title: 'Department Gantt',
        path: '/departments/gantt',
        icon: ChartGantt,
        match: createExactMatcher('/departments/gantt'),
      },
      {
        label: 'Performance',
        title: 'Performance Report',
        path: '/performance',
        icon: Gauge,
        match: createExactMatcher('/performance'),
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    icon: Bell,
    defaultCollapsed: true,
    items: [
      {
        label: 'Notifications',
        title: 'Notifications',
        path: '/notifications',
        icon: Bell,
        match: createExactMatcher('/notifications'),
      },
      {
        label: 'Team',
        title: 'Team & PIC',
        path: '/team',
        icon: Users,
        match: createExactMatcher('/team'),
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: Settings2,
    defaultCollapsed: true,
    items: [
      {
        label: 'Lokasi',
        title: 'Lokasi',
        path: '/locations',
        icon: MapPin,
        match: createExactMatcher('/locations'),
      },
      {
        label: 'Calendar',
        title: 'Working Calendar',
        path: '/calendar',
        icon: CalendarDays,
        match: createExactMatcher('/calendar'),
      },
      {
        label: 'Settings',
        title: 'Settings',
        path: '/settings',
        icon: Settings2,
        match: createExactMatcher('/settings'),
      },
    ],
  },
];

export const getSidebarInitialCollapsedGroupIds = () =>
  sidebarNavigationGroups.filter((group) => group.defaultCollapsed).map((group) => group.id);

export const getSidebarActiveGroupId = (pathname) =>
  sidebarNavigationGroups.find((group) => group.items.some((item) => item.match(pathname)))?.id || null;

export const getSidebarActiveItem = (pathname) =>
  sidebarNavigationGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label }))).find((item) => item.match(pathname)) || null;

export const pageNavigationMeta = [
  {
    section: 'Overview',
    title: 'Dashboard',
    match: createExactMatcher('/'),
  },
  {
    section: 'Overview',
    title: 'Project Workspace',
    match: createPrefixMatcher('/projects'),
  },
  {
    section: 'Work Management',
    title: 'My Tasks',
    match: createExactMatcher('/my-tasks'),
  },
  {
    section: 'Work Management',
    title: 'Task List',
    match: createExactMatcher('/tasks'),
  },
  {
    section: 'Work Management',
    title: 'Task Calendar',
    match: createExactMatcher('/tasks/calendar'),
  },
  {
    section: 'Work Management',
    title: 'Gantt Monitoring',
    match: createExactMatcher('/gantt'),
  },
  {
    section: 'Work Management',
    title: 'Department Gantt',
    match: createExactMatcher('/departments/gantt'),
  },
  {
    section: 'Work Management',
    title: 'Performance Report',
    match: createExactMatcher('/performance'),
  },
  {
    section: 'Collaboration',
    title: 'Notifications',
    match: createExactMatcher('/notifications'),
  },
  {
    section: 'Collaboration',
    title: 'Team & PIC',
    match: createExactMatcher('/team'),
  },
  {
    section: 'Administration',
    title: 'Lokasi',
    match: createExactMatcher('/locations'),
  },
  {
    section: 'Administration',
    title: 'Working Calendar',
    match: createExactMatcher('/calendar'),
  },
  {
    section: 'Administration',
    title: 'Settings',
    match: createExactMatcher('/settings'),
  },
];

export const getPageNavigationMeta = (pathname) =>
  pageNavigationMeta.find((item) => item.match(pathname)) || {
    section: 'Overview',
    title: 'Dashboard',
  };
