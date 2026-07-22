const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user');
const { uploadBuffer } = require('../config/cloudinary');
const { readVerificationToken, signAuthToken } = require('../utils/tokens');
const { parseEnrolmentEmail, yearOfStudy } = require('../utils/enrolment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const defaultShowMe = (gender) =>
  gender === 'male' ? ['female'] : gender === 'female' ? ['male'] : ['male', 'female', 'other'];

/** POST /profile — create account. Requires a verificationToken. */
const createProfile = asyncHandler(async (req, res) => {
  const {
    verificationToken, name, password, age, profile, gender, year, interests, bio,
  } = req.body;

  const email = readVerificationToken(verificationToken);
  if (!email) throw new ApiError(401, 'Please verify your email first');

  const missing = ['name', 'password', 'age', 'gender', 'profile'].filter(
    (f) => !req.body[f]
  );
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(', ')}`);
  if (String(password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');

  // The enrolment number in the email tells us the admission year, so the year
  // of study is derived rather than self-reported. `year` from the request body
  // is ignored on purpose — otherwise a 4th year could pose as a fresher.
  const enrolment = parseEnrolmentEmail(email);
  const derivedYear = enrolment ? yearOfStudy(enrolment.admissionYear) : year;
  if (!derivedYear) throw new ApiError(400, 'Could not work out your year of study');

  const user = await User.create({
    name,
    email,
    enrolmentNo: enrolment?.enrolmentNo,
    admissionYear: enrolment?.admissionYear,
    password: await bcrypt.hash(password, 12),
    age,
    profile,
    gender,
    year: derivedYear,
    bio: bio || '',
    interests: Array.isArray(interests) ? interests : [],
    showMe: defaultShowMe(gender),
  });

  // Log them straight in — no reason to bounce back to the login screen.
  res.status(201).json({
    success: true,
    token: signAuthToken(user._id),
    user: { _id: user._id, name: user.name, email: user.email, profile: user.profile },
  });
});

/** GET /profile/me */
const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId)
    .select(`${User.PUBLIC_FIELDS} email showMe admissionYear createdAt`)
    .lean();
  if (!user) throw new ApiError(404, 'Profile not found');
  res.json({ success: true, user });
});

/** GET /profile/:id — another user's public profile */
const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid user id');

  // PUBLIC_FIELDS excludes email and (via select:false) the password hash.
  // Your old version sent the entire document, hash included.
  const user = await User.findOne({ _id: id, isBanned: false })
    .select(User.PUBLIC_FIELDS)
    .lean();

  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, user });
});

/** PATCH /profile/me */
const editProfile = asyncHandler(async (req, res) => {
  // `year` is intentionally absent — it comes from the enrolment number and is
  // refreshed automatically each August. Letting people edit it would undo that.
  const allowed = ['name', 'bio', 'age', 'profile', 'photos', 'interests', 'showMe'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  if (!Object.keys(update).length) throw new ApiError(400, 'Nothing to update');

  const user = await User.findByIdAndUpdate(req.userId, update, {
    new: true,
    runValidators: true, // your old version skipped validation entirely
  })
    .select(`${User.PUBLIC_FIELDS} email showMe`)
    .lean();

  res.json({ success: true, user });
});

/** POST /profile/photo — multipart, field name "photo" */
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image received');
  const result = await uploadBuffer(req.file.buffer, 'jiit-connections/profiles');
  res.json({ success: true, url: result.secure_url });
});

/**
 * POST /profile/signup-photo — multipart, fields: photo (file) + verificationToken
 *
 * Signup needs a photo URL before the account exists, but /profile/photo sits
 * behind requireAuth and a new user has no auth token yet — only the
 * verificationToken from OTP verification. Without this endpoint registration
 * was impossible to complete.
 */
const uploadSignupPhoto = asyncHandler(async (req, res) => {
  const email = readVerificationToken(req.body.verificationToken);
  if (!email) throw new ApiError(401, 'Please verify your email first');
  if (!req.file) throw new ApiError(400, 'No image received');

  const result = await uploadBuffer(req.file.buffer, 'jiit-connections/profiles');
  res.json({ success: true, url: result.secure_url });
});

/** DELETE /profile/me */
const deleteMyProfile = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.userId);
  res.json({ success: true, message: 'Account deleted' });
});

module.exports = {
  createProfile,
  getMyProfile,
  getUserProfile,
  editProfile,
  uploadPhoto,
  uploadSignupPhoto,
  deleteMyProfile,
};
