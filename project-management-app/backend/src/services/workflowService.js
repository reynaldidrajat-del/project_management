const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// Workflow state categories
const STATE_CATEGORIES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
};

// Default workflow states
const DEFAULT_WORKFLOW_STATES = [
  { name: 'To Do', category: 'TODO', color: '#DFE1E6', sort_order: 0, is_initial: true, is_final: false },
  { name: 'In Progress', category: 'IN_PROGRESS', color: '#DEEBFF', sort_order: 1, is_initial: false, is_final: false },
  { name: 'In Review', category: 'IN_PROGRESS', color: '#FFF0B3', sort_order: 2, is_initial: false, is_final: false },
  { name: 'Done', category: 'DONE', color: '#E3FCEF', sort_order: 3, is_initial: false, is_final: true },
];

// Default workflow transitions
const DEFAULT_WORKFLOW_TRANSITIONS = [
  { name: 'Start Progress', from_state: 'To Do', to_state: 'In Progress', sort_order: 0 },
  { name: 'Request Review', from_state: 'In Progress', to_state: 'In Review', sort_order: 1 },
  { name: 'Approve', from_state: 'In Review', to_state: 'Done', sort_order: 2 },
  { name: 'Reject', from_state: 'In Review', to_state: 'In Progress', sort_order: 3 },
  { name: 'Reopen', from_state: 'Done', to_state: 'To Do', sort_order: 4 },
  { name: 'Complete', from_state: 'In Progress', to_state: 'Done', sort_order: 5 },
  { name: 'Stop Progress', from_state: 'In Progress', to_state: 'To Do', sort_order: 6 },
];

/**
 * Get all workflows for a project (including global workflows)
 * @param {number|null} projectId - Project ID or null for global workflows only
 * @returns {Promise<Array>} Array of workflows
 */
const getWorkflows = async (projectId = null) => {
  const result = await query(
    `
    SELECT 
      w.id,
      w.name,
      w.description,
      w.project_id,
      w.is_default,
      w.created_at,
      w.updated_at,
      (SELECT COUNT(*)::INTEGER FROM workflow_states WHERE workflow_id = w.id) AS state_count,
      (SELECT COUNT(*)::INTEGER FROM workflow_transitions WHERE workflow_id = w.id) AS transition_count
    FROM workflows w
    WHERE w.project_id IS NULL OR w.project_id = $1
    ORDER BY w.is_default DESC, w.name
    `,
    [projectId]
  );

  return result.rows;
};

/**
 * Get a single workflow by ID
 * @param {number} id - Workflow ID
 * @returns {Promise<Object|null>} Workflow object or null
 */
const getWorkflowById = async (id) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      description,
      project_id,
      is_default,
      created_at,
      updated_at
    FROM workflows
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Get all states for a workflow
 * @param {number} workflowId - Workflow ID
 * @returns {Promise<Array>} Array of workflow states
 */
const getWorkflowStates = async (workflowId) => {
  const result = await query(
    `
    SELECT 
      id,
      workflow_id,
      name,
      category,
      color,
      sort_order,
      is_initial,
      is_final,
      created_at,
      updated_at
    FROM workflow_states
    WHERE workflow_id = $1
    ORDER BY sort_order, id
    `,
    [workflowId]
  );

  return result.rows;
};

/**
 * Get a single workflow state by ID
 * @param {number} stateId - State ID
 * @returns {Promise<Object|null>} State object or null
 */
const getWorkflowStateById = async (stateId) => {
  const result = await query(
    `
    SELECT 
      id,
      workflow_id,
      name,
      category,
      color,
      sort_order,
      is_initial,
      is_final,
      created_at,
      updated_at
    FROM workflow_states
    WHERE id = $1
    `,
    [stateId]
  );

  return result.rows[0] || null;
};

/**
 * Get all transitions for a workflow
 * @param {number} workflowId - Workflow ID
 * @returns {Promise<Array>} Array of workflow transitions
 */
const getWorkflowTransitions = async (workflowId) => {
  const result = await query(
    `
    SELECT 
      t.id,
      t.workflow_id,
      t.name,
      t.from_state_id,
      t.to_state_id,
      t.conditions,
      t.validators,
      t.post_functions,
      t.screen_id,
      t.sort_order,
      t.created_at,
      t.updated_at,
      fs.name AS from_state_name,
      fs.category AS from_state_category,
      ts.name AS to_state_name,
      ts.category AS to_state_category
    FROM workflow_transitions t
    INNER JOIN workflow_states fs ON fs.id = t.from_state_id
    INNER JOIN workflow_states ts ON ts.id = t.to_state_id
    WHERE t.workflow_id = $1
    ORDER BY t.sort_order, t.id
    `,
    [workflowId]
  );

  return result.rows;
};

/**
 * Get available transitions for an issue from its current state
 * @param {number} issueId - Issue/Task ID
 * @returns {Promise<Array>} Array of available transitions
 */
const getAvailableTransitions = async (issueId) => {
  const issueResult = await query(
    'SELECT workflow_state_id, project_id FROM tasks WHERE id = $1',
    [issueId]
  );

  if (!issueResult.rows[0]) {
    throw new Error('Issue not found.');
  }

  const currentStateId = issueResult.rows[0].workflow_state_id;

  if (!currentStateId) {
    return [];
  }

  const result = await query(
    `
    SELECT 
      t.id,
      t.workflow_id,
      t.name,
      t.from_state_id,
      t.to_state_id,
      t.conditions,
      t.validators,
      t.post_functions,
      t.screen_id,
      t.sort_order,
      ts.name AS to_state_name,
      ts.category AS to_state_category,
      ts.color AS to_state_color,
      ts.is_final AS to_is_final
    FROM workflow_transitions t
    INNER JOIN workflow_states ts ON ts.id = t.to_state_id
    WHERE t.from_state_id = $1
    ORDER BY t.sort_order, t.id
    `,
    [currentStateId]
  );

  return result.rows;
};

/**
 * Create a new workflow
 * @param {Object} data - Workflow data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created workflow
 */
const createWorkflow = async (data, context = {}) => {
  const { name, description = null, project_id = null, is_default = false } = data;

  const result = await query(
    `
    INSERT INTO workflows (name, description, project_id, is_default)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [name, description, project_id, is_default]
  );

  const workflow = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'workflow.create',
    object_type: 'workflow',
    object_id: workflow.id,
    description: `Workflow "${workflow.name}" created.`,
    metadata: { name, project_id },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return workflow;
};

/**
 * Update a workflow
 * @param {number} id - Workflow ID
 * @param {Object} data - Updated data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated workflow
 */
const updateWorkflow = async (id, data, context = {}) => {
  const currentWorkflow = await getWorkflowById(id);

  if (!currentWorkflow) {
    throw new Error('Workflow not found.');
  }

  const { name, description, is_default } = data;

  const result = await query(
    `
    UPDATE workflows
    SET 
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      is_default = COALESCE($3, is_default),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
    `,
    [name, description, is_default, id]
  );

  const workflow = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'workflow.update',
    object_type: 'workflow',
    object_id: workflow.id,
    description: `Workflow "${workflow.name}" updated.`,
    metadata: { changes: data },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return workflow;
};

/**
 * Delete a workflow
 * @param {number} id - Workflow ID
 * @param {Object} context - Activity context
 * @returns {Promise<void>}
 */
const deleteWorkflow = async (id, context = {}) => {
  const workflow = await getWorkflowById(id);

  if (!workflow) {
    throw new Error('Workflow not found.');
  }

  // Check if any issue types are using this workflow
  const issueTypesResult = await query(
    'SELECT COUNT(*)::INTEGER AS count FROM issue_types WHERE default_workflow_id = $1',
    [id]
  );

  if (issueTypesResult.rows[0].count > 0) {
    throw new Error(`Cannot delete workflow "${workflow.name}" because it is used by ${issueTypesResult.rows[0].count} issue types.`);
  }

  await query('DELETE FROM workflows WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'workflow.delete',
    object_type: 'workflow',
    object_id: id,
    description: `Workflow "${workflow.name}" deleted.`,
    metadata: { name: workflow.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });
};

/**
 * Create a workflow state
 * @param {number} workflowId - Workflow ID
 * @param {Object} data - State data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created state
 */
const createWorkflowState = async (workflowId, data, context = {}) => {
  const {
    name,
    category = 'TODO',
    color = '#DFE1E6',
    sort_order = 0,
    is_initial = false,
    is_final = false,
  } = data;

  // If this is initial state, unset other initial states
  if (is_initial) {
    await query(
      'UPDATE workflow_states SET is_initial = false WHERE workflow_id = $1',
      [workflowId]
    );
  }

  const result = await query(
    `
    INSERT INTO workflow_states (
      workflow_id,
      name,
      category,
      color,
      sort_order,
      is_initial,
      is_final
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [workflowId, name, category, color, sort_order, is_initial, is_final]
  );

  return result.rows[0];
};

/**
 * Update a workflow state
 * @param {number} stateId - State ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated state
 */
const updateWorkflowState = async (stateId, data, context = {}) => {
  const currentState = await getWorkflowStateById(stateId);

  if (!currentState) {
    throw new Error('State not found.');
  }

  const { name, category, color, sort_order, is_initial, is_final } = data;

  // If this is becoming initial state, unset other initial states
  if (is_initial && !currentState.is_initial) {
    await query(
      'UPDATE workflow_states SET is_initial = false WHERE workflow_id = $1',
      [currentState.workflow_id]
    );
  }

  const result = await query(
    `
    UPDATE workflow_states
    SET 
      name = COALESCE($1, name),
      category = COALESCE($2, category),
      color = COALESCE($3, color),
      sort_order = COALESCE($4, sort_order),
      is_initial = COALESCE($5, is_initial),
      is_final = COALESCE($6, is_final),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
    `,
    [name, category, color, sort_order, is_initial, is_final, stateId]
  );

  return result.rows[0];
};

/**
 * Delete a workflow state
 * @param {number} stateId - State ID
 * @returns {Promise<void>}
 */
const deleteWorkflowState = async (stateId) => {
  const state = await getWorkflowStateById(stateId);

  if (!state) {
    throw new Error('State not found.');
  }

  // Check if any transitions reference this state
  const transitionsResult = await query(
    'SELECT COUNT(*)::INTEGER AS count FROM workflow_transitions WHERE from_state_id = $1 OR to_state_id = $1',
    [stateId]
  );

  if (transitionsResult.rows[0].count > 0) {
    throw new Error('Cannot delete state because it is used by transitions.');
  }

  // Check if any tasks are in this state
  const tasksResult = await query(
    'SELECT COUNT(*)::INTEGER AS count FROM tasks WHERE workflow_state_id = $1',
    [stateId]
  );

  if (tasksResult.rows[0].count > 0) {
    throw new Error(`Cannot delete state because ${tasksResult.rows[0].count} tasks are currently in this state.`);
  }

  await query('DELETE FROM workflow_states WHERE id = $1', [stateId]);
};

/**
 * Create a workflow transition
 * @param {number} workflowId - Workflow ID
 * @param {Object} data - Transition data
 * @returns {Promise<Object>} Created transition
 */
const createWorkflowTransition = async (workflowId, data, context = {}) => {
  const {
    name,
    from_state_id,
    to_state_id,
    conditions = [],
    validators = [],
    post_functions = [],
    screen_id = null,
    sort_order = 0,
  } = data;

  // Validate from and to states exist and belong to this workflow
  const fromState = await getWorkflowStateById(from_state_id);
  const toState = await getWorkflowStateById(to_state_id);

  if (!fromState || fromState.workflow_id !== workflowId) {
    throw new Error('Invalid from_state_id.');
  }

  if (!toState || toState.workflow_id !== workflowId) {
    throw new Error('Invalid to_state_id.');
  }

  const result = await query(
    `
    INSERT INTO workflow_transitions (
      workflow_id,
      name,
      from_state_id,
      to_state_id,
      conditions,
      validators,
      post_functions,
      screen_id,
      sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [workflowId, name, from_state_id, to_state_id, JSON.stringify(conditions), JSON.stringify(validators), JSON.stringify(post_functions), screen_id, sort_order]
  );

  return result.rows[0];
};

/**
 * Update a workflow transition
 * @param {number} transitionId - Transition ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated transition
 */
const updateWorkflowTransition = async (transitionId, data) => {
  const result = await query(
    `
    UPDATE workflow_transitions
    SET 
      name = COALESCE($1, name),
      from_state_id = COALESCE($2, from_state_id),
      to_state_id = COALESCE($3, to_state_id),
      conditions = COALESCE($4, conditions),
      validators = COALESCE($5, validators),
      post_functions = COALESCE($6, post_functions),
      screen_id = COALESCE($7, screen_id),
      sort_order = COALESCE($8, sort_order),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
    `,
    [
      data.name,
      data.from_state_id,
      data.to_state_id,
      data.conditions ? JSON.stringify(data.conditions) : null,
      data.validators ? JSON.stringify(data.validators) : null,
      data.post_functions ? JSON.stringify(data.post_functions) : null,
      data.screen_id,
      data.sort_order,
      transitionId,
    ]
  );

  if (!result.rows[0]) {
    throw new Error('Transition not found.');
  }

  return result.rows[0];
};

/**
 * Delete a workflow transition
 * @param {number} transitionId - Transition ID
 * @returns {Promise<void>}
 */
const deleteWorkflowTransition = async (transitionId) => {
  const result = await query('DELETE FROM workflow_transitions WHERE id = $1 RETURNING id', [transitionId]);

  if (!result.rows[0]) {
    throw new Error('Transition not found.');
  }
};

/**
 * Evaluate transition conditions
 * @param {Object} transition - Transition object
 * @param {Object} issue - Issue/Task object
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Evaluation result
 */
const evaluateTransitionConditions = async (transition, issue, context) => {
  if (!transition.conditions || transition.conditions.length === 0) {
    return { passed: true };
  }

  for (const condition of transition.conditions) {
    switch (condition.type) {
      case 'permission':
        // Check if user has required permission
        if (condition.config.permission) {
          const permissionResult = await query(
            `
            SELECT 1 FROM role_permissions
            WHERE role = $1 AND permission = $2
            `,
            [context.user_role, condition.config.permission]
          );

          if (permissionResult.rows.length === 0) {
            return { passed: false, message: `Permission "${condition.config.permission}" required.` };
          }
        }
        break;

      case 'user_role':
        // Check if user has specific role
        if (condition.config.roles && !condition.config.roles.includes(context.user_role)) {
          return { passed: false, message: `Role "${condition.config.roles.join(' or ')}" required.` };
        }
        break;

      case 'field_value':
        // Check if issue field has specific value
        if (condition.config.field && condition.config.value !== undefined) {
          const fieldValue = issue[condition.config.field];
          if (fieldValue !== condition.config.value) {
            return { passed: false, message: `Field "${condition.config.field}" must be "${condition.config.value}".` };
          }
        }
        break;

      case 'assignee':
        // Check if user is assignee or lead
        if (condition.config.must_be_assignee) {
          const isAssignee = issue.assignee_ids?.includes(context.actor_user_id) || issue.assignee_id === context.actor_user_id;
          if (!isAssignee) {
            return { passed: false, message: 'Only assignees can perform this transition.' };
          }
        }
        if (condition.config.must_be_lead) {
          if (issue.lead_id !== context.actor_user_id) {
            return { passed: false, message: 'Only the lead can perform this transition.' };
          }
        }
        break;

      default:
        // Unknown condition type, skip
        break;
    }
  }

  return { passed: true };
};

/**
 * Execute transition validators
 * @param {Object} transition - Transition object
 * @param {Object} issue - Issue/Task object
 * @param {Object} payload - Transition payload
 * @returns {Promise<Object>} Validation result
 */
const executeTransitionValidators = async (transition, issue, payload) => {
  if (!transition.validators || transition.validators.length === 0) {
    return { valid: true };
  }

  for (const validator of transition.validators) {
    switch (validator.type) {
      case 'required_fields':
        // Check if required fields are present
        if (validator.config.fields) {
          for (const field of validator.config.fields) {
            if (!payload.fields?.[field] && !issue[field]) {
              return { valid: false, message: `Field "${field}" is required.` };
            }
          }
        }
        break;

      case 'field_format':
        // Validate field format
        if (validator.config.field && validator.config.pattern) {
          const value = payload.fields?.[validator.config.field] || issue[validator.config.field];
          if (value && !new RegExp(validator.config.pattern).test(value)) {
            return { valid: false, message: `Field "${validator.config.field}" has invalid format.` };
          }
        }
        break;

      default:
        // Unknown validator type, skip
        break;
    }
  }

  return { valid: true };
};

/**
 * Map workflow state category to legacy task status for backward compatibility.
 * Ensures the bucket-based status system stays in sync with workflow transitions.
 * @param {string} category - Workflow state category (TODO, IN_PROGRESS, DONE)
 * @returns {string} Legacy status value
 */
const mapCategoryToLegacyStatus = (category) => {
  switch (category) {
    case 'TODO':
      return 'Not Started';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'DONE':
      return 'Done';
    default:
      return 'In Progress';
  }
};

// Allowed fields that can be updated via post-functions or transition screens
const ALLOWED_UPDATE_FIELDS = [
  'assignee_id', 'lead_id', 'priority', 'resolution', 'environment',
  'story_points', 'description', 'title', 'start_date', 'end_date',
];

/**
 * Safely update a field on an issue, only allowing whitelisted columns.
 * @param {string} field - Field name to update
 * @param {*} value - New value
 * @param {number} issueId - Issue/Task ID
 * @returns {Promise<void>}
 */
const safeUpdateField = async (field, value, issueId) => {
  if (!ALLOWED_UPDATE_FIELDS.includes(field)) {
    return; // Skip disallowed fields to prevent SQL injection
  }
  await query(
    `UPDATE tasks SET "${field}" = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [value, issueId]
  );
};

/**
 * Execute post-transition functions
 * @param {Object} transition - Transition object
 * @param {Object} issue - Issue/Task object
 * @param {Object} context - Execution context
 * @returns {Promise<void>}
 */
const executePostFunctions = async (transition, issue, context) => {
  if (!transition.post_functions || transition.post_functions.length === 0) {
    return;
  }

  for (const postFunction of transition.post_functions) {
    switch (postFunction.type) {
      case 'update_field':
        // Update a field on the issue (whitelisted fields only)
        if (postFunction.config.field && postFunction.config.value !== undefined) {
          await safeUpdateField(postFunction.config.field, postFunction.config.value, issue.id);
        }
        break;

      case 'send_notification': {
        // Send notification to specified users
        const { createNotificationsForUsers } = require('./notificationService');
        const userIds = postFunction.config.user_ids || [];
        
        if (postFunction.config.notify_assignees && issue.assignee_ids?.length > 0) {
          userIds.push(...issue.assignee_ids);
        }
        
        if (postFunction.config.notify_lead && issue.lead_id) {
          userIds.push(issue.lead_id);
        }

        if (userIds.length > 0) {
          await createNotificationsForUsers([...new Set(userIds)], {
            actor_user_id: context.actor_user_id,
            type: 'workflow.transition',
            resource_type: 'task',
            resource_id: issue.id,
            task_id: issue.id,
            project_id: issue.project_id,
            title: `Issue transitioned: ${issue.title}`,
            body: `Status changed from ${transition.from_state_name} to ${transition.to_state_name}`,
          });
        }
        break;
      }

      case 'create_issue': {
        // Create a new linked issue after transition
        const config = postFunction.config;
        if (config.title) {
          const newIssueResult = await query(
            `INSERT INTO tasks (title, description, project_id, parent_task_id, status, priority, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'Not Started', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [
              config.title,
              config.description || null,
              issue.project_id,
              config.link_to_parent ? issue.id : null,
              config.priority || 'Medium',
            ]
          );

          // If issue_links table exists and link_type is specified, create a link
          if (config.link_type && newIssueResult.rows[0]) {
            try {
              await query(
                `INSERT INTO issue_links (source_issue_id, target_issue_id, link_type, created_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [issue.id, newIssueResult.rows[0].id, config.link_type]
              );
            } catch (linkError) {
              // issue_links table may not exist yet; skip silently
            }
          }
        }
        break;
      }

      case 'assign_user':
        // Assign user to issue
        if (postFunction.config.user_id) {
          await query(
            'UPDATE tasks SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [postFunction.config.user_id, issue.id]
          );
        }
        break;

      default:
        // Unknown post-function type, skip
        break;
    }
  }
};

/**
 * Transition an issue to a new state
 * @param {number} issueId - Issue/Task ID
 * @param {number} transitionId - Transition ID
 * @param {Object} payload - Transition payload (fields, comment, etc.)
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Updated issue
 */
const transitionIssue = async (issueId, transitionId, payload = {}, context = {}) => {
  // Get the issue
  const issueResult = await query(
    `
    SELECT t.*, p.name AS project_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = $1
    `,
    [issueId]
  );

  const issue = issueResult.rows[0];

  if (!issue) {
    throw new Error('Issue not found.');
  }

  // Get the transition with state categories for backward compatibility
  const transitionResult = await query(
    `
    SELECT 
      t.*,
      fs.name AS from_state_name,
      fs.category AS from_state_category,
      ts.name AS to_state_name,
      ts.category AS to_state_category
    FROM workflow_transitions t
    INNER JOIN workflow_states fs ON fs.id = t.from_state_id
    INNER JOIN workflow_states ts ON ts.id = t.to_state_id
    WHERE t.id = $1
    `,
    [transitionId]
  );

  const transition = transitionResult.rows[0];

  if (!transition) {
    throw new Error('Transition not found.');
  }

  // Validate transition is from current state (Req 2.4)
  if (issue.workflow_state_id !== transition.from_state_id) {
    throw new Error(`Invalid transition: issue is not in "${transition.from_state_name}" state.`);
  }

  // Evaluate conditions
  const conditionResult = await evaluateTransitionConditions(transition, issue, context);
  if (!conditionResult.passed) {
    throw new Error(conditionResult.message);
  }

  // Execute validators
  const validationResult = await executeTransitionValidators(transition, issue, payload);
  if (!validationResult.valid) {
    throw new Error(validationResult.message);
  }

  // Apply transition screen field updates (Req 2.5)
  // When a transition has a screen_id, the payload.fields contains required field updates
  if (payload.fields && Object.keys(payload.fields).length > 0) {
    for (const [field, value] of Object.entries(payload.fields)) {
      await safeUpdateField(field, value, issueId);
    }
  }

  // Map workflow state category to legacy status for backward compatibility (Req 2.8)
  const legacyStatus = mapCategoryToLegacyStatus(transition.to_state_category);

  // Update issue state and legacy status field together
  await query(
    'UPDATE tasks SET workflow_state_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [transition.to_state_id, legacyStatus, issueId]
  );

  // Execute post-functions (Req 2.6)
  await executePostFunctions(transition, issue, context);

  // Log activity to activity_logs
  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: issueId,
    project_id: issue.project_id,
    action: 'workflow.transition',
    object_type: 'task',
    object_id: issueId,
    description: `Transitioned from "${transition.from_state_name}" to "${transition.to_state_name}".`,
    metadata: {
      transition_id: transitionId,
      transition_name: transition.name,
      from_state: transition.from_state_name,
      from_state_category: transition.from_state_category,
      to_state: transition.to_state_name,
      to_state_category: transition.to_state_category,
      legacy_status: legacyStatus,
      fields_updated: payload.fields ? Object.keys(payload.fields) : [],
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  // Get updated issue
  const updatedIssueResult = await query(
    'SELECT * FROM tasks WHERE id = $1',
    [issueId]
  );

  return updatedIssueResult.rows[0];
};

/**
 * Create a default workflow for a project
 * @param {number} projectId - Project ID
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created workflow with states and transitions
 */
const createDefaultWorkflow = async (projectId, context = {}) => {
  // Create workflow
  const workflow = await createWorkflow({
    name: 'Default Workflow',
    description: 'Default workflow with To Do, In Progress, In Review, and Done states',
    project_id: projectId,
    is_default: true,
  }, context);

  // Create states
  const stateMap = {};
  for (const stateData of DEFAULT_WORKFLOW_STATES) {
    const state = await createWorkflowState(workflow.id, stateData);
    stateMap[state.name] = state.id;
  }

  // Create transitions
  for (const transitionData of DEFAULT_WORKFLOW_TRANSITIONS) {
    await createWorkflowTransition(workflow.id, {
      name: transitionData.name,
      from_state_id: stateMap[transitionData.from_state],
      to_state_id: stateMap[transitionData.to_state],
      sort_order: transitionData.sort_order,
    });
  }

  return workflow;
};

module.exports = {
  createDefaultWorkflow,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
  deleteWorkflow,
  deleteWorkflowState,
  deleteWorkflowTransition,
  evaluateTransitionConditions,
  executePostFunctions,
  executeTransitionValidators,
  getAvailableTransitions,
  getWorkflowById,
  getWorkflowStateById,
  getWorkflowStates,
  getWorkflowTransitions,
  getWorkflows,
  mapCategoryToLegacyStatus,
  transitionIssue,
  updateWorkflow,
  updateWorkflowState,
  updateWorkflowTransition,
};
