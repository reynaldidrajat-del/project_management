const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { createNotificationsForUsers } = require('./notificationService');
const { emitToChatRoom, emitToProject } = require('./realtimeService');

const MAX_CHAT_MESSAGE_LENGTH = 4000;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

const normalizePositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeLimit = (value, fallback = DEFAULT_MESSAGE_LIMIT) => {
  const normalizedValue = Number(value || fallback);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return Math.min(normalizedValue, MAX_MESSAGE_LIMIT);
};

const normalizeOffset = (value) => {
  const normalizedValue = Number(value || 0);
  return Number.isInteger(normalizedValue) && normalizedValue >= 0 ? normalizedValue : 0;
};

const normalizeMessageBody = (value) => String(value || '').trim();

const isElevatedRole = (role) => ['super_admin', 'admin', 'manager'].includes(role);

const getProjectById = async (projectId) => {
  const result = await query(
    `
      SELECT id, name, owner_id
      FROM projects
      WHERE id = $1
    `,
    [projectId],
  );

  return result.rows[0] || null;
};

const ensureProjectAccess = async (projectId, user = {}) => {
  const normalizedProjectId = normalizePositiveInteger(projectId);
  const userId = normalizePositiveInteger(user.id);

  if (!normalizedProjectId) {
    throw new Error('Project wajib diisi.');
  }

  const project = await getProjectById(normalizedProjectId);

  if (!project) {
    throw new Error('Project tidak ditemukan.');
  }

  if (isElevatedRole(user.role)) {
    return project;
  }

  const accessResult = await query(
    `
      SELECT 1
      WHERE EXISTS (
        SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2
      )
      OR EXISTS (
        SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2
      )
      OR EXISTS (
        SELECT 1 FROM tasks
        WHERE project_id = $1
          AND (assignee_id = $2 OR lead_id = $2 OR creator_id = $2)
      )
      OR EXISTS (
        SELECT 1
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        WHERE t.project_id = $1
          AND ta.user_id = $2
      )
    `,
    [normalizedProjectId, userId],
  );

  if (!accessResult.rowCount) {
    throw new Error('User tidak memiliki akses project.');
  }

  return project;
};

const getProjectParticipantIds = async (projectId, extraUserIds = []) => {
  const result = await query(
    `
      SELECT DISTINCT user_id
      FROM (
        SELECT owner_id AS user_id
        FROM projects
        WHERE id = $1
        UNION
        SELECT user_id
        FROM project_members
        WHERE project_id = $1
        UNION
        SELECT assignee_id AS user_id
        FROM tasks
        WHERE project_id = $1
        UNION
        SELECT lead_id AS user_id
        FROM tasks
        WHERE project_id = $1
        UNION
        SELECT creator_id AS user_id
        FROM tasks
        WHERE project_id = $1
        UNION
        SELECT ta.user_id
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        WHERE t.project_id = $1
      ) participants
      INNER JOIN users u ON u.id = participants.user_id
      WHERE participants.user_id IS NOT NULL
        AND u.is_active = TRUE
        AND u.deleted_at IS NULL
    `,
    [projectId],
  );

  return Array.from(
    new Set([...result.rows.map((row) => Number(row.user_id)), ...extraUserIds.map(normalizePositiveInteger).filter(Boolean)]),
  );
};

const addRoomMembers = async (roomId, userIds = [], role = 'member') => {
  for (const userId of Array.from(new Set(userIds.map(normalizePositiveInteger).filter(Boolean)))) {
    await query(
      `
        INSERT INTO chat_room_members (room_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [roomId, userId, role],
    );
  }
};

const syncProjectRoomMembers = async (roomId, projectId, actorUserId) => {
  const participantIds = await getProjectParticipantIds(projectId, [actorUserId]);
  await addRoomMembers(roomId, participantIds);
};

const mapRoomRow = (row) => ({
  id: Number(row.id),
  type: row.type,
  name: row.name,
  project_id: row.project_id ? Number(row.project_id) : null,
  project_name: row.project_name,
  department_id: row.department_id ? Number(row.department_id) : null,
  department_name: row.department_name,
  member_count: Number(row.member_count || 0),
  unread_count: Number(row.unread_count || 0),
  last_message_id: row.last_message_id ? Number(row.last_message_id) : null,
  last_message_body: row.last_message_body,
  last_message_at: row.last_message_at,
  last_message_sender_name: row.last_message_sender_name,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getRoomSummaryById = async (roomId, userId) => {
  const result = await query(
    `
      SELECT
        cr.id,
        cr.type,
        cr.name,
        cr.project_id,
        p.name AS project_name,
        cr.department_id,
        d.name AS department_name,
        cr.created_at,
        cr.updated_at,
        COALESCE(member_summary.member_count, 0)::INTEGER AS member_count,
        COALESCE(unread_summary.unread_count, 0)::INTEGER AS unread_count,
        last_message.id AS last_message_id,
        last_message.body AS last_message_body,
        last_message.created_at AS last_message_at,
        sender.name AS last_message_sender_name
      FROM chat_rooms cr
      LEFT JOIN projects p ON p.id = cr.project_id
      LEFT JOIN departments d ON d.id = cr.department_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS member_count
        FROM chat_room_members crm
        WHERE crm.room_id = cr.id
      ) member_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS unread_count
        FROM chat_messages cm
        WHERE cm.room_id = cr.id
          AND cm.deleted_at IS NULL
          AND cm.sender_id IS DISTINCT FROM $2
          AND NOT EXISTS (
            SELECT 1
            FROM read_receipts rr
            WHERE rr.object_type = 'chat_message'
              AND rr.object_id = cm.id
              AND rr.user_id = $2
          )
      ) unread_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT cm.*
        FROM chat_messages cm
        WHERE cm.room_id = cr.id
          AND cm.deleted_at IS NULL
        ORDER BY cm.created_at DESC, cm.id DESC
        LIMIT 1
      ) last_message ON TRUE
      LEFT JOIN users sender ON sender.id = last_message.sender_id
      WHERE cr.id = $1
    `,
    [roomId, userId],
  );

  return result.rows[0] ? mapRoomRow(result.rows[0]) : null;
};

const getOrCreateProjectRoom = async (projectId, user = {}) => {
  const project = await ensureProjectAccess(projectId, user);
  const userId = normalizePositiveInteger(user.id);

  const existingRoomResult = await query(
    `
      SELECT *
      FROM chat_rooms
      WHERE type = 'project'
        AND project_id = $1
        AND archived_at IS NULL
      LIMIT 1
    `,
    [project.id],
  );

  let room = existingRoomResult.rows[0];

  if (!room) {
    const createdRoomResult = await query(
      `
        INSERT INTO chat_rooms (type, name, project_id, created_by)
        VALUES ('project', $1, $2, $3)
        RETURNING *
      `,
      [`${project.name} Chat`, project.id, userId],
    );
    room = createdRoomResult.rows[0];

    await logActivity({
      actor_user_id: userId,
      project_id: project.id,
      action: 'chat.room.create',
      object_type: 'chat_room',
      object_id: room.id,
      description: `Project chat "${room.name}" dibuat.`,
      metadata: { type: 'project' },
    });
  }

  await syncProjectRoomMembers(room.id, project.id, userId);

  return getRoomSummaryById(room.id, userId);
};

const ensureRoomMembership = async (roomId, userId) => {
  const result = await query(
    `
      SELECT
        cr.*,
        p.name AS project_name,
        d.name AS department_name
      FROM chat_rooms cr
      INNER JOIN chat_room_members crm ON crm.room_id = cr.id
      LEFT JOIN projects p ON p.id = cr.project_id
      LEFT JOIN departments d ON d.id = cr.department_id
      WHERE cr.id = $1
        AND crm.user_id = $2
        AND cr.archived_at IS NULL
      LIMIT 1
    `,
    [roomId, userId],
  );

  if (!result.rows[0]) {
    throw new Error('Chat room tidak ditemukan atau tidak bisa diakses.');
  }

  return result.rows[0];
};

const listChatRooms = async (user = {}, filters = {}) => {
  const userId = normalizePositiveInteger(user.id);
  const projectId = normalizePositiveInteger(filters.project_id);

  if (!userId) {
    throw new Error('User login tidak ditemukan.');
  }

  if (projectId) {
    await getOrCreateProjectRoom(projectId, user);
  }

  const values = [userId];
  const conditions = ['crm.user_id = $1', 'cr.archived_at IS NULL'];

  if (projectId) {
    values.push(projectId);
    conditions.push(`cr.project_id = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        cr.id,
        cr.type,
        cr.name,
        cr.project_id,
        p.name AS project_name,
        cr.department_id,
        d.name AS department_name,
        cr.created_at,
        cr.updated_at,
        COALESCE(member_summary.member_count, 0)::INTEGER AS member_count,
        COALESCE(unread_summary.unread_count, 0)::INTEGER AS unread_count,
        last_message.id AS last_message_id,
        last_message.body AS last_message_body,
        last_message.created_at AS last_message_at,
        sender.name AS last_message_sender_name
      FROM chat_rooms cr
      INNER JOIN chat_room_members crm ON crm.room_id = cr.id
      LEFT JOIN projects p ON p.id = cr.project_id
      LEFT JOIN departments d ON d.id = cr.department_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS member_count
        FROM chat_room_members member
        WHERE member.room_id = cr.id
      ) member_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS unread_count
        FROM chat_messages cm
        WHERE cm.room_id = cr.id
          AND cm.deleted_at IS NULL
          AND cm.sender_id IS DISTINCT FROM $1
          AND NOT EXISTS (
            SELECT 1
            FROM read_receipts rr
            WHERE rr.object_type = 'chat_message'
              AND rr.object_id = cm.id
              AND rr.user_id = $1
          )
      ) unread_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT cm.*
        FROM chat_messages cm
        WHERE cm.room_id = cr.id
          AND cm.deleted_at IS NULL
        ORDER BY cm.created_at DESC, cm.id DESC
        LIMIT 1
      ) last_message ON TRUE
      LEFT JOIN users sender ON sender.id = last_message.sender_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY last_message.created_at DESC NULLS LAST, cr.updated_at DESC, cr.id DESC
    `,
    values,
  );

  return result.rows.map(mapRoomRow);
};

const createChatRoom = async (payload = {}, user = {}) => {
  const type = payload.type || 'project';

  if (type !== 'project') {
    throw new Error('Saat ini hanya project chat yang didukung.');
  }

  return getOrCreateProjectRoom(payload.project_id, user);
};

const mapMessageRow = (row) => ({
  id: Number(row.id),
  room_id: Number(row.room_id),
  sender_id: row.sender_id ? Number(row.sender_id) : null,
  sender_name: row.sender_name,
  sender_email: row.sender_email,
  parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : null,
  body: row.body,
  message_type: row.message_type,
  created_at: row.created_at,
  updated_at: row.updated_at,
  read_receipts: row.read_receipts || [],
  read_count: Number(row.read_count || 0),
});

const listChatMessages = async (roomId, user = {}, filters = {}) => {
  const userId = normalizePositiveInteger(user.id);
  const normalizedRoomId = normalizePositiveInteger(roomId);
  await ensureRoomMembership(normalizedRoomId, userId);

  const result = await query(
    `
      SELECT *
      FROM (
        SELECT
          cm.id,
          cm.room_id,
          cm.sender_id,
          sender.name AS sender_name,
          sender.email AS sender_email,
          cm.parent_message_id,
          cm.body,
          cm.message_type,
          cm.created_at,
          cm.updated_at,
          COALESCE(read_summary.read_receipts, '[]'::JSON) AS read_receipts,
          COALESCE(read_summary.read_count, 0)::INTEGER AS read_count
        FROM chat_messages cm
        LEFT JOIN users sender ON sender.id = cm.sender_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::INTEGER AS read_count,
            json_agg(
              json_build_object(
                'user_id', reader.id,
                'name', reader.name,
                'email', reader.email,
                'read_at', rr.read_at
              )
              ORDER BY rr.read_at DESC
            ) FILTER (WHERE reader.id IS NOT NULL) AS read_receipts
          FROM read_receipts rr
          INNER JOIN users reader ON reader.id = rr.user_id
          WHERE rr.object_type = 'chat_message'
            AND rr.object_id = cm.id
        ) read_summary ON TRUE
        WHERE cm.room_id = $1
          AND cm.deleted_at IS NULL
        ORDER BY cm.created_at DESC, cm.id DESC
        LIMIT $2
        OFFSET $3
      ) messages
      ORDER BY created_at ASC, id ASC
    `,
    [normalizedRoomId, normalizeLimit(filters.limit), normalizeOffset(filters.offset)],
  );

  return result.rows.map(mapMessageRow);
};

const getMessageById = async (messageId) => {
  const result = await query(
    `
      SELECT
        cm.id,
        cm.room_id,
        cm.sender_id,
        sender.name AS sender_name,
        sender.email AS sender_email,
        cm.parent_message_id,
        cm.body,
        cm.message_type,
        cm.created_at,
        cm.updated_at,
        COALESCE(read_summary.read_receipts, '[]'::JSON) AS read_receipts,
        COALESCE(read_summary.read_count, 0)::INTEGER AS read_count
      FROM chat_messages cm
      LEFT JOIN users sender ON sender.id = cm.sender_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INTEGER AS read_count,
          json_agg(
            json_build_object(
              'user_id', reader.id,
              'name', reader.name,
              'email', reader.email,
              'read_at', rr.read_at
            )
            ORDER BY rr.read_at DESC
          ) FILTER (WHERE reader.id IS NOT NULL) AS read_receipts
        FROM read_receipts rr
        INNER JOIN users reader ON reader.id = rr.user_id
        WHERE rr.object_type = 'chat_message'
          AND rr.object_id = cm.id
      ) read_summary ON TRUE
      WHERE cm.id = $1
        AND cm.deleted_at IS NULL
    `,
    [messageId],
  );

  return result.rows[0] ? mapMessageRow(result.rows[0]) : null;
};

const markChatMessageRead = async (messageId, user = {}) => {
  const userId = normalizePositiveInteger(user.id);
  const normalizedMessageId = normalizePositiveInteger(messageId);

  if (!userId) {
    throw new Error('User login tidak ditemukan.');
  }

  const messageResult = await query(
    `
      SELECT cm.id, cm.room_id, cm.sender_id, cr.project_id
      FROM chat_messages cm
      INNER JOIN chat_rooms cr ON cr.id = cm.room_id
      WHERE cm.id = $1
        AND cm.deleted_at IS NULL
    `,
    [normalizedMessageId],
  );
  const message = messageResult.rows[0];

  if (!message) {
    throw new Error('Pesan chat tidak ditemukan.');
  }

  await ensureRoomMembership(message.room_id, userId);

  const result = await query(
    `
      INSERT INTO read_receipts (object_type, object_id, user_id, read_at)
      VALUES ('chat_message', $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (object_type, object_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING *
    `,
    [normalizedMessageId, userId],
  );
  const receipt = result.rows[0];

  emitToChatRoom(message.room_id, 'chat.message.read', {
    message_id: normalizedMessageId,
    project_id: message.project_id,
    read_at: receipt.read_at,
    room_id: Number(message.room_id),
    user_id: userId,
  });

  return receipt;
};

const markChatRoomRead = async (roomId, user = {}) => {
  const userId = normalizePositiveInteger(user.id);
  const room = await ensureRoomMembership(roomId, userId);

  const result = await query(
    `
      INSERT INTO read_receipts (object_type, object_id, user_id, read_at)
      SELECT 'chat_message', cm.id, $2, CURRENT_TIMESTAMP
      FROM chat_messages cm
      WHERE cm.room_id = $1
        AND cm.deleted_at IS NULL
      ON CONFLICT (object_type, object_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING object_id
    `,
    [room.id, userId],
  );
  const lastMessageId = result.rows.length ? Math.max(...result.rows.map((row) => Number(row.object_id))) : null;

  if (lastMessageId) {
    await query(
      `
        UPDATE chat_room_members
        SET last_read_message_id = $1
        WHERE room_id = $2
          AND user_id = $3
      `,
      [lastMessageId, room.id, userId],
    );
  }

  emitToChatRoom(room.id, 'chat.message.read', {
    message_ids: result.rows.map((row) => Number(row.object_id)),
    project_id: room.project_id,
    room_id: Number(room.id),
    updated_count: result.rowCount,
    user_id: userId,
  });

  return {
    message_ids: result.rows.map((row) => Number(row.object_id)),
    updated_count: result.rowCount,
  };
};

const createChatMessage = async (roomId, payload = {}, context = {}) => {
  const user = context.user || {};
  const userId = normalizePositiveInteger(user.id || context.actor_user_id);
  const normalizedRoomId = normalizePositiveInteger(roomId);
  const body = normalizeMessageBody(payload.body || payload.message);

  if (!userId) {
    throw new Error('User login tidak ditemukan.');
  }

  if (!body) {
    throw new Error('Pesan chat wajib diisi.');
  }

  if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(`Pesan chat tidak boleh lebih dari ${MAX_CHAT_MESSAGE_LENGTH} karakter.`);
  }

  const room = await ensureRoomMembership(normalizedRoomId, userId);
  const result = await query(
    `
      INSERT INTO chat_messages (room_id, sender_id, parent_message_id, body, message_type)
      VALUES ($1, $2, $3, $4, 'text')
      RETURNING *
    `,
    [room.id, userId, normalizePositiveInteger(payload.parent_message_id), body],
  );
  const createdMessage = result.rows[0];
  await markChatMessageRead(createdMessage.id, user);

  await logActivity({
    actor_user_id: userId,
    project_id: room.project_id || null,
    action: 'chat.message.create',
    object_type: 'chat_message',
    object_id: createdMessage.id,
    description: `Pesan chat baru dikirim di "${room.name || room.project_name || 'Chat'}".`,
    metadata: {
      room_id: room.id,
      room_type: room.type,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  const message = await getMessageById(createdMessage.id);
  const memberResult = await query(
    `
      SELECT user_id
      FROM chat_room_members
      WHERE room_id = $1
        AND user_id <> $2
    `,
    [room.id, userId],
  );
  const recipientIds = memberResult.rows.map((row) => row.user_id);

  await createNotificationsForUsers(recipientIds, {
    actor_user_id: userId,
    type: 'chat.message',
    resource_type: 'chat_message',
    resource_id: message.id,
    project_id: room.project_id || null,
    title: `Pesan baru di ${room.name || room.project_name || 'Project Chat'}`,
    body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
    metadata: {
      room_id: room.id,
      room_name: room.name,
    },
  });

  const realtimePayload = {
    message,
    project_id: room.project_id || null,
    room: await getRoomSummaryById(room.id, userId),
    room_id: Number(room.id),
  };

  emitToChatRoom(room.id, 'chat.message.created', realtimePayload);

  if (room.project_id) {
    emitToProject(room.project_id, 'chat.message.created', realtimePayload);
  }

  return message;
};

const ensureMessageMutationAllowed = async (messageId, user = {}) => {
  const userId = normalizePositiveInteger(user.id);
  const result = await query(
    `
      SELECT cm.*, cr.project_id
      FROM chat_messages cm
      INNER JOIN chat_rooms cr ON cr.id = cm.room_id
      WHERE cm.id = $1
        AND cm.deleted_at IS NULL
    `,
    [messageId],
  );
  const message = result.rows[0];

  if (!message) {
    throw new Error('Pesan chat tidak ditemukan.');
  }

  await ensureRoomMembership(message.room_id, userId);

  if (Number(message.sender_id) === userId || isElevatedRole(user.role)) {
    return message;
  }

  throw new Error('Hanya pengirim atau manager yang dapat mengubah pesan chat.');
};

const updateChatMessage = async (messageId, payload = {}, user = {}) => {
  const body = normalizeMessageBody(payload.body || payload.message);

  if (!body) {
    throw new Error('Pesan chat wajib diisi.');
  }

  if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(`Pesan chat tidak boleh lebih dari ${MAX_CHAT_MESSAGE_LENGTH} karakter.`);
  }

  const currentMessage = await ensureMessageMutationAllowed(messageId, user);
  await query(
    `
      UPDATE chat_messages
      SET body = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
    [body, messageId],
  );

  const message = await getMessageById(messageId);

  emitToChatRoom(currentMessage.room_id, 'chat.message.updated', {
    message,
    project_id: currentMessage.project_id,
    room_id: Number(currentMessage.room_id),
  });

  return message;
};

const deleteChatMessage = async (messageId, user = {}) => {
  const currentMessage = await ensureMessageMutationAllowed(messageId, user);
  await query(
    `
      UPDATE chat_messages
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
      WHERE id = $2
      RETURNING id, room_id
    `,
    [user.id, messageId],
  );

  emitToChatRoom(currentMessage.room_id, 'chat.message.deleted', {
    message_id: Number(messageId),
    project_id: currentMessage.project_id,
    room_id: Number(currentMessage.room_id),
  });

  return {
    id: Number(messageId),
    room_id: Number(currentMessage.room_id),
  };
};

module.exports = {
  createChatMessage,
  createChatRoom,
  deleteChatMessage,
  getOrCreateProjectRoom,
  listChatMessages,
  listChatRooms,
  markChatMessageRead,
  markChatRoomRead,
  updateChatMessage,
};
