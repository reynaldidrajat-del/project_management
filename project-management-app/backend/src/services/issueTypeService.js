const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// Issue type hierarchy levels
const HIERARCHY_LEVELS = {
  Epic: 0,
  Story: 1,
  Task: 2,
  Bug: 2,
  Subtask: 3,
};

// Default system issue types
const DEFAULT_ISSUE_TYPES = [
  { name: 'Epic', icon: 'epic', color: '#904EE2', hierarchy_level: 0, allowed_parent_types: [], allowed_child_types: ['Story', 'Task', 'Bug'] },
  { name: 'Story', icon: 'story', color: '#63BA3C', hierarchy_level: 1, allowed_parent_types: ['Epic'], allowed_child_types: ['Task', 'Subtask'] },
  { name: 'Task', icon: 'task', color: '#4BADE8', hierarchy_level: 2, allowed_parent_types: ['Epic', 'Story'], allowed_child_types: ['Subtask'] },
  { name: 'Bug', icon: 'bug', color: '#E5493A', hierarchy_level: 2, allowed_parent_types: ['Epic', 'Story'], allowed_child_types: ['Subtask'] },
  { name: 'Subtask', icon: 'subtask', color: '#4FADE6', hierarchy_level: 3, allowed_parent_types: ['Task', 'Bug', 'Story'], allowed_child_types: [] },
];

/**
 * Get all issue types for a project (including global/system types)
 * @param {number|null} projectId - Project ID or null for global types only
 * @returns {Promise<Array>} Array of issue types
 */
const getIssueTypes = async (projectId = null) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      is_system,
      project_id,
      created_at,
      updated_at
    FROM issue_types
    WHERE project_id IS NULL OR project_id = $1
    ORDER BY hierarchy_level, name
    `,
    [projectId]
  );

  return result.rows;
};

/**
 * Get a single issue type by ID
 * @param {number} id - Issue type ID
 * @returns {Promise<Object|null>} Issue type object or null
 */
const getIssueTypeById = async (id) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      is_system,
      project_id,
      created_at,
      updated_at
    FROM issue_types
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Get issue type by name
 * @param {string} name - Issue type name
 * @param {number|null} projectId - Project ID for project-specific types
 * @returns {Promise<Object|null>} Issue type object or null
 */
const getIssueTypeByName = async (name, projectId = null) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      is_system,
      project_id,
      created_at,
      updated_at
    FROM issue_types
    WHERE name = $1 AND (project_id IS NULL OR project_id = $2)
    `,
    [name, projectId]
  );

  return result.rows[0] || null;
};

/**
 * Create a new issue type
 * @param {Object} data - Issue type data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created issue type
 */
const createIssueType = async (data, context = {}) => {
  const {
    name,
    icon = 'task',
    color = '#4BADE8',
    hierarchy_level = 2,
    allowed_parent_types = [],
    allowed_child_types = [],
    default_workflow_id = null,
    project_id = null,
  } = data;

  // Validate name is unique
  const existing = await getIssueTypeByName(name, project_id);
  if (existing) {
    throw new Error(`Issue type "${name}" already exists.`);
  }

  const result = await query(
    `
    INSERT INTO issue_types (
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      is_system,
      project_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      false, // Custom issue types are not system types
      project_id,
    ]
  );

  const issueType = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'issue_type.create',
    object_type: 'issue_type',
    object_id: issueType.id,
    description: `Issue type "${issueType.name}" created.`,
    metadata: { name, hierarchy_level, project_id },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return issueType;
};

/**
 * Update an existing issue type
 * @param {number} id - Issue type ID
 * @param {Object} data - Updated data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated issue type
 */
const updateIssueType = async (id, data, context = {}) => {
  const currentIssueType = await getIssueTypeById(id);

  if (!currentIssueType) {
    throw new Error('Issue type not found.');
  }

  if (currentIssueType.is_system) {
    throw new Error('System issue types cannot be modified.');
  }

  const {
    name = currentIssueType.name,
    icon = currentIssueType.icon,
    color = currentIssueType.color,
    hierarchy_level = currentIssueType.hierarchy_level,
    allowed_parent_types = currentIssueType.allowed_parent_types,
    allowed_child_types = currentIssueType.allowed_child_types,
    default_workflow_id = currentIssueType.default_workflow_id,
  } = data;

  // Check for name conflict if name is being changed
  if (name !== currentIssueType.name) {
    const existing = await getIssueTypeByName(name, currentIssueType.project_id);
    if (existing && existing.id !== id) {
      throw new Error(`Issue type "${name}" already exists.`);
    }
  }

  const result = await query(
    `
    UPDATE issue_types
    SET 
      name = $1,
      icon = $2,
      color = $3,
      hierarchy_level = $4,
      allowed_parent_types = $5,
      allowed_child_types = $6,
      default_workflow_id = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
    `,
    [
      name,
      icon,
      color,
      hierarchy_level,
      allowed_parent_types,
      allowed_child_types,
      default_workflow_id,
      id,
    ]
  );

  const issueType = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'issue_type.update',
    object_type: 'issue_type',
    object_id: issueType.id,
    description: `Issue type "${issueType.name}" updated.`,
    metadata: { changes: data },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return issueType;
};

/**
 * Delete an issue type
 * @param {number} id - Issue type ID
 * @param {Object} context - Activity context
 * @returns {Promise<void>}
 */
const deleteIssueType = async (id, context = {}) => {
  const issueType = await getIssueTypeById(id);

  if (!issueType) {
    throw new Error('Issue type not found.');
  }

  if (issueType.is_system) {
    throw new Error('System issue types cannot be deleted.');
  }

  // Check if any issues are using this type
  const issuesResult = await query(
    'SELECT COUNT(*)::INTEGER AS count FROM tasks WHERE issue_type_id = $1',
    [id]
  );

  if (issuesResult.rows[0].count > 0) {
    throw new Error(`Cannot delete issue type "${issueType.name}" because it has ${issuesResult.rows[0].count} associated issues.`);
  }

  await query('DELETE FROM issue_types WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'issue_type.delete',
    object_type: 'issue_type',
    object_id: id,
    description: `Issue type "${issueType.name}" deleted.`,
    metadata: { name: issueType.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });
};

/**
 * Allowed children for each known issue type.
 * Enforces: Epic > Story > Task/Bug > Subtask
 */
const ALLOWED_CHILDREN = {
  Epic: ['Story', 'Task', 'Bug'],
  Story: ['Task', 'Subtask'],
  Task: ['Subtask'],
  Bug: ['Subtask'],
  Subtask: [],
};

/**
 * Allowed parents for each known issue type.
 */
const ALLOWED_PARENTS = {
  Epic: [],
  Story: ['Epic'],
  Task: ['Epic', 'Story'],
  Bug: ['Epic', 'Story'],
  Subtask: ['Story', 'Task', 'Bug'],
};

/**
 * Validate parent-child hierarchy for issue types.
 * For known system types, checks both that the parent allows the child
 * and that the child allows the parent.
 * For unknown/custom types, falls back to hierarchy level comparison.
 * @param {string} parentType - Parent issue type name
 * @param {string} childType - Child issue type name
 * @returns {boolean} True if valid hierarchy
 */
const validateHierarchy = (parentType, childType) => {
  const parentAllowedChildren = ALLOWED_CHILDREN[parentType];
  const childAllowedParents = ALLOWED_PARENTS[childType];

  // If both types are known system types, use explicit rules
  if (parentAllowedChildren !== undefined && childAllowedParents !== undefined) {
    return parentAllowedChildren.includes(childType) && childAllowedParents.includes(parentType);
  }

  // Fallback for custom/unknown types: use hierarchy level comparison
  const parentLevel = HIERARCHY_LEVELS[parentType];
  const childLevel = HIERARCHY_LEVELS[childType];

  if (parentLevel === undefined || childLevel === undefined) {
    return true;
  }

  return parentLevel < childLevel;
};

/**
 * Check if a parent type can have a specific child type
 * @param {string} parentType - Parent issue type name
 * @param {string} childType - Child issue type name
 * @returns {Promise<boolean>} True if valid
 */
const canHaveChild = async (parentType, childType) => {
  const parent = await getIssueTypeByName(parentType);
  
  if (!parent) {
    return validateHierarchy(parentType, childType);
  }

  // Check if child type is in allowed_child_types
  if (parent.allowed_child_types && parent.allowed_child_types.length > 0) {
    return parent.allowed_child_types.includes(childType);
  }

  return validateHierarchy(parentType, childType);
};

/**
 * Check if a child type can have a specific parent type
 * @param {string} childType - Child issue type name
 * @param {string} parentType - Parent issue type name
 * @returns {Promise<boolean>} True if valid
 */
const canHaveParent = async (childType, parentType) => {
  const child = await getIssueTypeByName(childType);
  
  if (!child) {
    return validateHierarchy(parentType, childType);
  }

  // Check if parent type is in allowed_parent_types
  if (child.allowed_parent_types && child.allowed_parent_types.length > 0) {
    return child.allowed_parent_types.includes(parentType);
  }

  return validateHierarchy(parentType, childType);
};

/**
 * Seed default system issue types
 * @returns {Promise<void>}
 */
const seedDefaultIssueTypes = async () => {
  for (const issueType of DEFAULT_ISSUE_TYPES) {
    const existing = await getIssueTypeByName(issueType.name);
    
    if (!existing) {
      await query(
        `
        INSERT INTO issue_types (
          name,
          icon,
          color,
          hierarchy_level,
          allowed_parent_types,
          allowed_child_types,
          is_system,
          project_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          issueType.name,
          issueType.icon,
          issueType.color,
          issueType.hierarchy_level,
          issueType.allowed_parent_types,
          issueType.allowed_child_types,
          true, // System type
          null, // Global
        ]
      );
    }
  }
};

/**
 * Get issue type statistics (count of issues per type)
 * @param {number|null} projectId - Project ID to filter by
 * @returns {Promise<Array>} Array of issue types with issue counts
 */
const getIssueTypeStats = async (projectId = null) => {
  const result = await query(
    `
    SELECT 
      it.id,
      it.name,
      it.icon,
      it.color,
      it.hierarchy_level,
      COUNT(t.id)::INTEGER AS issue_count
    FROM issue_types it
    LEFT JOIN tasks t ON t.issue_type_id = it.id AND ($1::INTEGER IS NULL OR t.project_id = $1)
    WHERE it.project_id IS NULL OR it.project_id = $1
    GROUP BY it.id, it.name, it.icon, it.color, it.hierarchy_level
    ORDER BY it.hierarchy_level, it.name
    `,
    [projectId]
  );

  return result.rows;
};

module.exports = {
  canHaveChild,
  canHaveParent,
  createIssueType,
  deleteIssueType,
  getIssueTypeById,
  getIssueTypeByName,
  getIssueTypeStats,
  getIssueTypes,
  seedDefaultIssueTypes,
  updateIssueType,
  validateHierarchy,
};
