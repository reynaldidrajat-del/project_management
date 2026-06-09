const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { emitDashboardMetricsUpdated } = require('./dashboardMetricsService');
const { generateIssueKey } = require('./issueKeyService');
const { searchIssues } = require('./jqlService');
const { createNotificationsForUsers, normalizeUserIds } = require('./notificationService');
const { emitToProjectOrWorkspace } = require('./realtimeService');
const { getIssueWatcherIds } = require('./watcherService');

const AUTOMATION_SELECT = `
  SELECT
    ar.id,
    ar.project_id,
    p.name AS project_name,
    ar.name,
    ar.description,
    ar.trigger,
    ar.conditions,
    ar.actions,
    ar.is_enabled,
    ar.execution_count,
    ar.last_executed_at,
    ar.created_by,
    creator.name AS created_by_name,
    ar.created_at,
    ar.updated_at
  FROM automation_rules ar
  LEFT JOIN projects p ON p.id = ar.project_id
  LEFT JOIN users creator ON creator.id = ar.created_by
`;

const ALLOWED_UPDATE_FIELDS = new Set([
  'assignee_id',
  'bucket_id',
  'description',
  'end_date',
  'environment',
  'epic_id',
  'priority',
  'progress',
  'resolution',
  'sprint_id',
  'start_date',
  'status',
  'story_points',
  'title',
  'workflow_state_id',
]);

const LEGACY_STATUS_BY_WORKFLOW_CATEGORY = {
  DONE: 'Done',
  IN_PROGRESS: 'In Progress',
  TODO: 'Not Started',
};

const getActorUserId = (context = {}) => context.actor_user_id || context.user_id || null;

const emitAutomationRealtimeEvent = (eventName, rule, context = {}, metadata = {}) => {
  const projectId = rule?.project_id || metadata.project_id || null;
  const payload = {
    actor_user_id: getActorUserId(context),
    event: eventName,
    metadata,
    project_id: projectId ? Number(projectId) : null,
    rule: rule || null,
    rule_id: rule?.id ? Number(rule.id) : metadata.rule_id || null,
  };

  emitToProjectOrWorkspace(projectId, eventName, payload);
  emitToProjectOrWorkspace(projectId, 'automation.changed', payload);
};

const emitAutomationExecutionRealtimeEvent = (rule, issue, result, context = {}, sourcePayload = {}, eventType = null) => {
  const projectId = rule?.project_id || issue?.project_id || sourcePayload.project_id || sourcePayload.projectId || null;
  const realtimePayload = {
    actor_user_id: getActorUserId(context),
    event: 'automation.execution.created',
    issue_id: issue?.id ? Number(issue.id) : null,
    metadata: {
      status: result.status,
      action_results: result.action_results || [],
      condition_result: result.condition_result || null,
      error_message: result.error_message || null,
      event_type: eventType,
    },
    project_id: projectId ? Number(projectId) : null,
    result,
    rule,
    rule_id: rule?.id ? Number(rule.id) : result?.rule_id || null,
  };

  emitToProjectOrWorkspace(projectId, 'automation.execution.created', realtimePayload);
  emitToProjectOrWorkspace(projectId, 'automation.changed', realtimePayload);
  emitDashboardMetricsUpdated(projectId, {
    event: 'automation.execution.created',
    issue_id: realtimePayload.issue_id,
    rule_id: realtimePayload.rule_id,
    status: result.status,
  });
};

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeOptionalPositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  return [value];
};

const normalizeTriggerType = (trigger) => {
  if (!trigger) {
    return null;
  }

  if (typeof trigger === 'string') {
    return trigger;
  }

  return trigger.type || trigger.event || trigger.name || null;
};

const normalizeOperator = (operator = 'equals') => String(operator).trim().toLowerCase();

const getIssueForAutomation = async (issueId) => {
  if (!issueId) {
    return null;
  }

  const result = await query(
    `
    SELECT
      t.*,
      p.name AS project_name,
      p.project_key,
      assignee.name AS assignee_name,
      creator.name AS creator_name,
      issue_type.name AS issue_type_name
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN issue_types issue_type ON issue_type.id = t.issue_type_id
    WHERE t.id = $1
    `,
    [issueId],
  );

  return result.rows[0] || null;
};

const getRuleById = async (ruleId) => {
  const result = await query(
    `
    ${AUTOMATION_SELECT}
    WHERE ar.id = $1
    `,
    [ruleId],
  );

  return result.rows[0] || null;
};

const listAutomationRules = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id || filters.projectId) {
    values.push(normalizePositiveInteger(filters.project_id || filters.projectId, 'Project ID'));
    conditions.push('(ar.project_id = $' + values.length + ' OR ar.project_id IS NULL)');
  }

  if (filters.enabled !== undefined || filters.is_enabled !== undefined) {
    const enabled = filters.enabled !== undefined ? filters.enabled : filters.is_enabled;
    values.push(enabled === true || enabled === 'true');
    conditions.push('ar.is_enabled = $' + values.length);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `
    ${AUTOMATION_SELECT}
    ${whereClause}
    ORDER BY ar.project_id NULLS FIRST, ar.name ASC
    `,
    values,
  );

  return result.rows;
};

const validateRulePayload = (payload = {}, partial = false) => {
  if (!partial && (!payload.name || !String(payload.name).trim())) {
    throw new Error('Automation rule name is required.');
  }

  const trigger = payload.trigger === undefined ? undefined : payload.trigger;
  const actions = payload.actions === undefined ? undefined : normalizeJsonArray(payload.actions);

  if (!partial && !normalizeTriggerType(trigger)) {
    throw new Error('Automation rule trigger is required.');
  }

  if (!partial && (!actions || actions.length === 0)) {
    throw new Error('Automation rule needs at least one action.');
  }

  if (trigger !== undefined && !normalizeTriggerType(trigger)) {
    throw new Error('Automation rule trigger type is required.');
  }

  if (actions !== undefined && actions.length === 0) {
    throw new Error('Automation rule needs at least one action.');
  }
};

const createAutomationRule = async (payload = {}, context = {}) => {
  validateRulePayload(payload);

  const result = await query(
    `
    INSERT INTO automation_rules (
      project_id,
      name,
      description,
      trigger,
      conditions,
      actions,
      is_enabled,
      created_by
    )
    VALUES ($1, $2, $3, $4::JSONB, $5::JSONB, $6::JSONB, $7, $8)
    RETURNING id
    `,
    [
      payload.project_id || payload.projectId || null,
      String(payload.name).trim(),
      payload.description || null,
      JSON.stringify(payload.trigger),
      JSON.stringify(normalizeJsonArray(payload.conditions)),
      JSON.stringify(normalizeJsonArray(payload.actions)),
      payload.is_enabled === undefined && payload.isEnabled === undefined
        ? true
        : Boolean(payload.is_enabled || payload.isEnabled),
      context.actor_user_id || context.user_id || null,
    ],
  );

  const rule = await getRuleById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: rule.project_id,
    action: 'automation_rule.create',
    object_type: 'automation_rule',
    object_id: rule.id,
    description: `Automation rule "${rule.name}" created.`,
    metadata: {
      trigger: rule.trigger,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  emitAutomationRealtimeEvent('automation.rule.created', rule, context, {
    action: 'automation.rule.create',
  });

  return rule;
};

const updateAutomationRule = async (ruleId, payload = {}, context = {}) => {
  const currentRule = await getRuleById(ruleId);

  if (!currentRule) {
    throw new Error('Automation rule not found.');
  }

  validateRulePayload(payload, true);

  const result = await query(
    `
    UPDATE automation_rules
    SET
      project_id = $1,
      name = $2,
      description = $3,
      trigger = $4::JSONB,
      conditions = $5::JSONB,
      actions = $6::JSONB,
      is_enabled = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING id
    `,
    [
      payload.project_id === undefined && payload.projectId === undefined
        ? currentRule.project_id
        : payload.project_id || payload.projectId || null,
      payload.name === undefined ? currentRule.name : String(payload.name).trim(),
      payload.description === undefined ? currentRule.description : payload.description || null,
      JSON.stringify(payload.trigger === undefined ? currentRule.trigger : payload.trigger),
      JSON.stringify(payload.conditions === undefined ? currentRule.conditions : normalizeJsonArray(payload.conditions)),
      JSON.stringify(payload.actions === undefined ? currentRule.actions : normalizeJsonArray(payload.actions)),
      payload.is_enabled === undefined && payload.isEnabled === undefined
        ? currentRule.is_enabled
        : Boolean(payload.is_enabled || payload.isEnabled),
      ruleId,
    ],
  );

  const rule = await getRuleById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: rule.project_id,
    action: 'automation_rule.update',
    object_type: 'automation_rule',
    object_id: rule.id,
    description: `Automation rule "${rule.name}" updated.`,
    metadata: {
      changed_fields: Object.keys(payload),
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  emitAutomationRealtimeEvent('automation.rule.updated', rule, context, {
    action: 'automation.rule.update',
    changed_fields: Object.keys(payload || {}),
  });

  return rule;
};

const setAutomationRuleEnabled = async (ruleId, isEnabled, context = {}) => {
  return updateAutomationRule(ruleId, { is_enabled: Boolean(isEnabled) }, context);
};

const deleteAutomationRule = async (ruleId, context = {}) => {
  const rule = await getRuleById(ruleId);

  if (!rule) {
    throw new Error('Automation rule not found.');
  }

  await query('DELETE FROM automation_rules WHERE id = $1', [ruleId]);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: rule.project_id,
    action: 'automation_rule.delete',
    object_type: 'automation_rule',
    object_id: Number(ruleId),
    description: `Automation rule "${rule.name}" deleted.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  emitAutomationRealtimeEvent('automation.rule.deleted', rule, context, {
    action: 'automation.rule.delete',
    rule_id: Number(ruleId),
  });

  return {
    deleted_rule_id: Number(ruleId),
  };
};

const listAutomationLogs = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.rule_id || filters.ruleId) {
    values.push(normalizePositiveInteger(filters.rule_id || filters.ruleId, 'Rule ID'));
    conditions.push(`al.rule_id = $${values.length}`);
  }

  if (filters.issue_id || filters.issueId) {
    values.push(normalizePositiveInteger(filters.issue_id || filters.issueId, 'Issue ID'));
    conditions.push(`al.issue_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`al.status = $${values.length}`);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  values.push(Number.isInteger(limit) && limit > 0 ? limit : 50);
  const limitParam = `$${values.length}`;

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `
    SELECT
      al.id,
      al.rule_id,
      ar.name AS rule_name,
      al.issue_id,
      t.issue_key,
      t.title AS issue_title,
      al.status,
      al.error_message,
      al.execution_time_ms,
      al.executed_at
    FROM automation_logs al
    INNER JOIN automation_rules ar ON ar.id = al.rule_id
    LEFT JOIN tasks t ON t.id = al.issue_id
    ${whereClause}
    ORDER BY al.executed_at DESC, al.id DESC
    LIMIT ${limitParam}
    `,
    values,
  );

  return result.rows;
};

const getFieldValue = (issue, field) => {
  const normalizedField = String(field || '').trim();
  const aliases = {
    assignee: 'assignee_id',
    issue_type: 'issue_type_name',
    issuetype: 'issue_type_name',
    reporter: 'creator_id',
    summary: 'title',
  };

  return issue?.[aliases[normalizedField] || normalizedField];
};

const compareValues = (leftValue, operator, rightValue) => {
  const normalizedOperator = normalizeOperator(operator);
  const values = normalizeJsonArray(rightValue);

  if (normalizedOperator === 'is_empty') {
    return leftValue === null || leftValue === undefined || leftValue === '';
  }

  if (normalizedOperator === 'is_not_empty') {
    return leftValue !== null && leftValue !== undefined && leftValue !== '';
  }

  if (normalizedOperator === 'in') {
    return values.some((value) => String(value).toLowerCase() === String(leftValue).toLowerCase());
  }

  if (normalizedOperator === 'not_in') {
    return !values.some((value) => String(value).toLowerCase() === String(leftValue).toLowerCase());
  }

  if (normalizedOperator === 'contains') {
    return String(leftValue || '').toLowerCase().includes(String(rightValue || '').toLowerCase());
  }

  if (normalizedOperator === 'not_contains') {
    return !String(leftValue || '').toLowerCase().includes(String(rightValue || '').toLowerCase());
  }

  const numericLeft = Number(leftValue);
  const numericRight = Number(rightValue);
  const canCompareNumeric = Number.isFinite(numericLeft) && Number.isFinite(numericRight);

  if (normalizedOperator === 'greater_than') {
    return canCompareNumeric && numericLeft > numericRight;
  }

  if (normalizedOperator === 'less_than') {
    return canCompareNumeric && numericLeft < numericRight;
  }

  if (normalizedOperator === 'not_equals' || normalizedOperator === '!=' || normalizedOperator === 'not_equal') {
    return String(leftValue).toLowerCase() !== String(rightValue).toLowerCase();
  }

  return String(leftValue).toLowerCase() === String(rightValue).toLowerCase();
};

const evaluateCondition = async (condition = {}, issue, context = {}) => {
  const type = condition.type || condition.condition || 'field_value';

  if (type === 'field_value') {
    return compareValues(getFieldValue(issue, condition.field), condition.operator, condition.value);
  }

  if (type === 'user_role') {
    return compareValues(context.actor_role || context.user_role, condition.operator || 'equals', condition.value || condition.role);
  }

  if (type === 'issue_type') {
    return compareValues(issue?.issue_type_name || issue?.issue_type_id, condition.operator || 'equals', condition.value || condition.issue_type);
  }

  if (type === 'custom_jql') {
    const jql = String(condition.jql || condition.query || '').trim();

    if (!jql || !issue?.id) {
      return false;
    }

    const searchResult = await searchIssues(`(${jql}) AND id = ${issue.id}`, {
      limit: 1,
      project_id: issue.project_id,
    });

    return searchResult.total > 0;
  }

  return false;
};

const evaluateConditions = async (conditions = [], issue, context = {}) => {
  const conditionResults = [];

  for (const condition of normalizeJsonArray(conditions)) {
    const passed = await evaluateCondition(condition, issue, context);
    conditionResults.push({
      condition,
      passed,
    });

    if (!passed) {
      return {
        details: conditionResults,
        passed: false,
      };
    }
  }

  return {
    details: conditionResults,
    passed: true,
  };
};

const updateIssueField = async (issueId, field, value) => {
  const normalizedField = String(field || '').trim();

  if (!ALLOWED_UPDATE_FIELDS.has(normalizedField)) {
    throw new Error(`Automation cannot update field "${normalizedField}".`);
  }

  await query(
    `
    UPDATE tasks
    SET ${normalizedField} = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [value === undefined ? null : value, issueId],
  );
};

const transitionIssueDirectly = async (issueId, action = {}) => {
  if (action.transition_id || action.transitionId) {
    const transitionResult = await query(
      `
      SELECT
        wt.id,
        wt.to_state_id,
        ws.category AS to_state_category
      FROM workflow_transitions wt
      INNER JOIN workflow_states ws ON ws.id = wt.to_state_id
      WHERE wt.id = $1
      `,
      [action.transition_id || action.transitionId],
    );
    const transition = transitionResult.rows[0];

    if (!transition) {
      throw new Error('Automation transition not found.');
    }

    await query(
      `
      UPDATE tasks
      SET workflow_state_id = $1,
          status = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [
        transition.to_state_id,
        LEGACY_STATUS_BY_WORKFLOW_CATEGORY[transition.to_state_category] || 'In Progress',
        issueId,
      ],
    );
    return;
  }

  if (action.status) {
    await updateIssueField(issueId, 'status', action.status);
    return;
  }

  throw new Error('Automation transition action requires transition_id or status.');
};

const getNotificationRecipients = async (issue, action = {}) => {
  const recipients = new Set(normalizeUserIds(action.user_ids || action.userIds || []));
  const recipientKeys = normalizeJsonArray(action.recipients || action.recipient || []);

  for (const recipientKey of recipientKeys) {
    if (recipientKey === 'assignee' && issue.assignee_id) {
      recipients.add(Number(issue.assignee_id));
    }

    if ((recipientKey === 'reporter' || recipientKey === 'creator') && issue.creator_id) {
      recipients.add(Number(issue.creator_id));
    }

    if (recipientKey === 'lead' && issue.lead_id) {
      recipients.add(Number(issue.lead_id));
    }

    if (recipientKey === 'watchers') {
      const watcherIds = await getIssueWatcherIds(issue.id);
      watcherIds.forEach((userId) => recipients.add(Number(userId)));
    }
  }

  return Array.from(recipients).filter(Boolean);
};

const createIssueFromAction = async (action = {}, sourceIssue, context = {}) => {
  if (!action.title) {
    throw new Error('Automation create_issue action requires a title.');
  }

  const projectId = action.project_id || sourceIssue?.project_id;

  if (!projectId) {
    throw new Error('Automation create_issue action requires a project_id when no source issue exists.');
  }

  const issueKey = await generateIssueKey(projectId);

  const result = await query(
    `
    INSERT INTO tasks (
      project_id,
      issue_key,
      title,
      description,
      status,
      priority,
      creator_id,
      parent_task_id,
      epic_id,
      sprint_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
    `,
    [
      projectId,
      issueKey,
      action.title,
      action.description || null,
      action.status || 'Not Started',
      action.priority || 'Medium',
      context.actor_user_id || context.user_id || sourceIssue?.creator_id || null,
      action.parent_task_id || null,
      action.epic_id || sourceIssue?.epic_id || null,
      action.sprint_id || sourceIssue?.sprint_id || null,
    ],
  );

  return result.rows[0].id;
};

const addCommentFromAction = async (issueId, action = {}, context = {}) => {
  if (!action.comment && !action.body) {
    throw new Error('Automation add_comment action requires a comment.');
  }

  await query(
    `
    INSERT INTO task_comments (task_id, user_id, comment)
    VALUES ($1, $2, $3)
    `,
    [
      issueId,
      context.actor_user_id || context.user_id || null,
      action.comment || action.body,
    ],
  );
};

const assignIssueFromAction = async (issueId, action = {}) => {
  const userIds = normalizeUserIds(action.user_ids || action.userIds || action.user_id || action.userId);

  if (!userIds.length) {
    throw new Error('Automation assign_user action requires at least one user.');
  }

  for (const userId of userIds) {
    await query(
      `
      INSERT INTO task_assignees (task_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (task_id, user_id) DO NOTHING
      `,
      [issueId, userId],
    );
  }

  await query(
    `
    UPDATE tasks
    SET assignee_id = COALESCE(assignee_id, $1),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [userIds[0], issueId],
  );
};

const executeAction = async (action = {}, issue, context = {}) => {
  const actionType = action.type || action.action;

  if (actionType === 'update_field') {
    await updateIssueField(issue.id, action.field, action.value);
    return { type: actionType, field: action.field };
  }

  if (actionType === 'transition_issue') {
    await transitionIssueDirectly(issue.id, action);
    return { type: actionType, transition_id: action.transition_id || action.transitionId || null, status: action.status || null };
  }

  if (actionType === 'send_notification') {
    const userIds = await getNotificationRecipients(issue, action);
    await createNotificationsForUsers(userIds, {
      actor_user_id: context.actor_user_id || context.user_id || null,
      type: action.notification_type || 'automation.notification',
      resource_type: 'automation_rule',
      resource_id: action.rule_id || null,
      task_id: issue.id,
      project_id: issue.project_id,
      title: action.title || `Automation notification for ${issue.issue_key || issue.title}`,
      body: action.body || action.message || null,
      metadata: {
        issue_key: issue.issue_key,
        issue_title: issue.title,
      },
    });
    return { type: actionType, recipient_count: userIds.length };
  }

  if (actionType === 'create_issue') {
    const createdIssueId = await createIssueFromAction(action, issue, context);
    return { type: actionType, created_issue_id: createdIssueId };
  }

  if (actionType === 'add_comment') {
    await addCommentFromAction(issue.id, action, context);
    return { type: actionType };
  }

  if (actionType === 'assign_user') {
    await assignIssueFromAction(issue.id, action);
    return { type: actionType };
  }

  throw new Error(`Unsupported automation action: ${actionType}.`);
};

const logAutomationExecution = async ({ ruleId, issueId, status, errorMessage = null, startedAt }) => {
  const executionTimeMs = Math.max(0, Date.now() - startedAt);

  await query(
    `
    INSERT INTO automation_logs (rule_id, issue_id, status, error_message, execution_time_ms)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [ruleId, issueId || null, status, errorMessage, executionTimeMs],
  );

  if (status !== 'skipped') {
    await query(
      `
      UPDATE automation_rules
      SET execution_count = COALESCE(execution_count, 0) + 1,
          last_executed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [ruleId],
    );
  }
};

const executeAutomationRule = async (rule, issue, payload = {}, context = {}, eventType = null) => {
  const startedAt = Date.now();

  try {
    const conditionResult = await evaluateConditions(rule.conditions, issue, context);

    if (!conditionResult.passed) {
      await logAutomationExecution({
        issueId: issue?.id || null,
        ruleId: rule.id,
        startedAt,
        status: 'skipped',
      });

      const result = {
        condition_result: conditionResult,
        rule_id: rule.id,
        status: 'skipped',
      };

      emitAutomationExecutionRealtimeEvent(rule, issue, result, context, payload, eventType);
      return result;
    }

    const actionResults = [];

    for (const action of normalizeJsonArray(rule.actions)) {
      actionResults.push(await executeAction({ ...action, rule_id: rule.id }, issue, context));
    }

    await logAutomationExecution({
      issueId: issue?.id || null,
      ruleId: rule.id,
      startedAt,
      status: 'success',
    });

    const result = {
      action_results: actionResults,
      condition_result: conditionResult,
      payload,
      rule_id: rule.id,
      status: 'success',
    };

    emitAutomationExecutionRealtimeEvent(rule, issue, result, context, payload, eventType);
    return result;
  } catch (error) {
    await logAutomationExecution({
      errorMessage: error.message,
      issueId: issue?.id || null,
      ruleId: rule.id,
      startedAt,
      status: 'failed',
    });

    const result = {
      error_message: error.message,
      payload,
      rule_id: rule.id,
      status: 'failed',
    };

    emitAutomationExecutionRealtimeEvent(rule, issue, result, context, payload, eventType);
    return result;
  }
};

const getEnabledRulesForTrigger = async (eventType, projectId = null) => {
  const result = await query(
    `
    ${AUTOMATION_SELECT}
    WHERE ar.is_enabled = TRUE
      AND (ar.project_id IS NULL OR ar.project_id = $1)
    ORDER BY ar.project_id NULLS FIRST, ar.id ASC
    `,
    [projectId],
  );

  return result.rows.filter((rule) => normalizeTriggerType(rule.trigger) === eventType);
};

const triggerAutomation = async (eventType, issueId = null, payload = {}, context = {}) => {
  const issue = issueId ? await getIssueForAutomation(issueId) : payload.issue || null;
  const projectId = issue?.project_id || payload.project_id || payload.projectId || null;
  const rules = await getEnabledRulesForTrigger(eventType, projectId);
  const results = [];

  for (const rule of rules) {
    results.push(await executeAutomationRule(rule, issue, payload, context, eventType));
  }

  return {
    event_type: eventType,
    issue_id: issue?.id || issueId || null,
    matched_rule_count: rules.length,
    results,
  };
};

module.exports = {
  createAutomationRule,
  deleteAutomationRule,
  executeAutomationRule,
  getRuleById,
  listAutomationLogs,
  listAutomationRules,
  setAutomationRuleEnabled,
  triggerAutomation,
  updateAutomationRule,
};
