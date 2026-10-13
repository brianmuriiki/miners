const Wallet = require('../models/Wallet');
const User = require('../models/User');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');

const ADDRESS = /^CW[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;

function pageArgs(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw httpError(400, 'Invalid page or limit');
  return { page, limit };
}

exports.info = (req, res) => res.json({ ...blockchain.info(), blocks: blockchain.chain.length });

exports.blocks = (req, res) => {
  const { page, limit } = pageArgs(req.query);
  const end = Math.max(0, blockchain.chain.length - (page - 1) * limit);
  const start = Math.max(0, end - limit);
  const items = blockchain.chain.slice(start, end).reverse().map((block) => block.toJSON());
  res.json({ total: blockchain.chain.length, page, limit, items });
};

exports.block = (req, res) => {
  const block = blockchain.blockById(req.params.id);
  if (!block) throw httpError(404, 'Block not found');
  res.json(block.toJSON());
};

exports.transaction = (req, res) => {
  if (!HASH.test(req.params.id)) throw httpError(400, 'Invalid transaction id');
  const transaction = blockchain.findTransaction(req.params.id);
  if (!transaction) throw httpError(404, 'Transaction not found');
  if (transaction.proof) transaction.proofValid = blockchain.verifyTransactionProof(transaction.id, transaction.proof, transaction.merkleRoot);
  res.json(transaction);
};

exports.mempool = (req, res) => {
  const selected = blockchain.selectPending();
  const selectedIds = new Set(selected.map((tx) => tx.id));
  const items = [...selected, ...blockchain.pending.filter((tx) => !selectedIds.has(tx.id)).sort((a, b) => b.fee - a.fee || a.id.localeCompare(b.id))];
  res.json({ total: items.length, items: items.map((tx) => ({ ...tx.toJSON(), status: 'pending' })) });
};

exports.fees = (req, res) => res.json(blockchain.fees());

exports.address = (req, res) => {
  const { address } = req.params;
  if (!ADDRESS.test(address)) throw httpError(400, 'Invalid address');
  res.json(blockchain.getAccount(address));
};

exports.addressTransactions = (req, res) => {
  const { address } = req.params;
  if (!ADDRESS.test(address)) throw httpError(400, 'Invalid address');
  const { page, limit } = pageArgs(req.query);
  const items = blockchain.getAddressTransactions(address);
  const start = (page - 1) * limit;
  res.json({ total: items.length, page, limit, items: items.slice(start, start + limit) });
};

exports.addressHistory = (req, res) => {
  const { address } = req.params;
  if (!ADDRESS.test(address)) throw httpError(400, 'Invalid address');
  res.json(blockchain.balanceHistory(address));
};

exports.mine = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  const invited = await User.find({ referredBy: req.user.id, emailVerifiedAt: { $ne: null } }).select('_id').lean();
  const referredWallets = await Wallet.find({ userId: { $in: invited.map((user) => user._id) } }).select('address').lean();
  try { res.status(201).json(blockchain.minePending(wallet.address, referredWallets.map((item) => item.address)).toJSON()); }
  catch (error) { throw httpError(409, error.message); }
};
