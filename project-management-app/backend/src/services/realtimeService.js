const { Server } = require('socket.io');

const { query } = require('../config/db');
const { getAuthenticatedSession } = require('./authService');

let io = null;

const normalizePositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const queryToken = socket.handshake.query?.token;
  const authorization = socket.handshake.headers?.authorization || '';
  const [scheme, headerToken] = authorization.split(' ');

  if (authToken) {
    return String(authToken).trim();
  }

  if (queryToken) {
    return String(queryToken).trim();
  }

  if (scheme?.toLowerCase() === 'bearer' && headerToken) {
    return headerToken.trim();
  }

  return null;
};

const getAccessibleProjectIds = async (user) => {
  const userId = normalizePositiveInteger(user?.id);

  if (!userId) {
    return [];
  }

  if (['super_admin', 'admin', 'manager'].includes(user.role)) {
    const result = await query('SELECT id FROM projects ORDER BY id');
    return result.rows.map((row) => row.id);
  }

  const result = await query(
    `
      SELECT DISTINCT project_id
      FROM (
        SELECT p.id AS project_id
        FROM projects p
        WHERE p.owner_id = $1
        UNION
        SELECT pm.project_id
        FROM project_members pm
        WHERE pm.user_id = $1
        UNION
        SELECT t.project_id
        FROM tasks t
        WHERE t.assignee_id = $1
           OR t.lead_id = $1
           OR t.creator_id = $1
        UNION
        SELECT t.project_id
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        WHERE ta.user_id = $1
      ) access_scope
      WHERE project_id IS NOT NULL
    `,
    [userId],
  );

  return result.rows.map((row) => row.project_id);
};

const getMemberChatRoomIds = async (userId) => {
  const result = await query(
    `
      SELECT room_id
      FROM chat_room_members
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows.map((row) => row.room_id);
};

const userCanAccessProject = async (user, projectId) => {
  const normalizedProjectId = normalizePositiveInteger(projectId);

  if (!normalizedProjectId) {
    return false;
  }

  if (['super_admin', 'admin', 'manager'].includes(user?.role)) {
    return true;
  }

  const projectIds = await getAccessibleProjectIds(user);
  return projectIds.some((accessibleProjectId) => Number(accessibleProjectId) === normalizedProjectId);
};

const userCanAccessChatRoom = async (userId, roomId) => {
  const result = await query(
    `
      SELECT 1
      FROM chat_room_members
      WHERE user_id = $1
        AND room_id = $2
      LIMIT 1
    `,
    [userId, roomId],
  );

  return Boolean(result.rowCount);
};

const joinDefaultRooms = async (socket) => {
  const user = socket.data.user;
  const userId = normalizePositiveInteger(user?.id);

  if (!userId) {
    return;
  }

  socket.join(`user:${userId}`);

  if (user.department_id) {
    socket.join(`department:${user.department_id}`);
  }

  const [projectIds, chatRoomIds] = await Promise.all([getAccessibleProjectIds(user), getMemberChatRoomIds(userId)]);

  projectIds.forEach((projectId) => socket.join(`project:${projectId}`));
  chatRoomIds.forEach((roomId) => socket.join(`chat:${roomId}`));
};

const initializeRealtimeServer = (httpServer, options = {}) => {
  io = new Server(httpServer, {
    cors: options.cors,
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      const session = await getAuthenticatedSession(token);

      if (!session) {
        next(new Error('Sesi realtime tidak valid atau sudah berakhir.'));
        return;
      }

      socket.data.authToken = token;
      socket.data.session = session.session;
      socket.data.user = session.user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', async (socket) => {
    try {
      await joinDefaultRooms(socket);

      socket.emit('realtime.connected', {
        user_id: socket.data.user?.id,
      });
    } catch (error) {
      socket.emit('realtime.error', {
        message: error.message,
      });
    }

    socket.on('project:join', async (projectId, ack) => {
      try {
        const normalizedProjectId = normalizePositiveInteger(projectId);
        const allowed = await userCanAccessProject(socket.data.user, normalizedProjectId);

        if (!allowed) {
          throw new Error('User tidak memiliki akses project.');
        }

        socket.join(`project:${normalizedProjectId}`);
        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, error: error.message });
      }
    });

    socket.on('task:join', (taskId, ack) => {
      const normalizedTaskId = normalizePositiveInteger(taskId);

      if (!normalizedTaskId) {
        ack?.({ success: false, error: 'Task tidak valid.' });
        return;
      }

      socket.join(`task:${normalizedTaskId}`);
      ack?.({ success: true });
    });

    socket.on('chat:join', async (roomId, ack) => {
      try {
        const normalizedRoomId = normalizePositiveInteger(roomId);
        const allowed = await userCanAccessChatRoom(socket.data.user?.id, normalizedRoomId);

        if (!allowed) {
          throw new Error('User tidak memiliki akses chat room.');
        }

        socket.join(`chat:${normalizedRoomId}`);
        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, error: error.message });
      }
    });
  });

  return io;
};

const getRealtimeServer = () => io;

const emitToRoom = (room, eventName, payload) => {
  if (!io || !room || !eventName) {
    return;
  }

  io.to(room).emit(eventName, payload);
};

const emitToUser = (userId, eventName, payload) => {
  const normalizedUserId = normalizePositiveInteger(userId);

  if (normalizedUserId) {
    emitToRoom(`user:${normalizedUserId}`, eventName, payload);
  }
};

const emitToUsers = (userIds = [], eventName, payload) => {
  Array.from(new Set(userIds.map(normalizePositiveInteger).filter(Boolean))).forEach((userId) => {
    emitToUser(userId, eventName, payload);
  });
};

const emitToProject = (projectId, eventName, payload) => {
  const normalizedProjectId = normalizePositiveInteger(projectId);

  if (normalizedProjectId) {
    emitToRoom(`project:${normalizedProjectId}`, eventName, payload);
  }
};

const emitToTask = (taskId, eventName, payload) => {
  const normalizedTaskId = normalizePositiveInteger(taskId);

  if (normalizedTaskId) {
    emitToRoom(`task:${normalizedTaskId}`, eventName, payload);
  }
};

const emitToChatRoom = (roomId, eventName, payload) => {
  const normalizedRoomId = normalizePositiveInteger(roomId);

  if (normalizedRoomId) {
    emitToRoom(`chat:${normalizedRoomId}`, eventName, payload);
  }
};

module.exports = {
  emitToChatRoom,
  emitToProject,
  emitToTask,
  emitToUser,
  emitToUsers,
  getRealtimeServer,
  initializeRealtimeServer,
};
