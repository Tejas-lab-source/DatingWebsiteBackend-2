const router = require('express').Router();
const c = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { writeLimiter } = require('../middleware/rateLimiters');

// public: account creation (guarded by the verification token instead)
router.post('/', writeLimiter, c.createProfile);
// Photo upload during signup — authorised by the verificationToken, not a JWT.
router.post('/signup-photo', writeLimiter, upload.single('photo'), c.uploadSignupPhoto);

router.use(requireAuth);
router.get('/me', c.getMyProfile);
router.patch('/me', writeLimiter, c.editProfile);
router.delete('/me', c.deleteMyProfile);
router.post('/photo', writeLimiter, upload.single('photo'), c.uploadPhoto);

// Static routes MUST come before /:id, otherwise "/me" is swallowed by the
// param route. This is why your old /suggestions endpoint never fired.
router.get('/:id', c.getUserProfile);

module.exports = router;
