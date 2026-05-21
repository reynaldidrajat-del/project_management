const { query } = require('../config/db');

// Query dasar untuk membaca project beserta owner, member, dan department terkait.
const PROJECT_SELECT = `
  SELECT
    p.id,
    p.name,
    p.description,
    NULL::INTEGER AS department_id,
    COALESCE(member_summary.department_names, 'Cross department') AS department_name,
    p.owner_id,
    owner_user.name AS owner_name,
    owner_user.department_id AS owner_department_id,
    owner_department.name AS owner_department_name,
    owner_user.location_id AS owner_location_id,
    owner_location.name AS owner_location_name,
    to_char(p.start_date, 'YYYY-MM-DD') AS start_date,
    to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
    p.status,
    p.progress,
    COALESCE(member_summary.member_count, 0)::INTEGER AS member_count,
    COALESCE(member_summary.members, '[]'::JSON) AS members,
    COALESCE(member_summary.departments, '[]'::JSON) AS departments,
    COALESCE(member_summary.locations, '[]'::JSON) AS locations,
    COALESCE(member_summary.department_names, '') AS department_names,
    COALESCE(member_summary.location_names, '') AS location_names,
    p.created_at,
    p.updated_at
  FROM projects p
  LEFT JOIN users owner_user ON owner_user.id = p.owner_id
  LEFT JOIN departments owner_department ON owner_department.id = owner_user.department_id
  LEFT JOIN locations owner_location ON owner_location.id = owner_user.location_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT member_user.id)::INTEGER AS member_count,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', member_user.id,
          'name', member_user.name,
          'email', member_user.email,
          'role', pm.role,
          'department_id', member_department.id,
          'department_name', member_department.name,
          'location_id', member_location.id,
          'location_name', member_location.name
        )
      ) FILTER (WHERE member_user.id IS NOT NULL) AS members,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', member_department.id,
          'name', member_department.name
        )
      ) FILTER (WHERE member_department.id IS NOT NULL) AS departments,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', member_location.id,
          'name', member_location.name
        )
      ) FILTER (WHERE member_location.id IS NOT NULL) AS locations,
      string_agg(DISTINCT member_department.name, ', ' ORDER BY member_department.name)
        FILTER (WHERE member_department.id IS NOT NULL) AS department_names,
      string_agg(DISTINCT member_location.name, ', ' ORDER BY member_location.name)
        FILTER (WHERE member_location.id IS NOT NULL) AS location_names
    FROM project_members pm
    LEFT JOIN users member_user ON member_user.id = pm.user_id
    LEFT JOIN departments member_department ON member_department.id = member_user.department_id
    LEFT JOIN locations member_location ON member_location.id = member_user.location_id
    WHERE pm.project_id = p.id
  ) member_summary ON TRUE
`;

// Membersihkan daftar member agar hanya berisi id user yang valid dan tidak duplikat.
const normalizeMemberIds = (memberIds = [], ownerId = null) => {
  const ids = new Set();

  if (ownerId) {
    ids.add(Number(ownerId));
  }

  memberIds
    .filter(Boolean)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .forEach((id) => ids.add(id));

  return Array.from(ids);
};

// Menambahkan user ke project atau memperbarui role-nya jika sudah ada.
const upsertProjectMember = async (projectId, userId, role = 'member') => {
  if (!projectId || !userId) {
    return null;
  }

  const result = await query(
    `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, user_id) DO UPDATE
      SET role = CASE
        WHEN project_members.role = 'owner' THEN 'owner'
        ELSE EXCLUDED.role
      END
      RETURNING *
    `,
    [projectId, userId, role],
  );

  return result.rows[0] || null;
};

// Mengganti daftar member project dengan data terbaru dari form.
const replaceProjectMembers = async (projectId, memberIds = [], ownerId = null) => {
  const normalizedMemberIds = normalizeMemberIds(memberIds, ownerId);

  await query('DELETE FROM project_members WHERE project_id = $1', [projectId]);

  await Promise.all(
    normalizedMemberIds.map((userId) => upsertProjectMember(projectId, userId, Number(userId) === Number(ownerId) ? 'owner' : 'member')),
  );
};

const buildUserInvolvementFilter = ({ departmentParam, locationParam }) => {
  const userConditions = [];

  if (departmentParam) {
    userConditions.push(`{alias}.department_id = ${departmentParam}`);
  }

  if (locationParam) {
    userConditions.push(`{alias}.location_id = ${locationParam}`);
  }

  return userConditions;
};

// Mengambil daftar project, termasuk filter status, owner, department, lokasi, dan rentang tanggal.
const getProjects = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`p.status = $${values.length}`);
  }

  if (filters.owner_id) {
    values.push(filters.owner_id);
    conditions.push(`p.owner_id = $${values.length}`);
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
    const involvementFilter = buildUserInvolvementFilter({ departmentParam, locationParam });
    const memberConditions = involvementFilter.map((condition) => condition.replaceAll('{alias}', 'member_filter')).join(' AND ');
    const taskUserConditions = involvementFilter.map((condition) => condition.replaceAll('{alias}', 'task_user_filter')).join(' AND ');
    const legacyTaskUserConditions = involvementFilter.map((condition) => condition.replaceAll('{alias}', 'legacy_task_user_filter')).join(' AND ');

    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM project_members pm_filter
          INNER JOIN users member_filter ON member_filter.id = pm_filter.user_id
          WHERE pm_filter.project_id = p.id
            AND ${memberConditions}
        )
        OR EXISTS (
          SELECT 1
          FROM tasks task_filter
          INNER JOIN task_assignees task_assignee_filter ON task_assignee_filter.task_id = task_filter.id
          INNER JOIN users task_user_filter ON task_user_filter.id = task_assignee_filter.user_id
          WHERE task_filter.project_id = p.id
            AND ${taskUserConditions}
        )
        OR EXISTS (
          SELECT 1
          FROM tasks legacy_task_filter
          INNER JOIN users legacy_task_user_filter ON legacy_task_user_filter.id = legacy_task_filter.assignee_id
          WHERE legacy_task_filter.project_id = p.id
            AND ${legacyTaskUserConditions}
        )
      )
    `);
  }

  if (filters.start_date) {
    values.push(filters.start_date);
    conditions.push(`(p.end_date IS NULL OR p.end_date >= $${values.length})`);
  }

  if (filters.end_date) {
    values.push(filters.end_date);
    conditions.push(`(p.start_date IS NULL OR p.start_date <= $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`${PROJECT_SELECT} ${whereClause} ORDER BY p.created_at DESC`, values);

  return result.rows;
};

// Mengambil detail project berdasarkan id.
const getProjectById = async (id) => {
  const result = await query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  return result.rows[0] || null;
};

// Memvalidasi data project sebelum masuk database.
const validateProject = (payload) => {
  if (!payload.name) {
    throw new Error('Nama project wajib diisi.');
  }

  if (payload.status && !['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'].includes(payload.status)) {
    throw new Error('Status project tidak valid.');
  }
};

// Membuat project baru lalu menyimpan owner/member project.
const createProject = async (payload) => {
  validateProject(payload);

  const result = await query(
    `
      INSERT INTO projects (name, description, owner_id, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      payload.name,
      payload.description || null,
      payload.owner_id || null,
      payload.start_date || null,
      payload.end_date || null,
      payload.status || 'Planning',
    ],
  );

  await replaceProjectMembers(result.rows[0].id, payload.member_ids || [], payload.owner_id || null);

  return getProjectById(result.rows[0].id);
};

// Mengubah project dan, jika dikirim, memperbarui daftar membernya.
const updateProject = async (id, payload) => {
  validateProject(payload);

  const result = await query(
    `
      UPDATE projects
      SET
        name = $1,
        description = $2,
        owner_id = $3,
        start_date = $4,
        end_date = $5,
        status = $6
      WHERE id = $7
      RETURNING id
    `,
    [
      payload.name,
      payload.description || null,
      payload.owner_id || null,
      payload.start_date || null,
      payload.end_date || null,
      payload.status || 'Planning',
      id,
    ],
  );

  if (!result.rows[0]) {
    throw new Error('Project tidak ditemukan.');
  }

  if (Array.isArray(payload.member_ids) || payload.owner_id) {
    await replaceProjectMembers(id, payload.member_ids || [], payload.owner_id || null);
  }

  return getProjectById(id);
};

// Menghapus project berdasarkan id.
const deleteProject = async (id) => {
  const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);

  if (!result.rows[0]) {
    throw new Error('Project tidak ditemukan.');
  }

  return result.rows[0];
};

// Menghitung progress project dari rata-rata progress task utama.
const updateProjectProgress = async (projectId) => {
  const result = await query(
    `
      SELECT COALESCE(ROUND(AVG(progress))::INTEGER, 0) AS progress
      FROM tasks
      WHERE project_id = $1 AND parent_task_id IS NULL
    `,
    [projectId],
  );
  const progress = Number(result.rows[0]?.progress || 0);

  await query('UPDATE projects SET progress = $1 WHERE id = $2', [progress, projectId]);

  return progress;
};

module.exports = {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  replaceProjectMembers,
  updateProject,
  updateProjectProgress,
  upsertProjectMember,
};
