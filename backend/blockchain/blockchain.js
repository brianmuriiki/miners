const fs = require('fs');
const path = require('path');
const Block = require('./block');
const Transaction = require('./transaction');

const FILE = path.join(__dirname, '..', 'data', 'chain.json');

class Blockchain {
  constructor() {
    this.difficulty = 3;
    this.miningReward = 50;
    this.chain = [new Block(0, 1700000000000, [], '0')];
    this.pending = [];
    this.load();
  }

  get latest() { return this.chain[this.chain.length - 1]; }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) for (const tx of block.transactions) {
      if (tx.from === address) balance -= tx.amount + tx.fee;
      if (tx.to === address) balance += tx.amount;
    }
    return balance;
  }

  getPendingOutgoing(address) {
    return this.pending.filter((tx) => tx.from === address).reduce((sum, tx) => sum + tx.amount + tx.fee, 0);
  }

  addTransaction(tx) {
    if (!tx.from || !tx.to) throw new Error('Transaction needs from and to');
    if (tx.from === tx.to) throw new Error('Cannot send to yourself');
    if (!tx.isValid()) throw new Error('Invalid transaction or signature');
    if (this.findTransaction(tx.id)) throw new Error('Duplicate transaction');
    if (this.getBalance(tx.from) - this.getPendingOutgoing(tx.from) < tx.amount + tx.fee) throw new Error('Insufficient balance');
    this.pending.push(tx);
    this.save();
    return tx;
  }

  minePending(minerAddress) {
    if (typeof minerAddress !== 'string' || !/^CW[0-9a-f]{40}$/.test(minerAddress)) throw new Error('Invalid miner address');
    const fees = this.pending.reduce((sum, tx) => sum + tx.fee, 0);
    const reward = new Transaction({ from: null, to: minerAddress, amount: this.miningReward + fees });
    const block = new Block(this.chain.length, Date.now(), [reward, ...this.pending], this.latest.hash);
    block.mine(this.difficulty);
    this.chain.push(block);
    this.pending = [];
    this.save();
    return block;
  }

  findTransaction(id) {
    const pending = this.pending.find((tx) => tx.id === id);
    if (pending) return { ...pending.toJSON(), status: 'pending', blockHash: null };
    for (const block of this.chain) {
      const tx = block.transactions.find((item) => item.id === id);
      if (tx) return { ...tx.toJSON(), status: 'confirmed', blockHash: block.hash, blockIndex: block.index };
    }
    return null;
  }

  getAddressTransactions(address) {
    const output = this.pending.filter((tx) => tx.from === address || tx.to === address)
      .map((tx) => ({ ...tx.toJSON(), status: 'pending', blockHash: null }));
    for (const block of [...this.chain].reverse()) for (const tx of block.transactions) {
      if (tx.from === address || tx.to === address) output.push({ ...tx.toJSON(), status: 'confirmed', blockHash: block.hash, blockIndex: block.index });
    }
    return output;
  }

  isChainValid() {
    const target = '0'.repeat(this.difficulty);
    if (!this.chain.length || this.chain[0].index !== 0 || this.chain[0].previousHash !== '0') return false;
    for (let i = 1; i < this.chain.length; i += 1) {
      const block = this.chain[i];
      if (block.hash !== block.calculateHash() || block.previousHash !== this.chain[i - 1].hash || !block.hash.startsWith(target)) return false;
      const [reward, ...rest] = block.transactions;
      if (!reward || reward.from !== null || !Number.isFinite(reward.amount) || reward.amount !== this.miningReward + rest.reduce((sum, tx) => sum + tx.fee, 0)) return false;
      if (!rest.every((tx) => tx.from !== null && tx.isValid())) return false;
    }
    return true;
  }

  save() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ chain: this.chain, pending: this.pending }, null, 2));
  }

  load() {
    if (!fs.existsSync(FILE)) return;
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(data.chain) || !Array.isArray(data.pending)) throw new Error('Invalid blockchain data file');
    const transactions = (list) => list.map((tx) => new Transaction(tx));
    this.chain = data.chain.map((item) => {
      const block = new Block(item.index, item.timestamp, transactions(item.transactions), item.previousHash, item.nonce);
      block.hash = item.hash;
      return block;
    });
    this.pending = transactions(data.pending);
  }
}

module.exports = new Blockchain();
