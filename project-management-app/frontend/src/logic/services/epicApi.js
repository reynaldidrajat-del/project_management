import api, { unwrapData } from './api';

export const getEpics = (projectId) => api.get('/epics', { params: { project_id: projectId } }).then(unwrapData);

export const getEpic = (id) => api.get(`/epics/${id}`).then(unwrapData);

export const createEpic = (payload) => api.post('/epics', payload).then(unwrapData);

export const updateEpic = (id, payload) => api.put(`/epics/${id}`, payload).then(unwrapData);

export const deleteEpic = (id) => api.delete(`/epics/${id}`).then(unwrapData);

export const getEpicProgress = (id) => api.get(`/epics/${id}/progress`).then(unwrapData);

export const getEpicIssues = (id) => api.get(`/epics/${id}/issues`).then(unwrapData);

export const linkIssueToEpic = (epicId, issueId) => api.post(`/epics/${epicId}/issues`, { issue_id: issueId }).then(unwrapData);

export const unlinkIssueFromEpic = (epicId, issueId) => api.delete(`/epics/${epicId}/issues/${issueId}`).then(unwrapData);
