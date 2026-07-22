const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/profile', require('./profileRoutes'));
router.use('/discover', require('./discoveryRoutes'));
router.use('/matches', require('./matchRoutes'));
router.use('/messages', require('./messageRoutes'));
router.use('/confessions', require('./confessionRoutes'));

module.exports = router;
