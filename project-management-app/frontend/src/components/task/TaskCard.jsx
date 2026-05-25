import { useDraggable } from '@dnd-kit/core';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { countSubtasks } from '../../logic/helpers/taskTreeHelper';
import { getPriorityBadgeClass, getProgressBarClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';

// Kartu task yang tampil di board dan bisa dipakai sebagai item drag.
function TaskCard({ task, onClick, draggable = false }) {
  const drag = useDraggable({
    id: String(task.id),
    disabled: !draggable,
  });
  const subtaskCount = countSubtasks(task);

  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      className="w-full rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/20"
      style={drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined}
      {...drag.listeners}
      {...drag.attributes}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold leading-snug text-text-dark">{task.title}</h4>
        <span className={`badge shrink-0 ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`badge ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
        {subtaskCount ? <span className="badge bg-slate-100 text-slate-700">{subtaskCount} subtasks</span> : null}
        {task.checklist_total ? (
          <span className="badge bg-slate-100 text-slate-700">
            {task.checklist_completed || 0}/{task.checklist_total} checklist
          </span>
        ) : null}
      </div>

      {task.labels?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label.id} className={`badge px-1.5 py-0.5 text-[10px] ${getTaskLabelBadgeClass(label.color)}`}>
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 ? <span className="badge px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700">+{task.labels.length - 3}</span> : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
        <div className="min-w-0">
          <span className="block truncate font-semibold text-text-dark">{getTaskAssigneeNames(task)}</span>
          <p>PIC</p>
        </div>
        <div className="min-w-0">
          <span className="block truncate font-semibold text-text-dark">{getTaskLeadName(task)}</span>
          <p>Lead</p>
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-text-dark">{formatDate(task.end_date, 'dd MMM')}</span>
          <p>Due date</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span>Progress</span>
          <span>{task.progress || 0}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${getProgressBarClass(task)}`} style={{ width: `${task.progress || 0}%` }} />
        </div>
      </div>
    </button>
  );
}

export default TaskCard;
