const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const normalizeRateLimitKeyPart = (value, fallback = 'unknown') => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue || fallback;
};

const parsePositiveInteger = (value, fallback) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : fallback;
};

const windowMinutesToMilliseconds = (minutes) => minutes * 60 * 1000;

const getRequestIpKey = (req) => ipKeyGenerator(req.ip);

const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

const apiRateLimiter = rateLimit({
  keyGenerator: (req) => `user:${req.user?.id || getRequestIpKey(req)}`,
  legacyHeaders: false,
  limit: parsePositiveInteger(process.env.API_RATE_LIMIT_MAX, 1500),
  message: {
    error: 'Terlalu banyak request. Coba lagi nanti.',
    message: 'Rate limit terlampaui.',
    success: false,
  },
  standardHeaders: true,
  windowMs: windowMinutesToMilliseconds(parsePositiveInteger(process.env.API_RATE_LIMIT_WINDOW_MINUTES, 15)),
});

const authRateLimiter = rateLimit({
  keyGenerator: (req) => `auth:${normalizeRateLimitKeyPart(req.body?.identifier, getRequestIpKey(req))}`,
  legacyHeaders: false,
  limit: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 50),
  message: {
    error: 'Terlalu banyak percobaan autentikasi. Coba lagi nanti.',
    message: 'Rate limit autentikasi terlampaui.',
    success: false,
  },
  standardHeaders: true,
  windowMs: windowMinutesToMilliseconds(parsePositiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15)),
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  securityHeaders,
};
