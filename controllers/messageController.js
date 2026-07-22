const mongoose = require('mongoose');
const User = require('../models/user');
const Message = require('../models/message');
const Match = require('../models/match');
const { uploadBuffer } = require('../config/cloudinary');
const { getIo } = require('../config/socket');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Only matched users may message each other. */
async function assertMatched(a, b) {
  const [u1, u2] = [String(a), String(b)].sort();
  const match = await Match.exists({ user1: u1, user2: u2, unmatchedBy: null });
  if (!match) throw new ApiError(403, 'You can only message people you have matched with');
}

/**
 * GET /messages/conversations?page=1&limit=20
 *
 * The old version pulled EVERY message the user had ever exchanged into
 * Node memory, looped over them to find unique partners, then .slice()'d.
 * It got measurably slower every day the app ran. This does it in one
 * indexed aggregation and also returns the unread count for free.
 */
const listConversations = asyncHandler(async (req, res) => {
  const uid = oid(req.userId);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const conversations = await Message.aggregate([
    { $match: { $or: [{ senderId: uid }, { receiverId: uid }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$senderId', uid] }, '$receiverId', '$senderId'] },
        lastMessage: { $first: '$$ROOT' },
        unread: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$receiverId', uid] }, { $eq: ['$seen', false] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        unread: 1,
        user: {
          _id: '$user._id', name: '$user.name', profile: '$user.profile',
          bio: '$user.bio', isOnline: '$user.isOnline',
        },
        lastMessage: {
          text: '$lastMessage.text',
          image: '$lastMessage.image',
          createdAt: '$lastMessage.createdAt',
          senderId: '$lastMessage.senderId',
        },
      },
    },
  ]);

  res.json({ success: true, conversations });
});

/** GET /messages/:userId?before=<ISO date>&limit=30 — cursor paginated */
const getThread = asyncHandler(async (req, res) => {
  const { userId: otherId } = req.params;
  if (!mongoose.isValidObjectId(otherId)) throw new ApiError(400, 'Invalid user id');

  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 60);

  const filter = {
    $or: [
      { senderId: req.userId, receiverId: otherId },
      { senderId: otherId, receiverId: req.userId },
    ],
  };
  // Cursor pagination — the old endpoint returned the entire chat history
  // every single time you opened a conversation.
  if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Mark their messages to me as seen, and tell them about it.
  const result = await Message.updateMany(
    { senderId: otherId, receiverId: req.userId, seen: false },
    { $set: { seen: true } }
  );
  if (result.modifiedCount) {
    getIo()?.to(String(otherId)).emit('messages:seen', { by: req.userId });
  }

  res.json({
    success: true,
    messages: messages.reverse(), // oldest -> newest for rendering
    hasMore: messages.length === limit,
  });
});

/** POST /messages/:userId — multipart optional, field name "image" */
const sendMessage = asyncHandler(async (req, res) => {
  const { userId: receiverId } = req.params;
  const text = (req.body.text || '').trim();

  if (!mongoose.isValidObjectId(receiverId)) throw new ApiError(400, 'Invalid recipient');
  if (String(receiverId) === req.userId) throw new ApiError(400, "You can't message yourself");
  if (!text && !req.file) throw new ApiError(400, 'Message cannot be empty');

  await assertMatched(req.userId, receiverId);

  let imageUrl;
  if (req.file) {
    const upload = await uploadBuffer(req.file.buffer, 'jiit-connections/messages');
    imageUrl = upload.secure_url; // a real CDN URL, not a local temp path
  }

  const message = await Message.create({
    senderId: req.userId,
    receiverId,
    text: text || undefined,
    image: imageUrl,
  });

  // Old code called `Socket.to(...)` — `Socket` was never defined, so every
  // message to an online user threw a ReferenceError and returned 500.
  getIo()?.to(String(receiverId)).emit('message:new', message);

  res.status(201).json({ success: true, message });
});

/** GET /messages/:userId/media — shared photos for the chat sidebar */
const getSharedMedia = asyncHandler(async (req, res) => {
  const { userId: otherId } = req.params;
  if (!mongoose.isValidObjectId(otherId)) throw new ApiError(400, 'Invalid user id');

  const [user, media] = await Promise.all([
    // Old code used .select("name , profile , bio") — the commas made mongoose
    // look for fields literally named ",".
    User.findById(otherId).select('name profile bio interests isOnline').lean(),
    Message.find({
      $or: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId },
      ],
      image: { $exists: true, $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('image createdAt')
      .lean(),
  ]);

  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, user, images: media.map((m) => m.image) });
});

module.exports = { listConversations, getThread, sendMessage, getSharedMedia };
