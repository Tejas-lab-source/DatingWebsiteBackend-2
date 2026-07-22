const bcrypt = require('bcryptjs');
const validator = require('validator');
const User = require('../models/user');
const otpStore = require('../utils/otpStore');
const { sendOtpEmail } = require('../config/mailer');
const { signVerificationToken, readVerificationToken, signAuthToken } = require('../utils/tokens');
const { parseEnrolmentEmail, yearOfStudy } = require('../utils/enrolment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const normalise = (e) => String(e || '').toLowerCase().trim();

function assertEmailAllowed(email) {
  if (!validator.isEmail(email)) throw new ApiError(400, 'Enter a valid email address');

  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (domain && !email.endsWith(`@${domain}`)) {
    throw new ApiError(403, `Use your college email — the one ending in @${domain}`);
  }

  if (process.env.REQUIRE_ENROLMENT_EMAIL === 'true' && !parseEnrolmentEmail(email)) {
    throw new ApiError(403, 'Sign up with your enrolment number, like 23103188@mail.jiit.ac.in');
  }
}

/** POST /auth/otp/signup — send a code to a NEW email */
const sendSignupOtp = asyncHandler(async (req, res) => {
  const email = normalise(req.body.email);
  assertEmailAllowed(email);

  if (await User.exists({ email })) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const { otp, error } = otpStore.issue(email, 'signup');
  if (error) throw new ApiError(429, error);

  // Fire and forget — do not make the user wait on Gmail's SMTP handshake.
  sendOtpEmail(email, otp).catch((e) => console.error('[mail] signup otp', e.message));

  res.json({ success: true, message: 'Verification code sent' });
});

/** POST /auth/otp/reset — send a code to an EXISTING email */
const sendResetOtp = asyncHandler(async (req, res) => {
  const email = normalise(req.body.email);
  if (!validator.isEmail(email)) throw new ApiError(400, 'Enter a valid email address');

  const exists = await User.exists({ email });

  // Deliberately vague: telling the caller "no such account" lets anyone
  // enumerate which emails are registered on your site.
  if (exists) {
    const { otp, error } = otpStore.issue(email, 'reset');
    if (error) throw new ApiError(429, error);
    sendOtpEmail(email, otp).catch((e) => console.error('[mail] reset otp', e.message));
  }

  res.json({ success: true, message: 'If that account exists, a code has been sent' });
});

/** POST /auth/otp/verify — exchange a code for a short-lived verification token */
const verifyOtp = asyncHandler(async (req, res) => {
  const email = normalise(req.body.email);
  const { otp, purpose } = req.body;

  if (!['signup', 'reset'].includes(purpose)) throw new ApiError(400, 'Invalid purpose');
  if (!otp) throw new ApiError(400, 'Code is required');

  const result = otpStore.verify(email, purpose, otp);
  if (!result.ok) throw new ApiError(400, result.message);

  res.json({ success: true, verificationToken: signVerificationToken(email) });
});

/** POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const email = normalise(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  // password has select:false on the schema, so we ask for it explicitly.
  const user = await User.findOne({ email }).select('+password');

  // Always run a compare even when the user doesn't exist, so response time
  // doesn't reveal whether the email is registered.
  const hash = user?.password || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) throw new ApiError(401, 'Incorrect email or password');
  if (user.isBanned) throw new ApiError(403, 'This account has been suspended');

  res.json({
    success: true,
    token: signAuthToken(user._id),
    user: { _id: user._id, name: user.name, email: user.email, profile: user.profile },
  });
});

/** POST /auth/password/reset — requires a verificationToken from verifyOtp */
const resetPassword = asyncHandler(async (req, res) => {
  const { verificationToken, newPassword } = req.body;

  const email = readVerificationToken(verificationToken);
  // Without this check your old endpoint let ANYONE change ANYONE's password
  // by posting { email, newPassword } — no OTP required at all.
  if (!email) throw new ApiError(401, 'Verification expired. Please start again.');

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, 'Account not found');

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ success: true, message: 'Password updated. Please log in.' });
});

/** GET /auth/me */
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId)
    .select(`${User.PUBLIC_FIELDS} email showMe admissionYear`)
    .lean();
  if (!user) throw new ApiError(404, 'Account not found');

  // The year of study changes every August. Rather than run a cron, correct it
  // the next time the person opens the app — one conditional write per year.
  if (user.admissionYear) {
    const current = yearOfStudy(user.admissionYear);
    if (current !== user.year) {
      await User.updateOne({ _id: user._id }, { year: current });
      user.year = current;
    }
  }

  res.json({ success: true, user });
});

/** POST /auth/logout — JWTs are stateless; the client discards the token. */
const logout = (_req, res) => res.json({ success: true, message: 'Logged out' });

module.exports = {
  sendSignupOtp,
  sendResetOtp,
  verifyOtp,
  login,
  resetPassword,
  me,
  logout,
};
