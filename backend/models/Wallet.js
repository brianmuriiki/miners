const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  address: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true },
  encryptedPrivateKey: { data: { type: String, required: true }, iv: { type: String, required: true }, tag: { type: String, required: true } },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
