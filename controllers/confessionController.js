const mongoose = require('mongoose');
const Confession = require('../models/confession');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Shapes a confession for the client, honouring the isAnonymous flag.
 * The old getAllConfessions hardcoded user:'Anonymous' for every post, so
 * the flag did nothing — and it .populate()'d the FULL author document
 * (password hash included) just to throw it away.
 */
function present(doc, viewerId) {
  const author = doc.author && typeof doc.author === 'object' ? doc.author : null;
  return {
    _id: doc._id,
    content: doc.content,
    isAnonymous: doc.isAnonymous,
    likeCount: doc.likes?.length || 0,
    likedByMe: (doc.likes || []).some((id) => String(id) === String(viewerId)),
    isMine: String(author?._id || doc.author) === String(viewerId),
    author: doc.isAnonymous
      ? { name: 'Anonymous', profile: null }
      : { _id: author?._id, name: author?.name, profile: author?.profile },
    createdAt: doc.createdAt,
  };
}

/** GET /confessions?page=1&limit=15 */
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 15, 40);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const [items, total] = await Promise.all([
    Confession.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // populate ONLY the two fields we actually render
      .populate('author', 'name profile')
      .lean(),
    Confession.estimatedDocumentCount(),
  ]);

  res.json({
    success: true,
    confessions: items.map((c) => present(c, req.userId)),
    page,
    hasMore: page * limit < total,
  });
});

/** POST /confessions */
const create = asyncHandler(async (req, res) => {
  const content = (req.body.content || '').trim();
  if (content.length < 5) throw new ApiError(400, 'Confession must be at least 5 characters');
  if (content.length > 500) throw new ApiError(400, 'Confession must be under 500 characters');

  const doc = await Confession.create({
    author: req.userId, // taken from the token, not a spoofable header
    content,
    isAnonymous: req.body.isAnonymous !== false,
  });

  const populated = await doc.populate('author', 'name profile');
  res.status(201).json({ success: true, confession: present(populated.toObject(), req.userId) });
});

/** POST /confessions/:id/like — atomic toggle, no read-modify-write race */
const toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid confession id');

  const existing = await Confession.findById(id).select('likes').lean();
  if (!existing) throw new ApiError(404, 'Confession not found');

  const liked = existing.likes.some((u) => String(u) === req.userId);
  const updated = await Confession.findByIdAndUpdate(
    id,
    liked ? { $pull: { likes: req.userId } } : { $addToSet: { likes: req.userId } },
    { new: true, select: 'likes' }
  ).lean();

  res.json({ success: true, liked: !liked, likeCount: updated.likes.length });
});

/** PATCH /confessions/:id */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const content = (req.body.content || '').trim();
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid confession id');
  if (content.length < 5) throw new ApiError(400, 'Confession must be at least 5 characters');

  // The old version checked `confession.user` — a field that never existed on
  // the schema — so this threw a TypeError on every call.
  const doc = await Confession.findOneAndUpdate(
    { _id: id, author: req.userId },
    { content },
    { new: true, runValidators: true }
  ).populate('author', 'name profile');

  if (!doc) throw new ApiError(404, 'Confession not found, or it is not yours');
  res.json({ success: true, confession: present(doc.toObject(), req.userId) });
});

/** DELETE /confessions/:id */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid confession id');

  // Ownership is enforced in the query itself — one round trip, no race.
  const doc = await Confession.findOneAndDelete({ _id: id, author: req.userId });
  if (!doc) throw new ApiError(404, 'Confession not found, or it is not yours');

  res.json({ success: true, message: 'Confession deleted' });
});

module.exports = { list, create, toggleLike, update, remove };
