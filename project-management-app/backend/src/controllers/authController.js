const { loginUser, logoutUser } = require('../services/authService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Login user aplikasi memakai nama atau email dari menu Team.
const login = asyncHandler(async (req, res) => {
  const session = await loginUser(req.body, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  sendSuccess(res, session, 'Login berhasil.');
});

const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, req.user);
});

const logout = asyncHandler(async (req, res) => {
  const result = await logoutUser(req.authToken, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  sendSuccess(res, result, 'Logout berhasil.');
});

module.exports = {
  getMe,
  login,
  logout,
};
