const router = require('express').Router();
const c = require('../controllers/discoveryController');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');

router.use(requireAuth);
router.get('/deck', c.getDeck);
router.get('/search', c.search);
router.post('/swipe', writeLimiter, c.swipe);

module.exports = router;
