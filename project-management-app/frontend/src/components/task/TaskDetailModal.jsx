import { useEffect, useState } from 'react';

import {
  approveTask,
  createTask,
  createTaskChecklist,
  deleteTask,
  deleteTaskChecklist,
  getTaskChecklists,
  updateTask,
  updateTaskChecklist,
  updateTaskProgress,
  updateTaskRealization,
} from '../../logic/services/taskApi';
import { formatDate } from '../../logic/helpers/dateHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';
import { getPriorityBadgeClass, getProgressBarClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getRealizationModeBadgeClass, getRealizationModeLabel } from '../../logic/helpers/realizationHelper';
import { useUiStore } from '../../store/uiStore';
import CommentThread from './CommentThread';
import SubtaskList from './SubtaskList';
import TaskFormModal from './TaskFormModal';
import TaskRealizationManualModal from './TaskRealizationManualModal';

// Modal detail task untuk melihat, mengedit, menghapus, dan mengelola realisasi/subtask.
function TaskDetailModal({ task: selectedTask, projects = [], users = [], tasks = [], labels = [], onClose, onSaved }) {
  const [mode, setMode] = useState(null);
  const [currentTask, setCurrentTask] = useState(selectedTask);
  const [checklists, setChecklists] = useState([]);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [progress, setProgress] = useState(selectedTask?.progress || 0);
  const showToast = useUiStore((state) => state.showToast);
  const currentUserId = useUiStore((state) => state.currentUserId);
  const currentUserRole = useUiStore((state) => state.currentUser?.role);

  useEffect(() => {
    setCurrentTask(selectedTask);
    setProgress(selectedTask?.progress || 0);
    setMode(null);
  }, [selectedTask]);

  useEffect(() => {
    let active = true;

    const fetchChecklists = async () => {
      if (!currentTask?.id) {
        setChecklists([]);
        return;
      }

      try {
        const rows = await getTaskChecklists(currentTask.id);

        if (active) {
          setChecklists(rows);
        }
      } catch (error) {
        if (active) {
          showToast({ type: 'error', message: getApiErrorMessage(error) });
        }
      }
    };

    fetchChecklists();

    return () => {
      active = false;
    };
  }, [currentTask?.id, showToast]);

  if (!currentTask) {
    return null;
  }

  const task = currentTask;
  const hasActualStarted = Boolean(task.actual_start_date);
  const hasActualFinished = Boolean(task.actual_end_date);
  const rawStatus = task.raw_status || task.status;
  const approvalPending = rawStatus === 'Waiting Review';
  const approvalEnabled =
    approvalPending && (currentUserRole === 'super_admin' || (task.lead_id && Number(task.lead_id) === Number(currentUserId)));
  const manualRealizationBlocked = Boolean(task.children?.length) || rawStatus === 'Done';

  // Menggabungkan hasil update dari API ke task yang sedang ditampilkan.
  const applyUpdatedTask = (updatedTask) => {
    setCurrentTask((current) => ({
      ...current,
      ...updatedTask,
      children: current?.children || [],
    }));
  };

  // Menyimpan perubahan progress cepat dari modal detail.
  const handleProgressSave = async () => {
    try {
      const updatedTask = await updateTaskProgress(task.id, progress);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({ type: 'success', message: 'Progress task diperbarui.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Mengapprove task yang sudah menunggu review lead.
  const handleApprove = async () => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await approveTask(task.id, currentUserId);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({ type: 'success', message: 'Task diapprove.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus task setelah user mengonfirmasi.
  const handleDelete = async () => {
    if (!window.confirm('Hapus task ini beserta seluruh subtask?')) {
      return;
    }

    try {
      await deleteTask(task.id);
      showToast({ type: 'success', message: 'Task dihapus.' });
      await onSaved?.();
      onClose();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menyimpan perubahan task dari form edit.
  const handleEditSubmit = async (payload) => {
    try {
      const updatedTask = await updateTask(task.id, payload);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      setMode(null);
      showToast({ type: 'success', message: 'Task diperbarui.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menjalankan aksi realisasi mulai atau selesai.
  const handleRealizationAction = async (action) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await updateTaskRealization(task.id, { action, actor_user_id: currentUserId });
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({
        type: 'success',
        message: action === 'start' ? 'Realisasi task dimulai.' : 'Realisasi task diselesaikan.',
      });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Membuka modal untuk input realisasi manual.
  const openManualRealizationModal = () => {
    setMode('manual-realization');
  };

  // Menyimpan tanggal realisasi manual.
  const handleManualRealizationSubmit = async (payload) => {
    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await updateTaskRealization(task.id, {
        action: 'manual',
        actor_user_id: currentUserId,
        ...payload,
      });
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      setMode(null);
      showToast({ type: 'success', message: 'Realisasi manual task disimpan.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Membuat subtask baru di bawah task yang sedang dibuka.
  const handleSubtaskSubmit = async (payload) => {
    try {
      const createdSubtask = await createTask({
        ...payload,
        project_id: task.project_id,
        bucket_id: payload.bucket_id || task.bucket_id || null,
        parent_task_id: task.id,
      });
      setCurrentTask((current) => ({
        ...current,
        children: [
          ...(current?.children || []),
          {
            ...createdSubtask,
            level: (current?.level || 0) + 1,
            children: [],
          },
        ],
      }));
      setMode(null);
      showToast({ type: 'success', message: 'Subtask dibuat.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const refreshChecklists = async () => {
    setChecklists(await getTaskChecklists(task.id));
  };

  const handleChecklistSubmit = async (event) => {
    event.preventDefault();

    if (!checklistTitle.trim()) {
      showToast({ type: 'error', message: 'Judul checklist wajib diisi.' });
      return;
    }

    try {
      await createTaskChecklist(task.id, { title: checklistTitle.trim() });
      setChecklistTitle('');
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleChecklistToggle = async (checklist) => {
    try {
      await updateTaskChecklist(checklist.id, { is_done: !checklist.is_done });
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleChecklistDelete = async (checklist) => {
    try {
      await deleteTaskChecklist(checklist.id);
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-muted">{task.project_name} / {task.bucket_name || 'No bucket'}</p>
            <h2 className="text-xl font-bold">{task.title}</h2>
          </div>
          <button className="text-2xl text-text-muted" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Status</p>
            <span className={`badge mt-2 ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Priority</p>
            <span className={`badge mt-2 ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">PIC</p>
            <p className="mt-2 font-semibold">{getTaskAssigneeNames(task)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Lead</p>
            <p className="mt-2 font-semibold">{getTaskLeadName(task)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="label">Plan Start</p>
            <p className="font-semibold">{formatDate(task.start_date)}</p>
          </div>
          <div>
            <p className="label">Plan End</p>
            <p className="font-semibold">{formatDate(task.end_date)}</p>
          </div>
          <div>
            <p className="label">Plan Duration</p>
            <p className="font-semibold">{task.duration_days || 0} days</p>
          </div>
          <div>
            <p className="label">Plan Work Days</p>
            <p className="font-semibold">{task.work_days || 0} days</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Realisasi</p>
              <p className="text-sm text-text-muted">Actual start dan finish disimpan terpisah dari jadwal plan untuk perbandingan di Gantt.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasActualStarted ? (
                <span className={`badge ${getRealizationModeBadgeClass(task.realization_mode)}`}>
                  {getRealizationModeLabel(task.realization_mode)}
                </span>
              ) : null}
              {!approvalPending && !hasActualStarted ? (
                <button className="btn-primary" type="button" onClick={() => handleRealizationAction('start')}>
                  Mulai Realisasi
                </button>
              ) : null}
              {!approvalPending && hasActualStarted && !hasActualFinished ? (
                <button className="btn-primary" type="button" onClick={() => handleRealizationAction('finish')}>
                  Selesaikan Realisasi
                </button>
              ) : null}
              {hasActualFinished ? <span className="badge bg-green-100 text-green-700">Realisasi selesai</span> : null}
              {approvalEnabled ? (
                <button className="btn-primary bg-success hover:bg-green-700" type="button" onClick={handleApprove}>
                  Approve
                </button>
              ) : null}
              {approvalPending && !approvalEnabled ? <span className="badge bg-amber-100 text-amber-700">Waiting lead approval</span> : null}
              <button
                className="btn-secondary"
                disabled={manualRealizationBlocked}
                title={manualRealizationBlocked ? 'Realisasi manual hanya untuk leaf task yang belum Done.' : 'Isi realisasi manual'}
                type="button"
                onClick={openManualRealizationModal}
              >
                Realisasi Manual
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="label">Actual Start</p>
              <p className="font-semibold">{formatDate(task.actual_start_date)}</p>
            </div>
            <div>
              <p className="label">Actual Finish</p>
              <p className="font-semibold">{formatDate(task.actual_end_date)}</p>
            </div>
            <div>
              <p className="label">Actual Duration</p>
              <p className="font-semibold">{task.actual_duration_days || 0} days</p>
            </div>
            <div>
              <p className="label">Actual Work Days</p>
              <p className="font-semibold">{task.actual_work_days || 0} days</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="label">Description</p>
          <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm text-text-muted">{task.description || 'No description'}</p>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">Labels</p>
              <p className="text-sm text-text-muted">Label dipakai untuk filter dan pengelompokan task.</p>
            </div>
            <button className="btn-secondary" type="button" onClick={() => setMode('edit')}>
              Edit Labels
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.labels?.length ? (
              task.labels.map((label) => (
                <span key={label.id} className={`badge ${getTaskLabelBadgeClass(label.color)}`}>
                  {label.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-text-muted">Belum ada label.</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">Progress</p>
              <p className="text-sm text-text-muted">{task.children?.length ? 'Parent progress dihitung otomatis dari subtask.' : 'Update manual progress task.'}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="field w-28"
                disabled={Boolean(task.children?.length)}
                max="100"
                min="0"
                type="number"
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
              />
              <button className="btn-primary" disabled={Boolean(task.children?.length)} type="button" onClick={handleProgressSave}>
                Save
              </button>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${getProgressBarClass(task)}`} style={{ width: `${task.progress || 0}%` }} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Checklist</p>
              <p className="text-sm text-text-muted">
                {checklists.filter((item) => item.is_done).length}/{checklists.length} item selesai.
              </p>
            </div>
          </div>
          <form className="mb-3 flex gap-2" onSubmit={handleChecklistSubmit}>
            <input
              className="field"
              placeholder="Tambah checklist"
              value={checklistTitle}
              onChange={(event) => setChecklistTitle(event.target.value)}
            />
            <button className="btn-primary" type="submit">
              Add
            </button>
          </form>
          <div className="space-y-2">
            {checklists.length ? (
              checklists.map((checklist) => (
                <div key={checklist.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
                    <input checked={checklist.is_done} type="checkbox" onChange={() => handleChecklistToggle(checklist)} />
                    <span className={checklist.is_done ? 'truncate text-text-muted line-through' : 'truncate text-text-dark'}>
                      {checklist.title}
                    </span>
                  </label>
                  <button className="text-xs font-bold text-danger" type="button" onClick={() => handleChecklistDelete(checklist)}>
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-muted">Belum ada checklist.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Subtasks</h3>
            <button className="btn-secondary" type="button" onClick={() => setMode('subtask')}>
              Add Subtask
            </button>
          </div>
          <SubtaskList
            subtasks={task.children || []}
            onOpen={(subtask) => {
              setCurrentTask(subtask);
              setProgress(subtask.progress || 0);
            }}
          />
        </div>

        <CommentThread task={task} users={users} />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" type="button" onClick={() => setMode('edit')}>
            Edit
          </button>
          <button className="btn-secondary text-danger" type="button" onClick={handleDelete}>
            Delete
          </button>
          <button className="btn-primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <TaskFormModal
        open={mode === 'edit'}
        task={task}
        projects={projects}
        users={users}
        tasks={tasks}
        labels={labels}
        onClose={() => setMode(null)}
        onSubmit={handleEditSubmit}
      />
      <TaskFormModal
        open={mode === 'subtask'}
        parentTask={task}
        projects={projects}
        users={users}
        tasks={tasks}
        labels={labels}
        onClose={() => setMode(null)}
        onSubmit={handleSubtaskSubmit}
      />
      <TaskRealizationManualModal
        open={mode === 'manual-realization'}
        task={task}
        onClose={() => setMode(null)}
        onSubmit={handleManualRealizationSubmit}
      />
    </div>
  );
}

export default TaskDetailModal;
