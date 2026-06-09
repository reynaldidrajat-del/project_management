import api, { unwrapData } from './api';

export const getIssueLinks = (issueId) => api.get(`/issue-links/issues/${issueId}`).then(unwrapData);

export const createIssueLink = (payload) => api.post('/issue-links', payload).then(unwrapData);

export const deleteIssueLink = (id) => api.delete(`/issue-links/${id}`).then(unwrapData);
