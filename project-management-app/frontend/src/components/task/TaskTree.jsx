import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getPriorityBadgeClass, getProgressBarClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';
import { useUiStore } from '../../store/uiStore';

// Menu aksi per task untuk edit, hapus, tambah subtask, dan realisasi.
function SplitTaskActions({
  approvalEnabled,
  approvalPending,
  task,
  realizationAction,
  realizationLabel,
  onApprove,
  onDelete,
  onEdit,
  onAddSubtask,
  onRealization,
  onManualRealization,
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const splitButtonRef = useRef(null);
  const menuRef = useRef(null);
  const rawStatus = task.raw_status || task.status;
  const manualRealizationDisabled = Boolean(task.children?.length) || rawStatus === 'Done';
  const manualRealizationDisabledReason = task.children?.length
    ? 'Parent task memakai rollup dari subtask.'
    : 'Task yang sudah Done tidak dapat diubah lewat realisasi manual.';

  // Menghitung posisi menu agar dropdown muncul dekat tombolnya.
  const updateMenuPosition = () => {
    const rect = splitButtonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const menuWidth = 176;
    const menuHeight = 160;
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth));
    const preferredTop = rect.bottom + 6;
    const top = preferredTop + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 6) : preferredTop;

    setMenuPosition({ left, top });
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Menutup menu saat user klik di luar area menu.
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !splitButtonRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    // Menutup menu saat user menekan Escape.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    return () => window.removeEventListener('resize', updateMenuPosition);
  }, [open]);

  // Membuka atau menutup menu aksi task.
  const handleOpenMenu = () => {
    updateMenuPosition();
    setOpen((current) => !current);
  };

  // Menjalankan aksi menu lalu menutup dropdown.
  const runAction = (action) => {
    setOpen(false);
    action?.();
  };

  return (
    <>
      <div ref={splitButtonRef} className="inline-flex shrink-0 overflow-hidden rounded-lg shadow-sm">
        {approvalEnabled ? (
          <button
            className="inline-flex h-8 min-w-20 items-center justify-center bg-success px-3 text-xs font-bold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/25"
            type="button"
            onClick={() => onApprove?.(task)}
          >
            Approve
          </button>
        ) : approvalPending ? (
          <span className="inline-flex h-8 min-w-20 items-center justify-center bg-amber-100 px-3 text-xs font-bold text-amber-700">Waiting</span>
        ) : realizationAction ? (
          <button
            className="inline-flex h-8 min-w-20 items-center justify-center bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/25"
            type="button"
            onClick={() => onRealization?.(task, realizationAction)}
          >
            {realizationLabel}
          </button>
        ) : (
          <span className="inline-flex h-8 min-w-20 items-center justify-center bg-green-100 px-3 text-xs font-bold text-green-700">Done</span>
        )}
        <button
          aria-expanded={open}
          aria-label={`Pilihan lain untuk ${task.title}`}
          className="inline-flex h-8 w-9 items-center justify-center border-l border-white/40 bg-primary text-xs font-bold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/25"
          type="button"
          onClick={handleOpenMenu}
        >
          v
        </button>
      </div>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] w-44 overflow-hidden rounded-lg border border-border bg-white py-1 text-xs shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button
                className={[
                  'block w-full px-3 py-2 text-left font-semibold',
                  manualRealizationDisabled ? 'cursor-not-allowed text-slate-400' : 'text-text-dark hover:bg-slate-50',
                ].join(' ')}
                disabled={manualRealizationDisabled}
                title={manualRealizationDisabled ? manualRealizationDisabledReason : 'Isi realisasi manual'}
                type="button"
                onClick={() => runAction(() => onManualRealization?.(task))}
              >
                Manual realization
              </button>
              <button className="block w-full px-3 py-2 text-left font-semibold text-text-dark hover:bg-slate-50" type="button" onClick={() => runAction(() => onAddSubtask(task))}>
                Add subtask
              </button>
              <button className="block w-full px-3 py-2 text-left font-semibold text-text-dark hover:bg-slate-50" type="button" onClick={() => runAction(() => onEdit(task))}>
                Edit task
              </button>
              <button className="block w-full px-3 py-2 text-left font-semibold text-danger hover:bg-red-50" type="button" onClick={() => runAction(() => onDelete(task))}>
                Delete task
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Satu baris task dalam tree list.
function TaskRow({
  task,
  currentUserId,
  currentUserRole,
  expanded,
  onToggle,
  onApprove,
  onEdit,
  onDelete,
  onAddSubtask,
  onRealization,
  onManualRealization,
}) {
  const hasChildren = Boolean(task.children?.length);
  const hasActualStarted = Boolean(task.actual_start_date);
  const hasActualFinished = Boolean(task.actual_end_date);
  const rawStatus = task.raw_status || task.status;
  const approvalPending = rawStatus === 'Waiting Review';
  const approvalEnabled =
    approvalPending && (currentUserRole === 'super_admin' || (task.lead_id && Number(task.lead_id) === Number(currentUserId)));
  const realizationAction = approvalPending ? null : !hasActualStarted ? 'start' : hasActualStarted && !hasActualFinished ? 'finish' : null;
  const realizationLabel = realizationAction === 'start' ? 'Mulai' : realizationAction === 'finish' ? 'Selesai' : 'Done';

  return (
    <>
      <tr className="text-xs">
        <td className="min-w-[360px] max-w-[460px] px-3 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${(task.level || 0) * 18}px` }}>
            <button
              className="h-6 w-6 shrink-0 rounded-md border border-border bg-white text-xs font-bold text-text-muted disabled:bg-slate-50"
              disabled={!hasChildren}
              type="button"
              onClick={() => onToggle(task.id)}
            >
              {hasChildren ? (expanded.has(task.id) ? '-' : '+') : ''}
            </button>
            <div className="min-w-0">
              <p className={`truncate ${hasChildren ? 'font-bold text-text-dark' : 'font-semibold text-text-dark'}`}>{task.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-text-muted">
                {task.project_name || '-'} / {task.bucket_name || '-'}
              </p>
            </div>
          </div>
        </td>
        <td className="min-w-36 px-3 py-2 font-semibold">{getTaskAssigneeNames(task)}</td>
        <td className="min-w-28 px-3 py-2 text-text-muted">{getTaskLeadName(task)}</td>
        <td className="min-w-24 px-3 py-2">{formatDate(task.start_date, 'dd MMM yyyy')}</td>
        <td className="min-w-24 px-3 py-2">{formatDate(task.end_date, 'dd MMM yyyy')}</td>
        <td className="min-w-20 px-3 py-2 text-center">{task.duration_days || 0}</td>
        <td className="min-w-24 px-3 py-2 text-center">{task.work_days || 0}</td>
        <td className="min-w-36 px-3 py-2">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-bold text-text-dark">{task.progress || 0}%</span>
              <span className={`badge px-1.5 py-0.5 text-[10px] ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${getProgressBarClass(task)}`} style={{ width: `${task.progress || 0}%` }} />
            </div>
          </div>
        </td>
        <td className="min-w-24 px-3 py-2">
          <span className={`badge px-1.5 py-0.5 text-[10px] ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
        </td>
        <td className="sticky right-0 z-20 min-w-[170px] bg-white px-3 py-2 shadow-[-8px_0_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-end gap-1.5">
            <SplitTaskActions
              approvalEnabled={approvalEnabled}
              approvalPending={approvalPending}
              task={task}
              realizationAction={realizationAction}
              realizationLabel={realizationLabel}
              onAddSubtask={onAddSubtask}
              onApprove={onApprove}
              onDelete={onDelete}
              onEdit={onEdit}
              onManualRealization={onManualRealization}
              onRealization={onRealization}
            />
          </div>
        </td>
      </tr>
      {hasChildren && expanded.has(task.id)
        ? task.children.map((child) => (
            <TaskRow
              key={child.id}
              task={child}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              expanded={expanded}
              onToggle={onToggle}
              onApprove={onApprove}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              onRealization={onRealization}
              onManualRealization={onManualRealization}
            />
          ))
        : null}
    </>
  );
}

// Tabel task bertingkat yang bisa expand/collapse.
function TaskTree({ tasks = [], onApprove, onEdit, onDelete, onAddSubtask, onRealization, onManualRealization }) {
  const [expanded, setExpanded] = useState(new Set());
  const currentUserId = useUiStore((state) => state.currentUserId);
  const currentUserRole = useUiStore((state) => state.currentUser?.role);

  // Membuka atau menutup cabang subtask tertentu.
  const toggle = (taskId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  if (!tasks.length) {
    return <div className="empty-state">Belum ada task untuk ditampilkan.</div>;
  }

  return (
    <div className="table-shell">
      <div className="table-scroll-visible">
        <table className="data-table task-list-table min-w-[1240px]">
          <thead>
            <tr>
              <th>Task</th>
              <th>PIC</th>
              <th>Lead</th>
              <th>Start</th>
              <th>End</th>
              <th className="w-20 text-center">Duration</th>
              <th className="w-24 text-center">Work Days</th>
              <th className="w-36">Progress</th>
              <th className="w-24">Priority</th>
              <th className="sticky right-0 z-30 w-[170px] bg-slate-50 text-right shadow-[-8px_0_12px_rgba(15,23,42,0.04)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                expanded={expanded}
                onToggle={toggle}
                onApprove={onApprove}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
                onRealization={onRealization}
                onManualRealization={onManualRealization}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TaskTree;
