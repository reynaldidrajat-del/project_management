import api, { unwrapData } from './api';

// Mengambil semua task yang akan digambar di Gantt global.
export const getAllGanttTasks = (params = {}) => api.get('/gantt/tasks', { params }).then(unwrapData);
// Mengambil task Gantt untuk satu project.
export const getProjectGanttTasks = (projectId) => api.get(`/gantt/projects/${projectId}`).then(unwrapData);
// Mengambil data Gantt untuk satu department.
export const getDepartmentGanttTasks = (departmentId, params = {}) => api.get(`/gantt/departments/${departmentId}`, { params }).then(unwrapData);
