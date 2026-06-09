const { pool, query } = require('../config/db');
const { logActivity } = require('./activityService');

const LINK_TYPES = {
  BLOCKS: 'blocks',
  IS_BLOCKED_BY: 'is_blocked_by',
  RELATES_TO: 'relates_to',
  DUPLICATES: 'duplicates',
  IS_DUPLICATED_BY: 'is_duplicated_by',
};

const LINK_TYPE_ALIASES = new Map([
  ['blocks', LINK_TYPES.BLOCKS],
  ['is blocked by', LINK_TYPES.IS_BLOCKED_BY],
  ['is_blocked_by', LINK_TYPES.IS_BLOCKED_BY],
  ['blocked_by', LINK_TYPES.IS_BLOCKED_BY],
  ['relates to', LINK_TYPES.RELATES_TO],
  ['relates_to', LINK_TYPES.RELATES_TO],
  ['relates', LINK_TYPES.RELATES_TO],
  ['duplicates', LINK_TYPES.DUPLICATES],
  ['is duplicated by', LINK_TYPES.IS_DUPLICATED_BY],
  ['is_duplicated_by', LINK_TYPES.IS_DUPLICATED_BY],
  ['duplicated_by', LINK_TYPES.IS_DUPLICATED_BY],
]);

const RECIPROCAL_LINK_TYPES = {
  [LINK_TYPES.BLOCKS]: LINK_TYPES.IS_BLOCKED_BY,
  [LINK_TYPES.IS_BLOCKED_BY]: LINK_TYPES.BLOCKS,
  [LINK_TYPES.RELATES_TO]: LINK_TYPES.RELATES_TO,
  [LINK_TYPES.DUPLICATES]: LINK_TYPES.IS_DUPLICATED_BY,
  [LINK_TYPES.IS_DUPLICATED_BY]: LINK_TYPES.DUPLICATES,
};

const ISSUE_LINK_SELECT = `
  SELECT
    il.id,
    il.source_issue_id,
    il.target_issue_id,
    il.link_type,
    il.created_by,
    il.created_at,
    il.updated_at,
    source_issue.title AS source_issue_title,
    source_issue.issue_key AS source_issue_key,
    source_issue.status AS source_issue_status,
    source_issue.project_id AS source_project_id,
    target_issue.title AS target_issue_title,
    target_issue.issue_key AS target_issue_key,
    target_issue.status AS target_issue_status,
    target_issue.project_id AS target_project_id,
    target_type.name AS target_issue_type_name,
    target_type.icon AS target_issue_type_icon,
    target_type.color AS target_issue_type_color,
    created_by_user.name AS created_by_name
  FROM issue_links il
  INNER JOIN tasks source_issue ON source_issue.id = il.source_issue_id
  INNER JOIN tasks target_issue ON target_issue.id = il.target_issue_id
  LEFT JOIN issue_types target_type ON target_type.id = target_issue.issue_type_id
  LEFT JOIN users created_by_user ON created_by_user.id = il.created_by
`;

const normalizeLinkType = (linkType) => {
  const normalizedInput = String(linkType || '').trim().toLowerCase();
  const normalizedLinkType = LINK_TYPE_ALIASES.get(normalizedInput);

  if (!normalizedLinkType) {
    throw new Error(`Invalid issue link type. Use one of: ${Object.values(LINK_TYPES).join(', ')}.`);
  }

  return normalizedLinkType;
};

const normalizeIssueId = (issueId, fieldName) => {
  const normalizedId = Number(issueId);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedId;
};

const getIssueById = async (issueId, client = null) => {
  const execQuery = client ? client.query.bind(client) : query;
  const result = await execQuery(
    `
    SELECT id, project_id, title, issue_key, status
    FROM tasks
    WHERE id = $1
    `,
    [issueId]
  );

  return result.rows[0] || null;
};

const ensureIssueExists = async (issueId, fieldName, client = null) => {
  const issue = await getIssueById(issueId, client);

  if (!issue) {
    throw new Error(`${fieldName} not found.`);
  }

  return issue;
};

const getIssueLinkById = async (id) => {
  const result = await query(
    `
    ${ISSUE_LINK_SELECT}
    WHERE il.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

const listIssueLinks = async (issueId, filters = {}) => {
  const normalizedIssueId = normalizeIssueId(issueId, 'Issue ID');
  const conditions = ['il.source_issue_id = $1'];
  const values = [normalizedIssueId];

  if (filters.link_type || filters.linkType) {
    values.push(normalizeLinkType(filters.link_type || filters.linkType));
    conditions.push(`il.link_type = $${values.length}`);
  }

  if (filters.linked_status || filters.linkedStatus) {
    values.push(filters.linked_status || filters.linkedStatus);
    conditions.push(`target_issue.status = $${values.length}`);
  }

  const result = await query(
    `
    ${ISSUE_LINK_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY il.created_at DESC, il.id DESC
    `,
    values
  );

  return result.rows;
};

const createIssueLink = async (data, context = {}) => {
  const sourceIssueId = normalizeIssueId(
    data.source_issue_id || data.sourceIssueId,
    'Source issue ID'
  );
  const targetIssueId = normalizeIssueId(
    data.target_issue_id || data.targetIssueId,
    'Target issue ID'
  );
  const linkType = normalizeLinkType(data.link_type || data.linkType);

  if (sourceIssueId === targetIssueId) {
    throw new Error('An issue cannot be linked to itself.');
  }

  const reciprocalLinkType = RECIPROCAL_LINK_TYPES[linkType];
  const actorUserId = context.actor_user_id || null;
  const client = await pool.connect();
  let transactionCommitted = false;

  try {
    await client.query('BEGIN');

    const sourceIssue = await ensureIssueExists(sourceIssueId, 'Source issue', client);
    const targetIssue = await ensureIssueExists(targetIssueId, 'Target issue', client);

    const existingPrimary = await client.query(
      `
      SELECT id
      FROM issue_links
      WHERE source_issue_id = $1
        AND target_issue_id = $2
        AND link_type = $3
      LIMIT 1
      `,
      [sourceIssueId, targetIssueId, linkType]
    );

    if (existingPrimary.rowCount > 0) {
      throw new Error('Duplicate issue link is not allowed.');
    }

    const primaryResult = await client.query(
      `
      INSERT INTO issue_links (source_issue_id, target_issue_id, link_type, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [sourceIssueId, targetIssueId, linkType, actorUserId]
    );

    const reciprocalResult = await client.query(
      `
      INSERT INTO issue_links (source_issue_id, target_issue_id, link_type, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source_issue_id, target_issue_id, link_type) DO NOTHING
      RETURNING id
      `,
      [targetIssueId, sourceIssueId, reciprocalLinkType, actorUserId]
    );

    await client.query('COMMIT');
    transactionCommitted = true;

    await logActivity({
      actor_user_id: actorUserId,
      task_id: sourceIssueId,
      project_id: sourceIssue.project_id,
      action: 'issue_link.create',
      object_type: 'issue_link',
      object_id: primaryResult.rows[0].id,
      description: `Issue "${sourceIssue.issue_key || sourceIssue.title}" linked to "${targetIssue.issue_key || targetIssue.title}" as ${linkType}.`,
      metadata: {
        source_issue_id: sourceIssueId,
        target_issue_id: targetIssueId,
        link_type: linkType,
        reciprocal_link_type: reciprocalLinkType,
        reciprocal_link_id: reciprocalResult.rows[0]?.id || null,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    });

    const link = await getIssueLinkById(primaryResult.rows[0].id);

    return {
      ...link,
      reciprocal_link_id: reciprocalResult.rows[0]?.id || null,
      reciprocal_link_type: reciprocalLinkType,
    };
  } catch (error) {
    if (!transactionCommitted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
};

const deleteIssueLink = async (id, context = {}) => {
  const existingLink = await getIssueLinkById(id);

  if (!existingLink) {
    throw new Error('Issue link not found.');
  }

  const reciprocalLinkType = RECIPROCAL_LINK_TYPES[existingLink.link_type];
  const client = await pool.connect();
  let transactionCommitted = false;

  try {
    await client.query('BEGIN');

    await client.query(
      `
      DELETE FROM issue_links
      WHERE id = $1
      `,
      [id]
    );

    const reciprocalResult = await client.query(
      `
      DELETE FROM issue_links
      WHERE source_issue_id = $1
        AND target_issue_id = $2
        AND link_type = $3
      RETURNING id
      `,
      [existingLink.target_issue_id, existingLink.source_issue_id, reciprocalLinkType]
    );

    await client.query('COMMIT');
    transactionCommitted = true;

    await logActivity({
      actor_user_id: context.actor_user_id || null,
      task_id: existingLink.source_issue_id,
      project_id: existingLink.source_project_id,
      action: 'issue_link.delete',
      object_type: 'issue_link',
      object_id: Number(id),
      description: `Issue link ${existingLink.link_type} deleted.`,
      metadata: {
        source_issue_id: existingLink.source_issue_id,
        target_issue_id: existingLink.target_issue_id,
        link_type: existingLink.link_type,
        reciprocal_link_ids: reciprocalResult.rows.map((row) => row.id),
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    });

    return {
      deleted_link_id: Number(id),
      deleted_reciprocal_link_ids: reciprocalResult.rows.map((row) => row.id),
    };
  } catch (error) {
    if (!transactionCommitted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
};

const deleteIssueLinksForIssue = async (issueId, context = {}) => {
  const normalizedIssueId = normalizeIssueId(issueId, 'Issue ID');
  const issue = await ensureIssueExists(normalizedIssueId, 'Issue');

  const result = await query(
    `
    DELETE FROM issue_links
    WHERE source_issue_id = $1
       OR target_issue_id = $1
    RETURNING id
    `,
    [normalizedIssueId]
  );

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: normalizedIssueId,
    project_id: issue.project_id,
    action: 'issue_link.delete_all',
    object_type: 'issue',
    object_id: normalizedIssueId,
    description: `All issue links for "${issue.issue_key || issue.title}" deleted.`,
    metadata: { deleted_link_ids: result.rows.map((row) => row.id) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    issue_id: normalizedIssueId,
    deleted_count: result.rowCount,
    deleted_link_ids: result.rows.map((row) => row.id),
  };
};

module.exports = {
  LINK_TYPES,
  createIssueLink,
  deleteIssueLink,
  deleteIssueLinksForIssue,
  getIssueLinkById,
  listIssueLinks,
  normalizeLinkType,
};
