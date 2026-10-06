const Wallet = require('../models/Wallet');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');

exports.info = (req, res) => res.json({ blocks: blockchain.chain.length, pending: blockchain.pending.length, difficulty: blockchain.difficulty, miningReward: blockchain.miningReward, valid: blockchain.isChainValid() });
exports.blocks = (req, res) => res.json([...blockchain.chain].reverse());

exports.mine = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  res.status(201).json(blockchain.minePending(wallet.address));
};
