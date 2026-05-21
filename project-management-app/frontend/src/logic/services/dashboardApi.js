import api, { unwrapData } from './api';

// Mengambil ringkasan data untuk dashboard.
export const getDashboardSummary = () => api.get('/dashboard/summary').then(unwrapData);
