import api, { unwrapData } from './api';

const toIssueTypeParams = (projectId) => {
  if (!projectId) {
    return {};
  }

  return { projectId };
};

export const getIssueTypes = (projectId) => api.get('/issue-types', { params: toIssueTypeParams(projectId) }).then(unwrapData);

export const getIssueType = (id) => api.get(`/issue-types/${id}`).then(unwrapData);

export const getIssueTypeStats = (projectId) => api.get('/issue-types/stats', { params: toIssueTypeParams(projectId) }).then(unwrapData);

export const createIssueType = (payload) => api.post('/issue-types', payload).then(unwrapData);

export const updateIssueType = (id, payload) => api.put(`/issue-types/${id}`, payload).then(unwrapData);

export const deleteIssueType = (id) => api.delete(`/issue-types/${id}`).then(unwrapData);

export const validateIssueTypeHierarchy = (payload) => api.post('/issue-types/validate-hierarchy', payload).then(unwrapData);
