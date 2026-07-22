const jwt = require('jsonwebtoken');

// Short-lived proof that an email passed OTP verification. The signup endpoint
// requires this, which closes the hole where anyone could POST /createProfile
// directly and skip verification entirely.
function signVerificationToken(email) {
  return jwt.sign({ email, scope: 'email_verified' }, process.env.JWT_SECRET, {
    expiresIn: '20m',
  });
}

function readVerificationToken(token) {
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    return d.scope === 'email_verified' ? d.email : null;
  } catch {
    return null;
  }
}

function signAuthToken(userId) {
  return jwt.sign({ userId, scope: 'auth' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { signVerificationToken, readVerificationToken, signAuthToken };
