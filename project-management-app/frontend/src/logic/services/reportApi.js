import api, { unwrapData } from './api';

export const getReports = (params = {}) => api.get('/reports', { params }).then(unwrapData);

export const createReport = (payload) => api.post('/reports', payload).then(unwrapData);

export const updateReport = (id, payload) => api.put(`/reports/${id}`, payload).then(unwrapData);

export const deleteReport = (id) => api.delete(`/reports/${id}`).then(unwrapData);

export const generateReport = (type, config = {}) => api.post('/reports/generate', { type, config }).then(unwrapData);

export const runSavedReport = (id, config = {}) => api.post(`/reports/${id}/run`, { config }).then(unwrapData);

export const exportGeneratedReport = (type, format, config = {}) =>
  api.post('/reports/export', { type, format, config }, { responseType: 'blob' });

export const exportSavedReport = (id, format, config = {}) =>
  api.post(`/reports/${id}/export`, { format, config }, { responseType: 'blob' });
