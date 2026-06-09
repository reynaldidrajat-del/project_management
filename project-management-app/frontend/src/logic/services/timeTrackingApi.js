import api, { unwrapData } from './api';

export const listWorkLogs = (params = {}) => api.get('/time-tracking/logs', { params }).then(unwrapData);

export const getIssueTimeTracking = (issueId) => api.get(`/time-tracking/issues/${issueId}`).then(unwrapData);

export const updateIssueEstimates = (issueId, payload) => api.put(`/time-tracking/issues/${issueId}/estimates`, payload).then(unwrapData);

export const createWorkLog = (issueId, payload) => api.post(`/time-tracking/issues/${issueId}/logs`, payload).then(unwrapData);

export const deleteWorkLog = (id) => api.delete(`/time-tracking/logs/${id}`).then(unwrapData);

export const getTimeTrackingReport = (params = {}) => api.get('/time-tracking/reports', { params }).then(unwrapData);
