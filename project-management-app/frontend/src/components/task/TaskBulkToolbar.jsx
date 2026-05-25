import { useState } from 'react';

import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';
import { getApiErrorMessage } from '../../logic/services/api';
import { bulkUpdateTasks } from '../../logic/services/taskApi';
import { useUiStore } from '../../store/uiStore';

// Toolbar bulk action untuk All Tasks/My Tasks.
function TaskBulkToolbar({ selectedTaskIds = [], buckets = [], onCleared, onChanged }) {
  const [action, setAction] = useState('status');
  const [status, setStatus] = useState('In Progress');
  const [priority, setPriority] = useState('Medium');
  const [bucketId, setBucketId] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);

  const selectedCount = selectedTaskIds.length;

  const handleApply = async () => {
    if (!selectedCount) {
      showToast({ type: 'error', message: 'Pilih minimal satu task.' });
      return;
    }

    const payload = {
      action,
      task_ids: selectedTaskIds,
    };

    if (action === 'status') {
      payload.status = status;
    }

    if (action === 'priority') {
      payload.priority = priority;
    }

    if (action === 'bucket') {
      payload.bucket_id = bucketId || null;
    }

    setLoading(true);

    try {
      const result = await bulkUpdateTasks(payload);
      showToast({ type: 'success', message: `${result.updated_count || selectedCount} task diperbarui.` });
      onCleared?.();
      await onChanged?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCount) {
    return null;
  }

  return (
    <div className="toolbar items-center justify-between">
      <div className="text-sm font-bold text-text-dark">{selectedCount} task selected</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field max-w-40" value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="status">Status</option>
          <option value="priority">Priority</option>
          <option value="bucket">Bucket</option>
          <option value="archive">Archive</option>
          <option value="unarchive">Unarchive</option>
        </select>
        {action === 'status' ? (
          <select className="field max-w-44" value={status} onChange={(event) => setStatus(event.target.value)}>
            {TASK_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
        {action === 'priority' ? (
          <select className="field max-w-40" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
        {action === 'bucket' ? (
          <select className="field max-w-56" value={bucketId} onChange={(event) => setBucketId(event.target.value)}>
            <option value="">No bucket</option>
            {buckets.map((bucket) => (
              <option key={bucket.id} value={bucket.id}>
                {bucket.name}
              </option>
            ))}
          </select>
        ) : null}
        <button className="btn-secondary" type="button" onClick={onCleared}>
          Clear
        </button>
        <button className="btn-primary" disabled={loading} type="button" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

export default TaskBulkToolbar;
