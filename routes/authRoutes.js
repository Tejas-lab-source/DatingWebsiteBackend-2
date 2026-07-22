const router = require('express').Router();
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiters');

router.post('/otp/signup', otpLimiter, c.sendSignupOtp);
router.post('/otp/reset', otpLimiter, c.sendResetOtp);
router.post('/otp/verify', authLimiter, c.verifyOtp);
router.post('/login', authLimiter, c.login);
router.post('/password/reset', authLimiter, c.resetPassword);
router.get('/me', requireAuth, c.me);
router.post('/logout', requireAuth, c.logout);

module.exports = router;
