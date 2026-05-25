const {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require('../services/notificationService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const list = asyncHandler(async (req, res) => {
  const notifications = await listNotifications(req.user?.id, req.query);
  sendSuccess(res, notifications);
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await getUnreadNotificationCount(req.user?.id);
  sendSuccess(res, { unread_count: count });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.params.id, req.user?.id);
  sendSuccess(res, notification, 'Notifikasi ditandai terbaca.');
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsRead(req.user?.id);
  sendSuccess(res, result, 'Semua notifikasi ditandai terbaca.');
});

module.exports = {
  list,
  markAllRead,
  markRead,
  unreadCount,
};
