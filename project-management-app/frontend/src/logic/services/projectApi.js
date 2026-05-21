import api, { unwrapData } from './api';

// Mengambil daftar project dengan filter opsional.
export const getProjects = (params = {}) => api.get('/projects', { params }).then(unwrapData);
// Mengambil detail satu project.
export const getProject = (id) => api.get(`/projects/${id}`).then(unwrapData);
// Membuat project baru.
export const createProject = (payload) => api.post('/projects', payload).then(unwrapData);
// Mengubah data project.
export const updateProject = (id, payload) => api.put(`/projects/${id}`, payload).then(unwrapData);
// Menghapus project.
export const deleteProject = (id) => api.delete(`/projects/${id}`).then(unwrapData);
// Mengambil bucket milik project untuk board dan form task.
export const getProjectBuckets = (projectId) => api.get(`/projects/${projectId}/buckets`).then(unwrapData);
// Membuat bucket baru.
export const createBucket = (payload) => api.post('/buckets', payload).then(unwrapData);
// Mengubah bucket.
export const updateBucket = (id, payload) => api.put(`/buckets/${id}`, payload).then(unwrapData);
// Menghapus bucket.
export const deleteBucket = (id) => api.delete(`/buckets/${id}`).then(unwrapData);
