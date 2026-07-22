const mongoose = require('mongoose');
const User = require('../models/user');
const Swipe = require('../models/swipe');
const Match = require('../models/match');
const { getIo } = require('../config/socket');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const CARD_FIELDS = {
  _id: 1, name: 1, age: 1, profile: 1, photos: 1,
  year: 1, gender: 1, interests: 1, bio: 1, isOnline: 1,
};

/**
 * GET /discover?limit=10
 *
 * The old getProfiles / randomMatch loaded EVERY user of the target gender
 * into Node — full documents, password hashes included — just to pick one.
 * This does the filtering and sampling inside Mongo and returns a small,
 * projected payload. This is the single biggest fix for the lag.
 */
const getDeck = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const me = await User.findById(req.userId).select('gender showMe').lean();
  if (!me) throw new ApiError(404, 'Profile not found');

  const showMe = me.showMe?.length
    ? me.showMe
    : me.gender === 'male' ? ['female'] : me.gender === 'female' ? ['male'] : ['male', 'female', 'other'];

  // .distinct() is index-backed and returns just the ids, not whole documents.
  const alreadySwiped = await Swipe.find({ swiper: req.userId }).distinct('target');

  const profiles = await User.aggregate([
    {
      $match: {
        _id: { $nin: [...alreadySwiped.map(oid), oid(req.userId)] },
        gender: { $in: showMe },
        isBanned: false,
      },
    },
    { $sample: { size: limit } },
    { $project: CARD_FIELDS },
  ]);

  res.json({ success: true, profiles });
});

/**
 * POST /swipe   body: { targetUserId, direction: 'left' | 'right' }
 *
 * Replaces the old split brain: a Swipe collection that was never imported
 * (so it always threw) plus a rightSwipe array on the user doc. One source
 * of truth now.
 */
const swipe = asyncHandler(async (req, res) => {
  const { targetUserId, direction } = req.body;

  if (!['left', 'right'].includes(direction)) throw new ApiError(400, 'direction must be left or right');
  if (!mongoose.isValidObjectId(targetUserId)) throw new ApiError(400, 'Invalid target user');
  if (String(targetUserId) === req.userId) throw new ApiError(400, "You can't swipe on yourself");

  const target = await User.findOne({ _id: targetUserId, isBanned: false }).select('_id name profile').lean();
  if (!target) throw new ApiError(404, 'User not found');

  // upsert => re-swiping is harmless instead of throwing a duplicate key error
  await Swipe.updateOne(
    { swiper: req.userId, target: targetUserId },
    { $set: { direction } },
    { upsert: true }
  );

  if (direction === 'left') return res.json({ success: true, matched: false });

  const mutual = await Swipe.exists({
    swiper: targetUserId,
    target: req.userId,
    direction: 'right',
  });

  if (!mutual) return res.json({ success: true, matched: false });

  // Canonical ordering so a pair can only ever create one Match document.
  const [a, b] = [req.userId, String(targetUserId)].sort();
  await Match.updateOne(
    { user1: a, user2: b },
    { $setOnInsert: { user1: a, user2: b } },
    { upsert: true }
  );

  const me = await User.findById(req.userId).select('name profile').lean();
  const io = getIo();
  if (io) {
    io.to(String(targetUserId)).emit('match:new', { user: me });
    io.to(req.userId).emit('match:new', { user: target });
  }

  res.json({ success: true, matched: true, user: target });
});

/** GET /matches */
const listMatches = asyncHandler(async (req, res) => {
  const uid = oid(req.userId);

  const matches = await Match.aggregate([
    { $match: { $or: [{ user1: uid }, { user2: uid }], unmatchedBy: null } },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        otherId: { $cond: [{ $eq: ['$user1', uid] }, '$user2', '$user1'] },
      },
    },
    { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.isBanned': false } },
    { $project: { _id: 1, matchedAt: '$createdAt', user: CARD_FIELDS } },
  ]);

  res.json({ success: true, matches });
});

/** DELETE /matches/:matchId — unmatch. (Your old handler deleted a USER here.) */
const unmatch = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  if (!mongoose.isValidObjectId(matchId)) throw new ApiError(400, 'Invalid match id');

  const match = await Match.findOne({
    _id: matchId,
    $or: [{ user1: req.userId }, { user2: req.userId }],
  });
  if (!match) throw new ApiError(404, 'Match not found');

  match.unmatchedBy = req.userId;
  await match.save();

  res.json({ success: true, message: 'Unmatched' });
});

/** GET /discover/search?q=&interests=Music,Art&year=2nd%20Year */
const search = asyncHandler(async (req, res) => {
  const { q, interests, year } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const filter = { _id: { $ne: req.userId }, isBanned: false };
  // Your old "search" ignored the query entirely and returned every user.
  if (q) filter.name = { $regex: String(q).slice(0, 40), $options: 'i' };
  if (year) filter.year = year;
  if (interests) filter.interests = { $in: String(interests).split(',') };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(User.PUBLIC_FIELDS)
      .sort({ lastActive: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, users, page, total, hasMore: page * limit < total });
});

module.exports = { getDeck, swipe, listMatches, unmatch, search };
