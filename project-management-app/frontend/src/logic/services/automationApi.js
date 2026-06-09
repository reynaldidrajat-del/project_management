import api, { unwrapData } from './api';

export const getAutomationRules = (params = {}) => api.get('/automation/rules', { params }).then(unwrapData);

export const getAutomationRule = (id) => api.get(`/automation/rules/${id}`).then(unwrapData);

export const createAutomationRule = (payload) => api.post('/automation/rules', payload).then(unwrapData);

export const updateAutomationRule = (id, payload) => api.put(`/automation/rules/${id}`, payload).then(unwrapData);

export const enableAutomationRule = (id) => api.patch(`/automation/rules/${id}/enable`).then(unwrapData);

export const disableAutomationRule = (id) => api.patch(`/automation/rules/${id}/disable`).then(unwrapData);

export const deleteAutomationRule = (id) => api.delete(`/automation/rules/${id}`).then(unwrapData);

export const getAutomationRuleLogs = (id, params = {}) => api.get(`/automation/rules/${id}/logs`, { params }).then(unwrapData);

export const getAutomationLogs = (params = {}) => api.get('/automation/logs', { params }).then(unwrapData);

export const triggerAutomation = (payload) => api.post('/automation/trigger', payload).then(unwrapData);
