import { useDraggable } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { countSubtasks } from '../../logic/helpers/taskTreeHelper';
import { getPriorityBadgeClass, getProgressBarClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskDisplayKey } from '../../logic/helpers/taskDisplayHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';
import { getBoardConfig } from '../../logic/services/boardConfigStorage';
import SyncStatusBadge from '../shared/SyncStatusBadge';
import IssueTypeBadge from './IssueTypeBadge';

const PRIORITY_COLORS = {
  Low: '#22C55E',
  Medium: '#F59E0B',
  High: '#EF4444',
  Urgent: '#7F1D1D',
};

const STATUS_COLORS = {
  Done: '#16A34A',
  'In Progress': '#2563EB',
  'Waiting Review': '#D97706',
  'Not Started': '#64748B',
  Overdue: '#DC2626',
};

const getCardAccentColor = (task, colorMode) => {
  if (colorMode === 'issue_type') {
    return task.issue_type_color || '#64748B';
  }

  if (colorMode === 'status') {
    return STATUS_COLORS[task.status] || '#64748B';
  }

  return PRIORITY_COLORS[task.priority] || '#64748B';
};

// Kartu task yang tampil di board dan bisa dipakai sebagai item drag.
function TaskCard({ task, onClick, draggable = false, selected = false, syncStatus = null }) {
  const [boardConfig, setBoardConfig] = useState(() => getBoardConfig(task.project_id));
  const drag = useDraggable({
    id: String(task.id),
    disabled: !draggable,
  });
  const subtaskCount = countSubtasks(task);
  const taskDisplayKey = getTaskDisplayKey(task);
  const visibleFields = useMemo(() => new Set(boardConfig.card_fields || []), [boardConfig.card_fields]);
  const showField = (field) => visibleFields.has(field);
  const cardStyle = {
    borderLeftColor: getCardAccentColor(task, boardConfig.card_color_mode),
    borderLeftWidth: 4,
    ...(drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : {}),
  };

  useEffect(() => {
    const handleConfigChange = (event) => {
      if (!event.detail?.projectId || Number(event.detail.projectId) === Number(task.project_id)) {
        setBoardConfig(getBoardConfig(task.project_id));
      }
    };

    window.addEventListener('board-config-updated', handleConfigChange);

    return () => {
      window.removeEventListener('board-config-updated', handleConfigChange);
    };
  }, [task.project_id]);

  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      className={[
        'w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/20',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
      ].join(' ')}
      style={cardStyle}
      {...drag.listeners}
      {...drag.attributes}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
            {showField('issue_type') ? (
              <IssueTypeBadge
                color={task.issue_type_color}
                icon={task.issue_type_icon}
                name={task.issue_type_name}
              />
            ) : null}
            {showField('issue_key') && taskDisplayKey ? <span className="truncate text-[11px] font-bold text-text-muted">{taskDisplayKey}</span> : null}
          </div>
          <h4 className="font-semibold leading-snug text-text-dark">{task.title}</h4>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <SyncStatusBadge status={syncStatus} />
          {showField('priority') ? <span className={`badge ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {showField('status') ? <span className={`badge ${getStatusBadgeClass(task.status)}`}>{task.status}</span> : null}
        {showField('subtasks') && subtaskCount ? <span className="badge bg-slate-100 text-slate-700">{subtaskCount} subtasks</span> : null}
        {showField('checklist') && task.checklist_total ? (
          <span className="badge bg-slate-100 text-slate-700">
            {task.checklist_completed || 0}/{task.checklist_total} checklist
          </span>
        ) : null}
      </div>

      {showField('labels') && task.labels?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label.id} className={`badge px-1.5 py-0.5 text-[10px] ${getTaskLabelBadgeClass(label.color)}`}>
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 ? <span className="badge px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700">+{task.labels.length - 3}</span> : null}
        </div>
      ) : null}

      {showField('epic') && task.epic_name ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-2 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="truncate text-text-dark">{task.epic_name}</span>
            <span className="text-text-muted">{task.epic_progress ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: task.epic_color || '#7C3AED', width: `${task.epic_progress ?? 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {showField('assignee') || showField('lead') || showField('due_date') ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
          {showField('assignee') ? (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-text-dark">{getTaskAssigneeNames(task)}</span>
              <p>PIC</p>
            </div>
          ) : null}
          {showField('lead') ? (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-text-dark">{getTaskLeadName(task)}</span>
              <p>Lead</p>
            </div>
          ) : null}
          {showField('due_date') ? (
            <div className="min-w-0">
              <span className="font-semibold text-text-dark">{formatDate(task.end_date, 'dd MMM')}</span>
              <p>Due date</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showField('progress') ? <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span>Progress</span>
          <span>{task.progress || 0}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${getProgressBarClass(task)}`} style={{ width: `${task.progress || 0}%` }} />
        </div>
      </div> : null}
    </button>
  );
}

export default TaskCard;
