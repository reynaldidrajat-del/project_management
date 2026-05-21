import { useState } from 'react';
import { useParams } from 'react-router-dom';

import BoardView from '../components/board/BoardView';
import GanttChart from '../components/gantt/GanttChart';
import BucketManager from '../components/project/BucketManager';
import ProjectHeader from '../components/project/ProjectHeader';
import TaskDetailModal from '../components/task/TaskDetailModal';
import TaskFormModal from '../components/task/TaskFormModal';
import TaskRealizationManualModal from '../components/task/TaskRealizationManualModal';
import TaskTree from '../components/task/TaskTree';
import { useProject, useBuckets, useProjects } from '../logic/hooks/useProjects';
import { useProjectTasks } from '../logic/hooks/useTasks';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { approveTask, createTask, deleteTask, updateTask, updateTaskRealization } from '../logic/services/taskApi';
import { useUiStore } from '../store/uiStore';

// Daftar tab yang tersedia di halaman detail project.
const tabs = ['Board', 'List', 'Gantt', 'Activity'];

// Halaman detail project yang menyatukan Board, List, Gantt, dan Activity.
function ProjectDetailPage() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState('Board');
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [parentTask, setParentTask] = useState(null);
  const [manualRealizationTask, setManualRealizationTask] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const { project, loading: projectLoading, refetch: refetchProject } = useProject(projectId);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { buckets, refetch: refetchBuckets } = useBuckets(projectId);
  const { tasks, loading: tasksLoading, refetch } = useProjectTasks(projectId, { tree: true });
  const showToast = useUiStore((state) => state.showToast);
  const currentUserId = useUiStore((state) => state.currentUserId);

  // Memuat ulang semua data penting setelah task berubah.
  const refreshProjectWorkspace = async () => {
    await Promise.all([refetch(), refetchProject()]);
  };

  // Memuat ulang bucket dan task untuk board.
  const refreshBucketsAndTasks = async () => {
    await Promise.all([refetchBuckets(), refetch()]);
  };

  // Membuat atau mengubah task dari modal form.
  const handleSubmit = async (payload) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload);
        showToast({ type: 'success', message: 'Task diperbarui.' });
      } else {
        await createTask({
          ...payload,
          project_id: projectId,
          parent_task_id: parentTask?.id || payload.parent_task_id || null,
        });
        showToast({ type: 'success', message: parentTask ? 'Subtask dibuat.' : 'Task dibuat.' });
      }

      setFormOpen(false);
      setEditingTask(null);
      setParentTask(null);
      await refreshProjectWorkspace();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus task setelah konfirmasi.
  const handleDelete = async (task) => {
    if (!window.confirm(`Hapus task "${task.title}"?`)) {
      return;
    }

    try {
      await deleteTask(task.id);
      showToast({ type: 'success', message: 'Task dihapus.' });
      await refreshProjectWorkspace();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Mengapprove task Waiting Review dari tab List detail project.
  const handleApprove = async (task) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      await approveTask(task.id, currentUserId);
      showToast({ type: 'success', message: 'Task diapprove.' });
      await refreshProjectWorkspace();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Mencatat realisasi mulai atau selesai untuk task.
  const handleRealization = async (task, action) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      await updateTaskRealization(task.id, { action, actor_user_id: currentUserId });
      showToast({ type: 'success', message: action === 'start' ? 'Realisasi task dimulai.' : 'Realisasi task diselesaikan.' });
      await refreshProjectWorkspace();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menyimpan realisasi manual dari modal.
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
      await refreshProjectWorkspace();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      {projectLoading ? <div className="card p-6 text-text-muted">Loading project...</div> : <ProjectHeader project={project} />}

      <div className="toolbar justify-between">
        <div className="segmented-control">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={[
                'segmented-control-button',
                activeTab === tab ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100',
              ].join(' ')}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setEditingTask(null);
            setParentTask(null);
            setFormOpen(true);
          }}
        >
          Tambah Task
        </button>
      </div>

      <BucketManager projectId={projectId} buckets={buckets} onChanged={refreshBucketsAndTasks} />

      {tasksLoading ? <div className="card p-6 text-text-muted">Loading tasks...</div> : null}

      {activeTab === 'Board' ? <BoardView tasks={tasks} buckets={buckets} onRefresh={refreshProjectWorkspace} onTaskClick={setSelectedTask} /> : null}
      {activeTab === 'List' ? (
        <TaskTree
          tasks={tasks}
          onApprove={handleApprove}
          onDelete={handleDelete}
          onEdit={(task) => {
            setEditingTask(task);
            setParentTask(null);
            setFormOpen(true);
          }}
          onAddSubtask={(task) => {
            setEditingTask(null);
            setParentTask(task);
            setFormOpen(true);
          }}
          onRealization={handleRealization}
          onManualRealization={setManualRealizationTask}
        />
      ) : null}
      {activeTab === 'Gantt' ? (
        <div className="space-y-3">
          <div className="toolbar justify-end">
            <select className="field max-w-xs" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
              <option value="week">Week view</option>
              <option value="month">Month view</option>
            </select>
          </div>
          <GanttChart quickResumeScopeLabel={project?.name || 'Project'} tasks={tasks} viewMode={viewMode} onTaskClick={setSelectedTask} />
        </div>
      ) : null}
      {activeTab === 'Activity' ? (
        <div className="empty-state">
          Activity log table sudah disiapkan di database untuk audit trail. Endpoint activity dapat ditambahkan saat workflow approval/import Excel masuk fase berikutnya.
        </div>
      ) : null}

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        users={users}
        tasks={tasks}
        onClose={() => setSelectedTask(null)}
        onSaved={refreshProjectWorkspace}
      />
      <TaskFormModal
        open={formOpen}
        task={editingTask}
        parentTask={parentTask}
        defaultProjectId={projectId}
        projects={projects}
        users={users}
        tasks={tasks}
        onClose={() => {
          setFormOpen(false);
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

export default ProjectDetailPage;
