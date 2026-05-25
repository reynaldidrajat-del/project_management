import api, { unwrapData } from './api';

// Mengambil audit trail/activity feed dengan filter opsional.
export const getActivities = (params = {}) => api.get('/activities', { params }).then(unwrapData);
