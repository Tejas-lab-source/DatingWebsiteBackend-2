const rateLimit = require('express-rate-limit');

const DISABLE_RATE_LIMIT = true;

const make = (windowMs, max, message) => {
  if (DISABLE_RATE_LIMIT) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });
};

module.exports = {
  authLimiter: make(15 * 60 * 1000, 20, 'Too many attempts. Try again in 15 minutes.'),
  otpLimiter: make(60 * 60 * 1000, 8, 'Too many codes requested. Try again later.'),
  writeLimiter: make(60 * 1000, 60, 'Slow down a little.'),
  globalLimiter: make(60 * 1000, 300, 'Too many requests.'),
};
