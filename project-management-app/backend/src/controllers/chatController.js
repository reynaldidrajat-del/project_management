const {
  createChatMessage,
  createChatRoom,
  deleteChatMessage,
  listChatMessages,
  listChatRooms,
  markChatMessageRead,
  markChatRoomRead,
  updateChatMessage,
} = require('../services/chatService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestContext = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: req.ip,
  user: req.user,
  user_agent: req.headers['user-agent'],
});

const listRooms = asyncHandler(async (req, res) => {
  const rooms = await listChatRooms(req.user, req.query);
  sendSuccess(res, rooms);
});

const createRoom = asyncHandler(async (req, res) => {
  const room = await createChatRoom(req.body, req.user);
  sendSuccess(res, room, 'Chat room berhasil dibuat.', 201);
});

const listMessages = asyncHandler(async (req, res) => {
  const messages = await listChatMessages(req.params.roomId, req.user, req.query);
  sendSuccess(res, messages);
});

const createMessage = asyncHandler(async (req, res) => {
  const message = await createChatMessage(req.params.roomId, req.body, getRequestContext(req));
  sendSuccess(res, message, 'Pesan chat berhasil dikirim.', 201);
});

const updateMessage = asyncHandler(async (req, res) => {
  const message = await updateChatMessage(req.params.id, req.body, req.user);
  sendSuccess(res, message, 'Pesan chat berhasil diperbarui.');
});

const deleteMessage = asyncHandler(async (req, res) => {
  const message = await deleteChatMessage(req.params.id, req.user);
  sendSuccess(res, message, 'Pesan chat berhasil dihapus.');
});

const markMessageRead = asyncHandler(async (req, res) => {
  const receipt = await markChatMessageRead(req.params.id, req.user);
  sendSuccess(res, receipt, 'Pesan chat ditandai terbaca.');
});

const markRoomRead = asyncHandler(async (req, res) => {
  const result = await markChatRoomRead(req.params.roomId, req.user);
  sendSuccess(res, result, 'Chat room ditandai terbaca.');
});

module.exports = {
  createMessage,
  createRoom,
  deleteMessage,
  listMessages,
  listRooms,
  markMessageRead,
  markRoomRead,
  updateMessage,
};
