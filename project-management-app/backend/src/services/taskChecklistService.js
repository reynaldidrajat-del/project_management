const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const CHECKLIST_SELECT = `
  SELECT
    tc.id,
    tc.task_id,
    t.project_id,
    tc.parent_checklist_id,
    tc.title,
    tc.is_done,
    tc.assignee_id,
    assignee.name AS assignee_name,
    to_char(tc.due_date, 'YYYY-MM-DD') AS due_date,
    tc.sort_order,
    tc.created_by,
    creator.name AS created_by_name,
    tc.completed_at,
    tc.created_at,
    tc.updated_at
  FROM task_checklists tc
  INNER JOIN tasks t ON t.id = tc.task_id
  LEFT JOIN users assignee ON assignee.id = tc.assignee_id
  LEFT JOIN users creator ON creator.id = tc.created_by
`;

const normalizeChecklistTitle = (title) => String(title || '').trim().replace(/\s+/g, ' ');

const getTaskChecklists = async (taskId) => {
  const result = await query(`${CHECKLIST_SELECT} WHERE tc.task_id = $1 ORDER BY tc.sort_order, tc.id`, [taskId]);
  return result.rows;
};

const getChecklistById = async (id) => {
  const result = await query(`${CHECKLIST_SELECT} WHERE tc.id = $1`, [id]);
  return result.rows[0] || null;
};

const createTaskChecklist = async (taskId, payload = {}, context = {}) => {
  const title = normalizeChecklistTitle(payload.title);

  if (!title) {
    throw new Error('Judul checklist wajib diisi.');
  }

  const taskResult = await query('SELECT id, project_id, title FROM tasks WHERE id = $1', [taskId]);
  const task = taskResult.rows[0];

  if (!task) {
    throw new Error('Task tidak ditemukan.');
  }

  const result = await query(
    `
      INSERT INTO task_checklists (
        task_id,
        parent_checklist_id,
        title,
        is_done,
        assignee_id,
        due_date,
        sort_order,
        created_by,
        completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING id
    `,
    [
      taskId,
      payload.parent_checklist_id || null,
      title,
      Boolean(payload.is_done),
      payload.assignee_id || null,
      payload.due_date || null,
      payload.sort_order || 0,
      context.actor_user_id || null,
    ],
  );

  const checklist = await getChecklistById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    task_id: task.id,
    project_id: task.project_id,
    action: 'task_checklist.create',
    object_type: 'task_checklist',
    object_id: checklist.id,
    description: `Checklist "${checklist.title}" dibuat untuk task "${task.title}".`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return checklist;
};

const updateTaskChecklist = async (id, payload = {}, context = {}) => {
  const currentChecklist = await getChecklistById(id);

  if (!currentChecklist) {
    throw new Error('Checklist tidak ditemukan.');
  }

  const title = payload.title === undefined ? currentChecklist.title : normalizeChecklistTitle(payload.title);

  if (!title) {
    throw new Error('Judul checklist wajib diisi.');
  }

  const nextIsDone = payload.is_done === undefined ? currentChecklist.is_done : Boolean(payload.is_done);

  await query(
    `
      UPDATE task_checklists
      SET
        parent_checklist_id = $1,
        title = $2,
        is_done = $3,
        assignee_id = $4,
        due_date = $5,
        sort_order = $6,
        completed_at = CASE
          WHEN $3 = TRUE AND completed_at IS NULL THEN CURRENT_TIMESTAMP
          WHEN $3 = FALSE THEN NULL
          ELSE completed_at
        END
      WHERE id = $7
    `,
    [
      payload.parent_checklist_id === undefined ? currentChecklist.parent_checklist_id : payload.parent_checklist_id || null,
      title,
      nextIsDone,
      payload.assignee_id === undefined ? currentChecklist.assignee_id : payload.assignee_id || null,
      payload.due_date === undefined ? currentChecklist.due_date : payload.due_date || null,
      payload.sort_order === undefined ? currentChecklist.sort_order : payload.sort_order || 0,
      id,
    ],
  );

  const checklist = await getChecklistById(id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    task_id: checklist.task_id,
    project_id: checklist.project_id,
    action: 'task_checklist.update',
    object_type: 'task_checklist',
    object_id: checklist.id,
    description: `Checklist "${checklist.title}" diperbarui.`,
    metadata: { is_done: checklist.is_done },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return checklist;
};

const deleteTaskChecklist = async (id, context = {}) => {
  const checklist = await getChecklistById(id);

  if (!checklist) {
    throw new Error('Checklist tidak ditemukan.');
  }

  await logActivity({
    actor_user_id: context.actor_user_id,
    task_id: checklist.task_id,
    project_id: checklist.project_id,
    action: 'task_checklist.delete',
    object_type: 'task_checklist',
    object_id: checklist.id,
    description: `Checklist "${checklist.title}" dihapus.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  await query('DELETE FROM task_checklists WHERE id = $1', [id]);

  return { id: Number(id) };
};

module.exports = {
  createTaskChecklist,
  deleteTaskChecklist,
  getTaskChecklists,
  updateTaskChecklist,
};
