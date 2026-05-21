import { getBarPosition } from '../../logic/helpers/ganttHelper';
import { getRealizationModeLabel } from '../../logic/helpers/realizationHelper';
import { getStatusBarColor } from '../../logic/helpers/statusHelper';

// Satu baris timeline task di Gantt, termasuk rencana dan realisasi.
function GanttRow({ task, timelineStart, viewMode, unitWidth = 112, onTaskClick }) {
  const planPosition = getBarPosition(task, timelineStart, viewMode, { unitWidth });
  const actualPosition = getBarPosition(task, timelineStart, viewMode, {
    startKey: 'actual_start_date',
    endKey: 'actual_end_date',
    fallbackEnd: task.actual_start_date && !task.actual_end_date ? new Date() : null,
    unitWidth,
  });
  const hasActual = Boolean(task.actual_start_date);
  const realizationModeLabel = getRealizationModeLabel(task.realization_mode);
  const actualBarClassName =
    task.realization_mode === 'manual'
      ? 'bg-amber-500'
      : task.actual_end_date
        ? 'bg-success'
        : 'bg-primary';
  const planLaneClassName = hasActual ? 'top-4 h-2' : 'top-6 h-3';
  const compactActualLabel = actualPosition.width < 96;
  const actualLabel = compactActualLabel
    ? task.realization_mode === 'manual'
      ? 'Manual'
      : 'Actual'
    : `${realizationModeLabel} ${task.actual_end_date ? 'done' : 'ongoing'}`;

  return (
    <div className="relative h-16 border-b border-border bg-white" style={{ width: '100%', minWidth: '100%' }}>
      {task.isProjectGroup ? (
        <div className="absolute inset-x-0 top-8 h-1 rounded-full bg-slate-200" />
      ) : planPosition.hidden && actualPosition.hidden ? (
        <div className="px-3 py-5 text-xs text-text-muted">No dates</div>
      ) : (
        <>
          {!planPosition.hidden ? (
            <button
              type="button"
              className={`absolute z-0 overflow-hidden rounded-full bg-slate-300 text-left ${planLaneClassName}`}
              style={{
                left: planPosition.left,
                width: planPosition.width,
              }}
              onClick={() => onTaskClick?.(task)}
              aria-label={`Plan ${task.title}`}
              title={`Plan: ${task.title}`}
            >
              <span className="absolute inset-y-0 left-0 opacity-80" style={{ width: `${task.progress || 0}%`, backgroundColor: getStatusBarColor(task.status) }} />
            </button>
          ) : null}

          {hasActual && !actualPosition.hidden ? (
            <button
              type="button"
              className={`absolute bottom-3 z-10 h-5 overflow-hidden rounded-full text-left text-[11px] font-bold text-white shadow-sm ${actualBarClassName}`}
              style={{
                left: actualPosition.left,
                width: actualPosition.width,
              }}
              onClick={() => onTaskClick?.(task)}
              title={`Actual ${realizationModeLabel}: ${task.title}${task.actual_end_date ? '' : ' - ongoing'}`}
            >
              <span className="block truncate px-2 leading-5">{actualLabel}</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default GanttRow;
