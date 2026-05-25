import api, { unwrapData } from './api';

// Login memakai nama atau email user dari menu Team.
export const login = (payload) => api.post('/auth/login', payload).then(unwrapData);
// Mengambil user login dari session aktif.
export const getCurrentSessionUser = () => api.get('/auth/me').then(unwrapData);
// Mencabut session aktif di backend.
export const logoutSession = () => api.post('/auth/logout').then(unwrapData);
