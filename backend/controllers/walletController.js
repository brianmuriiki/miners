const Wallet = require('../models/Wallet');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');

exports.getWallet = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) throw httpError(404, 'Wallet not found');
  if (!/^04[0-9a-f]{128}$/.test(wallet.publicKey)) throw httpError(409, 'This account has a legacy CryChain wallet. Its old chain and keys need a separate migration before this wallet can be used.');
  const account = blockchain.getAccount(wallet.address);
  res.json({ ...account, publicKey: wallet.publicKey, unit: 100000000 });
};
