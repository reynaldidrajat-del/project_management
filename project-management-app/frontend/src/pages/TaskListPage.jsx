import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import TaskBulkToolbar from '../components/task/TaskBulkToolbar';
import TaskFilters from '../components/task/TaskFilters';
import TaskFormModal from '../components/task/TaskFormModal';
import TaskRealizationManualModal from '../components/task/TaskRealizationManualModal';
import TaskTree from '../components/task/TaskTree';
import { useDepartments } from '../logic/hooks/useDepartments';
import { useLocations } from '../logic/hooks/useLocations';
import { useBuckets, useProject, useProjects } from '../logic/hooks/useProjects';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useTasks } from '../logic/hooks/useTasks';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { approveTask, createTask, deleteTask, updateTask, updateTaskRealization } from '../logic/services/taskApi';
import { useUiStore } from '../store/uiStore';

// Halaman Task List untuk melihat task bertingkat dan mengelola task/subtask.
function TaskListPage({
  defaultFilters = {},
  title,
  description = 'Tree task dan subtask bertingkat untuk data yang sama dengan Board dan Gantt.',
  kicker = 'Execution',
  hideFilters = false,
}) {
  const { projectId } = useParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [parentTask, setParentTask] = useState(null);
  const [manualRealizationTask, setManualRealizationTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryFilters = {
    ...filters,
    project_id: projectId || filters.project_id || '',
    tree: true,
  };
  const selectedProjectId = projectId || filters.project_id || '';
  const { tasks, loading, error, refetch } = useTasks(queryFilters);
  const { project } = useProject(projectId);
  const { projects } = useProjects();
  const { buckets } = useBuckets(selectedProjectId);
  const { labels } = useTaskLabels(selectedProjectId);
  const { departments } = useDepartments();
  const { locations } = useLocations();
  const { users } = useUsers();
  const showToast = useUiStore((state) => state.showToast);
  const currentUserId = useUiStore((state) => state.currentUserId);

  const refreshTasks = async () => {
    setSelectedTaskIds(new Set());
    await refetch();
  };

  const handleFilterChange = (nextFilters) => {
    setSelectedTaskIds(new Set());
    setFilters(nextFilters);
  };

  const toggleTaskSelection = (taskId, checked) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(Number(taskId));
      } else {
        next.delete(Number(taskId));
      }

      return next;
    });
  };

  // Membuka form untuk membuat task utama baru.
  const openCreateModal = () => {
    setEditingTask(null);
    setParentTask(null);
    setModalOpen(true);
  };

  // Mengapprove task Waiting Review, hanya jika user aktif adalah lead task.
  const handleApprove = async (task) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      await approveTask(task.id, currentUserId);
      showToast({ type: 'success', message: 'Task diapprove.' });
      await refreshTasks();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Menyimpan task baru, subtask baru, atau perubahan task.
  const handleSubmit = async (payload) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload);
        showToast({ type: 'success', message: 'Task diperbarui.' });
      } else {
        await createTask({
          ...payload,
          project_id: projectId || payload.project_id,
          parent_task_id: parentTask?.id || payload.parent_task_id || null,
        });
        showToast({ type: 'success', message: parentTask ? 'Subtask dibuat.' : 'Task dibuat.' });
      }

      setModalOpen(false);
      setEditingTask(null);
      setParentTask(null);
      await refreshTasks();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Menghapus task dan subtask turunannya setelah konfirmasi.
  const handleDelete = async (task) => {
    if (!window.confirm(`Hapus task "${task.title}" dan subtask di bawahnya?`)) {
      return;
    }

    try {
      await deleteTask(task.id);
      showToast({ type: 'success', message: 'Task dihapus.' });
      await refreshTasks();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Mencatat realisasi mulai atau selesai dari baris task.
  const handleRealization = async (task, action) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      await updateTaskRealization(task.id, { action, actor_user_id: currentUserId });
      showToast({ type: 'success', message: action === 'start' ? 'Realisasi task dimulai.' : 'Realisasi task diselesaikan.' });
      await refreshTasks();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Menyimpan realisasi manual untuk task yang sedang dipilih.
  const handleManualRealization = async (payload) => {
    if (!manualRealizationTask) {
      return;
    }

    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      await updateTaskRealization(manualRealizationTask.id, { action: 'manual', actor_user_id: currentUserId, ...payload });
      showToast({ type: 'success', message: 'Realisasi manual task disimpan.' });
      setManualRealizationTask(null);
      await refreshTasks();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1 className="page-title">{title || (project ? `${project.name} Task List` : 'Task List')}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" to={projectId ? `/projects/${projectId}/gantt` : '/gantt'}>
            Open Gantt
          </Link>
          <button className="btn-primary" type="button" onClick={openCreateModal}>
            Tambah Task
          </button>
        </div>
      </div>

      {!projectId && !hideFilters ? (
        <TaskFilters
          departments={departments}
          filters={filters}
          labels={labels}
          locations={locations}
          projects={projects}
          users={users}
          onChange={handleFilterChange}
        />
      ) : null}

      <TaskBulkToolbar
        buckets={buckets}
        selectedTaskIds={Array.from(selectedTaskIds)}
        onChanged={refreshTasks}
        onCleared={() => setSelectedTaskIds(new Set())}
      />

      {loading ? <div className="card p-6 text-text-muted">Loading tasks...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      <TaskTree
        tasks={tasks}
        selectedTaskIds={selectedTaskIds}
        onSelectionChange={toggleTaskSelection}
        onApprove={handleApprove}
        onDelete={handleDelete}
        onEdit={(task) => {
          setEditingTask(task);
          setParentTask(null);
          setModalOpen(true);
        }}
        onAddSubtask={(task) => {
          setEditingTask(null);
          setParentTask(task);
          setModalOpen(true);
        }}
        onRealization={handleRealization}
        onManualRealization={setManualRealizationTask}
      />

      <TaskFormModal
        open={modalOpen}
        task={editingTask}
        parentTask={parentTask}
        defaultProjectId={projectId}
        projects={projects}
        users={users}
        tasks={tasks}
        labels={labels}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
          setParentTask(null);
        }}
        onSubmit={handleSubmit}
      />
      <TaskRealizationManualModal
        open={Boolean(manualRealizationTask)}
        task={manualRealizationTask}
        onClose={() => setManualRealizationTask(null)}
        onSubmit={handleManualRealization}
      />
    </div>
  );
}

export default TaskListPage;
