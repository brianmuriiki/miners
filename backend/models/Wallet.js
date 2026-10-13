const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  address: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true, match: /^04[0-9a-f]{128}$/ },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
