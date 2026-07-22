const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 4000 },
    image: { type: String },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Without these, opening a chat scanned the whole messages collection.
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, seen: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
