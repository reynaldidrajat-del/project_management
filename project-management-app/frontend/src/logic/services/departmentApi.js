import api, { unwrapData } from './api';

// Mengambil semua department.
export const getDepartments = () => api.get('/departments').then(unwrapData);
// Membuat department baru.
export const createDepartment = (payload) => api.post('/departments', payload).then(unwrapData);
// Mengubah department.
export const updateDepartment = (id, payload) => api.put(`/departments/${id}`, payload).then(unwrapData);
// Menghapus department.
export const deleteDepartment = (id) => api.delete(`/departments/${id}`).then(unwrapData);
