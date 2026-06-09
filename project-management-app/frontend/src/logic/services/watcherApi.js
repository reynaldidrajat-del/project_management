import api, { unwrapData } from './api';

export const getIssueWatchers = (issueId) => api.get(`/watchers/issues/${issueId}`).then(unwrapData);

export const addIssueWatcher = (issueId, userId) => api.post(`/watchers/issues/${issueId}`, { user_id: userId }).then(unwrapData);

export const addIssueWatchers = (issueId, userIds) => api.post(`/watchers/issues/${issueId}/bulk`, { user_ids: userIds }).then(unwrapData);

export const removeIssueWatcher = (issueId, userId) => api.delete(`/watchers/issues/${issueId}/users/${userId}`).then(unwrapData);
