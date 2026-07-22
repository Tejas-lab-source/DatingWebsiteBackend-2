const router = require('express').Router();
const c = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { writeLimiter } = require('../middleware/rateLimiters');

router.use(requireAuth);
router.get('/conversations', c.listConversations); // before /:userId
router.get('/:userId', c.getThread);
router.get('/:userId/media', c.getSharedMedia);
router.post('/:userId', writeLimiter, upload.single('image'), c.sendMessage);

module.exports = router;
