import api, { unwrapData } from './api';

// Mengambil daftar notifikasi user login.
export const getNotifications = (params = {}) => api.get('/notifications', { params }).then(unwrapData);

// Mengambil jumlah notifikasi belum dibaca.
export const getUnreadNotificationCount = () => api.get('/notifications/unread-count').then(unwrapData);

// Menandai satu notifikasi sebagai dibaca.
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then(unwrapData);

// Menandai semua notifikasi sebagai dibaca.
export const markAllNotificationsRead = () => api.patch('/notifications/read-all').then(unwrapData);
