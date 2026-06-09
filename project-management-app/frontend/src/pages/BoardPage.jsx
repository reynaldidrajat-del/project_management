import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import BoardView from '../components/board/BoardView';
import IssueExportMenu from '../components/import-export/IssueExportMenu';
import BucketManager from '../components/project/BucketManager';
import ProjectHeader from '../components/project/ProjectHeader';
import TaskBulkToolbar from '../components/task/TaskBulkToolbar';
import TaskDetailModal from '../components/task/LazyTaskDetailModal';
import TaskFormModal from '../components/task/TaskFormModal';
import { useProject, useBuckets, useProjects } from '../logic/hooks/useProjects';
import { useSprints } from '../logic/hooks/useSprints';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useProjectTasks } from '../logic/hooks/useTasks';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { hasRolePermission } from '../logic/helpers/permissionHelper';
import { flattenTaskTree } from '../logic/helpers/taskTreeHelper';
import { createTask, getProjectTasks } from '../logic/services/taskApi';
import { useUiStore } from '../store/uiStore';

// Halaman board project untuk melihat task per status/bucket dan membuat task baru.
function BoardPage() {
  const { projectId } = useParams();
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const { project, refetch: refetchProject } = useProject(projectId);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { buckets, refetch: refetchBuckets } = useBuckets(projectId);
  const { labels, refetch: refetchLabels } = useTaskLabels(projectId);
  const { tasks, loading, refetch } = useProjectTasks(projectId, { tree: true });
  const { sprints, loading: sprintsLoading } = useSprints(projectId, {}, { enabled: Boolean(projectId) });
  const showToast = useUiStore((state) => state.showToast);
  const currentUser = useUiStore((state) => state.currentUser);
  const canCreateTask = hasRolePermission(currentUser, 'task', 'create');
  const canMoveTask = hasRolePermission(currentUser, 'task', 'move');
  const canExecuteBulkOperation = hasRolePermission(currentUser, 'bulk_operation', 'execute');
  const canCreateBucket = hasRolePermission(currentUser, 'bucket', 'create');
  const canUpdateBucket = hasRolePermission(currentUser, 'bucket', 'update');
  const canDeleteBucket = hasRolePermission(currentUser, 'bucket', 'delete');
  const flatTasks = useMemo(() => flattenTaskTree(tasks), [tasks]);
  const selectedTasks = useMemo(
    () => flatTasks.filter((task) => selectedTaskIds.has(Number(task.id))),
    [flatTasks, selectedTaskIds],
  );

  // Memuat ulang bucket dan task setelah ada perubahan di board.
  const refreshBoardData = async (options = {}) => {
    if (!options.preserveSelection) {
      setSelectedTaskIds(new Set());
    }

    await Promise.all([refetch(), refetchProject(), refetchLabels()]);
  };

  // Alias refresh yang dikirim ke komponen board setelah drag and drop.
  const refreshBucketsAndTasks = async () => {
    setSelectedTaskIds(new Set());
    await Promise.all([refetchBuckets(), refetchLabels(), refetch()]);
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

  const loadAllIssuesForExport = async () => flattenTaskTree(await getProjectTasks(projectId, { tree: true }));

  // Membuat task baru untuk project aktif dari form modal.
  const handleCreateTask = async (payload) => {
    if (!canCreateTask) {
      showToast({ type: 'error', message: 'User tidak memiliki izin untuk membuat task.' });
      return;
    }

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
      <div className="toolbar justify-between">
        <IssueExportMenu
          currentIssues={flatTasks}
          disabled={loading}
          fileNamePrefix={project?.project_key || project?.name || `project-${projectId}-issues`}
          onLoadAllIssues={loadAllIssuesForExport}
        />
        {canCreateTask ? (
          <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}>
            Tambah Task
          </button>
        ) : null}
      </div>
      <BucketManager
        canCreate={canCreateBucket}
        canDelete={canDeleteBucket}
        canUpdate={canUpdateBucket}
        projectId={projectId}
        buckets={buckets}
        onChanged={refreshBucketsAndTasks}
      />
      <TaskBulkToolbar
        enabled={canExecuteBulkOperation}
        buckets={buckets}
        selectedTaskIds={Array.from(selectedTaskIds)}
        selectedTasks={selectedTasks}
        sprints={sprints}
        sprintsLoading={sprintsLoading}
        users={users}
        onChanged={refreshBoardData}
        onCleared={() => setSelectedTaskIds(new Set())}
      />
      {loading ? <div className="card p-6 text-text-muted">Loading board...</div> : null}
      <BoardView
        canMoveTask={canMoveTask}
        buckets={buckets}
        projectId={projectId}
        selectedTaskIds={selectedTaskIds}
        tasks={tasks}
        onRefresh={refreshBoardData}
        onSelectionChange={canExecuteBulkOperation ? toggleTaskSelection : undefined}
        onTaskClick={setSelectedTask}
      />

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
