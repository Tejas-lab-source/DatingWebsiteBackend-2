const mongoose = require('mongoose');

const confessionSchema = new mongoose.Schema(
  {
    // renamed from UserID -> author, and the field the controllers actually
    // referenced ("user") never existed, which is why edit/delete always 500'd.
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    isAnonymous: { type: Boolean, default: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

confessionSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Confession || mongoose.model('Confession', confessionSchema);
