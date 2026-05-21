import { DndContext } from '@dnd-kit/core';
import { useState } from 'react';

import { TASK_STATUSES } from '../../logic/constants/status';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { moveTask } from '../../logic/services/taskApi';
import { useUiStore } from '../../store/uiStore';
import BoardColumn from './BoardColumn';
import BoardGroupSwitcher from './BoardGroupSwitcher';

// Tampilan board drag and drop yang mengelompokkan task berdasarkan status atau bucket.
function BoardView({ tasks = [], buckets = [], onTaskClick, onRefresh }) {
  const [groupBy, setGroupBy] = useState('status');
  const showToast = useUiStore((state) => state.showToast);
  const flatTasks = flattenTaskTree(tasks);

  const columns =
    groupBy === 'status'
      ? TASK_STATUSES.map((status) => ({
          id: `status:${status}`,
          title: status,
          tasks: flatTasks.filter((task) => task.status === status),
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
    if (!event.over || !event.active?.id) {
      return;
    }

    const [type, value] = String(event.over.id).split(':');
    const taskId = event.active.id;

    try {
      if (type === 'status') {
        await moveTask(taskId, { status: value });
      }

      if (type === 'bucket') {
        await moveTask(taskId, { bucket_id: value === 'null' ? null : value });
      }

      showToast({ type: 'success', message: 'Task board diperbarui.' });
      onRefresh?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="toolbar justify-between">
        <BoardGroupSwitcher value={groupBy} onChange={setGroupBy} />
        <p className="text-sm text-text-muted">Drag task ke kolom status atau bucket untuk menyimpan perubahan ke PostgreSQL.</p>
      </div>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {[...columns, ...unbucketedColumn].map((column) => (
            <BoardColumn key={column.id} id={column.id} title={column.title} tasks={column.tasks} onTaskClick={onTaskClick} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

export default BoardView;
