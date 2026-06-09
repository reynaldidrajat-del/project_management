const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { hasPermission } = require('./permissionService');
const {
  VALID_STATUSES,
  deleteTask,
  getTaskById,
  updateTask,
  updateTaskStatus,
} = require('./taskService');

const BULK_ACTIONS = {
  ASSIGNEE: 'assignee',
  DELETE: 'delete',
  SPRINT: 'sprint',
  STATUS: 'status',
};

const ACTION_PERMISSION = {
  [BULK_ACTIONS.ASSIGNEE]: { action: 'update', resource: 'task' },
  [BULK_ACTIONS.DELETE]: { action: 'delete', resource: 'task' },
  [BULK_ACTIONS.SPRINT]: { action: 'update', resource: 'task' },
  [BULK_ACTIONS.STATUS]: { action: 'update', resource: 'task' },
};

const ELEVATED_ROLES = new Set(['super_admin', 'admin', 'manager']);

const normalizeRole = (role) => String(role || 'viewer').trim();

const normalizePositiveInteger = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const normalizeIdList = (values = []) => {
  const rawValues = Array.isArray(values) ? values : [values];

  return Array.from(
    new Set(
      rawValues
        .map((value) => normalizePositiveInteger(value))
        .filter(Boolean),
    ),
  );
};

const getActorUserId = (context = {}) =>
  normalizePositiveInteger(context.actor_user_id || context.user_id || context.user?.id);

const getRequestedIssueIds = (payload = {}) =>
  normalizeIdList(payload.issue_ids || payload.issueIds || payload.task_ids || payload.taskIds);

const canAccessProjectIssue = (issue, user) => {
  if (!issue) {
    return false;
  }

  if (ELEVATED_ROLES.has(normalizeRole(user?.role))) {
    return true;
  }

  const userId = normalizePositiveInteger(user?.id);

  if (!userId) {
    return false;
  }

  return Number(issue.project_owner_id) === userId || Boolean(issue.is_project_member);
};

const getIssuesForBulkOperation = async (issueIds, userId) => {
  const result = await query(
    `
      SELECT
        t.id,
        t.project_id,
        t.title,
        t.status,
        t.progress,
        t.sprint_id,
        t.assignee_id,
        p.owner_id AS project_owner_id,
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = t.project_id
            AND pm.user_id = $2
        ) AS is_project_member
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ANY($1::INTEGER[])
        AND t.deleted_at IS NULL
    `,
    [issueIds, userId || null],
  );

  return new Map(result.rows.map((issue) => [Number(issue.id), issue]));
};

const getSprintForBulkAssignment = async (sprintId) => {
  if (!sprintId) {
    return null;
  }

  const result = await query(
    `
      SELECT id, project_id, state
      FROM sprints
      WHERE id = $1
    `,
    [sprintId],
  );

  const sprint = result.rows[0];

  if (!sprint) {
    throw new Error('Sprint tidak ditemukan.');
  }

  if (sprint.state === 'CLOSED') {
    throw new Error('Issue tidak bisa dipindahkan ke sprint yang sudah closed.');
  }

  return sprint;
};

const validateAssignees = async (assigneeIds) => {
  if (!assigneeIds.length) {
    return;
  }

  const result = await query('SELECT id FROM users WHERE id = ANY($1::INTEGER[]) AND is_active = TRUE', [assigneeIds]);
  const existingIds = new Set(result.rows.map((row) => Number(row.id)));
  const missingIds = assigneeIds.filter((assigneeId) => !existingIds.has(Number(assigneeId)));

  if (missingIds.length) {
    throw new Error(`Assignee tidak valid: ${missingIds.join(', ')}.`);
  }
};

const getNextBacklogOrder = async (projectId) => {
  const result = await query(
    `
      SELECT COALESCE(MAX(backlog_order), 0)::INTEGER AS max_order
      FROM tasks
      WHERE project_id = $1
        AND sprint_id IS NULL
    `,
    [projectId],
  );

  return Number(result.rows[0]?.max_order || 0) + 1;
};

const buildActionPayload = async (payload = {}) => {
  const action = payload.action;

  if (!Object.values(BULK_ACTIONS).includes(action)) {
    throw new Error('Aksi bulk operation tidak valid.');
  }

  if (action === BULK_ACTIONS.STATUS) {
    if (!VALID_STATUSES.includes(payload.status)) {
      throw new Error('Status task tidak valid.');
    }

    return { status: payload.status };
  }

  if (action === BULK_ACTIONS.ASSIGNEE) {
    const hasAssigneePayload = payload.assignee_ids !== undefined || payload.assigneeIds !== undefined || payload.assignee_id !== undefined || payload.assigneeId !== undefined;
    const assigneeIds = normalizeIdList(
      payload.assignee_ids !== undefined
        ? payload.assignee_ids
        : payload.assigneeIds !== undefined
          ? payload.assigneeIds
          : payload.assignee_id !== undefined
            ? payload.assignee_id
            : payload.assigneeId,
    );

    if (!hasAssigneePayload) {
      throw new Error('Assignee wajib dikirim untuk bulk assignee.');
    }

    await validateAssignees(assigneeIds);

    return { assignee_ids: assigneeIds };
  }

  if (action === BULK_ACTIONS.SPRINT) {
    const sprintId = normalizePositiveInteger(payload.sprint_id ?? payload.sprintId);
    const sprint = await getSprintForBulkAssignment(sprintId);

    return { sprint, sprint_id: sprintId };
  }

  return {};
};

const runIssueOperation = async (issue, action, actionPayload, context) => {
  if (action === BULK_ACTIONS.STATUS) {
    return updateTaskStatus(issue.id, actionPayload.status, context);
  }

  if (action === BULK_ACTIONS.ASSIGNEE) {
    return updateTask(
      issue.id,
      {
        assignee_id: actionPayload.assignee_ids[0] || null,
        assignee_ids: actionPayload.assignee_ids,
      },
      context,
    );
  }

  if (action === BULK_ACTIONS.SPRINT) {
    if (actionPayload.sprint && Number(actionPayload.sprint.project_id) !== Number(issue.project_id)) {
      throw new Error('Sprint tujuan harus berada di project yang sama dengan issue.');
    }

    if (actionPayload.sprint_id) {
      return updateTask(
        issue.id,
        {
          backlog_order: null,
          sprint_id: actionPayload.sprint_id,
        },
        context,
      );
    }

    return updateTask(
      issue.id,
      {
        backlog_order: await getNextBacklogOrder(issue.project_id),
        sprint_id: null,
      },
      context,
    );
  }

  if (action === BULK_ACTIONS.DELETE) {
    await deleteTask(issue.id, context);
    return { id: issue.id };
  }

  throw new Error('Aksi bulk operation tidak valid.');
};

const buildFailure = (issueId, reason) => ({
  issue_id: Number(issueId),
  reason,
  success: false,
});

const buildSuccess = (issueId, issue) => ({
  issue,
  issue_id: Number(issueId),
  success: true,
});

const executeBulkOperation = async (payload = {}, context = {}) => {
  const issueIds = getRequestedIssueIds(payload);

  if (!issueIds.length) {
    throw new Error('Pilih minimal satu issue untuk bulk operation.');
  }

  const action = payload.action;
  const permission = ACTION_PERMISSION[action];
  const actionPayload = await buildActionPayload(payload);
  const actorUserId = getActorUserId(context);
  const issuesById = await getIssuesForBulkOperation(issueIds, actorUserId);
  const globalPermissionAllowed = permission
    ? await hasPermission(context.user, permission.resource, permission.action)
    : false;
  const results = [];

  for (const issueId of issueIds) {
    const issue = issuesById.get(Number(issueId));

    if (!issue) {
      results.push(buildFailure(issueId, 'Issue tidak ditemukan.'));
      continue;
    }

    if (!globalPermissionAllowed || !canAccessProjectIssue(issue, context.user)) {
      results.push(buildFailure(issueId, 'User tidak memiliki izin untuk menjalankan aksi ini pada issue tersebut.'));
      continue;
    }

    try {
      const updatedIssue = await runIssueOperation(issue, action, actionPayload, context);
      results.push(buildSuccess(issueId, updatedIssue || (await getTaskById(issueId))));
    } catch (error) {
      results.push(buildFailure(issueId, error.message || 'Bulk operation gagal untuk issue ini.'));
    }
  }

  const succeeded = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);
  const affectedProjectIds = Array.from(
    new Set(
      results
        .map((result) => issuesById.get(Number(result.issue_id))?.project_id)
        .filter(Boolean)
        .map(Number),
    ),
  );

  await logActivity({
    actor_user_id: actorUserId,
    action: `bulk_operation.${action}`,
    object_type: 'bulk_operation',
    description: `Bulk operation ${action} diproses untuk ${issueIds.length} issue.`,
    metadata: {
      action,
      failed_count: failed.length,
      issue_ids: issueIds,
      payload: {
        assignee_ids: actionPayload.assignee_ids,
        sprint_id: actionPayload.sprint_id,
        status: actionPayload.status,
      },
      succeeded_count: succeeded.length,
    },
    project_id: affectedProjectIds.length === 1 ? affectedProjectIds[0] : null,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    action,
    failed_count: failed.length,
    failures: failed,
    issue_ids: issueIds,
    results,
    succeeded_count: succeeded.length,
    successes: succeeded,
    total_count: issueIds.length,
  };
};

module.exports = {
  BULK_ACTIONS,
  executeBulkOperation,
  normalizeIdList,
};
