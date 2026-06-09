export const BOARD_CARD_FIELDS = [
  { key: 'issue_key', label: 'Issue key' },
  { key: 'issue_type', label: 'Issue type' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'subtasks', label: 'Subtasks' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'labels', label: 'Labels' },
  { key: 'epic', label: 'Epic progress' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'lead', label: 'Lead' },
  { key: 'due_date', label: 'Due date' },
  { key: 'progress', label: 'Progress' },
];

export const BOARD_DEFAULT_CONFIG = {
  card_color_mode: 'priority',
  card_fields: BOARD_CARD_FIELDS.map((field) => field.key),
  columns: [
    { id: 'todo', label: 'To Do', status: 'Not Started', workflow_category: 'TODO' },
    { id: 'in-progress', label: 'In Progress', status: 'In Progress', workflow_category: 'IN_PROGRESS' },
    { id: 'review', label: 'Review', status: 'Waiting Review', workflow_category: 'IN_PROGRESS' },
    { id: 'done', label: 'Done', status: 'Done', workflow_category: 'DONE' },
  ],
  quick_filters: [
    { id: 'mine', label: 'My issues', jql: 'assignee = currentUser()' },
    { id: 'bugs', label: 'Bugs', jql: 'type = Bug' },
    { id: 'overdue', label: 'Overdue', jql: 'due < now() AND status != Done' },
  ],
  swimlane_default: 'none',
};

export const getBoardConfigStorageKey = (projectId) => `jira-board-config:${projectId || 'global'}`;

export const getBoardConfig = (projectId) => {
  if (typeof window === 'undefined') {
    return BOARD_DEFAULT_CONFIG;
  }

  try {
    const storedConfig = window.localStorage.getItem(getBoardConfigStorageKey(projectId));
    return {
      ...BOARD_DEFAULT_CONFIG,
      ...(storedConfig ? JSON.parse(storedConfig) : {}),
    };
  } catch (_error) {
    return BOARD_DEFAULT_CONFIG;
  }
};

export const saveBoardConfig = (projectId, config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const nextConfig = {
    ...BOARD_DEFAULT_CONFIG,
    ...config,
  };

  window.localStorage.setItem(getBoardConfigStorageKey(projectId), JSON.stringify(nextConfig));
  window.dispatchEvent(new CustomEvent('board-config-updated', { detail: { projectId, config: nextConfig } }));

  return nextConfig;
};
