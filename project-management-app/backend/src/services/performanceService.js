const { query } = require('../config/db');

const DEFAULT_STALE_DAYS = 7;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultPeriod = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    start_date: formatDate(start),
    end_date: formatDate(now),
  };
};

const normalizeDateFilter = (value, fallback, fieldName) => {
  if (!value) {
    return fallback;
  }

  const normalizedValue = String(value).trim();

  if (!DATE_PATTERN.test(normalizedValue)) {
    throw new Error(`${fieldName} wajib memakai format YYYY-MM-DD.`);
  }

  return normalizedValue;
};

const normalizeOptionalId = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} wajib berupa angka positif.`);
  }

  return normalizedValue;
};

const normalizePositiveInteger = (value, fallback, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} wajib berupa angka positif.`);
  }

  return normalizedValue;
};

const normalizeFilters = (filters = {}) => {
  const defaultPeriod = getDefaultPeriod();
  const startDate = normalizeDateFilter(filters.start_date, defaultPeriod.start_date, 'start_date');
  const endDate = normalizeDateFilter(filters.end_date, defaultPeriod.end_date, 'end_date');

  if (startDate > endDate) {
    throw new Error('start_date tidak boleh lebih besar dari end_date.');
  }

  return {
    start_date: startDate,
    end_date: endDate,
    department_id: normalizeOptionalId(filters.department_id, 'department_id'),
    project_id: normalizeOptionalId(filters.project_id, 'project_id'),
    stale_days: normalizePositiveInteger(filters.stale_days, DEFAULT_STALE_DAYS, 'stale_days'),
  };
};

const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value).slice(0, 10);
};

const normalizeTimestamp = (value) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toDateTime = (dateValue, time = '00:00:00') => new Date(`${dateValue}T${time}`);

const diffDays = (laterDate, earlierDate) => {
  const later = toDateTime(laterDate);
  const earlier = toDateTime(earlierDate);

  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const calculateRatio = (value, total) => {
  if (!total) {
    return 0;
  }

  return Number((value / total).toFixed(4));
};

const getRating = (score) => {
  if (score === null) {
    return 'No Data';
  }

  if (score >= 80) {
    return 'Bagus';
  }

  if (score >= 60) {
    return 'Cukup';
  }

  return 'Kurang';
};

const buildRecommendations = (metrics) => {
  if (!metrics.total_tasks) {
    return ['Belum ada task assigned pada periode ini. Pastikan distribusi pekerjaan sudah tercatat.'];
  }

  const recommendations = [];

  if (metrics.ratios.overdue >= 0.2) {
    recommendations.push('Prioritaskan penyelesaian task overdue dan review estimasi deadline.');
  }

  if (metrics.ratios.not_started >= 0.35) {
    recommendations.push('Pecah task besar menjadi subtask dan mulai task prioritas.');
  }

  if (metrics.ratios.waiting_review >= 0.2) {
    recommendations.push('Lead perlu mempercepat approval agar pekerjaan tidak tertahan.');
  }

  if (metrics.ratios.stale >= 0.2) {
    recommendations.push('Cek task in progress yang tidak bergerak dan bantu hilangkan hambatan.');
  }

  if (metrics.ratios.no_due_date >= 0.2) {
    recommendations.push('Lengkapi deadline agar pekerjaan bisa dipantau dengan adil.');
  }

  if (!recommendations.length) {
    recommendations.push('Kinerja task sehat. Pertahankan ritme penyelesaian dan update progress.');
  }

  return recommendations;
};

const getTaskFlags = (task, filters) => {
  const status = task.status || 'Not Started';
  const progress = Number(task.progress || 0);
  const endDate = normalizeDateValue(task.end_date);
  const updatedAt = task.updated_at ? new Date(task.updated_at).getTime() : null;
  const reportEnd = toDateTime(filters.end_date, '23:59:59');
  const staleThreshold = reportEnd.getTime() - filters.stale_days * 86400000;
  const completed = status === 'Done' || progress >= 100;
  const overdue = Boolean(endDate && endDate < filters.end_date && progress < 100 && status !== 'Done');
  const stale = Boolean(status === 'In Progress' && progress < 100 && updatedAt && updatedAt < staleThreshold);

  return {
    completed,
    healthy_in_progress: status === 'In Progress' && !overdue && !stale,
    in_progress: status === 'In Progress',
    no_due_date: !endDate,
    not_started: status === 'Not Started',
    overdue,
    stale,
    waiting_review: status === 'Waiting Review',
  };
};

const mapTaskRow = (row, filters) => {
  const task = {
    id: Number(row.task_id),
    title: row.task_title,
    status: row.status,
    progress: Number(row.progress || 0),
    priority: row.priority,
    start_date: normalizeDateValue(row.start_date),
    end_date: normalizeDateValue(row.end_date),
    actual_start_date: normalizeDateValue(row.actual_start_date),
    actual_end_date: normalizeDateValue(row.actual_end_date),
    updated_at: normalizeTimestamp(row.updated_at),
    project_id: row.project_id ? Number(row.project_id) : null,
    project_name: row.project_name,
    bucket_name: row.bucket_name,
    flags: {},
  };

  task.flags = getTaskFlags(task, filters);

  return task;
};

const getBottleneckReasons = (task, filters) => {
  const reasons = [];

  if (task.flags.overdue) {
    reasons.push({
      type: 'overdue',
      label: 'Overdue',
      days: task.end_date ? Math.max(0, diffDays(filters.end_date, task.end_date)) : 0,
    });
  }

  if (task.flags.stale) {
    const updatedDate = task.updated_at ? normalizeDateValue(task.updated_at) : filters.end_date;
    reasons.push({
      type: 'stale',
      label: 'Stale progress',
      days: Math.max(0, diffDays(filters.end_date, updatedDate)),
    });
  }

  if (task.flags.waiting_review) {
    reasons.push({
      type: 'waiting_review',
      label: 'Waiting review',
      days: task.end_date ? Math.max(0, diffDays(filters.end_date, task.end_date)) : 0,
    });
  }

  if (task.flags.no_due_date) {
    reasons.push({
      type: 'no_due_date',
      label: 'Tanpa deadline',
      days: 0,
    });
  }

  return reasons;
};

const getBottleneckSeverity = (task, filters) => {
  const reasons = getBottleneckReasons(task, filters);

  return reasons.reduce((score, reason) => {
    if (reason.type === 'overdue') {
      return score + 100 + reason.days;
    }

    if (reason.type === 'stale') {
      return score + 60 + reason.days;
    }

    if (reason.type === 'waiting_review') {
      return score + 40 + reason.days;
    }

    if (reason.type === 'no_due_date') {
      return score + 20;
    }

    return score;
  }, 0);
};

const buildTaskCategories = (tasks) => ({
  completed: tasks.filter((task) => task.flags.completed),
  in_progress: tasks.filter((task) => task.flags.in_progress),
  not_started: tasks.filter((task) => task.flags.not_started),
  waiting_review: tasks.filter((task) => task.flags.waiting_review),
  overdue: tasks.filter((task) => task.flags.overdue),
  stale: tasks.filter((task) => task.flags.stale),
  no_due_date: tasks.filter((task) => task.flags.no_due_date),
});

const calculateUserMetrics = (user, taskRows, filters, includeTasks = false) => {
  const tasks = taskRows.map((row) => mapTaskRow(row, filters));
  const totalTasks = tasks.length;
  const categories = buildTaskCategories(tasks);
  const completedTasks = categories.completed.length;
  const inProgressTasks = categories.in_progress.length;
  const healthyInProgressTasks = tasks.filter((task) => task.flags.healthy_in_progress).length;
  const notStartedTasks = categories.not_started.length;
  const waitingReviewTasks = categories.waiting_review.length;
  const overdueTasks = categories.overdue.length;
  const staleTasks = categories.stale.length;
  const noDueDateTasks = categories.no_due_date.length;

  const ratios = {
    completed: calculateRatio(completedTasks, totalTasks),
    healthy_in_progress: calculateRatio(healthyInProgressTasks, totalTasks),
    in_progress: calculateRatio(inProgressTasks, totalTasks),
    no_due_date: calculateRatio(noDueDateTasks, totalTasks),
    not_started: calculateRatio(notStartedTasks, totalTasks),
    overdue: calculateRatio(overdueTasks, totalTasks),
    stale: calculateRatio(staleTasks, totalTasks),
    waiting_review: calculateRatio(waitingReviewTasks, totalTasks),
  };

  const scoreBreakdown = totalTasks
    ? {
        base: 60,
        completed_bonus: Number((ratios.completed * 30).toFixed(2)),
        healthy_in_progress_bonus: Number((ratios.healthy_in_progress * 10).toFixed(2)),
        overdue_penalty: Number((ratios.overdue * -40).toFixed(2)),
        stale_penalty: Number((ratios.stale * -15).toFixed(2)),
        no_due_date_penalty: Number((ratios.no_due_date * -10).toFixed(2)),
      }
    : null;

  const score = scoreBreakdown
    ? clampScore(
        scoreBreakdown.base +
          scoreBreakdown.completed_bonus +
          scoreBreakdown.healthy_in_progress_bonus +
          scoreBreakdown.overdue_penalty +
          scoreBreakdown.stale_penalty +
          scoreBreakdown.no_due_date_penalty,
      )
    : null;

  const bottlenecks = tasks
    .map((task) => ({
      ...task,
      bottleneck_reasons: getBottleneckReasons(task, filters),
      bottleneck_severity: getBottleneckSeverity(task, filters),
    }))
    .filter((task) => task.bottleneck_reasons.length)
    .sort((firstTask, secondTask) => secondTask.bottleneck_severity - firstTask.bottleneck_severity);

  const metrics = {
    user: {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id ? Number(user.department_id) : null,
      department_name: user.department_name,
      location_id: user.location_id ? Number(user.location_id) : null,
      location_name: user.location_name,
    },
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    healthy_in_progress_tasks: healthyInProgressTasks,
    in_progress_tasks: inProgressTasks,
    not_started_tasks: notStartedTasks,
    waiting_review_tasks: waitingReviewTasks,
    overdue_tasks: overdueTasks,
    stale_tasks: staleTasks,
    no_due_date_tasks: noDueDateTasks,
    ratios,
    score,
    score_breakdown: scoreBreakdown,
    rating: getRating(score),
    recommendations: [],
    bottleneck_count: bottlenecks.length,
  };

  metrics.recommendations = buildRecommendations(metrics);

  if (includeTasks) {
    return {
      ...metrics,
      bottlenecks,
      tasks_by_category: categories,
    };
  }

  return metrics;
};

const getActiveUsers = async ({ department_id: departmentId, user_id: userId }) => {
  const result = await query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.department_id,
        d.name AS department_name,
        u.location_id,
        l.name AS location_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE u.deleted_at IS NULL
        AND u.is_active IS TRUE
        AND ($1::INTEGER IS NULL OR u.department_id = $1::INTEGER)
        AND ($2::INTEGER IS NULL OR u.id = $2::INTEGER)
      ORDER BY u.name
    `,
    [departmentId, userId],
  );

  return result.rows;
};

const getAssignedTaskRows = async (filters, userId = null) => {
  const result = await query(
    `
      WITH assignment_source AS (
        SELECT task_id, user_id
        FROM task_assignees
        UNION
        SELECT id AS task_id, assignee_id AS user_id
        FROM tasks
        WHERE assignee_id IS NOT NULL
      )
      SELECT DISTINCT
        a.user_id,
        t.id AS task_id,
        t.title AS task_title,
        t.status,
        t.progress,
        t.priority,
        t.start_date,
        t.end_date,
        t.actual_start_date,
        t.actual_end_date,
        t.updated_at,
        t.project_id,
        p.name AS project_name,
        b.name AS bucket_name
      FROM assignment_source a
      INNER JOIN tasks t ON t.id = a.task_id
      INNER JOIN users u ON u.id = a.user_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN buckets b ON b.id = t.bucket_id
      WHERE t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND u.deleted_at IS NULL
        AND u.is_active IS TRUE
        AND ($3::INTEGER IS NULL OR u.department_id = $3::INTEGER)
        AND ($4::INTEGER IS NULL OR t.project_id = $4::INTEGER)
        AND ($5::INTEGER IS NULL OR a.user_id = $5::INTEGER)
        AND (
          (t.start_date IS NOT NULL AND t.start_date <= $2::DATE AND COALESCE(t.end_date, t.start_date) >= $1::DATE)
          OR (t.end_date IS NOT NULL AND t.end_date BETWEEN $1::DATE AND $2::DATE)
          OR (
            t.actual_start_date IS NOT NULL
            AND t.actual_start_date <= $2::DATE
            AND COALESCE(t.actual_end_date, t.actual_start_date) >= $1::DATE
          )
          OR (t.actual_end_date IS NOT NULL AND t.actual_end_date BETWEEN $1::DATE AND $2::DATE)
          OR (
            COALESCE(t.status, 'Not Started') <> 'Done'
            AND COALESCE(t.progress, 0) < 100
            AND COALESCE(t.start_date, t.created_at::DATE) <= $2::DATE
          )
        )
      ORDER BY a.user_id, t.end_date NULLS LAST, t.priority DESC, t.title
    `,
    [filters.start_date, filters.end_date, filters.department_id, filters.project_id, userId],
  );

  return result.rows;
};

const groupTaskRowsByUser = (taskRows) =>
  taskRows.reduce((groupedRows, row) => {
    const userId = Number(row.user_id);

    if (!groupedRows.has(userId)) {
      groupedRows.set(userId, []);
    }

    groupedRows.get(userId).push(row);
    return groupedRows;
  }, new Map());

const buildReportSummary = (users) => {
  const usersWithScore = users.filter((user) => user.score !== null);
  const totalScore = usersWithScore.reduce((sum, user) => sum + user.score, 0);

  return {
    total_users: users.length,
    users_with_tasks: usersWithScore.length,
    average_score: usersWithScore.length ? Math.round(totalScore / usersWithScore.length) : null,
    good_rating_users: users.filter((user) => user.rating === 'Bagus').length,
    enough_rating_users: users.filter((user) => user.rating === 'Cukup').length,
    low_rating_users: users.filter((user) => user.rating === 'Kurang').length,
    total_tasks: users.reduce((sum, user) => sum + user.total_tasks, 0),
    overdue_tasks: users.reduce((sum, user) => sum + user.overdue_tasks, 0),
    waiting_review_tasks: users.reduce((sum, user) => sum + user.waiting_review_tasks, 0),
    bottleneck_tasks: users.reduce((sum, user) => sum + user.bottleneck_count, 0),
  };
};

const getPerformanceUsers = async (rawFilters = {}) => {
  const filters = normalizeFilters(rawFilters);
  const [users, taskRows] = await Promise.all([getActiveUsers(filters), getAssignedTaskRows(filters)]);
  const rowsByUser = groupTaskRowsByUser(taskRows);
  const performanceUsers = users
    .map((user) => calculateUserMetrics(user, rowsByUser.get(Number(user.id)) || [], filters))
    .filter((userMetrics) => !filters.project_id || userMetrics.total_tasks > 0);

  return {
    period: filters,
    generated_at: new Date().toISOString(),
    summary: buildReportSummary(performanceUsers),
    users: performanceUsers,
  };
};

const getUserPerformance = async (userId, rawFilters = {}) => {
  const normalizedUserId = normalizeOptionalId(userId, 'user_id');
  const filters = normalizeFilters(rawFilters);
  const [users, taskRows] = await Promise.all([
    getActiveUsers({ ...filters, user_id: normalizedUserId }),
    getAssignedTaskRows(filters, normalizedUserId),
  ]);

  if (!users[0]) {
    throw new Error('User tidak ditemukan atau tidak aktif.');
  }

  return {
    period: filters,
    generated_at: new Date().toISOString(),
    ...calculateUserMetrics(users[0], taskRows, filters, true),
  };
};

const getDepartmentPerformance = async (rawFilters = {}) => {
  const report = await getPerformanceUsers(rawFilters);
  const departments = report.users.reduce((groupedDepartments, userMetrics) => {
    const departmentId = userMetrics.user.department_id || 0;
    const departmentName = userMetrics.user.department_name || 'No Department';

    if (!groupedDepartments.has(departmentId)) {
      groupedDepartments.set(departmentId, {
        department_id: departmentId || null,
        department_name: departmentName,
        users: 0,
        users_with_tasks: 0,
        total_score: 0,
        total_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        waiting_review_tasks: 0,
        stale_tasks: 0,
        no_due_date_tasks: 0,
        bottleneck_tasks: 0,
        ratings: {
          bagus: 0,
          cukup: 0,
          kurang: 0,
          no_data: 0,
        },
      });
    }

    const department = groupedDepartments.get(departmentId);
    department.users += 1;
    department.total_tasks += userMetrics.total_tasks;
    department.completed_tasks += userMetrics.completed_tasks;
    department.overdue_tasks += userMetrics.overdue_tasks;
    department.waiting_review_tasks += userMetrics.waiting_review_tasks;
    department.stale_tasks += userMetrics.stale_tasks;
    department.no_due_date_tasks += userMetrics.no_due_date_tasks;
    department.bottleneck_tasks += userMetrics.bottleneck_count;

    if (userMetrics.score === null) {
      department.ratings.no_data += 1;
    } else {
      department.users_with_tasks += 1;
      department.total_score += userMetrics.score;

      if (userMetrics.rating === 'Bagus') {
        department.ratings.bagus += 1;
      } else if (userMetrics.rating === 'Cukup') {
        department.ratings.cukup += 1;
      } else {
        department.ratings.kurang += 1;
      }
    }

    return groupedDepartments;
  }, new Map());

  return {
    period: report.period,
    generated_at: report.generated_at,
    departments: Array.from(departments.values())
      .map((department) => ({
        ...department,
        average_score: department.users_with_tasks ? Math.round(department.total_score / department.users_with_tasks) : null,
      }))
      .sort((firstDepartment, secondDepartment) => firstDepartment.department_name.localeCompare(secondDepartment.department_name)),
  };
};

const getPerformanceBottlenecks = async (rawFilters = {}) => {
  const filters = normalizeFilters(rawFilters);
  const limit = Math.min(normalizePositiveInteger(rawFilters.limit, 12, 'limit'), 100);
  const [users, taskRows] = await Promise.all([getActiveUsers(filters), getAssignedTaskRows(filters)]);
  const usersById = new Map(users.map((user) => [Number(user.id), user]));
  const bottlenecks = taskRows
    .map((row) => {
      const user = usersById.get(Number(row.user_id));
      const task = mapTaskRow(row, filters);

      return {
        ...task,
        assigned_user: user
          ? {
              id: Number(user.id),
              name: user.name,
              department_name: user.department_name,
            }
          : null,
        bottleneck_reasons: getBottleneckReasons(task, filters),
        bottleneck_severity: getBottleneckSeverity(task, filters),
      };
    })
    .filter((task) => task.bottleneck_reasons.length)
    .sort((firstTask, secondTask) => secondTask.bottleneck_severity - firstTask.bottleneck_severity)
    .slice(0, limit);

  return {
    period: filters,
    generated_at: new Date().toISOString(),
    bottlenecks,
  };
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = Array.isArray(value) ? value.join(' | ') : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const getPerformanceExport = async (rawFilters = {}) => {
  const report = await getPerformanceUsers(rawFilters);
  const headers = [
    'User',
    'Department',
    'Role',
    'Total Tasks',
    'Completed',
    'In Progress',
    'Not Started',
    'Waiting Review',
    'Overdue',
    'Stale',
    'No Due Date',
    'Score',
    'Rating',
    'Recommendations',
  ];
  const rows = report.users.map((userMetrics) => [
    userMetrics.user.name,
    userMetrics.user.department_name || 'No Department',
    userMetrics.user.role,
    userMetrics.total_tasks,
    userMetrics.completed_tasks,
    userMetrics.in_progress_tasks,
    userMetrics.not_started_tasks,
    userMetrics.waiting_review_tasks,
    userMetrics.overdue_tasks,
    userMetrics.stale_tasks,
    userMetrics.no_due_date_tasks,
    userMetrics.score ?? '',
    userMetrics.rating,
    userMetrics.recommendations,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');

  return {
    content: csv,
    file_name: `performance-${report.period.start_date}-to-${report.period.end_date}.csv`,
  };
};

module.exports = {
  getDepartmentPerformance,
  getPerformanceBottlenecks,
  getPerformanceExport,
  getPerformanceUsers,
  getUserPerformance,
};
