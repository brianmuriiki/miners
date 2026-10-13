const Wallet = require('../models/Wallet');
const Transaction = require('../blockchain/transaction');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');

exports.send = async (req, res) => {
  const tx = Transaction.fromRequest(req.body);
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  if (tx.from !== wallet.address || tx.publicKey !== wallet.publicKey) throw httpError(403, 'Transaction sender does not match your wallet');
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
