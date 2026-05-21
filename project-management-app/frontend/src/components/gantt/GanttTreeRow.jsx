import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';

// Baris kiri Gantt yang menampilkan nama task dan tombol expand/collapse.
function GanttTreeRow({ task, collapsed, onSelect, onToggle }) {
  const hasChildren = Boolean(task.children?.length);

  return (
    <div className="relative z-50 flex h-16 items-center border-b border-border bg-white px-3 text-sm" style={{ paddingLeft: `${12 + (task.level || 0) * 18}px` }}>
      <button
        className="mr-2 h-6 w-6 shrink-0 rounded-md border border-border text-xs"
        disabled={!hasChildren}
        type="button"
        onClick={() => onToggle(task.id)}
      >
        {hasChildren ? (collapsed.has(task.id) ? '+' : '-') : ''}
      </button>
      <button
        className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-primary/20"
        disabled={task.isProjectGroup}
        type="button"
        onClick={() => onSelect?.(task)}
      >
        <p className={task.isProjectGroup || hasChildren ? 'truncate font-bold text-text-dark' : 'truncate font-semibold text-text-dark'}>
          {task.title}
        </p>
        {!task.isProjectGroup ? (
          <p className="truncate text-xs text-text-muted">
            PIC: {getTaskAssigneeNames(task)} | Lead: {getTaskLeadName(task)}
          </p>
        ) : null}
      </button>
    </div>
  );
}

export default GanttTreeRow;
