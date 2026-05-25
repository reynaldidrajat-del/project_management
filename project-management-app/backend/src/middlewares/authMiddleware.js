const { getAuthenticatedSession } = require('../services/authService');
const { sendError } = require('../utils/responseUtils');

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
};

// Memastikan request API membawa session token yang masih aktif.
const authenticateRequest = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return sendError(res, 'Autentikasi diperlukan.', 'Autentikasi diperlukan.', 401);
    }

    const session = await getAuthenticatedSession(token);

    if (!session) {
      return sendError(res, 'Sesi login tidak valid atau sudah berakhir.', 'Autentikasi diperlukan.', 401);
    }

    req.authToken = token;
    req.session = session.session;
    req.user = session.user;

    return next();
  } catch (error) {
    return sendError(res, error, 'Autentikasi diperlukan.', 401);
  }
};

module.exports = {
  authenticateRequest,
};
