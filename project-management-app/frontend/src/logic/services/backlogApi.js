import api, { unwrapData } from './api';

export const getBacklog = (projectId, params = {}) =>
  api.get('/backlog', { params: { ...params, project_id: projectId } }).then(unwrapData);

export const getBacklogStats = (projectId) => api.get('/backlog/stats', { params: { project_id: projectId } }).then(unwrapData);

export const reorderBacklogIssue = (projectId, issueId, newPosition) =>
  api.patch('/backlog/reorder', { project_id: projectId, issue_id: issueId, new_position: newPosition }).then(unwrapData);

export const moveIssuesToSprint = (sprintId, issueIds) =>
  api.post('/backlog/move-to-sprint', { sprint_id: sprintId, issue_ids: issueIds }).then(unwrapData);

export const moveIssuesToBacklog = (issueIds) => api.post('/backlog/move-to-backlog', { issue_ids: issueIds }).then(unwrapData);
