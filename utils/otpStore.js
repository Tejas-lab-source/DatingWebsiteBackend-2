const crypto = require('crypto');

/**
 * In-memory OTP store with hashing + TTL + attempt limiting.
 *
 * Your old code kept TWO separate Maps (one in authController, one in
 * getprofileController) so an OTP issued by one was invisible to the other.
 * It also stored OTPs in plaintext and had no attempt limit.
 *
 * NOTE: this still only works for a SINGLE server process. If you deploy more
 * than one instance (or your host restarts dynos), swap the Map for Redis.
 * The interface below is designed so that's a 10-line change.
 */
const store = new Map();
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const key = (email, purpose) => `${purpose}:${String(email).toLowerCase().trim()}`;

function issue(email, purpose) {
  const k = key(email, purpose);
  const existing = store.get(k);
  if (existing && Date.now() - existing.issuedAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.issuedAt)) / 1000);
    return { error: `Please wait ${wait}s before requesting another code.` };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  store.set(k, {
    hash: hash(otp),
    expiresAt: Date.now() + TTL_MS,
    issuedAt: Date.now(),
    attempts: 0,
  });
  return { otp };
}

function verify(email, purpose, otp) {
  const k = key(email, purpose);
  const rec = store.get(k);
  if (!rec) return { ok: false, message: 'No code found. Request a new one.' };
  if (Date.now() > rec.expiresAt) {
    store.delete(k);
    return { ok: false, message: 'Code expired. Request a new one.' };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    store.delete(k);
    return { ok: false, message: 'Too many attempts. Request a new code.' };
  }
  rec.attempts += 1;

  // timing-safe compare
  const a = Buffer.from(rec.hash);
  const b = Buffer.from(hash(otp));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, message: 'Invalid code.' };
  }

  store.delete(k);
  return { ok: true };
}

// Sweep expired entries so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (now > v.expiresAt) store.delete(k);
}, 5 * 60 * 1000).unref();

module.exports = { issue, verify };
