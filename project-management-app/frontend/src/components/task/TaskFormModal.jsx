import { useEffect, useState } from 'react';

import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';
import { formatDate, toDateInputValue } from '../../logic/helpers/dateHelper';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
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
  label_ids: [],
};

const statusDescriptions = {
  'Not Started': 'Task belum mulai.',
  'In Progress': 'Task sedang dikerjakan.',
  'Waiting Review': 'Pekerjaan selesai dan menunggu approval lead.',
  Done: 'Task sudah approved.',
  Overdue: 'Task melewati plan end date.',
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

function TaskFormSection({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-border bg-white p-4 ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-text-dark">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SelectedChipList({ emptyText, children }) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
      {children || <span className="text-sm text-text-muted">{emptyText}</span>}
    </div>
  );
}

// Panel checkbox untuk memilih lebih dari satu PIC tanpa dropdown yang menimpa field lain.
function UserMultiSelectDropdown({ id, users = [], value = [], onChange }) {
  const [query, setQuery] = useState('');
  const selectedIds = new Set(toStringIds(value));
  const selectedUsers = users.filter((user) => selectedIds.has(String(user.id)));
  const filteredUsers = users.filter((user) => {
    const searchValue = `${user.name || ''} ${user.department_name || ''} ${user.email || ''}`.toLowerCase();
    return searchValue.includes(query.trim().toLowerCase());
  });

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
    <div className="mt-1 rounded-xl border border-border bg-white" id={id}>
      <div className="border-b border-border p-2">
        <SelectedChipList emptyText="Belum ada PIC dipilih.">
          {selectedUsers.length
            ? selectedUsers.map((user) => (
                <button
                  key={user.id}
                  className="badge bg-blue-100 text-blue-700 transition hover:bg-blue-200"
                  type="button"
                  onClick={() => toggleUser(user.id, false)}
                >
                  {user.name} x
                </button>
              ))
            : null}
        </SelectedChipList>
        <input
          className="field mt-2"
          placeholder="Cari PIC"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filteredUsers.length ? (
          filteredUsers.map((user) => {
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
          <p className="px-3 py-3 text-sm text-text-muted">PIC tidak ditemukan.</p>
        )}
      </div>
    </div>
  );
}

// Panel checkbox untuk memilih label task dari project yang sama.
function LabelMultiSelectDropdown({ id, labels = [], value = [], onChange }) {
  const selectedIds = new Set(toStringIds(value));
  const selectedLabels = labels.filter((label) => selectedIds.has(String(label.id)));

  const toggleLabel = (labelId, checked) => {
    const nextIds = new Set(selectedIds);

    if (checked) {
      nextIds.add(String(labelId));
    } else {
      nextIds.delete(String(labelId));
    }

    onChange(Array.from(nextIds));
  };

  return (
    <div className="mt-1 rounded-xl border border-border bg-white" id={id}>
      <div className="border-b border-border p-2">
        <SelectedChipList emptyText="Belum ada label dipilih.">
          {selectedLabels.length
            ? selectedLabels.map((item) => (
                <button
                  key={item.id}
                  className={`badge transition ${getTaskLabelBadgeClass(item.color)}`}
                  type="button"
                  onClick={() => toggleLabel(item.id, false)}
                >
                  {item.name} x
                </button>
              ))
            : null}
        </SelectedChipList>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {labels.length ? (
          labels.map((item) => {
            const labelId = String(item.id);

            return (
              <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-slate-50">
                <span className={`badge ${getTaskLabelBadgeClass(item.color)}`}>{item.name}</span>
                <input
                  checked={selectedIds.has(labelId)}
                  type="checkbox"
                  value={item.id}
                  onChange={(event) => toggleLabel(labelId, event.target.checked)}
                />
              </label>
            );
          })
        ) : (
          <p className="px-3 py-3 text-sm text-text-muted">Belum ada label untuk project ini.</p>
        )}
      </div>
    </div>
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
  labels = [],
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
        label_ids: toStringIds(task.label_ids || task.labels?.map((label) => label.id) || []),
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
      label_ids: [],
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
        if ((task?.raw_status || task?.status) === 'Done') {
          return {
            ...current,
            status: 'Done',
            progress: 100,
          };
        }

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
      if ((task?.raw_status || task?.status) === 'Done' && progress === 100) {
        return {
          ...current,
          progress: 100,
          status: 'Done',
        };
      }

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
      label_ids: form.label_ids,
    });
  };

  const selectableParents = allTasks.filter((item) => {
    return Number(item.id) !== Number(task?.id) && Number(item.project_id) === Number(form.project_id);
  });
  const parentOptions = parentTask
    ? [parentTask, ...selectableParents.filter((item) => Number(item.id) !== Number(parentTask.id))]
    : selectableParents;
  const isEditing = Boolean(task);
  const currentProject = projects.find((project) => Number(project.id) === Number(form.project_id));
  const currentBucket = buckets.find((bucket) => Number(bucket.id) === Number(form.bucket_id));
  const currentLead = users.find((user) => Number(user.id) === Number(form.lead_id));
  const availableLabels = labels.filter((label) => Number(label.project_id) === Number(form.project_id));
  const statusOptions = (task?.raw_status || task?.status) === 'Done'
    ? TASK_STATUSES
    : TASK_STATUSES.filter((status) => status !== 'Done');
  const formModeLabel = isEditing ? 'Edit task' : parentTask ? 'New subtask' : 'New task';

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
      size="2xl"
      title={task ? 'Edit Task' : parentTask ? 'Tambah Subtask' : 'Tambah Task'}
      onClose={onClose}
    >
      <form id="task-form" noValidate onSubmit={handleSubmit}>
        <div className="mb-4 grid gap-3 rounded-xl border border-border bg-slate-50 p-3 sm:grid-cols-4">
          <div>
            <p className="label">Mode</p>
            <p className="mt-1 text-sm font-bold text-text-dark">{formModeLabel}</p>
          </div>
          <div>
            <p className="label">Project</p>
            <p className="mt-1 truncate text-sm font-bold text-text-dark">{currentProject?.name || '-'}</p>
          </div>
          <div>
            <p className="label">Bucket</p>
            <p className="mt-1 truncate text-sm font-bold text-text-dark">{currentBucket?.name || 'No bucket'}</p>
          </div>
          <div>
            <p className="label">Lead</p>
            <p className="mt-1 truncate text-sm font-bold text-text-dark">{currentLead?.name || 'No lead'}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <TaskFormSection title="Task Detail">
              <div className="grid gap-4">
                <FormField error={errors.title} htmlFor="task-title" label="Title" required>
                  <input
                    className={`field mt-1 ${errors.title ? 'field-error' : ''}`}
                    id="task-title"
                    required
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                  />
                </FormField>
                <FormField htmlFor="task-description" label="Description">
                  <textarea
                    className="field mt-1 min-h-28 resize-y"
                    id="task-description"
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                  />
                </FormField>
              </div>
            </TaskFormSection>

            <TaskFormSection title="Structure" description="Project, bucket, dan parent menentukan posisi task di board dan tree.">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={errors.project_id}
                  hint={parentLocked ? 'Project mengikuti task parent.' : undefined}
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
                      updateField('label_ids', []);
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
                  className="md:col-span-2"
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
              </div>
            </TaskFormSection>

            <TaskFormSection title="Schedule">
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>
            </TaskFormSection>

            <TaskFormSection title="Workflow">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField htmlFor="task-status" label="Status">
                  <select className="field mt-1" id="task-status" value={form.status} onChange={(event) => updateStatus(event.target.value)}>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <p className="form-hint">{statusDescriptions[form.status]}</p>
                </FormField>
                <FormField
                  hint={taskHasChildren ? 'Parent dihitung otomatis dari subtask.' : undefined}
                  htmlFor="task-progress"
                  label="Progress"
                >
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="field"
                      disabled={taskHasChildren}
                      id="task-progress"
                      max="100"
                      min="0"
                      type="number"
                      value={form.progress}
                      onChange={(event) => updateProgress(event.target.value)}
                    />
                    <span className="text-sm font-bold text-text-muted">%</span>
                  </div>
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
            </TaskFormSection>
          </div>

          <div className="space-y-4">
            <TaskFormSection title="People">
              <div className="space-y-4">
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
              </div>
            </TaskFormSection>

            <TaskFormSection title="Labels" description="Label mengikuti project yang dipilih.">
              <FormField htmlFor="task-labels" label="Task Labels">
                <LabelMultiSelectDropdown
                  id="task-labels"
                  labels={availableLabels}
                  value={form.label_ids}
                  onChange={(selectedIds) => updateField('label_ids', selectedIds)}
                />
              </FormField>
            </TaskFormSection>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default TaskFormModal;
