import { useState } from 'react';
import { useParams } from 'react-router-dom';

import BoardView from '../components/board/BoardView';
import BucketManager from '../components/project/BucketManager';
import ProjectHeader from '../components/project/ProjectHeader';
import TaskDetailModal from '../components/task/TaskDetailModal';
import TaskFormModal from '../components/task/TaskFormModal';
import { useProject, useBuckets, useProjects } from '../logic/hooks/useProjects';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useProjectTasks } from '../logic/hooks/useTasks';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { createTask } from '../logic/services/taskApi';
import { useUiStore } from '../store/uiStore';

// Halaman board project untuk melihat task per status/bucket dan membuat task baru.
function BoardPage() {
  const { projectId } = useParams();
  const [selectedTask, setSelectedTask] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const { project, refetch: refetchProject } = useProject(projectId);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { buckets, refetch: refetchBuckets } = useBuckets(projectId);
  const { labels, refetch: refetchLabels } = useTaskLabels(projectId);
  const { tasks, loading, refetch } = useProjectTasks(projectId, { tree: true });
  const showToast = useUiStore((state) => state.showToast);

  // Memuat ulang bucket dan task setelah ada perubahan di board.
  const refreshBoardData = async () => {
    await Promise.all([refetch(), refetchProject(), refetchLabels()]);
  };

  // Alias refresh yang dikirim ke komponen board setelah drag and drop.
  const refreshBucketsAndTasks = async () => {
    await Promise.all([refetchBuckets(), refetchLabels(), refetch()]);
  };

  // Membuat task baru untuk project aktif dari form modal.
  const handleCreateTask = async (payload) => {
    try {
      await createTask({
        ...payload,
        project_id: projectId,
      });
      setFormOpen(false);
      showToast({ type: 'success', message: 'Task dibuat.' });
      await refreshBoardData();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      <ProjectHeader project={project} />
      <div className="toolbar justify-end">
        <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}>
          Tambah Task
        </button>
      </div>
      <BucketManager projectId={projectId} buckets={buckets} onChanged={refreshBucketsAndTasks} />
      {loading ? <div className="card p-6 text-text-muted">Loading board...</div> : null}
      <BoardView tasks={tasks} buckets={buckets} onRefresh={refreshBoardData} onTaskClick={setSelectedTask} />

      <TaskDetailModal
        task={selectedTask}
        labels={labels}
        projects={projects}
        users={users}
        tasks={tasks}
        onClose={() => setSelectedTask(null)}
        onSaved={refreshBoardData}
      />
      <TaskFormModal
        open={formOpen}
        defaultProjectId={projectId}
        labels={labels}
        projects={projects}
        users={users}
        tasks={tasks}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}

export default BoardPage;
