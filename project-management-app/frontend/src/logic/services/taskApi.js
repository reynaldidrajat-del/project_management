import api, { unwrapData } from './api';

// Mengambil daftar task dengan filter opsional.
export const getTasks = (params = {}) => api.get('/tasks', { params }).then(unwrapData);
// Mengambil task yang hanya berada di satu project.
export const getProjectTasks = (projectId, params = {}) => api.get(`/projects/${projectId}/tasks`, { params }).then(unwrapData);
// Mengambil detail satu task.
export const getTask = (id) => api.get(`/tasks/${id}`).then(unwrapData);
// Mengambil subtask milik satu task.
export const getSubtasks = (id) => api.get(`/tasks/${id}/subtasks`).then(unwrapData);
// Membuat task baru.
export const createTask = (payload) => api.post('/tasks', payload).then(unwrapData);
// Mengubah data utama task.
export const updateTask = (id, payload) => api.put(`/tasks/${id}`, payload).then(unwrapData);
// Menghapus task.
export const deleteTask = (id) => api.delete(`/tasks/${id}`).then(unwrapData);
// Mengubah status task saja.
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status }).then(unwrapData);
// Mengubah progress task saja.
export const updateTaskProgress = (id, progress) => api.patch(`/tasks/${id}/progress`, { progress }).then(unwrapData);
// Mengapprove task yang sudah masuk Waiting Review.
export const approveTask = (id, approverUserId) =>
  api
    .patch(
      `/tasks/${id}/approve`,
      { approver_user_id: approverUserId },
      {
        headers: {
          'X-User-Id': approverUserId,
        },
      },
    )
    .then(unwrapData);
// Menyimpan realisasi mulai/selesai/manual task.
export const updateTaskRealization = (id, payload = {}) =>
  api
    .patch(
      `/tasks/${id}/realization`,
      payload,
      payload.actor_user_id
        ? {
            headers: {
              'X-User-Id': payload.actor_user_id,
            },
          }
        : undefined,
    )
    .then(unwrapData);
// Memindahkan task di board atau list.
export const moveTask = (id, payload) => api.patch(`/tasks/${id}/move`, payload).then(unwrapData);
// Mengubah parent task.
export const updateTaskParent = (id, parent_task_id) => api.patch(`/tasks/${id}/parent`, { parent_task_id }).then(unwrapData);
// Menjalankan bulk update pada beberapa task.
export const bulkUpdateTasks = (payload) => api.post('/tasks/bulk-update', payload).then(unwrapData);
// Mengambil label task, opsional terfilter project.
export const getTaskLabels = (params = {}) => api.get('/task-labels', { params }).then(unwrapData);
// Membuat label task baru.
export const createTaskLabel = (payload) => api.post('/task-labels', payload).then(unwrapData);
// Mengubah label task.
export const updateTaskLabel = (id, payload) => api.put(`/task-labels/${id}`, payload).then(unwrapData);
// Menghapus label task.
export const deleteTaskLabel = (id) => api.delete(`/task-labels/${id}`).then(unwrapData);
// Mengambil checklist milik task.
export const getTaskChecklists = (taskId) => api.get(`/tasks/${taskId}/checklists`).then(unwrapData);
// Membuat checklist baru di task.
export const createTaskChecklist = (taskId, payload) => api.post(`/tasks/${taskId}/checklists`, payload).then(unwrapData);
// Mengubah checklist.
export const updateTaskChecklist = (id, payload) => api.put(`/task-checklists/${id}`, payload).then(unwrapData);
// Menghapus checklist.
export const deleteTaskChecklist = (id) => api.delete(`/task-checklists/${id}`).then(unwrapData);
