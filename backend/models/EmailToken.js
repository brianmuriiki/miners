const mongoose = require('mongoose');

const emailTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ['verify-email', 'change-email', 'reset-password'], required: true },
  targetEmail: { type: String, lowercase: true, trim: true, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('EmailToken', emailTokenSchema);
