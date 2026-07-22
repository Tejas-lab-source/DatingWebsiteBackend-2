const router = require('express').Router();
const c = require('../controllers/confessionController');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');

// Every one of these needs auth. Your old createConfession and
// getAllConfessions had none at all.
router.use(requireAuth);
router.get('/', c.list);
router.post('/', writeLimiter, c.create);
router.post('/:id/like', writeLimiter, c.toggleLike);
router.patch('/:id', writeLimiter, c.update);
router.delete('/:id', c.remove);

module.exports = router;
