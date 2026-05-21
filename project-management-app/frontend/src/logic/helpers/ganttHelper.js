import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  format,
  max,
  min,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { parseDateSafe } from './dateHelper';
import { flattenTaskTree } from './taskTreeHelper';

// Menentukan tanggal awal dan akhir Gantt dari seluruh task yang tampil.
export const getGanttDateRange = (tasks = [], fallbackStart = new Date(), fallbackEnd = addDays(new Date(), 30)) => {
  const flattened = flattenTaskTree(tasks);
  const starts = flattened.flatMap((task) => [parseDateSafe(task.start_date), parseDateSafe(task.actual_start_date)]).filter(Boolean);
  const ends = flattened
    .flatMap((task) => [parseDateSafe(task.end_date), parseDateSafe(task.actual_end_date), task.actual_start_date && !task.actual_end_date ? new Date() : null])
    .filter(Boolean);

  if (!starts.length || !ends.length) {
    return {
      start: fallbackStart,
      end: fallbackEnd,
    };
  }

  return {
    start: min(starts),
    end: max(ends),
  };
};

// Membuat unit timeline mingguan atau bulanan untuk header Gantt.
export const buildTimelineUnits = (start, end, viewMode = 'week') => {
  if (viewMode === 'month') {
    return eachMonthOfInterval({
      start: startOfMonth(start),
      end: endOfMonth(end),
  }).map((date) => ({
      date,
      label: format(date, 'MMM yyyy'),
    }));
  }

  return eachWeekOfInterval(
    {
      start: startOfWeek(start, { weekStartsOn: 1 }),
      end,
    },
    { weekStartsOn: 1 },
  ).map((date) => ({
    date,
    label: `${format(date, 'dd MMM')} - ${format(addDays(date, 6), 'dd MMM')}`,
    subLabel: format(date, 'yyyy'),
  }));
};

// Menghitung posisi kiri dan lebar bar task di area timeline Gantt.
export const getBarPosition = (task, timelineStart, viewMode = 'week', options = {}) => {
  const start = parseDateSafe(task[options.startKey || 'start_date']);
  const end = parseDateSafe(task[options.endKey || 'end_date']) || parseDateSafe(options.fallbackEnd);
  const unitDays = viewMode === 'month' ? 30 : 7;
  const unitWidth = options.unitWidth || 112;

  if (!start || !end) {
    return {
      left: 0,
      width: unitWidth,
      hidden: true,
    };
  }

  const offsetDays = Math.max(0, differenceInCalendarDays(start, timelineStart));
  const durationDays = Math.max(1, differenceInCalendarDays(end, start) + 1);

  return {
    left: (offsetDays / unitDays) * unitWidth,
    width: Math.max(42, (durationDays / unitDays) * unitWidth),
    hidden: false,
  };
};

// Mengubah sebuah tanggal menjadi jarak pixel dari awal timeline.
export const getTimelineDateOffset = (date, timelineStart, viewMode = 'week', unitWidth = 112) => {
  const unitDays = viewMode === 'month' ? 30 : 7;

  return (differenceInCalendarDays(date, timelineStart) / unitDays) * unitWidth;
};
