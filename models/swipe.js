const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema(
  {
    swiper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['left', 'right'], required: true },
  },
  { timestamps: true }
);

// One swipe per pair. Makes double-swiping impossible at the DB level and
// makes the "have I already seen this person" lookup instant.
swipeSchema.index({ swiper: 1, target: 1 }, { unique: true });
swipeSchema.index({ target: 1, direction: 1 });

module.exports = mongoose.models.Swipe || mongoose.model('Swipe', swipeSchema);
