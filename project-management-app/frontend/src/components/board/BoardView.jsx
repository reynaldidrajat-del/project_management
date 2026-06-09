import { DndContext } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';

import { TASK_STATUSES } from '../../logic/constants/status';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { getBoardConfig } from '../../logic/services/boardConfigStorage';
import { moveTask } from '../../logic/services/taskApi';
import { useUiStore } from '../../store/uiStore';
import SyncStatusBadge from '../shared/SyncStatusBadge';
import BoardColumn from './BoardColumn';
import BoardGroupSwitcher from './BoardGroupSwitcher';

const patchTaskTree = (taskRows = [], taskId, patch) =>
  taskRows.map((task) => ({
    ...task,
    ...(Number(task.id) === Number(taskId) ? patch : {}),
    children: task.children?.length ? patchTaskTree(task.children, taskId, patch) : task.children,
  }));

// Tampilan board drag and drop yang mengelompokkan task berdasarkan status atau bucket.
function BoardView({ canMoveTask = true, tasks = [], buckets = [], projectId = null, selectedTaskIds, onSelectionChange, onTaskClick, onRefresh }) {
  const [groupBy, setGroupBy] = useState('status');
  const [boardConfig, setBoardConfig] = useState(() => getBoardConfig(projectId));
  const [localTasks, setLocalTasks] = useState(tasks);
  const [syncStatusByTaskId, setSyncStatusByTaskId] = useState({});
  const [boardSyncStatus, setBoardSyncStatus] = useState(null);
  const showToast = useUiStore((state) => state.showToast);
  const flatTasks = useMemo(() => flattenTaskTree(localTasks), [localTasks]);
  const bulkSelectable = Boolean(onSelectionChange);
  const configuredColumns = boardConfig.columns?.length
    ? boardConfig.columns
    : TASK_STATUSES.map((status) => ({ id: status, label: status, status }));

  useEffect(() => {
    setLocalTasks(tasks);
    setBoardSyncStatus(null);
    setSyncStatusByTaskId({});
  }, [tasks]);

  useEffect(() => {
    setBoardConfig(getBoardConfig(projectId));
  }, [projectId]);

  useEffect(() => {
    const handleConfigChange = (event) => {
      if (!event.detail?.projectId || String(event.detail.projectId) === String(projectId || 'global')) {
        setBoardConfig(getBoardConfig(projectId));
      }
    };

    window.addEventListener('board-config-updated', handleConfigChange);

    return () => {
      window.removeEventListener('board-config-updated', handleConfigChange);
    };
  }, [projectId]);

  const markTaskSyncStatus = (taskId, status) => {
    setSyncStatusByTaskId((current) => ({
      ...current,
      [taskId]: status,
    }));
    setBoardSyncStatus(status);
  };

  const clearTaskSyncStatus = (taskId, status) => {
    window.setTimeout(() => {
      setSyncStatusByTaskId((current) => {
        if (current[taskId] !== status) {
          return current;
        }

        const next = { ...current };
        delete next[taskId];
        return next;
      });
      setBoardSyncStatus((current) => (current === status ? null : current));
    }, 1800);
  };

  const columns =
    groupBy === 'status'
      ? configuredColumns.map((column) => ({
          id: `status:${column.id}`,
          status: column.status,
          title: column.label,
          tasks: flatTasks.filter((task) => task.status === column.status),
        }))
      : buckets.map((bucket) => ({
          id: `bucket:${bucket.id}`,
          title: bucket.name,
          tasks: flatTasks.filter((task) => Number(task.bucket_id) === Number(bucket.id)),
        }));

  const unbucketedColumn =
    groupBy === 'bucket'
      ? [
          {
            id: 'bucket:null',
            title: 'No Bucket',
            tasks: flatTasks.filter((task) => !task.bucket_id),
          },
        ]
      : [];

  // Menyimpan perpindahan task saat user selesai drag and drop.
  const handleDragEnd = async (event) => {
    if (!canMoveTask) {
      return;
    }

    if (!event.over || !event.active?.id) {
      return;
    }

    const [type, value] = String(event.over.id).split(':');
    const taskId = event.active.id;
    const draggedTask = flatTasks.find((task) => Number(task.id) === Number(taskId));

    if (!draggedTask) {
      return;
    }

    const patch = {};

    if (type === 'status') {
      const targetColumn = configuredColumns.find((column) => String(column.id) === value);
      const status = targetColumn?.status || value;

      if (draggedTask.status === status) {
        return;
      }

      patch.status = status;
    }

    if (type === 'bucket') {
      const bucketId = value === 'null' ? null : Number(value);

      if ((draggedTask.bucket_id ? Number(draggedTask.bucket_id) : null) === bucketId) {
        return;
      }

      patch.bucket_id = bucketId;
    }

    if (!Object.keys(patch).length) {
      return;
    }

    const previousTasks = localTasks;
    setLocalTasks((current) => patchTaskTree(current, taskId, patch));
    markTaskSyncStatus(taskId, 'syncing');

    try {
      if (type === 'status') {
        await moveTask(taskId, { status: patch.status });
      }

      if (type === 'bucket') {
        await moveTask(taskId, { bucket_id: patch.bucket_id });
      }

      markTaskSyncStatus(taskId, 'synced');
      showToast({ type: 'success', message: 'Task board diperbarui.' });
      onRefresh?.();
      clearTaskSyncStatus(taskId, 'synced');
    } catch (error) {
      setLocalTasks(previousTasks);
      markTaskSyncStatus(taskId, 'failed');
      showToast({ type: 'error', message: getApiErrorMessage(error) });
      clearTaskSyncStatus(taskId, 'failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="toolbar justify-between">
        <BoardGroupSwitcher value={groupBy} onChange={setGroupBy} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SyncStatusBadge status={boardSyncStatus} />
          <p className="text-sm text-text-muted">
            {canMoveTask
              ? bulkSelectable
                ? 'Drag task untuk move cepat, atau centang beberapa kartu untuk bulk action.'
                : 'Drag task untuk move cepat.'
              : 'Mode view-only.'}
          </p>
        </div>
      </div>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {[...columns, ...unbucketedColumn].map((column) => (
            <BoardColumn
              key={column.id}
              id={column.id}
              canMoveTask={canMoveTask}
              selectedTaskIds={selectedTaskIds}
              syncStatusByTaskId={syncStatusByTaskId}
              tasks={column.tasks}
              title={column.title}
              onSelectionChange={onSelectionChange}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

export default BoardView;
