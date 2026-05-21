const {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject,
} = require('../services/projectService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

// Mengambil daftar project dengan filter dari frontend.
const listProjects = asyncHandler(async (req, res) => {
  const projects = await getProjects(req.query);
  sendSuccess(res, projects);
});

// Mengambil detail satu project dan mengembalikan 404 jika tidak ada.
const getProject = asyncHandler(async (req, res) => {
  const project = await getProjectById(req.params.id);

  if (!project) {
    return sendError(res, 'Project tidak ditemukan.', 'Project tidak ditemukan.', 404);
  }

  return sendSuccess(res, project);
});

// Membuat project baru beserta member awalnya lewat service project.
const createProjectController = asyncHandler(async (req, res) => {
  const project = await createProject(req.body);
  sendSuccess(res, project, 'Project berhasil dibuat.', 201);
});

// Mengubah data project dan daftar membernya.
const updateProjectController = asyncHandler(async (req, res) => {
  const project = await updateProject(req.params.id, req.body);
  sendSuccess(res, project, 'Project berhasil diperbarui.');
});

// Menghapus project berdasarkan id.
const deleteProjectController = asyncHandler(async (req, res) => {
  const project = await deleteProject(req.params.id);
  sendSuccess(res, project, 'Project berhasil dihapus.');
});

module.exports = {
  createProject: createProjectController,
  deleteProject: deleteProjectController,
  getProject,
  listProjects,
  updateProject: updateProjectController,
};
