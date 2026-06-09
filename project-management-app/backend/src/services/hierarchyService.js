const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { createTask, getSubtasks, getTaskById, updateTask } = require('./taskService');

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const getIssueTypeByName = async (name, projectId = null) => {
  const result = await query(
    `
    SELECT id, name, allowed_parent_types, allowed_child_types, hierarchy_level
    FROM issue_types
    WHERE name = $1
      AND (project_id IS NULL OR project_id = $2)
    ORDER BY project_id NULLS LAST
    LIMIT 1
    `,
    [name, projectId],
  );

  return result.rows[0] || null;
};

const getIssueWithType = async (issueId) => {
  const result = await query(
    `
    SELECT
      t.*,
      it.name AS issue_type_name,
      it.allowed_parent_types,
      it.allowed_child_types,
      it.hierarchy_level
    FROM tasks t
    LEFT JOIN issue_types it ON it.id = t.issue_type_id
    WHERE t.id = $1
    `,
    [issueId],
  );

  if (!result.rows[0]) {
    throw new Error('Issue not found.');
  }

  return result.rows[0];
};

const createSubtask = async (parentIssueId, payload = {}, context = {}) => {
  const parentIssue = await getIssueWithType(parentIssueId);
  const subtaskType = payload.issue_type_id || payload.issueTypeId
    ? null
    : await getIssueTypeByName('Subtask', parentIssue.project_id);
  const subtask = await createTask({
    ...payload,
    epic_id: payload.epic_id || payload.epicId || parentIssue.epic_id || null,
    issue_type_id: payload.issue_type_id || payload.issueTypeId || subtaskType?.id || null,
    parent_task_id: parentIssue.id,
    project_id: parentIssue.project_id,
    sprint_id: payload.sprint_id || payload.sprintId || parentIssue.sprint_id || null,
  }, context);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: parentIssue.project_id,
    task_id: parentIssue.id,
    action: 'issue_hierarchy.subtask.create',
    object_type: 'task',
    object_id: subtask.id,
    description: `Subtask "${subtask.title}" created under "${parentIssue.title}".`,
    metadata: {
      parent_task_id: parentIssue.id,
      subtask_id: subtask.id,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return subtask;
};

const convertIssueType = async (issueId, payload = {}, context = {}) => {
  const issue = await getIssueWithType(issueId);
  const targetIssueTypeId = normalizePositiveInteger(payload.issue_type_id || payload.issueTypeId, 'Issue type ID');
  const parentTaskId = payload.parent_task_id === undefined && payload.parentTaskId === undefined
    ? issue.parent_task_id
    : payload.parent_task_id || payload.parentTaskId || null;

  const updatedIssue = await updateTask(issue.id, {
    issue_type_id: targetIssueTypeId,
    parent_task_id: parentTaskId,
  }, context);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: issue.project_id,
    task_id: issue.id,
    action: 'issue_hierarchy.type.convert',
    object_type: 'task',
    object_id: issue.id,
    description: `Issue "${issue.title}" converted from ${issue.issue_type_name || 'Unclassified'} to issue type ${targetIssueTypeId}.`,
    metadata: {
      parent_task_id: parentTaskId,
      previous_issue_type_id: issue.issue_type_id,
      target_issue_type_id: targetIssueTypeId,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return updatedIssue;
};

const getIssueHierarchy = async (issueId) => {
  const issue = await getTaskById(issueId);

  if (!issue) {
    throw new Error('Issue not found.');
  }

  return {
    issue,
    subtasks: await getSubtasks(issueId),
  };
};

module.exports = {
  convertIssueType,
  createSubtask,
  getIssueHierarchy,
};
