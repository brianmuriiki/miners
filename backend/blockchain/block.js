const { sha256 } = require('../utils/crypto');
const { merkleRoot } = require('./merkle');
const canonical = (value) => JSON.stringify(Object.keys(value).sort().reduce((out, key) => { out[key] = value[key]; return out; }, {}));

class Block {
  constructor(index, timestamp, transactions, previousHash = '', nonce = 0, difficulty = 3, root = null) {
    Object.assign(this, { index, timestamp, transactions, previousHash, nonce, difficulty });
    this.merkleRoot = root === null || root === undefined ? merkleRoot(transactions) : root;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(canonical({ index: this.index, previousHash: this.previousHash, timestamp: this.timestamp, merkleRoot: this.merkleRoot, difficulty: this.difficulty, nonce: this.nonce }));
  }

  mine(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) { this.nonce += 1; this.hash = this.calculateHash(); }
  }

  toJSON() { return { index: this.index, timestamp: this.timestamp, transactions: this.transactions.map((tx) => tx.toJSON()), previousHash: this.previousHash, nonce: this.nonce, merkleRoot: this.merkleRoot, difficulty: this.difficulty, hash: this.hash }; }
}

module.exports = Block;
