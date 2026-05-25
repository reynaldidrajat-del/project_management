import api, { unwrapData } from './api';

// Mengambil komentar diskusi milik satu task.
export const getTaskComments = (taskId) => api.get(`/tasks/${taskId}/comments`).then(unwrapData);

// Membuat komentar task dan optional mention user.
export const createTaskComment = (taskId, payload) => api.post(`/tasks/${taskId}/comments`, payload).then(unwrapData);

// Mengubah komentar task.
export const updateTaskComment = (commentId, payload) => api.put(`/task-comments/${commentId}`, payload).then(unwrapData);

// Soft delete komentar task.
export const deleteTaskComment = (commentId) => api.delete(`/task-comments/${commentId}`).then(unwrapData);

// Menandai semua komentar pada task sebagai sudah dibaca user login.
export const markTaskCommentsRead = (taskId) => api.post(`/tasks/${taskId}/comments/read`).then(unwrapData);

// Menandai satu komentar sebagai sudah dibaca user login.
export const markTaskCommentRead = (commentId) => api.post(`/task-comments/${commentId}/read`).then(unwrapData);
