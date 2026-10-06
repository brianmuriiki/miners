const Wallet = require('../models/Wallet');
const Transaction = require('../blockchain/transaction');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');
const { decrypt } = require('../utils/crypto');

const ADDRESS = /^CW[0-9a-f]{40}$/;

exports.send = async (req, res) => {
  const { to, amount, fee = 1 } = req.body || {};
  if (typeof to !== 'string' || !ADDRESS.test(to)) throw httpError(400, 'Invalid recipient address');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Amount must be a positive number');
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) throw httpError(400, 'Invalid fee');
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  const tx = new Transaction({ from: wallet.address, to, amount, fee });
  tx.sign(decrypt(wallet.encryptedPrivateKey), wallet.publicKey);
  try { blockchain.addTransaction(tx); } catch (error) { throw httpError(400, error.message); }
  res.status(201).json({ ...tx.toJSON(), status: 'pending' });
};

exports.list = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  res.json(blockchain.getAddressTransactions(wallet.address));
};

exports.getOne = (req, res) => {
  const tx = blockchain.findTransaction(req.params.id);
  if (!tx) throw httpError(404, 'Transaction not found');
  res.json(tx);
};
