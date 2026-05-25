const { query } = require('../config/db');
const { emitToUser } = require('./realtimeService');

const DEFAULT_NOTIFICATION_LIMIT = 30;
const MAX_NOTIFICATION_LIMIT = 100;

const normalizePositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeUserIds = (userIds = []) => {
  const normalizedIds = Array.isArray(userIds) ? userIds : [userIds];

  return Array.from(new Set(normalizedIds.map(normalizePositiveInteger).filter(Boolean)));
};

const normalizeLimit = (limit) => {
  const numericLimit = Number(limit || DEFAULT_NOTIFICATION_LIMIT);

  if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(numericLimit, MAX_NOTIFICATION_LIMIT);
};

const normalizeOffset = (offset) => {
  const numericOffset = Number(offset || 0);
  return Number.isInteger(numericOffset) && numericOffset >= 0 ? numericOffset : 0;
};

const isNotificationEnabled = async (userId, eventType) => {
  const result = await query(
    `
      SELECT enabled
      FROM notification_preferences
      WHERE user_id = $1
        AND channel = 'in_app'
        AND event_type IN ($2, '*')
      ORDER BY CASE WHEN event_type = $2 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [userId, eventType],
  );

  return result.rows[0] ? Boolean(result.rows[0].enabled) : true;
};

// Membuat satu notifikasi in-app untuk user aktif.
const createNotification = async ({
  user_id,
  actor_user_id,
  type,
  resource_type,
  resource_id,
  task_id,
  project_id,
  title,
  body,
  metadata = {},
} = {}) => {
  const userId = normalizePositiveInteger(user_id);

  if (!userId || !type || !title) {
    return null;
  }

  const enabled = await isNotificationEnabled(userId, type);

  if (!enabled) {
    return null;
  }

  const result = await query(
    `
      INSERT INTO notifications (
        user_id,
        actor_user_id,
        type,
        resource_type,
        resource_id,
        task_id,
        project_id,
        title,
        body,
        metadata
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::JSONB
      WHERE EXISTS (
        SELECT 1
        FROM users
        WHERE id = $1
          AND is_active = TRUE
          AND deleted_at IS NULL
      )
      RETURNING *
    `,
    [
      userId,
      normalizePositiveInteger(actor_user_id),
      type,
      resource_type || null,
      normalizePositiveInteger(resource_id),
      normalizePositiveInteger(task_id),
      normalizePositiveInteger(project_id),
      title,
      body || null,
      JSON.stringify(metadata || {}),
    ],
  );

  const notification = result.rows[0] || null;

  if (notification) {
    emitToUser(notification.user_id, 'notification.created', {
      notification,
      unread_delta: 1,
    });
  }

  return notification;
};

// Membuat notifikasi untuk beberapa user, dengan opsi melewati actor agar tidak self-notify.
const createNotificationsForUsers = async (userIds = [], payload = {}, { skipActor = true } = {}) => {
  const actorUserId = normalizePositiveInteger(payload.actor_user_id);
  const targetUserIds = normalizeUserIds(userIds).filter((userId) => !skipActor || Number(userId) !== Number(actorUserId));
  const notifications = [];

  for (const userId of targetUserIds) {
    const notification = await createNotification({
      ...payload,
      user_id: userId,
    });

    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
};

const listNotifications = async (userId, filters = {}) => {
  const normalizedUserId = normalizePositiveInteger(userId);

  if (!normalizedUserId) {
    throw new Error('User login tidak ditemukan.');
  }

  const conditions = ['n.user_id = $1'];
  const values = [normalizedUserId];

  if (filters.status === 'unread') {
    conditions.push('n.read_at IS NULL');
  }

  if (filters.status === 'read') {
    conditions.push('n.read_at IS NOT NULL');
  }

  if (filters.type) {
    values.push(filters.type);
    conditions.push(`n.type = $${values.length}`);
  }

  values.push(normalizeLimit(filters.limit));
  const limitParam = `$${values.length}`;
  values.push(normalizeOffset(filters.offset));
  const offsetParam = `$${values.length}`;

  const result = await query(
    `
      SELECT
        n.id,
        n.user_id,
        n.actor_user_id,
        actor.name AS actor_name,
        actor.email AS actor_email,
        n.type,
        n.resource_type,
        n.resource_id,
        n.task_id,
        t.title AS task_title,
        n.project_id,
        p.name AS project_name,
        n.title,
        n.body,
        COALESCE(n.metadata, '{}'::JSONB) AS metadata,
        n.read_at,
        n.created_at
      FROM notifications n
      LEFT JOIN users actor ON actor.id = n.actor_user_id
      LEFT JOIN tasks t ON t.id = n.task_id
      LEFT JOIN projects p ON p.id = n.project_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values,
  );

  return result.rows;
};

const getUnreadNotificationCount = async (userId) => {
  const normalizedUserId = normalizePositiveInteger(userId);

  if (!normalizedUserId) {
    return 0;
  }

  const result = await query('SELECT COUNT(*)::INTEGER AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL', [
    normalizedUserId,
  ]);

  return Number(result.rows[0]?.unread_count || 0);
};

const markNotificationRead = async (notificationId, userId) => {
  const result = await query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE id = $1
        AND user_id = $2
      RETURNING *
    `,
    [notificationId, userId],
  );

  if (!result.rows[0]) {
    throw new Error('Notifikasi tidak ditemukan.');
  }

  return result.rows[0];
};

const markAllNotificationsRead = async (userId) => {
  const result = await query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE user_id = $1
        AND read_at IS NULL
      RETURNING id
    `,
    [userId],
  );

  return {
    updated_count: result.rowCount,
    notification_ids: result.rows.map((row) => row.id),
  };
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeUserIds,
};
