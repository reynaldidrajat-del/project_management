import api, { unwrapData } from './api';

// Mengambil semua user/PIC.
export const getUsers = () => api.get('/users').then(unwrapData);
// Membuat user baru.
export const createUser = (payload) => api.post('/users', payload).then(unwrapData);
// Mengubah user.
export const updateUser = (id, payload) => api.put(`/users/${id}`, payload).then(unwrapData);
// Menghapus user.
export const deleteUser = (id) => api.delete(`/users/${id}`).then(unwrapData);
