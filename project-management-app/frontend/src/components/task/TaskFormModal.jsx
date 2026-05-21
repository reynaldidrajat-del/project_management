import { useEffect, useState } from 'react';

import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';
import { formatDate, toDateInputValue } from '../../logic/helpers/dateHelper';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { useBuckets } from '../../logic/hooks/useProjects';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

// Nilai awal form task sebelum user mengisi data.
const initialForm = {
  title: '',
  description: '',
  project_id: '',
  bucket_id: '',
  parent_task_id: '',
  assignee_ids: [],
  lead_id: '',
  start_date: '',
  end_date: '',
  progress: 0,
  status: 'Not Started',
  priority: 'Medium',
};

// Mengubah daftar id menjadi string unik agar aman dipakai di input form.
const toStringIds = (values = []) => {
  const normalizedValues = Array.isArray(values) ? values : [values];

  return Array.from(new Set(normalizedValues.filter(Boolean).map(String)));
};

// Mengambil daftar PIC dari task, baik format lama maupun format multi PIC.
const getTaskAssigneeIds = (task) => {
  if (!task) {
    return [];
  }

  if (Array.isArray(task.assignee_ids) && task.assignee_ids.length) {
    return task.assignee_ids;
  }

  if (Array.isArray(task.assignees) && task.assignees.length) {
    return task.assignees.map((assignee) => assignee.id);
  }

  return task.assignee_id ? [task.assignee_id] : [];
};

// Mencari subtask terakhir agar start date subtask berikutnya bisa otomatis diisi.
const getLastChildTask = (parentTask) => {
  const children = parentTask?.children || [];

  if (!children.length) {
    return null;
  }

  return [...children].sort((firstTask, secondTask) => {
    const sortOrderDifference = Number(firstTask.sort_order || 0) - Number(secondTask.sort_order || 0);

    if (sortOrderDifference !== 0) {
      return sortOrderDifference;
    }

    return Number(firstTask.id || 0) - Number(secondTask.id || 0);
  })[children.length - 1];
};

// Menentukan start date default saat membuat subtask.
const getSubtaskDefaultStartDate = (parentTask) => {
  const lastChildTask = getLastChildTask(parentTask);

  return toDateInputValue(lastChildTask?.end_date || parentTask?.start_date);
};

// Membuat teks bantuan agar user paham asal start date subtask.
const getSubtaskDateHint = (parentTask) => {
  if (!parentTask) {
    return undefined;
  }

  const lastChildTask = getLastChildTask(parentTask);

  if (lastChildTask?.end_date) {
    return `Start date otomatis mengikuti end date subtask sebelumnya: ${formatDate(lastChildTask.end_date)}.`;
  }

  if (parentTask.start_date) {
    return `Subtask pertama otomatis mengikuti start date parent: ${formatDate(parentTask.start_date)}.`;
  }

  return 'Start date dapat diisi manual karena parent belum memiliki start date.';
};

// Dropdown checkbox untuk memilih lebih dari satu PIC.
function UserMultiSelectDropdown({ id, users = [], value = [], onChange }) {
  const selectedIds = new Set(toStringIds(value));
  const selectedUsers = users.filter((user) => selectedIds.has(String(user.id)));
  const label =
    selectedUsers.length > 2
      ? `${selectedUsers.length} PIC selected`
      : selectedUsers.map((user) => user.name).join(', ') || 'Pilih PIC';

  // Menambah atau menghapus user dari daftar PIC terpilih.
  const toggleUser = (userId, checked) => {
    const nextIds = new Set(selectedIds);

    if (checked) {
      nextIds.add(String(userId));
    } else {
      nextIds.delete(String(userId));
    }

    onChange(Array.from(nextIds));
  };

  return (
    <details className="relative mt-1">
      <summary className="field cursor-pointer list-none truncate" id={id}>
        {label}
      </summary>
      <div className="absolute left-0 right-0 z-30 mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-white shadow-soft">
        {users.length ? (
          users.map((user) => {
            const userId = String(user.id);

            return (
              <label key={user.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text-dark">{user.name}</span>
                  <span className="block truncate text-xs text-text-muted">{user.department_name || 'No department'}</span>
                </span>
                <input
                  checked={selectedIds.has(userId)}
                  type="checkbox"
                  value={user.id}
                  onChange={(event) => toggleUser(userId, event.target.checked)}
                />
              </label>
            );
          })
        ) : (
          <p className="px-3 py-2 text-sm text-text-muted">Belum ada user.</p>
        )}
      </div>
    </details>
  );
}

// Modal form untuk membuat task, membuat subtask, atau mengedit task.
function TaskFormModal({
  open,
  task,
  parentTask,
  defaultProjectId,
  projects = [],
  users = [],
  tasks = [],
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const { buckets } = useBuckets(form.project_id);
  const allTasks = flattenTaskTree(tasks);
  const taskHasChildren = Boolean(task?.children?.length);
  const parentLocked = Boolean(parentTask && !task);
  const modalDescription = parentTask
    ? `Parent: ${parentTask.title}. Start Date: ${formatDate(parentTask.start_date)}. End Date: ${formatDate(parentTask.end_date)}.`
    : 'Task menjadi sumber data Board, List, dan Gantt. Tanggal task akan dihitung otomatis menjadi duration days dan work days di backend.';
  const subtaskDateHint = parentLocked ? getSubtaskDateHint(parentTask) : undefined;

  useEffect(() => {
    setErrors({});

    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        project_id: task.project_id || '',
        bucket_id: task.bucket_id || '',
        parent_task_id: task.parent_task_id || '',
        assignee_ids: toStringIds(getTaskAssigneeIds(task)),
        lead_id: task.lead_id ? String(task.lead_id) : '',
        start_date: toDateInputValue(task.start_date),
        end_date: toDateInputValue(task.end_date),
        progress: task.progress || 0,
        status: task.raw_status || task.status || 'Not Started',
        priority: task.priority || 'Medium',
      });
      return;
    }

    setForm({
      ...initialForm,
      project_id: defaultProjectId || parentTask?.project_id || '',
      parent_task_id: parentTask?.id || '',
      bucket_id: parentTask?.bucket_id || '',
      assignee_ids: toStringIds(getTaskAssigneeIds(parentTask)),
      lead_id: parentTask?.lead_id ? String(parentTask.lead_id) : '',
      start_date: parentTask ? getSubtaskDefaultStartDate(parentTask) : '',
    });
  }, [task, parentTask, defaultProjectId, open]);

  if (!open) {
    return null;
  }

  // Menghapus error field ketika user memperbaiki isinya.
  const clearFieldError = (field) => {
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Mengubah satu field form task.
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field === 'start_date' ? 'end_date' : field);
  };

  // Mengubah status dan menyesuaikan progress jika statusnya selesai atau belum mulai.
  const updateStatus = (status) => {
    setForm((current) => {
      if (status === 'Done') {
        return {
          ...current,
          status: 'Waiting Review',
          progress: 99,
        };
      }

      if (status === 'Waiting Review') {
        return {
          ...current,
          status,
          progress: 99,
        };
      }

      if (status === 'Not Started' && Number(current.progress) === 100) {
        return {
          ...current,
          status,
          progress: 0,
        };
      }

      if (Number(current.progress) === 100) {
        return {
          ...current,
          status,
          progress: 99,
        };
      }

      return {
        ...current,
        status,
      };
    });
  };

  // Mengubah progress dan menyesuaikan status jika progress mencapai 100%.
  const updateProgress = (value) => {
    const progress = Math.min(100, Math.max(0, Number(value || 0)));

    setForm((current) => {
      if (progress === 100) {
        return {
          ...current,
          progress: 99,
          status: 'Waiting Review',
        };
      }

      if (current.status === 'Done') {
        return {
          ...current,
          progress,
          status: progress === 0 ? 'Not Started' : 'In Progress',
        };
      }

      return {
        ...current,
        progress,
      };
    });
  };

  // Memastikan title dan project wajib diisi serta tanggal tidak terbalik.
  const validateForm = () => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = 'Masukkan judul task.';
    }

    if (!form.project_id) {
      nextErrors.project_id = 'Pilih project untuk task.';
    }

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      nextErrors.end_date = 'End date tidak boleh lebih awal dari start date.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  // Mengirim payload task yang sudah dirapikan ke halaman parent.
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      project_id: parentTask?.project_id || form.project_id || null,
      bucket_id: form.bucket_id || null,
      parent_task_id: parentTask?.id || form.parent_task_id || null,
      assignee_id: form.assignee_ids[0] || null,
      assignee_ids: form.assignee_ids,
      lead_id: form.lead_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      progress: Number(form.progress || 0),
    });
  };

  const selectableParents = allTasks.filter((item) => {
    return Number(item.id) !== Number(task?.id) && Number(item.project_id) === Number(form.project_id);
  });
  const parentOptions = parentTask
    ? [parentTask, ...selectableParents.filter((item) => Number(item.id) !== Number(parentTask.id))]
    : selectableParents;

  return (
    <Modal
      description={modalDescription}
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="task-form" type="submit">
            {task ? 'Save Changes' : parentTask ? 'Create Subtask' : 'Create Task'}
          </button>
        </>
      }
      open={open}
      size="xl"
      title={task ? 'Edit Task' : parentTask ? 'Tambah Subtask' : 'Tambah Task'}
      onClose={onClose}
    >
      <form id="task-form" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField className="sm:col-span-2" error={errors.title} htmlFor="task-title" label="Title" required>
            <input
              className={`field mt-1 ${errors.title ? 'field-error' : ''}`}
              id="task-title"
              required
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
            />
          </FormField>
          <FormField className="sm:col-span-2" htmlFor="task-description" label="Description">
            <textarea
              className="field mt-1 min-h-20"
              id="task-description"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </FormField>
          <FormField
            error={errors.project_id}
            hint={parentLocked ? 'Project mengikuti task parent yang dipilih dari row.' : undefined}
            htmlFor="task-project"
            label="Project"
            required
          >
            <select
              className={`field mt-1 ${errors.project_id ? 'field-error' : ''}`}
              disabled={parentLocked}
              id="task-project"
              required
              value={form.project_id}
              onChange={(event) => {
                updateField('project_id', event.target.value);
                updateField('bucket_id', '');
                updateField('parent_task_id', '');
              }}
            >
              <option value="">Pilih project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="task-bucket" label="Bucket">
            <select className="field mt-1" id="task-bucket" value={form.bucket_id} onChange={(event) => updateField('bucket_id', event.target.value)}>
              <option value="">No bucket</option>
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            hint={parentLocked ? `Subtask akan dibuat di bawah "${parentTask.title}".` : undefined}
            htmlFor="task-parent"
            label="Parent Task"
          >
            <select
              className="field mt-1"
              disabled={parentLocked}
              id="task-parent"
              value={form.parent_task_id}
              onChange={(event) => updateField('parent_task_id', event.target.value)}
            >
              {!parentLocked ? <option value="">Task utama</option> : null}
              {parentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {'-'.repeat(item.level || 0)} {item.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField hint="Pilih satu atau lebih PIC dari data Team." htmlFor="task-assignee" label="PIC">
            <UserMultiSelectDropdown
              id="task-assignee"
              users={users}
              value={form.assignee_ids}
              onChange={(selectedIds) => updateField('assignee_ids', selectedIds)}
            />
          </FormField>
          <FormField htmlFor="task-lead" label="Lead">
            <select className="field mt-1" id="task-lead" value={form.lead_id} onChange={(event) => updateField('lead_id', event.target.value)}>
              <option value="">No lead</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} {user.department_name ? `- ${user.department_name}` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField hint={subtaskDateHint} htmlFor="task-start-date" label="Start Date">
            <input
              className="field mt-1"
              id="task-start-date"
              type="date"
              value={form.start_date}
              onChange={(event) => updateField('start_date', event.target.value)}
            />
          </FormField>
          <FormField error={errors.end_date} htmlFor="task-end-date" label="End Date">
            <input
              className={`field mt-1 ${errors.end_date ? 'field-error' : ''}`}
              id="task-end-date"
              type="date"
              value={form.end_date}
              onChange={(event) => updateField('end_date', event.target.value)}
            />
          </FormField>
          <FormField
            hint={taskHasChildren ? 'Progress parent dihitung otomatis dari subtask.' : 'Isi 0 sampai 100 untuk task tanpa subtask.'}
            htmlFor="task-progress"
            label="Progress"
          >
            <input
              className="field mt-1"
              disabled={taskHasChildren}
              id="task-progress"
              max="100"
              min="0"
              type="number"
              value={form.progress}
              onChange={(event) => updateProgress(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="task-status" label="Status">
            <select className="field mt-1" id="task-status" value={form.status} onChange={(event) => updateStatus(event.target.value)}>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="task-priority" label="Priority">
            <select className="field mt-1" id="task-priority" value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export default TaskFormModal;
