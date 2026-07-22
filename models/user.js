const mongoose = require('mongoose');
const { Schema } = mongoose;

const INTERESTS = [
  'Music', 'Movies', 'Reading', 'Hiking', 'Cooking', 'Gaming', 'Photography',
  'Dancing', 'Travelling', 'Sports', 'Art', 'Fitness', 'Technology', 'Fashion',
  'Food', 'Nature', 'Pets', 'Writing', 'Yoga', 'Swimming',
];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Derived from the college email at signup. Kept OUT of PUBLIC_FIELDS:
    // an enrolment number identifies a specific real student, and exposing it
    // would let anyone map a profile to a person in the college directory.
    enrolmentNo: { type: String, unique: true, sparse: true, select: false },
    admissionYear: { type: Number },

    // select:false => the hash is NEVER returned unless explicitly requested.
    // This one line kills a whole class of leaks (your old code shipped
    // password hashes to the browser on every profile fetch).
    password: { type: String, required: true, select: false },
    age: { type: Number, required: true, min: 17, max: 40 },
    profile: { type: String, required: true }, // primary photo URL
    photos: { type: [String], default: [] },   // extra photos
    year: {
      type: String,
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduated', 'Other'],
      required: true,
    },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    // Who this user wants to see. Replaces the hardcoded male<->female logic.
    showMe: { type: [String], enum: ['male', 'female', 'other'], default: [] },
    interests: { type: [String], enum: INTERESTS, default: [] },
    // was [String] in your schema, which is why bios behaved oddly
    bio: { type: String, default: '', maxlength: 500 },

    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The discovery query filters on gender + isBanned. Without this it was
// a full collection scan every swipe.
userSchema.index({ gender: 1, isBanned: 1 });

userSchema.statics.INTERESTS = INTERESTS;

// Fields that are safe to send to another user.
userSchema.statics.PUBLIC_FIELDS =
  '_id name age profile photos year gender interests bio isOnline lastActive';

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
