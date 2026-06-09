const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { createNotificationsForUsers, normalizeUserIds } = require('./notificationService');

const WATCHER_SELECT = `
  SELECT
    iw.id,
    iw.issue_id,
    t.title AS issue_title,
    t.issue_key,
    t.project_id,
    iw.user_id,
    u.name AS user_name,
    u.email AS user_email,
    iw.auto_watched,
    iw.added_at
  FROM issue_watchers iw
  INNER JOIN tasks t ON t.id = iw.issue_id
  INNER JOIN users u ON u.id = iw.user_id
`;

const normalizeId = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const getIssue = async (issueId) => {
  const result = await query(
    `
    SELECT id, project_id, title, issue_key
    FROM tasks
    WHERE id = $1
    `,
    [issueId],
  );

  if (!result.rows[0]) {
    throw new Error('Issue not found.');
  }

  return result.rows[0];
};

const getActiveUserIds = async (userIds = []) => {
  const normalizedUserIds = normalizeUserIds(userIds);

  if (!normalizedUserIds.length) {
    return [];
  }

  const result = await query(
    `
    SELECT id
    FROM users
    WHERE id = ANY($1::INTEGER[])
      AND is_active = TRUE
      AND deleted_at IS NULL
    `,
    [normalizedUserIds],
  );

  return result.rows.map((row) => row.id);
};

const listIssueWatchers = async (issueId) => {
  const normalizedIssueId = normalizeId(issueId, 'Issue ID');
  await getIssue(normalizedIssueId);

  const result = await query(
    `
    ${WATCHER_SELECT}
    WHERE iw.issue_id = $1
    ORDER BY iw.added_at ASC, iw.id ASC
    `,
    [normalizedIssueId],
  );

  return result.rows;
};

const getIssueWatcherIds = async (issueId) => {
  const result = await query(
    `
    SELECT user_id
    FROM issue_watchers
    WHERE issue_id = $1
    ORDER BY id
    `,
    [issueId],
  );

  return result.rows.map((row) => row.user_id);
};

const addIssueWatchers = async (issueId, userIds = [], options = {}) => {
  const normalizedIssueId = normalizeId(issueId, 'Issue ID');
  const issue = await getIssue(normalizedIssueId);
  const activeUserIds = await getActiveUserIds(userIds);
  const addedWatcherIds = [];

  for (const userId of activeUserIds) {
    const result = await query(
      `
      INSERT INTO issue_watchers (issue_id, user_id, auto_watched)
      VALUES ($1, $2, $3)
      ON CONFLICT (issue_id, user_id) DO UPDATE
      SET auto_watched = issue_watchers.auto_watched OR EXCLUDED.auto_watched
      RETURNING user_id
      `,
      [normalizedIssueId, userId, Boolean(options.auto_watched || options.autoWatched)],
    );

    if (result.rows[0]) {
      addedWatcherIds.push(result.rows[0].user_id);
    }
  }

  if (addedWatcherIds.length > 0 && options.logActivity !== false) {
    await logActivity({
      actor_user_id: options.actor_user_id || null,
      task_id: normalizedIssueId,
      project_id: issue.project_id,
      action: 'issue_watcher.add',
      object_type: 'issue',
      object_id: normalizedIssueId,
      description: `Watchers updated for issue "${issue.issue_key || issue.title}".`,
      metadata: {
        user_ids: addedWatcherIds,
        auto_watched: Boolean(options.auto_watched || options.autoWatched),
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
    });
  }

  return {
    issue_id: normalizedIssueId,
    watcher_ids: await getIssueWatcherIds(normalizedIssueId),
    added_watcher_ids: [...new Set(addedWatcherIds.map(Number))],
  };
};

const addIssueWatcher = async (issueId, userId, options = {}) => {
  return addIssueWatchers(issueId, [userId], options);
};

const removeIssueWatcher = async (issueId, userId, context = {}) => {
  const normalizedIssueId = normalizeId(issueId, 'Issue ID');
  const normalizedUserId = normalizeId(userId, 'User ID');
  const issue = await getIssue(normalizedIssueId);

  const result = await query(
    `
    DELETE FROM issue_watchers
    WHERE issue_id = $1
      AND user_id = $2
    RETURNING user_id
    `,
    [normalizedIssueId, normalizedUserId],
  );

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: normalizedIssueId,
    project_id: issue.project_id,
    action: 'issue_watcher.remove',
    object_type: 'issue',
    object_id: normalizedIssueId,
    description: `Watcher removed from issue "${issue.issue_key || issue.title}".`,
    metadata: { user_id: normalizedUserId, removed: result.rowCount > 0 },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    issue_id: normalizedIssueId,
    user_id: normalizedUserId,
    removed: result.rowCount > 0,
  };
};

const notifyIssueWatchers = async (issueId, payload = {}, options = {}) => {
  const issue = await getIssue(issueId);
  const watcherIds = await getIssueWatcherIds(issueId);
  const excludedUserIds = new Set(normalizeUserIds(options.exclude_user_ids || options.excludeUserIds));
  const targetWatcherIds = watcherIds.filter((userId) => !excludedUserIds.has(Number(userId)));

  return createNotificationsForUsers(targetWatcherIds, {
    actor_user_id: payload.actor_user_id,
    type: payload.type || 'issue.updated',
    resource_type: payload.resource_type || 'issue',
    resource_id: payload.resource_id || issue.id,
    task_id: issue.id,
    project_id: issue.project_id,
    title: payload.title || `Issue updated: ${issue.issue_key || issue.title}`,
    body: payload.body || null,
    metadata: {
      issue_title: issue.title,
      issue_key: issue.issue_key,
      ...(payload.metadata || {}),
    },
  });
};

const cleanupWatchersForProjectUser = async (projectId, userId) => {
  const normalizedProjectId = normalizeId(projectId, 'Project ID');
  const normalizedUserId = normalizeId(userId, 'User ID');

  const result = await query(
    `
    DELETE FROM issue_watchers iw
    USING tasks t
    WHERE t.id = iw.issue_id
      AND t.project_id = $1
      AND iw.user_id = $2
    RETURNING iw.issue_id
    `,
    [normalizedProjectId, normalizedUserId],
  );

  return {
    project_id: normalizedProjectId,
    user_id: normalizedUserId,
    removed_count: result.rowCount,
    issue_ids: result.rows.map((row) => row.issue_id),
  };
};

module.exports = {
  addIssueWatcher,
  addIssueWatchers,
  cleanupWatchersForProjectUser,
  getIssueWatcherIds,
  listIssueWatchers,
  notifyIssueWatchers,
  removeIssueWatcher,
};
