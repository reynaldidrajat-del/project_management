import { differenceInCalendarDays, format, isAfter, isBefore, max, min, startOfDay } from 'date-fns';
import { useMemo, useState } from 'react';

import { formatDate, parseDateSafe } from '../../logic/helpers/dateHelper';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { getTaskAssigneeNames } from '../../logic/helpers/taskPeopleHelper';
import Modal from '../shared/Modal';

// Membatasi persentase agar selalu di antara 0 dan 100.
const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));

// Mengambil progress task sebagai angka aman.
const getTaskProgress = (task) => {
  const progress = Number(task.progress || 0);
  return Number.isFinite(progress) ? clampPercent(progress) : 0;
};

// Mengecek apakah task sudah selesai berdasarkan status atau progress.
const isTaskComplete = (task) => task.status === 'Done' || getTaskProgress(task) >= 100;

// Memberi bobot durasi task agar progress ringkasan lebih mencerminkan panjang pekerjaan.
const getDurationWeight = (task, startDate, endDate) => {
  const workDays = Number(task.work_days || 0);
  const durationDays = Number(task.duration_days || 0);

  if (Number.isFinite(workDays) && workDays > 0) {
    return workDays;
  }

  if (Number.isFinite(durationDays) && durationDays > 0) {
    return durationDays;
  }

  if (startDate && endDate) {
    return Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
  }

  return 1;
};

// Mengecek apakah task adalah task paling bawah tanpa child.
const isLeafTask = (task) => !task.children?.length;

// Mengambil mandays task dari work days atau duration days.
const getTaskMandays = (task) => {
  const workDays = Number(task.work_days || 0);
  const durationDays = Number(task.duration_days || 0);

  if (Number.isFinite(workDays) && workDays > 0) {
    return workDays;
  }

  return Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 0;
};

// Menjelaskan asal angka mandays yang dipakai.
const getTaskMandaySource = (task) => {
  const workDays = Number(task.work_days || 0);

  return Number.isFinite(workDays) && workDays > 0 ? 'Work days' : 'Duration days';
};

// Membuat fungsi pengurutan task berdasarkan tanggal tertentu.
const sortByDate = (dateKey) => (firstTask, secondTask) => {
  const firstDate = parseDateSafe(firstTask[dateKey]);
  const secondDate = parseDateSafe(secondTask[dateKey]);

  if (!firstDate || !secondDate) {
    return firstDate ? -1 : 1;
  }

  return firstDate.getTime() - secondDate.getTime();
};

// Menghapus duplikasi task berdasarkan id.
const getUniqueTasks = (tasks) => Array.from(new Map(tasks.map((task) => [task.id, task])).values());

// Menentukan key project untuk pengelompokan ringkasan.
const getProjectKey = (project, fallbackKey) => {
  const key = project.project_id || project.id || project.project_name || project.name;
  return key ? String(key) : fallbackKey;
};

// Mengambil rentang tanggal project dari data project group atau task.
const getProjectDateRange = (taskList, projectGroups = []) => {
  const projectDates = new Map();

  // Menyimpan tanggal project pertama yang ditemukan untuk satu project.
  const upsertProjectDate = (projectKey, startDateValue, endDateValue) => {
    const current = projectDates.get(projectKey) || {
      startDate: null,
      endDate: null,
    };

    projectDates.set(projectKey, {
      startDate: current.startDate || parseDateSafe(startDateValue),
      endDate: current.endDate || parseDateSafe(endDateValue),
    });
  };

  projectGroups.forEach((project, index) => {
    upsertProjectDate(getProjectKey(project, `project-group-${index}`), project.start_date, project.end_date);
  });

  taskList.forEach((task, index) => {
    upsertProjectDate(getProjectKey(task, `task-project-${index}`), task.project_start_date, task.project_end_date);
  });

  const projectDateList = Array.from(projectDates.values());
  const projectStarts = projectDateList.map((projectDate) => projectDate.startDate).filter(Boolean);
  const projectEnds = projectDateList.map((projectDate) => projectDate.endDate).filter(Boolean);

  return {
    endDate: projectEnds.length ? max(projectEnds) : null,
    projectCount: projectDates.size,
    startDate: projectStarts.length ? min(projectStarts) : null,
  };
};

// Menyimpulkan kondisi project berdasarkan waktu berjalan, overdue, dan progress.
const getHealthSummary = ({ elapsedPercent, overdueCount, totalTasks, completedTasks, weightedProgress }) => {
  if (!totalTasks) {
    return {
      label: 'Belum ada task',
      toneClass: 'bg-slate-100 text-slate-700',
    };
  }

  if (completedTasks === totalTasks) {
    return {
      label: 'Selesai',
      toneClass: 'bg-green-100 text-green-700',
    };
  }

  if (overdueCount > 0) {
    return {
      label: 'Butuh perhatian',
      toneClass: 'bg-red-100 text-red-700',
    };
  }

  if (elapsedPercent > 10 && weightedProgress + 10 < elapsedPercent) {
    return {
      label: 'Tertinggal waktu',
      toneClass: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    label: 'On track',
    toneClass: 'bg-blue-100 text-blue-700',
  };
};

// Membuat semua angka ringkasan cepat Gantt dari daftar task.
const buildQuickResume = (tasks, projectGroups = [], today = new Date()) => {
  const todayStart = startOfDay(today);
  const taskList = flattenTaskTree(tasks);
  const projectDateRange = getProjectDateRange(taskList, projectGroups);
  const starts = taskList.map((task) => parseDateSafe(task.start_date)).filter(Boolean);
  const ends = taskList.map((task) => parseDateSafe(task.end_date)).filter(Boolean);
  const startDate = starts.length ? min(starts) : null;
  const endDate = ends.length ? max(ends) : null;
  const hasRange = Boolean(startDate && endDate);
  const totalDurationDays = hasRange ? Math.max(1, differenceInCalendarDays(endDate, startDate) + 1) : 0;
  const elapsedDays = hasRange ? Math.min(totalDurationDays, Math.max(0, differenceInCalendarDays(todayStart, startDate) + 1)) : 0;
  const elapsedPercent = hasRange ? clampPercent((elapsedDays / totalDurationDays) * 100) : 0;
  const remainingDays = hasRange ? Math.max(0, differenceInCalendarDays(endDate, todayStart)) : 0;

  const progressTotals = taskList.reduce(
    (totals, task) => {
      const taskStart = parseDateSafe(task.start_date);
      const taskEnd = parseDateSafe(task.end_date);
      const weight = getDurationWeight(task, taskStart, taskEnd);

      return {
        weightedProgress: totals.weightedProgress + getTaskProgress(task) * weight,
        weight: totals.weight + weight,
      };
    },
    { weightedProgress: 0, weight: 0 },
  );
  const weightedProgress = progressTotals.weight ? clampPercent(progressTotals.weightedProgress / progressTotals.weight) : 0;
  const leafTasks = taskList.filter(isLeafTask);
  const mandayDetails = leafTasks
    .map((task) => ({
      assigneeNames: getTaskAssigneeNames(task),
      durationDays: Number(task.duration_days || 0),
      endDate: task.end_date,
      id: task.id,
      mandays: getTaskMandays(task),
      projectName: task.project_name,
      source: getTaskMandaySource(task),
      startDate: task.start_date,
      title: task.title,
      workDays: Number(task.work_days || 0),
    }))
    .sort((firstTask, secondTask) => {
      const startDifference = (firstTask.startDate || '').localeCompare(secondTask.startDate || '');

      if (startDifference !== 0) {
        return startDifference;
      }

      return firstTask.title.localeCompare(secondTask.title);
    });
  const mandays = mandayDetails.reduce((total, task) => total + task.mandays, 0);
  const mandaysByAssignee = Object.values(
    mandayDetails.reduce((totals, task) => {
      const key = task.assigneeNames || '-';
      const current = totals[key] || {
        assigneeNames: key,
        mandays: 0,
        taskCount: 0,
      };

      totals[key] = {
        ...current,
        mandays: current.mandays + task.mandays,
        taskCount: current.taskCount + 1,
      };

      return totals;
    }, {}),
  ).sort((firstAssignee, secondAssignee) => secondAssignee.mandays - firstAssignee.mandays || firstAssignee.assigneeNames.localeCompare(secondAssignee.assigneeNames));

  const completedTasks = taskList.filter(isTaskComplete);
  const activeTasks = taskList.filter((task) => {
    const taskStart = parseDateSafe(task.start_date);
    const taskEnd = parseDateSafe(task.end_date);

    return taskStart && taskEnd && !isTaskComplete(task) && !isAfter(taskStart, todayStart) && !isBefore(taskEnd, todayStart);
  });
  const overdueTasks = taskList.filter((task) => {
    const taskEnd = parseDateSafe(task.end_date);

    return !isTaskComplete(task) && (task.status === 'Overdue' || (taskEnd && isBefore(taskEnd, todayStart)));
  });
  const upcomingTasks = taskList.filter((task) => {
    const taskStart = parseDateSafe(task.start_date);

    return taskStart && !isTaskComplete(task) && isAfter(taskStart, todayStart);
  });
  const waitingReviewTasks = taskList.filter((task) => task.status === 'Waiting Review' && !isTaskComplete(task));
  const tasksWithoutCompleteDates = taskList.filter((task) => !task.start_date || !task.end_date);
  const focusTasks = getUniqueTasks([...overdueTasks.sort(sortByDate('end_date')), ...activeTasks.sort(sortByDate('end_date'))]).slice(0, 3);
  const nextTasks = upcomingTasks.sort(sortByDate('start_date')).slice(0, 3);
  const health = getHealthSummary({
    elapsedPercent,
    overdueCount: overdueTasks.length,
    totalTasks: taskList.length,
    completedTasks: completedTasks.length,
    weightedProgress,
  });

  return {
    activeTasks: activeTasks.length,
    completedTasks: completedTasks.length,
    elapsedDays,
    elapsedPercent,
    endDate,
    focusTasks,
    hasRange,
    health,
    mandays,
    mandayDetails,
    mandaysByAssignee,
    nextTasks,
    overdueTasks: overdueTasks.length,
    projectCount: projectDateRange.projectCount,
    projectEndDate: projectDateRange.endDate,
    projectStartDate: projectDateRange.startDate,
    remainingDays,
    startDate,
    tasksWithoutCompleteDates: tasksWithoutCompleteDates.length,
    today: todayStart,
    totalDurationDays,
    totalTasks: taskList.length,
    upcomingTasks: upcomingTasks.length,
    waitingReviewTasks: waitingReviewTasks.length,
    weightedProgress,
  };
};

// Progress bar kecil dengan label untuk ringkasan.
function AnimatedProgressBar({ label, value, hint, barClassName = 'bg-primary' }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-text-dark">{label}</span>
        <span className="font-semibold text-text-muted">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <div className={`quick-resume-fill h-full rounded-full ${barClassName}`} style={{ width: `${value}%` }} />
      </div>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

// Menampilkan perbandingan progress waktu dan progress pekerjaan.
function TimelineProgress({ summary }) {
  const todayMarker = `calc(${summary.elapsedPercent}% - 1px)`;

  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-text-dark">Start - Today - Upcoming</p>
          <p className="text-xs text-text-muted">
            {summary.elapsedDays} dari {summary.totalDurationDays} hari berjalan, {summary.remainingDays} hari tersisa
          </p>
        </div>
        <span className="text-xs font-bold text-primary">{summary.elapsedPercent}% timeline</span>
      </div>
      <div className="relative h-3 overflow-visible rounded-full bg-slate-200">
        <div className="quick-resume-fill h-full rounded-full bg-primary" style={{ width: `${summary.elapsedPercent}%` }} />
        <span className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-text-dark" style={{ left: todayMarker }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-semibold text-text-muted">
        <span>Start</span>
        <span className="text-center text-text-dark">Today</span>
        <span className="text-right">End</span>
      </div>
    </div>
  );
}

// Kartu angka ringkasan yang bisa diklik jika punya detail.
function ResumeStat({ label, value, toneClass = 'text-text-dark', onClick }) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={[
        'rounded-lg border border-border bg-white px-3 py-2 text-left',
        onClick ? 'transition hover:border-primary/40 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary/20' : '',
      ].join(' ')}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      <p className="text-xl font-bold text-text-dark">{value}</p>
      <p className={`text-xs font-semibold ${toneClass}`}>{label}</p>
    </Component>
  );
}

// Modal detail mandays per task agar user bisa melihat asal total mandays.
function MandaysDetailModal({ open, summary, onClose }) {
  return (
    <Modal
      description="Mandays dihitung dari leaf task yang tampil di Gantt. Nilai utama memakai work days; jika kosong, fallback ke duration days."
      open={open}
      size="2xl"
      title="Detail Perhitungan Mandays"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Total mandays</p>
            <p className="mt-1 text-2xl font-black text-text-dark">{summary.mandays}</p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Task dihitung</p>
            <p className="mt-1 text-2xl font-black text-text-dark">{summary.mandayDetails.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Formula</p>
            <p className="mt-1 text-sm font-semibold text-text-dark">SUM(leaf task work days)</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Summary per PIC</p>
          <div className="grid gap-2 md:grid-cols-2">
            {summary.mandaysByAssignee.map((row) => (
              <div key={row.assigneeNames} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-text-dark">{row.assigneeNames}</span>
                <span className="shrink-0 font-bold text-primary">
                  {row.mandays} mandays / {row.taskCount} task
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="table-shell">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>PIC</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="text-center">Work</th>
                  <th className="text-center">Duration</th>
                  <th className="text-center">Mandays</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {summary.mandayDetails.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <p className="max-w-[320px] truncate font-semibold">{task.title}</p>
                      {task.projectName ? <p className="text-xs text-text-muted">{task.projectName}</p> : null}
                    </td>
                    <td>{task.assigneeNames}</td>
                    <td>{formatDate(task.startDate)}</td>
                    <td>{formatDate(task.endDate)}</td>
                    <td className="text-center">{task.workDays}</td>
                    <td className="text-center">{task.durationDays}</td>
                    <td className="text-center font-bold text-primary">{task.mandays}</td>
                    <td>{task.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Ringkasan tanggal project, elapsed time, dan prediksi health.
function ProjectDateSummary({ summary }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Project schedule</p>
        <span className="text-xs font-semibold text-text-muted">{summary.projectCount > 1 ? `${summary.projectCount} projects` : 'Project'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-text-muted">Start Date</p>
          <p className="text-base font-bold text-text-dark">{formatDate(summary.projectStartDate)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted">End Date</p>
          <p className="text-base font-bold text-text-dark">{formatDate(summary.projectEndDate)}</p>
        </div>
      </div>
    </div>
  );
}

// Daftar preview task untuk overdue, upcoming, dan completed.
function TaskPreviewList({ emptyLabel, label, tasks, dateKey }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</p>
        <span className="text-xs font-semibold text-text-muted">{tasks.length}</span>
      </div>
      {tasks.length ? (
        <div className="space-y-2">
          {tasks.map((task) => {
            const taskDate = parseDateSafe(task[dateKey]);

            return (
              <div key={task.id} className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-text-dark">{task.title}</p>
                  <span className="shrink-0 text-xs font-bold text-text-muted">{taskDate ? format(taskDate, 'dd MMM') : '-'}</span>
                </div>
                <p className="truncate text-xs text-text-muted">{task.project_name || task.bucket_name || getTaskAssigneeNames(task)}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

// Panel ringkasan cepat di atas Gantt.
function GanttQuickResume({ projectGroups = [], scopeLabel = 'All projects', showHeader = true, tasks = [] }) {
  const [mandaysDetailOpen, setMandaysDetailOpen] = useState(false);
  const summary = useMemo(() => buildQuickResume(tasks, projectGroups), [projectGroups, tasks]);
  const progressDelta = summary.weightedProgress - summary.elapsedPercent;
  const progressHint =
    summary.hasRange && summary.totalTasks
      ? `${progressDelta >= 0 ? '+' : ''}${progressDelta}% dibanding waktu berjalan`
      : 'Progress dihitung dari task yang tampil';

  if (!summary.totalTasks) {
    return null;
  }

  return (
    <section className="space-y-4">
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Quick Resume</p>
            <h2 className="text-lg font-bold text-text-dark">Ringkasan keseluruhan Gantt</h2>
            <p className="mt-1 text-sm font-semibold text-text-muted">Project: {scopeLabel}</p>
          </div>
          <span className={`badge ${summary.health.toneClass}`}>{summary.health.label}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-muted">Project: {scopeLabel}</p>
          <span className={`badge ${summary.health.toneClass}`}>{summary.health.label}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="space-y-4">
          <ProjectDateSummary summary={summary} />

          {summary.hasRange ? (
            <TimelineProgress summary={summary} />
          ) : (
            <div className="rounded-lg border border-border bg-white p-3 text-sm font-semibold text-text-muted">
              Belum ada rentang tanggal lengkap untuk menghitung timeline.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <AnimatedProgressBar label="Progress pekerjaan" value={summary.weightedProgress} hint={progressHint} />
            <AnimatedProgressBar
              label="Task selesai"
              value={summary.totalTasks ? clampPercent((summary.completedTasks / summary.totalTasks) * 100) : 0}
              hint={`${summary.completedTasks} dari ${summary.totalTasks} task selesai`}
              barClassName="bg-success"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <TaskPreviewList dateKey="end_date" emptyLabel="Tidak ada task aktif atau overdue." label="Fokus sekarang" tasks={summary.focusTasks} />
          <TaskPreviewList dateKey="start_date" emptyLabel="Belum ada pekerjaan berikutnya." label="Akan datang" tasks={summary.nextTasks} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <ResumeStat label="Total task" value={summary.totalTasks} />
        <ResumeStat label="Mandays" value={summary.mandays} toneClass="text-primary" onClick={() => setMandaysDetailOpen(true)} />
        <ResumeStat label="Aktif" value={summary.activeTasks} toneClass="text-blue-700" />
        <ResumeStat label="Overdue" value={summary.overdueTasks} toneClass="text-red-700" />
        <ResumeStat label="Akan datang" value={summary.upcomingTasks} toneClass="text-primary" />
        <ResumeStat label="Task completed" value={summary.completedTasks} toneClass="text-green-700" />
      </div>

      <MandaysDetailModal open={mandaysDetailOpen} summary={summary} onClose={() => setMandaysDetailOpen(false)} />
    </section>
  );
}

export default GanttQuickResume;
