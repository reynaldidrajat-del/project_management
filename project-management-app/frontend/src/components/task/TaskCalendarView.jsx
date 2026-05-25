import {
  addMonths,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useMemo, useState } from 'react';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { getPriorityBadgeClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskAssigneeNames } from '../../logic/helpers/taskPeopleHelper';

const MAX_VISIBLE_TASKS_PER_DAY = 4;
const PRIORITY_ORDER = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = typeof value === 'string' ? parseISO(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTaskDueDate = (task) => parseDate(task.end_date || task.start_date);

const isTaskDone = (task) => (task.raw_status || task.status) === 'Done' || Number(task.progress || 0) >= 100;

const getTaskAccentClass = (task) => {
  if (isTaskDone(task)) {
    return 'border-l-green-500 bg-green-50/80 hover:bg-green-50';
  }

  if (task.status === 'Overdue') {
    return 'border-l-red-500 bg-red-50/80 hover:bg-red-50';
  }

  if (task.priority === 'Urgent' || task.priority === 'High') {
    return 'border-l-amber-500 bg-amber-50/80 hover:bg-amber-50';
  }

  return 'border-l-primary bg-blue-50/70 hover:bg-blue-50';
};

const sortTasksByDueAndPriority = (firstTask, secondTask) => {
  const firstDate = getTaskDueDate(firstTask);
  const secondDate = getTaskDueDate(secondTask);

  if (firstDate && secondDate) {
    const dateDifference = compareAsc(firstDate, secondDate);

    if (dateDifference !== 0) {
      return dateDifference;
    }
  }

  if (firstDate && !secondDate) {
    return -1;
  }

  if (!firstDate && secondDate) {
    return 1;
  }

  const priorityDifference = (PRIORITY_ORDER[firstTask.priority] ?? 99) - (PRIORITY_ORDER[secondTask.priority] ?? 99);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return String(firstTask.title || '').localeCompare(String(secondTask.title || ''));
};

function CalendarTaskChip({ task, compact = false, onTaskClick }) {
  return (
    <button
      className={[
        'w-full rounded-md border border-border border-l-4 px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/20',
        getTaskAccentClass(task),
      ].join(' ')}
      type="button"
      onClick={() => onTaskClick?.(task)}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className={['min-w-0 flex-1 truncate text-xs font-bold text-text-dark', compact ? 'leading-4' : 'leading-5'].join(' ')}>
          {task.title}
        </p>
        <span className="shrink-0 text-[11px] font-bold text-text-muted">{task.progress || 0}%</span>
      </div>
      {!compact ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <span className={`badge px-1.5 py-0.5 text-[10px] ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
          <span className={`badge px-1.5 py-0.5 text-[10px] ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
          {task.labels?.slice(0, 2).map((label) => (
            <span key={label.id} className={`badge px-1.5 py-0.5 text-[10px] ${getTaskLabelBadgeClass(label.color)}`}>
              {label.name}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function TaskAgendaList({ title, subtitle, tasks = [], emptyText, onTaskClick }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-text-dark">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-text-muted">{subtitle}</p> : null}
      </div>
      <div className="space-y-2">
        {tasks.length ? (
          tasks.map((task) => (
            <button
              key={task.id}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-left transition hover:border-primary/40 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              type="button"
              onClick={() => onTaskClick?.(task)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-dark">{task.title}</p>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {formatDate(task.end_date || task.start_date)} - {getTaskAssigneeNames(task)}
                  </p>
                </div>
                <span className={`badge shrink-0 ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
              </div>
            </button>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-4 text-sm text-text-muted">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

// Calendar task dengan month grid, selected-day agenda, ringkasan beban, dan unscheduled tasks.
function TaskCalendarView({ tasks = [], onTaskClick }) {
  const today = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [viewMode, setViewMode] = useState('month');
  const flattenedTasks = useMemo(() => flattenTaskTree(tasks).sort(sortTasksByDueAndPriority), [tasks]);
  const scheduledTasks = useMemo(() => flattenedTasks.filter((task) => getTaskDueDate(task)), [flattenedTasks]);
  const unscheduledTasks = useMemo(() => flattenedTasks.filter((task) => !getTaskDueDate(task)), [flattenedTasks]);
  const visibleDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [currentMonth]);

  const tasksByDayKey = useMemo(() => {
    return scheduledTasks.reduce((result, task) => {
      const dueDate = getTaskDueDate(task);
      const key = format(dueDate, 'yyyy-MM-dd');
      result.set(key, [...(result.get(key) || []), task]);
      return result;
    }, new Map());
  }, [scheduledTasks]);

  const selectedDayTasks = tasksByDayKey.get(format(selectedDay, 'yyyy-MM-dd')) || [];
  const overdueTasks = scheduledTasks.filter((task) => {
    const dueDate = getTaskDueDate(task);
    return dueDate && isBefore(dueDate, today) && !isTaskDone(task);
  });
  const monthTasks = scheduledTasks.filter((task) => {
    const dueDate = getTaskDueDate(task);
    return dueDate && isSameMonth(dueDate, currentMonth);
  });
  const busiestDay = visibleDays
    .filter((day) => isSameMonth(day, currentMonth))
    .map((day) => ({ day, count: tasksByDayKey.get(format(day, 'yyyy-MM-dd'))?.length || 0 }))
    .sort((firstDay, secondDay) => secondDay.count - firstDay.count)[0];

  const goToToday = () => {
    setCurrentMonth(startOfMonth(today));
    setSelectedDay(today);
  };

  const moveMonth = (monthOffset) => {
    const nextMonth = startOfMonth(monthOffset > 0 ? addMonths(currentMonth, monthOffset) : subMonths(currentMonth, Math.abs(monthOffset)));
    setCurrentMonth(nextMonth);
    setSelectedDay(nextMonth);
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);

    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(startOfMonth(day));
    }
  };

  const agendaTasks = viewMode === 'agenda' ? [...scheduledTasks].slice(0, 60) : selectedDayTasks;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="info-tile bg-white">
          <p className="label">This Month</p>
          <p className="mt-2 text-2xl font-bold text-text-dark">{monthTasks.length}</p>
          <p className="mt-1 text-xs text-text-muted">Task with due date in {format(currentMonth, 'MMMM yyyy')}</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Overdue</p>
          <p className="mt-2 text-2xl font-bold text-danger">{overdueTasks.length}</p>
          <p className="mt-1 text-xs text-text-muted">Unfinished tasks before today</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Unscheduled</p>
          <p className="mt-2 text-2xl font-bold text-text-dark">{unscheduledTasks.length}</p>
          <p className="mt-1 text-xs text-text-muted">Tasks without start or end date</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Busiest Day</p>
          <p className="mt-2 text-2xl font-bold text-text-dark">{busiestDay?.count || 0}</p>
          <p className="mt-1 text-xs text-text-muted">{busiestDay?.count ? formatDate(busiestDay.day) : 'No scheduled task'}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-text-dark">Task Calendar</h2>
            <p className="mt-1 text-sm text-text-muted">Due-date calendar with selected-day agenda and unscheduled task visibility.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" type="button" onClick={goToToday}>
              Today
            </button>
            <div className="segmented-control">
              <button
                className={['segmented-control-button', viewMode === 'month' ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100'].join(' ')}
                type="button"
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
              <button
                className={['segmented-control-button', viewMode === 'agenda' ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100'].join(' ')}
                type="button"
                onClick={() => setViewMode('agenda')}
              >
                Agenda
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Previous month"
                className="btn-secondary h-10 w-10 px-0"
                type="button"
                onClick={() => moveMonth(-1)}
              >
                &lt;
              </button>
              <span className="min-w-36 text-center text-sm font-bold text-text-dark">{format(currentMonth, 'MMMM yyyy')}</span>
              <button
                aria-label="Next month"
                className="btn-secondary h-10 w-10 px-0"
                type="button"
                onClick={() => moveMonth(1)}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          {viewMode === 'month' ? (
            <div className="min-w-0">
              <div className="hidden grid-cols-7 border-b border-border bg-slate-50 text-xs font-bold uppercase tracking-wide text-text-muted md:grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
                  <div key={dayName} className="px-3 py-2">
                    {dayName}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-7">
                {visibleDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDayKey.get(dayKey) || [];
                  const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS_PER_DAY);
                  const hiddenTaskCount = Math.max(0, dayTasks.length - visibleTasks.length);
                  const selected = isSameDay(day, selectedDay);
                  const currentMonthDay = isSameMonth(day, currentMonth);
                  const dayIsToday = isToday(day);

                  return (
                    <section
                      key={dayKey}
                      className={[
                        'min-h-[168px] border-b border-border p-2 md:border-r',
                        currentMonthDay ? 'bg-white' : 'bg-slate-50/70',
                        selected ? 'ring-2 ring-inset ring-primary/30' : '',
                      ].join(' ')}
                    >
                      <button
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition hover:bg-slate-100"
                        type="button"
                        onClick={() => handleSelectDay(day)}
                      >
                        <span className="md:hidden text-xs font-bold uppercase text-text-muted">{format(day, 'EEE')}</span>
                        <span
                          className={[
                            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                            dayIsToday ? 'bg-primary text-white' : currentMonthDay ? 'text-text-dark' : 'text-slate-400',
                          ].join(' ')}
                        >
                          {format(day, 'd')}
                        </span>
                        <span className="badge bg-slate-100 text-slate-700">{dayTasks.length}</span>
                      </button>
                      <div className="space-y-1.5">
                        {visibleTasks.map((task) => (
                          <CalendarTaskChip key={task.id} compact task={task} onTaskClick={onTaskClick} />
                        ))}
                        {hiddenTaskCount ? (
                          <button
                            className="w-full rounded-md bg-slate-100 px-2 py-1 text-left text-xs font-bold text-text-muted transition hover:bg-slate-200"
                            type="button"
                            onClick={() => handleSelectDay(day)}
                          >
                            +{hiddenTaskCount} more
                          </button>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="min-w-0 border-b border-border p-4 lg:border-b-0 lg:border-r">
              <TaskAgendaList
                emptyText="Tidak ada task terjadwal."
                subtitle="Sorted by due date. Use filters above to narrow the workload."
                tasks={agendaTasks}
                title="Agenda"
                onTaskClick={onTaskClick}
              />
            </div>
          )}

          <aside className="bg-slate-50 p-4">
            <div className="space-y-5">
              <TaskAgendaList
                emptyText="Tidak ada task pada tanggal ini."
                subtitle={formatDate(selectedDay)}
                tasks={selectedDayTasks}
                title="Selected Day"
                onTaskClick={onTaskClick}
              />
              <TaskAgendaList
                emptyText="Semua task sudah memiliki tanggal."
                subtitle="Tambahkan start/end date agar task masuk calendar."
                tasks={unscheduledTasks.slice(0, 8)}
                title="Unscheduled Tasks"
                onTaskClick={onTaskClick}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default TaskCalendarView;
