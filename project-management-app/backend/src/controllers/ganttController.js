const {
  getAllGanttTasks,
  getDepartmentGanttTasks,
  getProjectGanttTasks,
} = require('../services/ganttService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Mengambil data Gantt global dengan filter dari query string.
const getAllGantt = asyncHandler(async (req, res) => {
  const tasks = await getAllGanttTasks(req.query);
  sendSuccess(res, tasks);
});

// Mengambil data Gantt untuk satu project.
const getProjectGantt = asyncHandler(async (req, res) => {
  const tasks = await getProjectGanttTasks(req.params.projectId);
  sendSuccess(res, tasks);
});

// Mengambil data Gantt gabungan untuk satu department.
const getDepartmentGantt = asyncHandler(async (req, res) => {
  const tasks = await getDepartmentGanttTasks(req.params.departmentId, req.query);
  sendSuccess(res, tasks);
});

module.exports = {
  getAllGantt,
  getDepartmentGantt,
  getProjectGantt,
};
