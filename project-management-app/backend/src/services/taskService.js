const { query } = require('../config/db');
const { calculateTaskDateMetrics } = require('./calendarService');
const { updateProjectProgress, upsertProjectMember } = require('./projectService');
const { formatDateKey } = require('../utils/dateUtils');

const VALID_STATUSES = ['Not Started', 'In Progress', 'Waiting Review', 'Done', 'Overdue'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const REVIEW_PROGRESS = 99;
const APPROVED_PROGRESS = 100;
const MANUAL_REALIZATION_REASON_MIN_LENGTH = 10;

// Query dasar untuk mengambil task lengkap dengan project, bucket, PIC, lead, dan status tampilannya.
const TASK_SELECT = `
  SELECT
    t.id,
    t.project_id,
    p.name AS project_name,
    to_char(p.start_date, 'YYYY-MM-DD') AS project_start_date,
    to_char(p.end_date, 'YYYY-MM-DD') AS project_end_date,
    COALESCE(assignee_summary.primary_department_id, legacy_assignee.department_id) AS department_id,
    COALESCE(assignee_summary.primary_department_name, legacy_assignee_department.name) AS department_name,
    COALESCE(assignee_summary.primary_department_id, legacy_assignee.department_id) AS assignee_department_id,
    COALESCE(assignee_summary.primary_department_name, legacy_assignee_department.name) AS assignee_department_name,
    COALESCE(assignee_summary.primary_location_id, legacy_assignee.location_id) AS location_id,
    COALESCE(assignee_summary.primary_location_name, legacy_assignee_location.name) AS location_name,
    COALESCE(assignee_summary.primary_location_id, legacy_assignee.location_id) AS assignee_location_id,
    COALESCE(assignee_summary.primary_location_name, legacy_assignee_location.name) AS assignee_location_name,
    t.bucket_id,
    b.name AS bucket_name,
    t.parent_task_id,
    t.title,
    t.description,
    COALESCE(assignee_summary.primary_assignee_id, t.assignee_id) AS assignee_id,
    COALESCE(assignee_summary.primary_assignee_name, legacy_assignee.name) AS assignee_name,
    COALESCE(
      assignee_summary.assignee_ids,
      CASE
        WHEN legacy_assignee.id IS NOT NULL THEN json_build_array(legacy_assignee.id)
        ELSE '[]'::JSON
      END
    ) AS assignee_ids,
    COALESCE(
      assignee_summary.assignees,
      CASE
        WHEN legacy_assignee.id IS NOT NULL THEN json_build_array(
          json_build_object(
            'id', legacy_assignee.id,
            'name', legacy_assignee.name,
            'email', legacy_assignee.email,
            'department_id', legacy_assignee_department.id,
            'department_name', legacy_assignee_department.name,
            'location_id', legacy_assignee_location.id,
            'location_name', legacy_assignee_location.name
          )
        )
        ELSE '[]'::JSON
      END
    ) AS assignees,
    COALESCE(assignee_summary.assignee_names, legacy_assignee.name) AS assignee_names,
    t.lead_id,
    COALESCE(lead_user.name, t.lead_name) AS lead_name,
    lead_user.email AS lead_email,
    lead_user.department_id AS lead_department_id,
    lead_department.name AS lead_department_name,
    lead_user.location_id AS lead_location_id,
    lead_location.name AS lead_location_name,
    to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
    to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
    t.duration_days,
    t.work_days,
    to_char(t.actual_start_date, 'YYYY-MM-DD') AS actual_start_date,
    to_char(t.actual_end_date, 'YYYY-MM-DD') AS actual_end_date,
    t.actual_duration_days,
    t.actual_work_days,
    t.realization_mode,
    t.progress,
    CASE
      WHEN t.end_date < CURRENT_DATE AND t.progress < 100 AND t.status NOT IN ('Done', 'Waiting Review') THEN 'Overdue'
      ELSE t.status
    END AS status,
    t.status AS raw_status,
    t.priority,
    t.sort_order,
    t.created_at,
    t.updated_at
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN buckets b ON b.id = t.bucket_id
  LEFT JOIN users legacy_assignee ON legacy_assignee.id = t.assignee_id
  LEFT JOIN departments legacy_assignee_department ON legacy_assignee_department.id = legacy_assignee.department_id
  LEFT JOIN locations legacy_assignee_location ON legacy_assignee_location.id = legacy_assignee.location_id
  LEFT JOIN users lead_user ON lead_user.id = t.lead_id
  LEFT JOIN departments lead_department ON lead_department.id = lead_user.department_id
  LEFT JOIN locations lead_location ON lead_location.id = lead_user.location_id
  LEFT JOIN LATERAL (
    SELECT
      (array_agg(ta.user_id ORDER BY ta.id))[1] AS primary_assignee_id,
      (array_agg(assignee_user.name ORDER BY ta.id))[1] AS primary_assignee_name,
      (array_agg(assignee_user.department_id ORDER BY ta.id))[1] AS primary_department_id,
      (array_agg(assignee_department.name ORDER BY ta.id))[1] AS primary_department_name,
      (array_agg(assignee_user.location_id ORDER BY ta.id))[1] AS primary_location_id,
      (array_agg(assignee_location.name ORDER BY ta.id))[1] AS primary_location_name,
      json_agg(assignee_user.id ORDER BY ta.id) FILTER (WHERE assignee_user.id IS NOT NULL) AS assignee_ids,
      json_agg(
        json_build_object(
          'id', assignee_user.id,
          'name', assignee_user.name,
          'email', assignee_user.email,
          'department_id', assignee_department.id,
          'department_name', assignee_department.name,
          'location_id', assignee_location.id,
          'location_name', assignee_location.name
        )
        ORDER BY ta.id
      ) FILTER (WHERE assignee_user.id IS NOT NULL) AS assignees,
      string_agg(assignee_user.name, ', ' ORDER BY ta.id) FILTER (WHERE assignee_user.id IS NOT NULL) AS assignee_names
    FROM task_assignees ta
    INNER JOIN users assignee_user ON assignee_user.id = ta.user_id
    LEFT JOIN departments assignee_department ON assignee_department.id = assignee_user.department_id
    LEFT JOIN locations assignee_location ON assignee_location.id = assignee_user.location_id
    WHERE ta.task_id = t.id
  ) assignee_summary ON TRUE
`;

// Membatasi angka progress agar selalu berada di rentang 0 sampai 100.
const clampProgress = (value) => {
  const numeric = Number(value || 0);

  if (Number.isNaN(numeric)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(numeric)));
};

// Menentukan kombinasi status dan progress yang valid saat user mengisi data manual.
const resolveManualTaskState = (progressValue, requestedStatus = 'Not Started') => {
  if (!VALID_STATUSES.includes(requestedStatus)) {
    throw new Error('Status task tidak valid.');
  }

  if (requestedStatus === 'Done') {
    return {
      progress: REVIEW_PROGRESS,
      status: 'Waiting Review',
    };
  }

  const progress = clampProgress(progressValue);

  if (requestedStatus === 'Waiting Review') {
    return {
      progress: REVIEW_PROGRESS,
      status: 'Waiting Review',
    };
  }

  if (progress < 100) {
    return {
      progress,
      status: requestedStatus,
    };
  }

  return {
    progress: requestedStatus === 'Not Started' ? 0 : REVIEW_PROGRESS,
    status: requestedStatus === 'Not Started' ? 'Not Started' : 'Waiting Review',
  };
};

// Mengecek apakah user yang melakukan approval adalah lead task atau super admin.
const ensureTaskApprover = async (task, approverUserId) => {
  const normalizedApproverUserId = Number(approverUserId);

  if (!Number.isInteger(normalizedApproverUserId) || normalizedApproverUserId <= 0) {
    throw new Error('User approver wajib diisi.');
  }

  const approverResult = await query('SELECT id, name, role FROM users WHERE id = $1', [normalizedApproverUserId]);
  const approver = approverResult.rows[0];

  if (!approver) {
    throw new Error('User approver tidak ditemukan.');
  }

  if (approver.role === 'super_admin') {
    return approver;
  }

  if (!task.lead_id) {
    throw new Error('Task wajib memiliki lead sebelum bisa diapprove.');
  }

  if (Number(task.lead_id) !== normalizedApproverUserId) {
    throw new Error('Hanya lead task yang dapat melakukan approval.');
  }

  return approver;
};

// Mengambil user pelaku aksi untuk kebutuhan audit trail.
const getActionUser = async (userId, { required = false } = {}) => {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    if (required) {
      throw new Error('User realisasi wajib diisi.');
    }

    return null;
  }

  const result = await query('SELECT id, name, role FROM users WHERE id = $1', [normalizedUserId]);
  const user = result.rows[0];

  if (!user) {
    throw new Error('User realisasi tidak ditemukan.');
  }

  return user;
};

// Memastikan priority task termasuk pilihan yang diizinkan aplikasi.
const validatePriority = (priority) => {
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    throw new Error('Priority task tidak valid.');
  }
};

// Membersihkan daftar user id agar hanya angka valid, unik, dan lebih besar dari nol.
const normalizeUserIds = (userIds = []) => {
  const normalizedIds = Array.isArray(userIds) ? userIds : [userIds];

  return Array.from(
    new Set(
      normalizedIds
        .filter(Boolean)
        .map(Number)
        .filter((userId) => Number.isInteger(userId) && userId > 0),
    ),
  );
};

// Mengecek apakah payload membawa data PIC, baik satu PIC lama maupun multi PIC baru.
const hasAssigneePayload = (payload = {}) => {
  return payload.assignee_ids !== undefined || payload.assignee_id !== undefined;
};

// Mengambil daftar PIC dari payload dan menormalkannya menjadi array angka.
const getPayloadAssigneeIds = (payload = {}) => {
  if (payload.assignee_ids !== undefined) {
    return normalizeUserIds(payload.assignee_ids);
  }

  return normalizeUserIds(payload.assignee_id);
};

// Mengambil daftar PIC yang sudah tersimpan untuk satu task.
const getTaskAssigneeIds = async (taskId, fallbackAssigneeId = null) => {
  const result = await query('SELECT user_id FROM task_assignees WHERE task_id = $1 ORDER BY id', [taskId]);
  const assigneeIds = normalizeUserIds(result.rows.map((row) => row.user_id));

  if (assigneeIds.length) {
    return assigneeIds;
  }

  return normalizeUserIds(fallbackAssigneeId);
};

// Mengganti seluruh PIC task agar isi tabel penghubung selalu sama dengan form terbaru.
const replaceTaskAssignees = async (taskId, assigneeIds = []) => {
  const normalizedAssigneeIds = normalizeUserIds(assigneeIds);

  await query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);

  await Promise.all(
    normalizedAssigneeIds.map((userId) =>
      query(
        `
          INSERT INTO task_assignees (task_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (task_id, user_id) DO NOTHING
        `,
        [taskId, userId],
      ),
    ),
  );

  return normalizedAssigneeIds;
};

// Mengambil nama user dari id, dipakai untuk menyimpan nama lead historis.
const getUserNameById = async (userId) => {
  if (!userId) {
    return null;
  }

  const result = await query('SELECT name FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.name || null;
};

// Memastikan semua PIC task juga tercatat sebagai member project.
const upsertTaskProjectMembers = async (projectId, userIds = []) => {
  await Promise.all(normalizeUserIds(userIds).map((userId) => upsertProjectMember(projectId, userId, 'member')));
};

// Mengubah daftar task datar dari database menjadi struktur pohon parent-child.
const buildTaskTree = (tasks) => {
  const taskById = new Map();
  // Mengubah tanggal mulai project menjadi angka agar task bisa diurutkan.
  const getProjectStartTime = (task) => {
    const projectStartDate = task.project_start_date || task.project_start || task.project_date || task.start_date;
    const parsedDate = projectStartDate ? new Date(projectStartDate) : null;

    return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Number.POSITIVE_INFINITY;
  };
  // Mengurutkan task agar project dan urutan task tampil konsisten.
  const compareTasks = (a, b) => {
    const projectStartDifference = getProjectStartTime(a) - getProjectStartTime(b);

    if (projectStartDifference !== 0) {
      return projectStartDifference;
    }

    const projectNameDifference = (a.project_name || '').localeCompare(b.project_name || '');

    if (projectNameDifference !== 0) {
      return projectNameDifference;
    }

    return (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id;
  };

  tasks.forEach((task) => {
    taskById.set(task.id, {
      ...task,
      level: 0,
      children: [],
    });
  });

  const roots = [];

  taskById.forEach((task) => {
    if (task.parent_task_id && taskById.has(task.parent_task_id)) {
      taskById.get(task.parent_task_id).children.push(task);
      return;
    }

    roots.push(task);
  });

  // Memberi level kedalaman agar frontend tahu task berada di tingkat berapa.
  const assignLevel = (task, level) => {
    task.level = level;
    task.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
    task.children.forEach((child) => assignLevel(child, level + 1));
  };

  roots.sort(compareTasks);
  roots.forEach((task) => assignLevel(task, 0));

  return roots;
};

// Mengubah struktur pohon task kembali menjadi daftar datar.
const flattenTaskTree = (tasks) => {
  const flattened = [];

  // Menelusuri setiap cabang task dari atas ke bawah.
  const walk = (items) => {
    items.forEach((item) => {
      flattened.push(item);
      walk(item.children || []);
    });
  };

  walk(tasks);

  return flattened;
};

// Mencari tanggal paling akhir dari beberapa tanggal.
const getMaxDateKey = (dateKeys = []) => {
  return dateKeys.filter(Boolean).reduce((latestDate, dateKey) => {
    if (!latestDate || dateKey > latestDate) {
      return dateKey;
    }

    return latestDate;
  }, null);
};

const buildUserFilterConditions = ({ departmentParam, locationParam }) => {
  const userConditions = [];

  if (departmentParam) {
    userConditions.push(`{alias}.department_id = ${departmentParam}`);
  }

  if (locationParam) {
    userConditions.push(`{alias}.location_id = ${locationParam}`);
  }

  return userConditions;
};

// Mengambil daftar task dengan filter project, department, status, PIC, priority, dan tanggal.
const getTasks = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id) {
    values.push(filters.project_id);
    conditions.push(`t.project_id = $${values.length}`);
  }

  let departmentParam = '';
  let locationParam = '';

  if (filters.department_id) {
    values.push(filters.department_id);
    departmentParam = `$${values.length}`;
  }

  if (filters.location_id) {
    values.push(filters.location_id);
    locationParam = `$${values.length}`;
  }

  if (departmentParam || locationParam) {
    const userFilterConditions = buildUserFilterConditions({ departmentParam, locationParam });
    const assigneeConditions = userFilterConditions.map((condition) => condition.replaceAll('{alias}', 'assignee_filter')).join(' AND ');
    const legacyConditions = userFilterConditions.map((condition) => condition.replaceAll('{alias}', 'legacy_assignee_filter')).join(' AND ');

    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM task_assignees ta_filter
          INNER JOIN users assignee_filter ON assignee_filter.id = ta_filter.user_id
          WHERE ta_filter.task_id = t.id
            AND ${assigneeConditions}
        )
        OR EXISTS (
          SELECT 1
          FROM users legacy_assignee_filter
          WHERE legacy_assignee_filter.id = t.assignee_id
            AND ${legacyConditions}
        )
      )
    `);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`
      CASE
        WHEN t.end_date < CURRENT_DATE AND t.progress < 100 AND t.status NOT IN ('Done', 'Waiting Review') THEN 'Overdue'
        ELSE t.status
      END = $${values.length}
    `);
  }

  if (filters.assignee_id) {
    values.push(filters.assignee_id);
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM task_assignees ta_filter
          WHERE ta_filter.task_id = t.id AND ta_filter.user_id = $${values.length}
        )
        OR t.assignee_id = $${values.length}
      )
    `);
  }

  if (filters.priority) {
    values.push(filters.priority);
    conditions.push(`t.priority = $${values.length}`);
  }

  if (filters.start_date) {
    values.push(filters.start_date);
    conditions.push(`(t.end_date IS NULL OR t.end_date >= $${values.length})`);
  }

  if (filters.end_date) {
    values.push(filters.end_date);
    conditions.push(`(t.start_date IS NULL OR t.start_date <= $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`${TASK_SELECT} ${whereClause} ORDER BY p.start_date NULLS LAST, p.name, t.sort_order, t.id`, values);

  if (filters.tree) {
    return buildTaskTree(result.rows);
  }

  return result.rows;
};

// Mengambil satu task lengkap berdasarkan id.
const getTaskById = async (id) => {
  const result = await query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
  return result.rows[0] || null;
};

// Mengambil data mentah task langsung dari tabel, dipakai untuk validasi internal.
const getTaskRawById = async (id) => {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [id]);
  return result.rows[0] || null;
};

// Mengecek apakah sebuah task punya subtask langsung sehingga dianggap parent/summary task.
const getDirectChildTaskCount = async (id) => {
  const result = await query('SELECT COUNT(*)::INTEGER AS child_count FROM tasks WHERE parent_task_id = $1', [id]);
  return Number(result.rows[0]?.child_count || 0);
};

// Menentukan tanggal realisasi dari payload atau menggunakan tanggal hari ini.
const getRealizationDate = (payload = {}) => {
  const dateValue = payload.actual_date || payload.actual_start_date || payload.actual_end_date;
  return formatDateKey(dateValue || new Date());
};

// Membersihkan alasan realisasi manual agar audit log tetap ringkas dan bermakna.
const normalizeManualRealizationReason = (reason) => {
  return String(reason || '').trim().replace(/\s+/g, ' ');
};

// Memastikan parent task valid, satu project, dan tidak membuat lingkaran parent-child.
const ensureValidParent = async (taskId, parentTaskId, projectId) => {
  if (!parentTaskId) {
    return;
  }

  if (taskId && Number(parentTaskId) === Number(taskId)) {
    throw new Error('Task tidak dapat menjadi parent untuk dirinya sendiri.');
  }

  const parent = await getTaskRawById(parentTaskId);

  if (!parent) {
    throw new Error('Parent task tidak ditemukan.');
  }

  if (Number(parent.project_id) !== Number(projectId)) {
    throw new Error('Parent task harus berada dalam project yang sama.');
  }

  if (!taskId) {
    return;
  }

  const descendantResult = await query(
    `
      WITH RECURSIVE descendants AS (
        SELECT id FROM tasks WHERE parent_task_id = $1
        UNION ALL
        SELECT t.id
        FROM tasks t
        INNER JOIN descendants d ON d.id = t.parent_task_id
      )
      SELECT id FROM descendants WHERE id = $2
    `,
    [taskId, parentTaskId],
  );

  if (descendantResult.rows.length) {
    throw new Error('Parent task tidak boleh berasal dari descendant task tersebut.');
  }
};

// Membuat task baru, menyimpan PIC, lalu menghitung ulang progress project.
const createTask = async (payload) => {
  if (!payload.title) {
    throw new Error('Judul task wajib diisi.');
  }

  if (!payload.project_id) {
    throw new Error('Project wajib dipilih.');
  }

  validatePriority(payload.priority);
  await ensureValidParent(null, payload.parent_task_id, payload.project_id);

  const createStatus = payload.status || (clampProgress(payload.progress) === 100 ? 'Done' : 'Not Started');
  const taskState = resolveManualTaskState(payload.progress, createStatus);
  const dateMetrics = await calculateTaskDateMetrics(payload.start_date, payload.end_date);
  const assigneeIds = getPayloadAssigneeIds(payload);
  const primaryAssigneeId = assigneeIds[0] || null;
  const leadId = payload.lead_id || null;
  const leadName = leadId ? await getUserNameById(leadId) : payload.lead_name || null;

  if (leadId && !leadName) {
    throw new Error('Lead task tidak valid.');
  }

  const result = await query(
    `
      INSERT INTO tasks (
        project_id,
        bucket_id,
        parent_task_id,
        title,
        description,
        assignee_id,
        lead_name,
        lead_id,
        start_date,
        end_date,
        duration_days,
        work_days,
        progress,
        status,
        priority,
        sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `,
    [
      payload.project_id,
      payload.bucket_id || null,
      payload.parent_task_id || null,
      payload.title,
      payload.description || null,
      primaryAssigneeId,
      leadName,
      leadId,
      payload.start_date || null,
      payload.end_date || null,
      dateMetrics.duration_days,
      dateMetrics.work_days,
      taskState.progress,
      taskState.status,
      payload.priority || 'Medium',
      payload.sort_order || 0,
    ],
  );

  await replaceTaskAssignees(result.rows[0].id, assigneeIds);
  await upsertTaskProjectMembers(payload.project_id, assigneeIds);
  await recalculateProjectTaskProgress(payload.project_id);

  return getTaskById(result.rows[0].id);
};

// Mengubah task yang sudah ada sambil menjaga validasi parent, tanggal, PIC, dan lead.
const updateTask = async (id, payload) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  if (payload.title !== undefined && !payload.title) {
    throw new Error('Judul task wajib diisi.');
  }

  validatePriority(payload.priority);

  const projectId = payload.project_id || currentTask.project_id;
  const parentTaskId = payload.parent_task_id === undefined ? currentTask.parent_task_id : payload.parent_task_id;

  await ensureValidParent(id, parentTaskId, projectId);

  const startDate = payload.start_date === undefined ? currentTask.start_date : payload.start_date || null;
  const endDate = payload.end_date === undefined ? currentTask.end_date : payload.end_date || null;
  const dateMetrics = await calculateTaskDateMetrics(startDate, endDate);
  const progressValue = payload.progress === undefined ? currentTask.progress : payload.progress;
  const updateStatus = payload.status || (payload.progress !== undefined && clampProgress(payload.progress) === 100 ? 'Done' : currentTask.status);
  const taskState = resolveManualTaskState(progressValue, updateStatus);
  const assigneeIds = hasAssigneePayload(payload)
    ? getPayloadAssigneeIds(payload)
    : await getTaskAssigneeIds(id, currentTask.assignee_id);
  const primaryAssigneeId = assigneeIds[0] || null;
  const leadId = payload.lead_id === undefined ? currentTask.lead_id || null : payload.lead_id || null;
  const leadName =
    payload.lead_id === undefined
      ? payload.lead_name === undefined
        ? currentTask.lead_name
        : payload.lead_name || null
      : leadId
        ? await getUserNameById(leadId)
        : null;

  if (leadId && !leadName) {
    throw new Error('Lead task tidak valid.');
  }

  const result = await query(
    `
      UPDATE tasks
      SET
        project_id = $1,
        bucket_id = $2,
        parent_task_id = $3,
        title = $4,
        description = $5,
        assignee_id = $6,
        lead_name = $7,
        lead_id = $8,
        start_date = $9,
        end_date = $10,
        duration_days = $11,
        work_days = $12,
        progress = $13,
        status = $14,
        priority = $15,
        sort_order = $16
      WHERE id = $17
      RETURNING id
    `,
    [
      projectId,
      payload.bucket_id === undefined ? currentTask.bucket_id : payload.bucket_id || null,
      parentTaskId || null,
      payload.title === undefined ? currentTask.title : payload.title,
      payload.description === undefined ? currentTask.description : payload.description || null,
      primaryAssigneeId,
      leadName,
      leadId,
      startDate || null,
      endDate || null,
      dateMetrics.duration_days,
      dateMetrics.work_days,
      taskState.progress,
      taskState.status,
      payload.priority || currentTask.priority,
      payload.sort_order === undefined ? currentTask.sort_order : payload.sort_order || 0,
      id,
    ],
  );

  if (!result.rows[0]) {
    throw new Error('Task tidak ditemukan.');
  }

  if (hasAssigneePayload(payload)) {
    await replaceTaskAssignees(id, assigneeIds);
  }

  await upsertTaskProjectMembers(projectId, assigneeIds);
  await recalculateProjectTaskProgress(currentTask.project_id);

  if (Number(currentTask.project_id) !== Number(projectId)) {
    await recalculateProjectTaskProgress(projectId);
  }

  return getTaskById(id);
};

// Menghapus task lalu menghitung ulang progress project terkait.
const deleteTask = async (id) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  await query('DELETE FROM tasks WHERE id = $1', [id]);
  await recalculateProjectTaskProgress(currentTask.project_id);

  return { id };
};

// Mengubah status task dan menyesuaikan progress jika status menuntut perubahan.
const updateTaskStatus = async (id, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Status task tidak valid.');
  }

  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  const taskState = resolveManualTaskState(currentTask.progress, status);

  await query('UPDATE tasks SET status = $1, progress = $2 WHERE id = $3', [taskState.status, taskState.progress, id]);
  await recalculateProjectTaskProgress(currentTask.project_id);

  return getTaskById(id);
};

// Mengubah progress task dan otomatis menyesuaikan status task.
const updateTaskProgress = async (id, progressValue) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  const requestedProgress = clampProgress(progressValue);
  let progress = requestedProgress;
  let status = currentTask.status;

  if (requestedProgress === APPROVED_PROGRESS) {
    progress = REVIEW_PROGRESS;
    status = 'Waiting Review';
  } else if (currentTask.status === 'Done') {
    status = progress === 0 ? 'Not Started' : 'In Progress';
  }

  await query('UPDATE tasks SET progress = $1, status = $2 WHERE id = $3', [progress, status, id]);
  await recalculateProjectTaskProgress(currentTask.project_id);

  return getTaskById(id);
};

// Mengapprove task yang sudah selesai secara pekerjaan, hanya oleh lead task.
const approveTask = async (id, approverUserId) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  const approver = await ensureTaskApprover(currentTask, approverUserId);

  if (currentTask.status !== 'Waiting Review') {
    throw new Error('Task hanya bisa diapprove saat status Waiting Review.');
  }

  const pendingChildResult = await query(
    `
      SELECT COUNT(*)::INTEGER AS pending_child_count
      FROM tasks
      WHERE parent_task_id = $1
        AND NOT (status = 'Done' AND progress = $2)
    `,
    [id, APPROVED_PROGRESS],
  );

  if (Number(pendingChildResult.rows[0]?.pending_child_count || 0) > 0) {
    throw new Error('Semua subtask harus diapprove sebelum parent task bisa diapprove.');
  }

  await query('UPDATE tasks SET progress = $1, status = $2 WHERE id = $3', [APPROVED_PROGRESS, 'Done', id]);

  await query(
    `
      INSERT INTO activity_logs (task_id, project_id, user_id, action, description)
      VALUES ($1, $2, $3, 'task_approved', $4)
    `,
    [
      id,
      currentTask.project_id,
      approver.id,
      `Task "${currentTask.title}" diapprove oleh ${approver.role === 'super_admin' ? 'super admin' : 'lead'}.`,
    ],
  );

  await recalculateProjectTaskProgress(currentTask.project_id);

  return getTaskById(id);
};

// Mencatat realisasi mulai, selesai, atau realisasi manual untuk task.
const updateTaskRealization = async (id, payload = {}) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  const action = payload.action || 'start';
  const actionUser = await getActionUser(payload.actor_user_id || payload.user_id, { required: action === 'manual' });
  const realizationDate = getRealizationDate(payload);

  if (!realizationDate) {
    throw new Error('Tanggal realisasi tidak valid.');
  }

  if (action === 'manual') {
    const actualStartDate = formatDateKey(payload.actual_start_date);
    const actualEndDate = formatDateKey(payload.actual_end_date);

    if (!actualStartDate || !actualEndDate) {
      throw new Error('Tanggal mulai dan selesai realisasi wajib diisi.');
    }

    const childTaskCount = await getDirectChildTaskCount(id);

    if (childTaskCount > 0) {
      throw new Error('Realisasi manual hanya dapat diisi pada task tanpa subtask.');
    }

    if (currentTask.status === 'Done' && clampProgress(currentTask.progress) === APPROVED_PROGRESS) {
      throw new Error('Task yang sudah Done dan approved tidak dapat diubah melalui realisasi manual.');
    }

    if (actualEndDate < actualStartDate) {
      throw new Error('Tanggal selesai realisasi tidak boleh lebih awal dari tanggal mulai realisasi.');
    }

    const todayDate = formatDateKey(new Date());

    if (actualStartDate > todayDate || actualEndDate > todayDate) {
      throw new Error('Tanggal realisasi aktual tidak boleh berada di masa depan.');
    }

    const manualReason = normalizeManualRealizationReason(payload.reason || payload.manual_reason || payload.note);

    if (manualReason.length < MANUAL_REALIZATION_REASON_MIN_LENGTH) {
      throw new Error(`Alasan realisasi manual wajib diisi minimal ${MANUAL_REALIZATION_REASON_MIN_LENGTH} karakter.`);
    }

    const actualMetrics = await calculateTaskDateMetrics(actualStartDate, actualEndDate);

    await query(
      `
        UPDATE tasks
        SET
          actual_start_date = $1,
          actual_end_date = $2,
          actual_duration_days = $3,
          actual_work_days = $4,
          realization_mode = 'manual',
          progress = $5,
          status = 'Waiting Review'
        WHERE id = $6
      `,
      [actualStartDate, actualEndDate, actualMetrics.duration_days, actualMetrics.work_days, REVIEW_PROGRESS, id],
    );

    await query(
      `
        INSERT INTO activity_logs (task_id, project_id, user_id, action, description)
        VALUES ($1, $2, $3, 'task_realization_manual', $4)
      `,
      [
        id,
        currentTask.project_id,
        actionUser.id,
        `Realisasi manual task "${currentTask.title}" diisi oleh ${actionUser.name} untuk ${actualStartDate} sampai ${actualEndDate}. Alasan: ${manualReason}. Task menunggu approval lead.`,
      ],
    );

    await recalculateProjectTaskProgress(currentTask.project_id);

    return getTaskById(id);
  }

  if (action === 'start') {
    if (currentTask.actual_end_date) {
      throw new Error('Task yang sudah selesai realisasi tidak dapat dimulai ulang.');
    }

    const nextStatus = currentTask.status === 'Not Started' ? 'In Progress' : currentTask.status;

    await query(
      `
        UPDATE tasks
        SET actual_start_date = $1, status = $2, realization_mode = 'normal'
        WHERE id = $3
      `,
      [realizationDate, nextStatus, id],
    );

    await query(
      `
        INSERT INTO activity_logs (task_id, project_id, user_id, action, description)
        VALUES ($1, $2, $3, 'task_realization_started', $4)
      `,
      [
        id,
        currentTask.project_id,
        actionUser?.id || null,
        `Realisasi task "${currentTask.title}" dimulai pada ${realizationDate}${actionUser ? ` oleh ${actionUser.name}` : ''}.`,
      ],
    );

    return getTaskById(id);
  }

  if (action === 'finish') {
    const actualStartDate = formatDateKey(currentTask.actual_start_date) || realizationDate;

    if (realizationDate < actualStartDate) {
      throw new Error('Tanggal selesai realisasi tidak boleh lebih awal dari tanggal mulai realisasi.');
    }

    const actualMetrics = await calculateTaskDateMetrics(actualStartDate, realizationDate);

    await query(
      `
        UPDATE tasks
        SET
          actual_start_date = $1,
          actual_end_date = $2,
          actual_duration_days = $3,
          actual_work_days = $4,
          realization_mode = 'normal',
          progress = $5,
          status = 'Waiting Review'
        WHERE id = $6
      `,
      [actualStartDate, realizationDate, actualMetrics.duration_days, actualMetrics.work_days, REVIEW_PROGRESS, id],
    );

    await query(
      `
        INSERT INTO activity_logs (task_id, project_id, user_id, action, description)
        VALUES ($1, $2, $3, 'task_realization_finished', $4)
      `,
      [
        id,
        currentTask.project_id,
        actionUser?.id || null,
        `Realisasi task "${currentTask.title}" selesai pada ${realizationDate}${actionUser ? ` oleh ${actionUser.name}` : ''} dan menunggu approval lead.`,
      ],
    );

    await recalculateProjectTaskProgress(currentTask.project_id);

    return getTaskById(id);
  }

  throw new Error('Aksi realisasi tidak valid.');
};

// Memindahkan task antar bucket/status/urutan seperti saat drag and drop di board.
const moveTask = async (id, payload) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  const status = payload.status || currentTask.status;
  const taskState = resolveManualTaskState(currentTask.progress, status);

  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Status task tidak valid.');
  }

  await query(
    `
      UPDATE tasks
      SET bucket_id = $1, status = $2, progress = $3, sort_order = $4
      WHERE id = $5
    `,
    [
      payload.bucket_id === undefined ? currentTask.bucket_id : payload.bucket_id || null,
      taskState.status,
      taskState.progress,
      payload.sort_order === undefined ? currentTask.sort_order : payload.sort_order || 0,
      id,
    ],
  );

  await recalculateProjectTaskProgress(currentTask.project_id);

  return getTaskById(id);
};

// Mengubah parent task lalu menghitung ulang rollup progress dan tanggal.
const updateTaskParent = async (id, parentTaskId) => {
  const currentTask = await getTaskRawById(id);

  if (!currentTask) {
    throw new Error('Task tidak ditemukan.');
  }

  await ensureValidParent(id, parentTaskId, currentTask.project_id);
  await query('UPDATE tasks SET parent_task_id = $1 WHERE id = $2', [parentTaskId || null, id]);
  await recalculateProjectTaskProgress(currentTask.project_id);

  return getTaskById(id);
};

// Mengambil task untuk satu project saja.
const getProjectTasks = async (projectId, options = {}) => {
  return getTasks({
    ...options,
    project_id: projectId,
  });
};

// Mengambil semua subtask turunannya dari satu task.
const getSubtasks = async (id) => {
  const task = await getTaskRawById(id);

  if (!task) {
    throw new Error('Task tidak ditemukan.');
  }

  const tree = await getProjectTasks(task.project_id, { tree: true });
  const flattened = flattenTaskTree(tree);
  const selectedTask = flattened.find((item) => Number(item.id) === Number(id));

  return selectedTask?.children || [];
};

// Menghitung ulang progress dan tanggal akhir parent task berdasarkan child task-nya.
async function recalculateProjectTaskProgress(projectId) {
  if (!projectId) {
    return 0;
  }

  const result = await query(
    `
      SELECT id, parent_task_id, progress, status, start_date, end_date
      FROM tasks
      WHERE project_id = $1
      ORDER BY sort_order, id
    `,
    [projectId],
  );

  const taskById = new Map(result.rows.map((task) => [task.id, task]));
  const childrenByParentId = new Map();

  result.rows.forEach((task) => {
    if (!task.parent_task_id) {
      return;
    }

    const children = childrenByParentId.get(task.parent_task_id) || [];
    children.push(task);
    childrenByParentId.set(task.parent_task_id, children);
  });

  const progressByTaskId = new Map();
  const endDateByTaskId = new Map();
  const updates = [];

  const isApprovedTaskState = (task) => {
    return task?.status === 'Done' && clampProgress(task?.progress || 0) === APPROVED_PROGRESS;
  };

  const isReadyForApprovalState = (task) => {
    return isApprovedTaskState(task) || (task?.status === 'Waiting Review' && clampProgress(task?.progress || 0) >= REVIEW_PROGRESS);
  };

  // Menyimpan perubahan rollup agar satu task hanya diupdate sekali.
  const addRollupUpdate = (taskId, update) => {
    const existingUpdate = updates.find((item) => Number(item.id) === Number(taskId));

    if (existingUpdate) {
      Object.assign(existingUpdate, update);
      return;
    }

    updates.push({ id: taskId, ...update });
  };

  // Menghitung progress dan tanggal akhir dari bawah ke atas dalam pohon task.
  const computeTaskRollup = (taskId) => {
    if (progressByTaskId.has(taskId)) {
      return {
        endDate: endDateByTaskId.get(taskId),
        progress: progressByTaskId.get(taskId),
      };
    }

    const task = taskById.get(taskId);
    const children = childrenByParentId.get(taskId) || [];
    const currentEndDate = formatDateKey(task?.end_date);

    if (!children.length) {
      const leafProgress = clampProgress(task?.progress || 0);
      progressByTaskId.set(taskId, leafProgress);
      endDateByTaskId.set(taskId, currentEndDate);

      return {
        approved: isApprovedTaskState(task),
        endDate: currentEndDate,
        progress: leafProgress,
        readyForApproval: isReadyForApprovalState(task),
      };
    }

    const childRollups = children.map((child) => computeTaskRollup(child.id));
    const childProgressTotal = childRollups.reduce((sum, childRollup) => sum + childRollup.progress, 0);
    const allChildrenApproved = childRollups.every((childRollup) => childRollup.approved);
    const allChildrenReadyForApproval = childRollups.every((childRollup) => childRollup.readyForApproval);
    let computedProgress = Math.round(childProgressTotal / children.length);
    const rollupEndDate = getMaxDateKey([currentEndDate, ...childRollups.map((childRollup) => childRollup.endDate)]);
    let status = task.status;

    if (allChildrenApproved) {
      const parentAlreadyApproved = isApprovedTaskState(task);
      computedProgress = parentAlreadyApproved ? APPROVED_PROGRESS : REVIEW_PROGRESS;
      status = parentAlreadyApproved ? 'Done' : 'Waiting Review';
    } else if (allChildrenReadyForApproval) {
      computedProgress = REVIEW_PROGRESS;
      status = 'Waiting Review';
    } else {
      computedProgress = Math.min(computedProgress, REVIEW_PROGRESS - 1);
    }

    if (!allChildrenReadyForApproval && (status === 'Done' || status === 'Waiting Review' || status === 'Not Started')) {
      status = computedProgress === 0 ? 'Not Started' : 'In Progress';
    }

    progressByTaskId.set(taskId, computedProgress);
    endDateByTaskId.set(taskId, rollupEndDate);
    addRollupUpdate(taskId, {
      endDate: rollupEndDate,
      progress: computedProgress,
      shouldUpdateEndDate: rollupEndDate !== currentEndDate,
      status,
    });

    return {
      approved: status === 'Done' && computedProgress === APPROVED_PROGRESS,
      endDate: rollupEndDate,
      progress: computedProgress,
      readyForApproval: status === 'Waiting Review' || (status === 'Done' && computedProgress === APPROVED_PROGRESS),
    };
  };

  const rootTasks = result.rows.filter((task) => !task.parent_task_id || !taskById.has(task.parent_task_id));
  rootTasks.forEach((task) => computeTaskRollup(task.id));

  await Promise.all(
    updates.map(async (update) => {
      if (!update.shouldUpdateEndDate) {
        await query('UPDATE tasks SET progress = $1, status = $2 WHERE id = $3', [
          update.progress,
          update.status,
          update.id,
        ]);
        return;
      }

      const task = taskById.get(update.id);
      const startDate = formatDateKey(task?.start_date);
      const dateMetrics = await calculateTaskDateMetrics(startDate, update.endDate);

      await query(
        `
          UPDATE tasks
          SET
            progress = $1,
            status = $2,
            end_date = $3,
            duration_days = $4,
            work_days = $5
          WHERE id = $6
        `,
        [update.progress, update.status, update.endDate, dateMetrics.duration_days, dateMetrics.work_days, update.id],
      );
    }),
  );

  await updateProjectProgress(projectId);

  const rootProgressTotal = rootTasks.reduce((sum, task) => sum + (progressByTaskId.get(task.id) || 0), 0);

  return rootTasks.length ? Math.round(rootProgressTotal / rootTasks.length) : 0;
}

module.exports = {
  VALID_PRIORITIES,
  VALID_STATUSES,
  approveTask,
  buildTaskTree,
  createTask,
  deleteTask,
  flattenTaskTree,
  getProjectTasks,
  getSubtasks,
  getTaskById,
  getTasks,
  moveTask,
  recalculateProjectTaskProgress,
  updateTask,
  updateTaskParent,
  updateTaskProgress,
  updateTaskRealization,
  updateTaskStatus,
};
