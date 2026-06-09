import api, { unwrapData } from './api';

const toProjectParams = (projectId, extraParams = {}) => ({
  ...extraParams,
  ...(projectId ? { project_id: projectId } : {}),
});

export const getSprints = (projectId, params = {}) =>
  api.get('/sprints', { params: toProjectParams(projectId, params) }).then(unwrapData);

export const getActiveSprint = (projectId) =>
  api.get('/sprints/active', { params: toProjectParams(projectId) }).then(unwrapData);

export const getSprint = (id) => api.get(`/sprints/${id}`).then(unwrapData);

export const createSprint = (payload) => api.post('/sprints', payload).then(unwrapData);

export const updateSprint = (id, payload) => api.put(`/sprints/${id}`, payload).then(unwrapData);

export const deleteSprint = (id) => api.delete(`/sprints/${id}`).then(unwrapData);

export const startSprint = (id) => api.post(`/sprints/${id}/start`).then(unwrapData);

export const completeSprint = (id, payload = {}) => api.post(`/sprints/${id}/complete`, payload).then(unwrapData);

export const getSprintIssues = (id) => api.get(`/sprints/${id}/issues`).then(unwrapData);

export const addIssuesToSprint = (id, issueIds) => api.post(`/sprints/${id}/issues`, { issue_ids: issueIds }).then(unwrapData);

export const removeIssuesFromSprint = (id, issueIds) => api.post(`/sprints/${id}/issues/remove`, { issue_ids: issueIds }).then(unwrapData);

export const getSprintMetrics = (id) => api.get(`/sprints/${id}/metrics`).then(unwrapData);
