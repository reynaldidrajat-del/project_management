import api, { unwrapData } from './api';

// Mengambil laporan kinerja per user berdasarkan periode dan filter yang dipilih.
export const getPerformanceUsers = (params) => api.get('/performance/users', { params }).then(unwrapData);

// Mengambil detail task dan bottleneck untuk satu user.
export const getUserPerformance = (userId, params) => api.get(`/performance/users/${userId}`, { params }).then(unwrapData);

// Mengambil ringkasan kinerja per department.
export const getDepartmentPerformance = (params) => api.get('/performance/departments', { params }).then(unwrapData);

// Mengambil task yang berpotensi menjadi penghambat pekerjaan.
export const getPerformanceBottlenecks = (params) => api.get('/performance/bottlenecks', { params }).then(unwrapData);

// Mengunduh export CSV laporan kinerja.
export const exportPerformanceUsers = (params) =>
  api.get('/performance/export', {
    params,
    responseType: 'blob',
  });
