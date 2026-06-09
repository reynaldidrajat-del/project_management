import api, { unwrapData } from './api';

export const getVersions = (projectId, params = {}) =>
  api.get('/versions', { params: { ...params, project_id: projectId } }).then(unwrapData);

export const getVersion = (id) => api.get(`/versions/${id}`).then(unwrapData);

export const createVersion = (payload) => api.post('/versions', payload).then(unwrapData);

export const updateVersion = (id, payload) => api.put(`/versions/${id}`, payload).then(unwrapData);

export const deleteVersion = (id) => api.delete(`/versions/${id}`).then(unwrapData);

export const releaseVersion = (id) => api.post(`/versions/${id}/release`).then(unwrapData);

export const archiveVersion = (id) => api.post(`/versions/${id}/archive`).then(unwrapData);

export const getVersionProgress = (id) => api.get(`/versions/${id}/progress`).then(unwrapData);

export const getVersionIssues = (id, type = 'fix') => api.get(`/versions/${id}/issues`, { params: { type } }).then(unwrapData);
