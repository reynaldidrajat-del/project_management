import api, { unwrapData } from './api';

// Mengambil daftar pengecualian kalender.
export const getCalendarExceptions = () => api.get('/calendar/exceptions').then(unwrapData);
// Membuat pengecualian kalender baru.
export const createCalendarException = (payload) => api.post('/calendar/exceptions', payload).then(unwrapData);
// Mengimport hari libur nasional Indonesia 2026.
export const importIndonesiaHolidays2026 = () => api.post('/calendar/indonesia-holidays/2026').then(unwrapData);
// Mengubah pengecualian kalender.
export const updateCalendarException = (id, payload) => api.put(`/calendar/exceptions/${id}`, payload).then(unwrapData);
// Menghapus pengecualian kalender.
export const deleteCalendarException = (id) => api.delete(`/calendar/exceptions/${id}`).then(unwrapData);
