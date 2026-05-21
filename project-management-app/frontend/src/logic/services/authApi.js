import api, { unwrapData } from './api';

// Login memakai nama atau email user dari menu Team.
export const login = (payload) => api.post('/auth/login', payload).then(unwrapData);
