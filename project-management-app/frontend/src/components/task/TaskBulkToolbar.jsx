import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';
import { getTaskDisplayKey } from '../../logic/helpers/taskDisplayHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { bulkUpdateTasks, updateTask, updateTaskStatus } from '../../logic/services/taskApi';
import { useUiStore } from '../../store/uiStore';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

const actionOptions = [
  { value: 'status', label: 'Change Status' },
  { value: 'assignee', label: 'Change PIC' },
  { value: 'sprint', label: 'Assign Sprint' },
  { value: 'priority', label: 'Change Priority' },
  { value: 'bucket', label: 'Move Bucket' },
  { value: 'archive', label: 'Archive' },
  { value: 'unarchive', label: 'Unarchive' },
];

const initialForm = {
  assignee_ids: [],
  bucket_id: '',
  priority: 'Medium',
  sprint_id: '',
  status: 'In Progress',
};

const toStringIds = (values = []) => values.map((value) => String(value));

const getTaskDisplayName = (task, taskId) => {
  if (!task) {
    return `Task #${taskId}`;
  }

  return [getTaskDisplayKey(task), task.title].filter(Boolean).join(' - ') || `Task #${taskId}`;
};

const getSelectedProjectIds = (tasks = []) =>
  Array.from(new Set(tasks.map((task) => Number(task.project_id)).filter(Boolean)));

function UserSelectionField({ users = [], value = [], onChange }) {
  const selectedIds = new Set(toStringIds(value));

  const toggleUser = (userId, checked) => {
    const nextIds = new Set(selectedIds);

    if (checked) {
      nextIds.add(String(userId));
    } else {
      nextIds.delete(String(userId));
    }

    onChange(Array.from(nextIds));
  };

  if (!users.length) {
    return <div className="rounded-lg border border-dashed border-border bg-slate-50 p-3 text-sm font-semibold text-text-muted">Data PIC belum tersedia.</div>;
  }

  return (
    <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-white">
      {users.map((user) => {
        const userId = String(user.id);

        return (
          <label key={user.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-text-dark">{user.name || user.email || `User ${user.id}`}</span>
              <span className="block truncate text-xs text-text-muted">{user.department_name || user.email || 'No department'}</span>
            </span>
            <input
              checked={selectedIds.has(userId)}
              type="checkbox"
              value={user.id}
              onChange={(event) => toggleUser(userId, event.target.checked)}
            />
          </label>
        );
      })}
    </div>
  );
}

function ResultSummary({ result }) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {result.successes.length} successful
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700">
            <AlertCircle className="h-4 w-4" />
            {result.failures.length} failed
          </div>
        </div>
      </div>

      {result.failures.length ? (
        <div className="table-shell">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-text-dark">Failed Items</h3>
          </div>
          <div className="table-scroll">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.failures.map((failure) => (
                  <tr key={failure.id}>
                    <td>{failure.name}</td>
                    <td className="text-danger">{failure.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm font-semibold text-text-muted">
          Semua task terpilih berhasil diproses.
        </div>
      )}
    </div>
  );
}

function TaskBulkToolbar({
  enabled = true,
  selectedTaskIds = [],
  selectedTasks = [],
  buckets = [],
  users = [],
  sprints = [],
  sprintsLoading = false,
  onCleared,
  onChanged,
}) {
  const [action, setAction] = useState('status');
  const [form, setForm] = useState(initialForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const showToast = useUiStore((state) => state.showToast);
  const selectedCount = selectedTaskIds.length;
  const selectedTaskMap = useMemo(
    () => new Map(selectedTasks.map((task) => [Number(task.id), task])),
    [selectedTasks],
  );
  const selectedTaskEntries = useMemo(
    () =>
      selectedTaskIds.map((taskId) => {
        const normalizedTaskId = Number(taskId);
        const task = selectedTaskMap.get(normalizedTaskId);

        return {
          id: normalizedTaskId,
          name: getTaskDisplayName(task, normalizedTaskId),
          task,
        };
      }),
    [selectedTaskIds, selectedTaskMap],
  );
  const selectedProjectIds = useMemo(() => getSelectedProjectIds(selectedTasks), [selectedTasks]);
  const actionLabel = actionOptions.find((option) => option.value === action)?.label || 'Bulk Action';
  const sprintAssignmentBlocked = action === 'sprint' && selectedProjectIds.length > 1;

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const resetOperationState = () => {
    setFormError('');
    setProgress({ completed: 0, total: 0 });
    setResult(null);
  };

  const openModal = () => {
    resetOperationState();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setLoading(false);
    setProgress({ completed: 0, total: 0 });

    if (result) {
      setResult(null);
      onCleared?.();
    }
  };

  const buildBulkPayload = () => {
    const payload = {
      action,
      task_ids: selectedTaskIds,
    };

    if (action === 'priority') {
      payload.priority = form.priority;
    }

    if (action === 'bucket') {
      payload.bucket_id = form.bucket_id || null;
    }

    return payload;
  };

  const runBulkEndpointOperation = async () => {
    const successes = [];
    const failures = [];

    try {
      setProgress({ completed: 0, total: selectedCount });
      const response = await bulkUpdateTasks(buildBulkPayload());
      const updatedIds = new Set((response.task_ids || selectedTaskIds).map(Number));

      selectedTaskEntries.forEach((entry) => {
        if (updatedIds.has(Number(entry.id))) {
          successes.push(entry);
        } else {
          failures.push({ ...entry, error: 'Task tidak diproses oleh backend.' });
        }
      });
      setProgress({ completed: selectedCount, total: selectedCount });
    } catch (error) {
      selectedTaskEntries.forEach((entry) => failures.push({ ...entry, error: getApiErrorMessage(error) }));
      setProgress({ completed: selectedCount, total: selectedCount });
    }

    return { failures, successes };
  };

  const runPerTaskOperation = async (operation) => {
    const successes = [];
    const failures = [];

    setProgress({ completed: 0, total: selectedTaskEntries.length });

    for (const entry of selectedTaskEntries) {
      try {
        await operation(entry);
        successes.push(entry);
      } catch (error) {
        failures.push({ ...entry, error: getApiErrorMessage(error) });
      } finally {
        setProgress((current) => ({ ...current, completed: current.completed + 1 }));
      }
    }

    return { failures, successes };
  };

  const validateOperation = () => {
    if (!selectedCount) {
      return 'Pilih minimal satu task.';
    }

    if (sprintAssignmentBlocked) {
      return 'Bulk sprint hanya bisa untuk task dari satu project yang sama.';
    }

    if (action === 'sprint' && form.sprint_id && !sprints.some((sprint) => String(sprint.id) === String(form.sprint_id))) {
      return 'Sprint tidak valid untuk project task terpilih.';
    }

    return '';
  };

  const handleApply = async () => {
    const validationError = validateOperation();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setLoading(true);
    setFormError('');
    setResult(null);

    try {
      const nextResult = ['priority', 'bucket', 'archive', 'unarchive'].includes(action)
        ? await runBulkEndpointOperation()
        : await runPerTaskOperation(async (entry) => {
            if (action === 'status') {
              await updateTaskStatus(entry.id, form.status);
              return;
            }

            if (action === 'assignee') {
              await updateTask(entry.id, {
                assignee_id: form.assignee_ids[0] || null,
                assignee_ids: form.assignee_ids,
              });
              return;
            }

            if (action === 'sprint') {
              await updateTask(entry.id, {
                backlog_order: form.sprint_id ? null : undefined,
                sprint_id: form.sprint_id || null,
              });
            }
          });

      setResult(nextResult);

      if (nextResult.successes.length) {
        showToast({ type: 'success', message: `${nextResult.successes.length} task berhasil diproses.` });
        await onChanged?.({ preserveSelection: true });
      }

      if (nextResult.failures.length) {
        showToast({ type: 'error', message: `${nextResult.failures.length} task gagal diproses.` });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!enabled || !selectedCount) {
    return null;
  }

  return (
    <>
      <div className="toolbar items-center justify-between">
        <div>
          <p className="text-sm font-bold text-text-dark">{selectedCount} task selected</p>
          <p className="text-xs text-text-muted">Bulk actions run against selected visible tasks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field max-w-48"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              resetOperationState();
            }}
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary" type="button" onClick={onCleared}>
            Clear
          </button>
          <button className="btn-primary" type="button" onClick={openModal}>
            Configure
          </button>
        </div>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={loading} type="button" onClick={closeModal}>
              {result ? 'Close and Clear' : 'Cancel'}
            </button>
            {!result ? (
              <button className="btn-primary" disabled={loading || sprintAssignmentBlocked} type="button" onClick={handleApply}>
                {loading ? 'Processing...' : `Apply to ${selectedCount} Tasks`}
              </button>
            ) : null}
          </>
        }
        open={modalOpen}
        size="xl"
        title={actionLabel}
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm text-text-muted">
            <span className="font-bold text-text-dark">{selectedCount}</span> task selected for {actionLabel.toLowerCase()}.
          </div>

          {formError ? <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-danger">{formError}</div> : null}

          {!result ? (
            <div className="grid gap-4">
              {action === 'status' ? (
                <FormField htmlFor="bulk-status" label="Status" required>
                  <select className="field mt-1" id="bulk-status" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}

              {action === 'assignee' ? (
                <FormField
                  hint="Tidak memilih PIC akan mengosongkan PIC pada semua task terpilih."
                  htmlFor="bulk-assignee"
                  label="PIC"
                >
                  <UserSelectionField users={users} value={form.assignee_ids} onChange={(value) => updateForm('assignee_ids', value)} />
                </FormField>
              ) : null}

              {action === 'sprint' ? (
                <FormField
                  hint="Pilih sprint dari project task terpilih, atau kosongkan untuk melepas sprint."
                  htmlFor="bulk-sprint"
                  label="Sprint"
                >
                  <select
                    className="field mt-1"
                    disabled={sprintsLoading || sprintAssignmentBlocked}
                    id="bulk-sprint"
                    value={form.sprint_id}
                    onChange={(event) => updateForm('sprint_id', event.target.value)}
                  >
                    <option value="">No sprint / Backlog</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} ({sprint.state})
                      </option>
                    ))}
                  </select>
                  {sprintAssignmentBlocked ? (
                    <p className="form-error">Pilih task dari satu project untuk assignment sprint.</p>
                  ) : null}
                </FormField>
              ) : null}

              {action === 'priority' ? (
                <FormField htmlFor="bulk-priority" label="Priority" required>
                  <select className="field mt-1" id="bulk-priority" value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}

              {action === 'bucket' ? (
                <FormField htmlFor="bulk-bucket" label="Bucket">
                  <select className="field mt-1" id="bulk-bucket" value={form.bucket_id} onChange={(event) => updateForm('bucket_id', event.target.value)}>
                    <option value="">No bucket</option>
                    {buckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}

              {action === 'archive' || action === 'unarchive' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                  This will {action === 'archive' ? 'archive' : 'unarchive'} every selected task.
                </div>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="flex items-center gap-2 text-text-dark">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Processing
                </span>
                <span className="text-text-muted">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : null}

          <ResultSummary result={result} />
        </div>
      </Modal>
    </>
  );
}

export default TaskBulkToolbar;
