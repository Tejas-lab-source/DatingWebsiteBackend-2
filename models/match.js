const mongoose = require('mongoose');

// This lived inside swipe.js and was destroyed by the second module.exports.
const matchSchema = new mongoose.Schema(
  {
    // Always stored with user1 < user2 (string compare) so a given pair can
    // only ever produce one document.
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unmatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

matchSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.models.Match || mongoose.model('Match', matchSchema);
