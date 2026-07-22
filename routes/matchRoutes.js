const router = require('express').Router();
const c = require('../controllers/discoveryController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', c.listMatches);
router.delete('/:matchId', c.unmatch);

module.exports = router;
