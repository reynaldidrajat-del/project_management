import { useEffect, useState } from 'react';

import ProjectCard from '../components/project/ProjectCard';
import ProjectFormModal from '../components/project/ProjectFormModal';
import TaskLabelManager from '../components/task/TaskLabelManager';
import { PROJECT_STATUSES } from '../logic/constants/status';
import { useLocations } from '../logic/hooks/useLocations';
import { useProjects } from '../logic/hooks/useProjects';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { createProject, deleteProject, updateProject } from '../logic/services/projectApi';
import { useUiStore } from '../store/uiStore';

// Nilai awal filter halaman Projects.
const initialFilters = {
  status: '',
  owner_id: '',
  location_id: '',
  start_date: '',
  end_date: '',
};

// Halaman daftar project untuk membuat, mengedit, menghapus, dan membuka project.
function ProjectsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [editingProject, setEditingProject] = useState(null);
  const [labelProjectId, setLabelProjectId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  const { projects, loading, error, refetch } = useProjects(activeFilters);
  const { projects: labelProjects } = useProjects();
  const { users } = useUsers();
  const { locations } = useLocations();
  const { labels, refetch: refetchLabels } = useTaskLabels(labelProjectId);
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    if (!labelProjects.length) {
      if (labelProjectId) {
        setLabelProjectId('');
      }
      return;
    }

    const hasSelectedProject = labelProjects.some((project) => String(project.id) === String(labelProjectId));

    if (!hasSelectedProject) {
      setLabelProjectId(String(labelProjects[0].id));
    }
  }, [labelProjectId, labelProjects]);

  // Mengubah satu filter dan langsung memicu refresh lewat useProjects.
  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  // Menyimpan project baru atau perubahan project yang sedang diedit.
  const handleSubmit = async (payload) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, payload);
        showToast({ type: 'success', message: 'Project diperbarui.' });
      } else {
        await createProject(payload);
        showToast({ type: 'success', message: 'Project dibuat.' });
      }

      setModalOpen(false);
      setEditingProject(null);
      refetch();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Menghapus project setelah user mengonfirmasi.
  const handleDelete = async (projectId) => {
    if (!window.confirm('Hapus project dan seluruh bucket/task di dalamnya?')) {
      return;
    }

    try {
      await deleteProject(projectId);
      showToast({ type: 'success', message: 'Project dihapus.' });
      refetch();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Portfolio</p>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">Kelola project sebagai sumber data Board, List, dan Gantt.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
          Tambah Project
        </button>
      </div>

      <div className="toolbar">
        <label className="grid min-w-40 max-w-xs flex-1 gap-1">
          <span className="label">Status</span>
          <select className="field" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All project statuses</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-40 max-w-xs flex-1 gap-1">
          <span className="label">Owner</span>
          <select className="field" value={filters.owner_id} onChange={(event) => updateFilter('owner_id', event.target.value)}>
            <option value="">All owners</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-40 max-w-xs flex-1 gap-1">
          <span className="label">Lokasi</span>
          <select className="field" value={filters.location_id} onChange={(event) => updateFilter('location_id', event.target.value)}>
            <option value="">All business units</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-40 max-w-xs flex-1 gap-1">
          <span className="label">Start Date</span>
          <input
            aria-label="Filter project start date"
            className="field"
            type="date"
            value={filters.start_date}
            onChange={(event) => updateFilter('start_date', event.target.value)}
          />
        </label>
        <label className="grid min-w-40 max-w-xs flex-1 gap-1">
          <span className="label">End Date</span>
          <input
            aria-label="Filter project end date"
            className="field"
            type="date"
            value={filters.end_date}
            onChange={(event) => updateFilter('end_date', event.target.value)}
          />
        </label>
        {hasActiveFilters ? (
          <button className="btn-secondary self-end" type="button" onClick={() => setFilters(initialFilters)}>
            Reset Filters
          </button>
        ) : null}
      </div>

      <div className="card p-4">
        <div className="section-header">
          <div>
            <h2 className="section-title">Master Task Labels</h2>
            <p className="section-subtitle">
              Kelola label berdasarkan project. Label yang dibuat di sini tersedia saat membuat, mengedit, dan memfilter task.
            </p>
          </div>
          <label className="grid min-w-56 gap-1">
            <span className="label">Project</span>
            <select
              className="field"
              value={labelProjectId}
              onChange={(event) => setLabelProjectId(event.target.value)}
            >
              <option value="">Pilih project</option>
              {labelProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TaskLabelManager embedded hideHeader projectId={labelProjectId} labels={labelProjectId ? labels : []} onChanged={refetchLabels} />
      </div>

      {loading ? <div className="card p-6 text-text-muted">Loading projects...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={handleDelete}
            onEdit={(selectedProject) => {
              setEditingProject(selectedProject);
              setModalOpen(true);
            }}
          />
        ))}
      </div>

      {!loading && !projects.length ? (
        <div className="empty-state">{hasActiveFilters ? 'Tidak ada project yang sesuai filter.' : 'Belum ada project.'}</div>
      ) : null}

      <ProjectFormModal
        open={modalOpen}
        project={editingProject}
        users={users}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default ProjectsPage;
