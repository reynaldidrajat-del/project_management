import { format, startOfMonth, startOfWeek } from 'date-fns';
import { useRef, useState } from 'react';

import { buildTimelineUnits, getBarPosition, getGanttDateRange, getTimelineDateOffset } from '../../logic/helpers/ganttHelper';
import Modal from '../shared/Modal';
import GanttQuickResume from './GanttQuickResume';
import GanttRow from './GanttRow';
import GanttTimelineHeader from './GanttTimelineHeader';
import GanttTreeRow from './GanttTreeRow';

// Lebar satu unit timeline dalam pixel.
const UNIT_WIDTH = 112;
const LEFT_COLUMN_WIDTH = 360;
const TIMELINE_HEADER_HEIGHT = 64;
const TIMELINE_ROW_HEIGHT = 64;

// Menggeser level task saat task dimasukkan ke dalam grup project.
const shiftLevels = (task, offset) => ({
  ...task,
  level: (task.level || 0) + offset,
  children: (task.children || []).map((child) => shiftLevels(child, offset)),
});

// Menentukan tanggal mulai grup project dari data project atau child task pertama.
const getProjectGroupStartDate = (group) => {
  const groupDate = group.start_date || group.children?.find((task) => task.start_date)?.start_date;
  const parsedDate = groupDate ? new Date(groupDate) : null;

  return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Number.POSITIVE_INFINITY;
};

// Membentuk baris Gantt agar task bisa dikelompokkan per project.
const normalizeRowsForProjectGroups = (tasks, projectGroups = []) => {
  const projectMap = new Map();

  projectGroups.forEach((project) => {
    const projectId = project.id || 'no-project';
    projectMap.set(projectId, {
      id: `project-${projectId}`,
      title: project.name || 'No Project',
      start_date: project.start_date || null,
      isProjectGroup: true,
      level: 0,
      children: [],
    });
  });

  tasks.forEach((task) => {
    const projectId = task.project_id || 'no-project';
    const group = projectMap.get(projectId) || {
      id: `project-${projectId}`,
      title: task.project_name || 'No Project',
      start_date: task.project_start_date || task.start_date || null,
      isProjectGroup: true,
      level: 0,
      children: [],
    };

    if (!group.start_date && task.start_date) {
      group.start_date = task.start_date;
    }

    group.children.push(shiftLevels(task, 1));
    projectMap.set(projectId, group);
  });

  return Array.from(projectMap.values()).sort((firstGroup, secondGroup) => {
    const dateDifference = getProjectGroupStartDate(firstGroup) - getProjectGroupStartDate(secondGroup);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return firstGroup.title.localeCompare(secondGroup.title);
  });
};

// Mengubah task tree menjadi daftar baris yang terlihat, sesuai state collapsed.
const buildVisibleRows = (tasks, collapsed) => {
  const rows = [];

  // Menelusuri task tree dan hanya memasukkan baris yang tidak sedang collapsed.
  const walk = (items) => {
    items.forEach((task) => {
      rows.push(task);

      if (!collapsed.has(task.id)) {
        walk(task.children || []);
      }
    });
  };

  walk(tasks);
  return rows;
};

// Komponen utama Gantt yang menggambar tree kiri dan timeline kanan.
function GanttChart({ projectGroups = [], quickResumeScopeLabel = 'All projects', tasks = [], viewMode = 'week', groupByProject = false, onTaskClick }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const [quickResumeOpen, setQuickResumeOpen] = useState(false);
  const chartScrollRef = useRef(null);
  const floatingScrollRef = useRef(null);
  const syncSourceRef = useRef(null);
  const groupedTasks = groupByProject ? normalizeRowsForProjectGroups(tasks, projectGroups) : tasks;
  const rows = buildVisibleRows(groupedTasks, collapsed);
  const range = getGanttDateRange(tasks);
  const timelineStart = viewMode === 'month' ? startOfMonth(range.start) : startOfWeek(range.start, { weekStartsOn: 1 });
  const units = buildTimelineUnits(range.start, range.end, viewMode);
  const timelineWidth = Math.max(units.length * UNIT_WIDTH, UNIT_WIDTH * 4);
  const timelineContentHeight = TIMELINE_HEADER_HEIGHT + rows.length * TIMELINE_ROW_HEIGHT;
  const timelineRangeLabel = `${format(range.start, 'dd MMM yyyy')} - ${format(range.end, 'dd MMM yyyy')}`;
  const scrollContentWidth = LEFT_COLUMN_WIDTH + timelineWidth;
  const today = new Date();
  const todayOffset = getTimelineDateOffset(today, timelineStart, viewMode, UNIT_WIDTH);
  const showTodayMarker = todayOffset >= 0 && todayOffset <= timelineWidth;
  const todayLabelAlignClass = todayOffset > timelineWidth - 96 ? '-translate-x-full' : '-translate-x-1/2';

  // Membuka atau menutup cabang task pada Gantt.
  const toggle = (taskId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Menyamakan scroll horizontal antara header dan body timeline.
  const syncHorizontalScroll = (source, scrollLeft) => {
    if (syncSourceRef.current && syncSourceRef.current !== source) {
      return;
    }

    syncSourceRef.current = source;

    const target = source === 'main' ? floatingScrollRef.current : chartScrollRef.current;

    if (target && target.scrollLeft !== scrollLeft) {
      target.scrollLeft = scrollLeft;
    }

    window.requestAnimationFrame(() => {
      syncSourceRef.current = null;
    });
  };

  // Membawa scroll ke bar task tertentu saat task dipilih dari tree kiri.
  const focusTaskBar = (task) => {
    if (!task || task.isProjectGroup) {
      return;
    }

    const planPosition = getBarPosition(task, timelineStart, viewMode, { unitWidth: UNIT_WIDTH });
    const actualPosition = getBarPosition(task, timelineStart, viewMode, {
      startKey: 'actual_start_date',
      endKey: 'actual_end_date',
      fallbackEnd: task.actual_start_date && !task.actual_end_date ? new Date() : null,
      unitWidth: UNIT_WIDTH,
    });
    const targetPosition = !actualPosition.hidden ? actualPosition : planPosition;

    if (targetPosition.hidden) {
      return;
    }

    const chartScroll = chartScrollRef.current;
    const floatingScroll = floatingScrollRef.current;

    if (!chartScroll) {
      return;
    }

    const visibleTimelineWidth = Math.max(UNIT_WIDTH, chartScroll.clientWidth - LEFT_COLUMN_WIDTH);
    const targetCenter = targetPosition.left + targetPosition.width / 2;
    const maxScrollLeft = Math.max(0, scrollContentWidth - chartScroll.clientWidth);
    const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetCenter - visibleTimelineWidth / 2));

    chartScroll.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });

    if (floatingScroll) {
      floatingScroll.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
    }
  };

  // Membuka detail task ketika bar timeline diklik.
  const handleTaskBarClick = (task) => {
    focusTaskBar(task);
    onTaskClick?.(task);
  };

  if (!tasks.length && !projectGroups.length) {
    return <div className="empty-state">Belum ada task bertanggal untuk Gantt.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
        <div>
          <p className="page-kicker">Gantt Timeline</p>
          <p className="text-sm font-semibold text-text-dark">{timelineRangeLabel}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-5 rounded-full bg-slate-300" />
              Plan baseline
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-5 rounded-full bg-primary" />
              Actual ongoing
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-5 rounded-full bg-success" />
              Actual done
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-5 rounded-full bg-amber-500" />
              Manual actual
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" type="button" onClick={() => setQuickResumeOpen(true)}>
            Quick Resume
          </button>
          <span className="badge bg-blue-100 text-blue-700">{viewMode === 'month' ? 'Monthly view' : 'Weekly view'}</span>
        </div>
      </div>
      <div
        ref={chartScrollRef}
        className="gantt-scroll-main flex max-h-[calc(100vh-220px)] overflow-x-hidden overflow-y-auto pb-4"
        onScroll={(event) => syncHorizontalScroll('main', event.currentTarget.scrollLeft)}
      >
        <div className="sticky left-0 z-50 shrink-0 border-r border-border bg-white" style={{ width: LEFT_COLUMN_WIDTH }}>
          <div
            className="sticky top-0 z-50 flex items-center border-b border-border bg-white px-3 text-xs font-bold uppercase tracking-wide text-text-muted"
            style={{ height: TIMELINE_HEADER_HEIGHT }}
          >
            Task / PIC
          </div>
          {rows.map((task) => (
            <GanttTreeRow key={task.id} task={task} collapsed={collapsed} onSelect={focusTaskBar} onToggle={toggle} />
          ))}
        </div>
        <div className="relative z-0 shrink-0" style={{ width: timelineWidth, minHeight: timelineContentHeight }}>
          <GanttTimelineHeader height={TIMELINE_HEADER_HEIGHT} units={units} unitWidth={UNIT_WIDTH} />
          {rows.map((task) => (
            <GanttRow
              key={task.id}
              task={task}
              timelineStart={timelineStart}
              unitWidth={UNIT_WIDTH}
              viewMode={viewMode}
              onTaskClick={handleTaskBarClick}
            />
          ))}
          {showTodayMarker ? (
            <div className="pointer-events-none absolute top-0 z-[70] w-px bg-danger/80" style={{ left: todayOffset, height: timelineContentHeight }}>
              <span
                className={`absolute left-1/2 top-2 whitespace-nowrap rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${todayLabelAlignClass}`}
              >
                Today {format(today, 'dd MMM')}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="sticky bottom-0 z-50 border-t border-border bg-white/95 px-3 py-2 shadow-[0_-8px_16px_rgba(15,23,42,0.06)] backdrop-blur">
        <div
          ref={floatingScrollRef}
          aria-label="Timeline horizontal scroll"
          className="gantt-floating-scroll overflow-x-auto overflow-y-hidden"
          onScroll={(event) => syncHorizontalScroll('floating', event.currentTarget.scrollLeft)}
        >
          <div className="h-1" style={{ width: scrollContentWidth }} />
        </div>
      </div>
      <Modal
        description="Ringkasan status jadwal dari task yang sedang tampil di Gantt."
        open={quickResumeOpen}
        size="2xl"
        title="Quick Resume"
        onClose={() => setQuickResumeOpen(false)}
      >
        <GanttQuickResume projectGroups={projectGroups} scopeLabel={quickResumeScopeLabel} showHeader={false} tasks={tasks} />
      </Modal>
    </div>
  );
}

export default GanttChart;
