const { loginUser } = require('../services/authService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Login user aplikasi memakai nama atau email dari menu Team.
const login = asyncHandler(async (req, res) => {
  const user = await loginUser(req.body);
  sendSuccess(res, user, 'Login berhasil.');
});

module.exports = {
  login,
};
