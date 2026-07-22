const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * THE important fix.
 *
 * Your old userAuth verified the token and then threw the result away —
 * it never set req.user. Every controller then read the user id from
 * req.headers['userid'], a header the browser controls. That meant anyone
 * could read anyone's messages or delete anyone's account by editing one
 * header. The auth middleware was purely decorative.
 *
 * Now: req.userId is set from the *signed* token, and no controller
 * ever touches req.headers['userid'] again.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== 'auth' || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Only pull what we need; .lean() skips hydrating a full mongoose doc.
    const user = await User.findById(decoded.userId)
      .select('_id isBanned')
      .lean();

    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    if (user.isBanned) return res.status(403).json({ message: 'Account suspended' });

    req.userId = String(user._id);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
