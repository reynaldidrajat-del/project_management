import api, { unwrapData } from './api';

// Mengambil semua lokasi/bisnis unit.
export const getLocations = () => api.get('/locations').then(unwrapData);
// Membuat lokasi baru.
export const createLocation = (payload) => api.post('/locations', payload).then(unwrapData);
// Mengubah lokasi.
export const updateLocation = (id, payload) => api.put(`/locations/${id}`, payload).then(unwrapData);
// Menghapus lokasi.
export const deleteLocation = (id) => api.delete(`/locations/${id}`).then(unwrapData);
