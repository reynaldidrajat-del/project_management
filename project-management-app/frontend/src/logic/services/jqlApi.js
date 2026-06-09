import api, { unwrapData } from './api';

export const searchJql = (payload) => api.post('/jql/search', payload).then(unwrapData);

export const validateJql = (jql) => api.post('/jql/validate', { jql }).then(unwrapData);

export const getSavedFilters = (params = {}) => api.get('/jql/filters', { params }).then(unwrapData);

export const getSavedFilter = (id) => api.get(`/jql/filters/${id}`).then(unwrapData);

export const createSavedFilter = (payload) => api.post('/jql/filters', payload).then(unwrapData);

export const updateSavedFilter = (id, payload) => api.put(`/jql/filters/${id}`, payload).then(unwrapData);

export const deleteSavedFilter = (id) => api.delete(`/jql/filters/${id}`).then(unwrapData);

export const favoriteSavedFilter = (id, isFavorite) =>
  api.patch(`/jql/filters/${id}/favorite`, { is_favorite: isFavorite }).then(unwrapData);

export const runSavedFilter = (id, params = {}) => api.post(`/jql/filters/${id}/run`, params).then(unwrapData);
