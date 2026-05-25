const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { createNotificationsForUsers, normalizeUserIds } = require('./notificationService');
const { emitToProject, emitToTask } = require('./realtimeService');

const MAX_COMMENT_LENGTH = 4000;

const normalizeCommentText = (value) => String(value || '').trim();

const getCommentSnippet = (comment) => {
  const normalizedComment = normalizeCommentText(comment).replace(/\s+/g, ' ');
  return normalizedComment.length > 140 ? `${normalizedComment.slice(0, 137)}...` : normalizedComment;
};

const getTaskCollaborationContext = async (taskId) => {
  const result = await query(
    `
      SELECT
        t.id,
        t.project_id,
        t.title,
        t.assignee_id,
        t.lead_id,
        t.creator_id,
        COALESCE(
          (
            SELECT json_agg(ta.user_id ORDER BY ta.id)
            FROM task_assignees ta
            WHERE ta.task_id = t.id
          ),
          '[]'::JSON
        ) AS assignee_ids
      FROM tasks t
      WHERE t.id = $1
    `,
    [taskId],
  );

  const task = result.rows[0];

  if (!task) {
    throw new Error('Task tidak ditemukan.');
  }

  return task;
};

const getTaskCommentParticipantIds = async (task) => {
  const commenterResult = await query(
    `
      SELECT DISTINCT user_id
      FROM task_comments
      WHERE task_id = $1
        AND user_id IS NOT NULL
        AND deleted_at IS NULL
    `,
    [task.id],
  );

  return normalizeUserIds([
    task.assignee_id,
    task.lead_id,
    task.creator_id,
    ...(task.assignee_ids || []),
    ...commenterResult.rows.map((row) => row.user_id),
  ]);
};

const extractMentionUserIdsFromText = async (comment) => {
  const tokens = Array.from(comment.matchAll(/@([a-zA-Z0-9._-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g))
    .map((match) => String(match[1] || '').toLowerCase())
    .filter(Boolean);

  if (!tokens.length) {
    return [];
  }

  const result = await query(
    `
      SELECT id
      FROM users
      WHERE is_active = TRUE
        AND deleted_at IS NULL
        AND (
          lower(email) = ANY($1::TEXT[])
          OR lower(regexp_replace(name, '\\s+', '', 'g')) = ANY($1::TEXT[])
        )
    `,
    [tokens],
  );

  return result.rows.map((row) => row.id);
};

const resolveMentionUserIds = async (comment, mentionUserIds = []) => {
  const explicitMentionIds = normalizeUserIds(mentionUserIds);
  const parsedMentionIds = await extractMentionUserIdsFromText(comment);

  return normalizeUserIds([...explicitMentionIds, ...parsedMentionIds]);
};

const replaceCommentMentions = async (commentId, mentionUserIds = []) => {
  await query('DELETE FROM comment_mentions WHERE comment_id = $1', [commentId]);

  const normalizedMentionUserIds = normalizeUserIds(mentionUserIds);

  for (const userId of normalizedMentionUserIds) {
    await query(
      `
        INSERT INTO comment_mentions (comment_id, mentioned_user_id)
        VALUES ($1, $2)
        ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING
      `,
      [commentId, userId],
    );
  }

  return normalizedMentionUserIds;
};

const listTaskComments = async (taskId) => {
  await getTaskCollaborationContext(taskId);

  const result = await query(
    `
      SELECT
        tc.id,
        tc.task_id,
        tc.user_id,
        author.name AS user_name,
        author.email AS user_email,
        tc.comment,
        tc.updated_at,
        tc.created_at,
        COALESCE(mention_summary.mentions, '[]'::JSON) AS mentions,
        COALESCE(read_summary.read_receipts, '[]'::JSON) AS read_receipts,
        COALESCE(read_summary.read_count, 0)::INTEGER AS read_count
      FROM task_comments tc
      LEFT JOIN users author ON author.id = tc.user_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'user_id', mentioned_user.id,
            'name', mentioned_user.name,
            'email', mentioned_user.email
          )
          ORDER BY mentioned_user.name
        ) FILTER (WHERE mentioned_user.id IS NOT NULL) AS mentions
        FROM comment_mentions cm
        INNER JOIN users mentioned_user ON mentioned_user.id = cm.mentioned_user_id
        WHERE cm.comment_id = tc.id
      ) mention_summary ON TRUE
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
        WHERE rr.object_type = 'task_comment'
          AND rr.object_id = tc.id
      ) read_summary ON TRUE
      WHERE tc.task_id = $1
        AND tc.deleted_at IS NULL
      ORDER BY tc.created_at ASC, tc.id ASC
    `,
    [taskId],
  );

  return result.rows;
};

const markCommentRead = async (commentId, userId) => {
  if (!userId) {
    throw new Error('User login tidak ditemukan.');
  }

  const commentResult = await query('SELECT id, task_id FROM task_comments WHERE id = $1 AND deleted_at IS NULL', [commentId]);

  if (!commentResult.rows[0]) {
    throw new Error('Komentar tidak ditemukan.');
  }

  const result = await query(
    `
      INSERT INTO read_receipts (object_type, object_id, user_id, read_at)
      VALUES ('task_comment', $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (object_type, object_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING *
    `,
    [commentId, userId],
  );

  const receipt = result.rows[0];

  emitToTask(commentResult.rows[0].task_id, 'comment.read', {
    comment_id: Number(commentId),
    task_id: Number(commentResult.rows[0].task_id),
    user_id: Number(userId),
    read_at: receipt.read_at,
  });

  return receipt;
};

const markTaskCommentsRead = async (taskId, userId) => {
  if (!userId) {
    throw new Error('User login tidak ditemukan.');
  }

  await getTaskCollaborationContext(taskId);

  const result = await query(
    `
      INSERT INTO read_receipts (object_type, object_id, user_id, read_at)
      SELECT 'task_comment', tc.id, $2, CURRENT_TIMESTAMP
      FROM task_comments tc
      WHERE tc.task_id = $1
        AND tc.deleted_at IS NULL
      ON CONFLICT (object_type, object_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING object_id
    `,
    [taskId, userId],
  );

  const payload = {
    updated_count: result.rowCount,
    comment_ids: result.rows.map((row) => row.object_id),
  };

  emitToTask(taskId, 'comment.read', {
    task_id: Number(taskId),
    user_id: Number(userId),
    ...payload,
  });

  return payload;
};

const createTaskComment = async (taskId, payload = {}, context = {}) => {
  const comment = normalizeCommentText(payload.comment);

  if (!comment) {
    throw new Error('Komentar wajib diisi.');
  }

  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Komentar tidak boleh lebih dari ${MAX_COMMENT_LENGTH} karakter.`);
  }

  const actorUserId = context.actor_user_id || context.user_id;

  if (!actorUserId) {
    throw new Error('User login tidak ditemukan.');
  }

  const task = await getTaskCollaborationContext(taskId);
  const result = await query(
    `
      INSERT INTO task_comments (task_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [task.id, actorUserId, comment],
  );
  const createdComment = result.rows[0];
  const mentionUserIds = await resolveMentionUserIds(comment, payload.mention_user_ids);
  await replaceCommentMentions(createdComment.id, mentionUserIds);
  await markCommentRead(createdComment.id, actorUserId);

  await logActivity({
    actor_user_id: actorUserId,
    task_id: task.id,
    project_id: task.project_id,
    action: 'task.comment.create',
    object_type: 'task_comment',
    object_id: createdComment.id,
    description: `Komentar baru ditambahkan pada task "${task.title}".`,
    metadata: {
      mention_user_ids: mentionUserIds,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  const actorName = context.actor_name || 'Seseorang';
  const commentSnippet = getCommentSnippet(comment);

  await createNotificationsForUsers(mentionUserIds, {
    actor_user_id: actorUserId,
    type: 'comment.mention',
    resource_type: 'task_comment',
    resource_id: createdComment.id,
    task_id: task.id,
    project_id: task.project_id,
    title: `${actorName} menyebut Anda di komentar`,
    body: commentSnippet,
    metadata: {
      task_title: task.title,
    },
  });

  const participantIds = await getTaskCommentParticipantIds(task);
  const mentionUserIdSet = new Set(mentionUserIds.map(Number));
  const commentNotificationUserIds = participantIds.filter((userId) => !mentionUserIdSet.has(Number(userId)));

  await createNotificationsForUsers(commentNotificationUserIds, {
    actor_user_id: actorUserId,
    type: 'task.comment',
    resource_type: 'task_comment',
    resource_id: createdComment.id,
    task_id: task.id,
    project_id: task.project_id,
    title: `Komentar baru di ${task.title}`,
    body: commentSnippet,
    metadata: {
      task_title: task.title,
    },
  });

  const commentWithDetails = (await listTaskComments(task.id)).find((item) => Number(item.id) === Number(createdComment.id));

  const realtimePayload = {
    project_id: task.project_id,
    task_id: task.id,
    comment: commentWithDetails,
  };

  emitToProject(task.project_id, 'comment.created', realtimePayload);
  emitToTask(task.id, 'comment.created', realtimePayload);

  return commentWithDetails;
};

const getCommentForMutation = async (commentId) => {
  const result = await query(
    `
      SELECT tc.*, t.project_id, t.title AS task_title
      FROM task_comments tc
      INNER JOIN tasks t ON t.id = tc.task_id
      WHERE tc.id = $1
        AND tc.deleted_at IS NULL
    `,
    [commentId],
  );

  if (!result.rows[0]) {
    throw new Error('Komentar tidak ditemukan.');
  }

  return result.rows[0];
};

const ensureCommentMutationAllowed = (comment, context = {}) => {
  const actorUserId = Number(context.actor_user_id || context.user_id);
  const actorRole = context.actor_role;
  const elevatedRoles = new Set(['super_admin', 'admin', 'manager']);

  if (Number(comment.user_id) === actorUserId || elevatedRoles.has(actorRole)) {
    return;
  }

  throw new Error('Hanya pembuat komentar atau manager yang dapat mengubah komentar.');
};

const updateTaskComment = async (commentId, payload = {}, context = {}) => {
  const comment = normalizeCommentText(payload.comment);

  if (!comment) {
    throw new Error('Komentar wajib diisi.');
  }

  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Komentar tidak boleh lebih dari ${MAX_COMMENT_LENGTH} karakter.`);
  }

  const currentComment = await getCommentForMutation(commentId);
  ensureCommentMutationAllowed(currentComment, context);

  const result = await query(
    `
      UPDATE task_comments
      SET comment = $1
      WHERE id = $2
      RETURNING *
    `,
    [comment, commentId],
  );
  const updatedComment = result.rows[0];
  const mentionUserIds = await resolveMentionUserIds(comment, payload.mention_user_ids);
  await replaceCommentMentions(updatedComment.id, mentionUserIds);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id,
    task_id: currentComment.task_id,
    project_id: currentComment.project_id,
    action: 'task.comment.update',
    object_type: 'task_comment',
    object_id: updatedComment.id,
    description: `Komentar pada task "${currentComment.task_title}" diperbarui.`,
    metadata: {
      mention_user_ids: mentionUserIds,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return (await listTaskComments(currentComment.task_id)).find((item) => Number(item.id) === Number(updatedComment.id));
};

const deleteTaskComment = async (commentId, context = {}) => {
  const currentComment = await getCommentForMutation(commentId);
  ensureCommentMutationAllowed(currentComment, context);

  const result = await query(
    `
      UPDATE task_comments
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
      WHERE id = $2
      RETURNING id, task_id
    `,
    [context.actor_user_id || context.user_id || null, commentId],
  );

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id,
    task_id: currentComment.task_id,
    project_id: currentComment.project_id,
    action: 'task.comment.delete',
    object_type: 'task_comment',
    object_id: currentComment.id,
    description: `Komentar pada task "${currentComment.task_title}" dihapus.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return result.rows[0];
};

module.exports = {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  markCommentRead,
  markTaskCommentsRead,
  updateTaskComment,
};
