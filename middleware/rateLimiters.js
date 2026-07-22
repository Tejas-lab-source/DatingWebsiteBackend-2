const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

module.exports = {
  // Brute-force protection on login. You had none.
  authLimiter: make(15 * 60 * 1000, 20, 'Too many attempts. Try again in 15 minutes.'),
  // Someone could previously spam your Gmail quota to death.
  otpLimiter: make(60 * 60 * 1000, 8, 'Too many codes requested. Try again later.'),
  writeLimiter: make(60 * 1000, 60, 'Slow down a little.'),
  globalLimiter: make(60 * 1000, 300, 'Too many requests.'),
};
