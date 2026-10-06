const Wallet = require('../models/Wallet');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');

exports.getWallet = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  const balance = blockchain.getBalance(wallet.address);
  res.json({ address: wallet.address, publicKey: wallet.publicKey, balance, available: balance - blockchain.getPendingOutgoing(wallet.address) });
};
