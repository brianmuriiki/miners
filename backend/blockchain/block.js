const { sha256 } = require('../utils/crypto');

class Block {
  constructor(index, timestamp, transactions, previousHash = '', nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce);
  }

  mine(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce += 1;
      this.hash = this.calculateHash();
    }
  }
}

module.exports = Block;
