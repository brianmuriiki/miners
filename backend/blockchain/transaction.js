const crypto = require('crypto');
const { sha256, sign, verify, addressFromPublicKey } = require('../utils/crypto');

class Transaction {
  constructor({ from, to, amount, fee = 0, timestamp = Date.now(), nonce = crypto.randomBytes(8).toString('hex'), publicKey = null, signature = null }) {
    Object.assign(this, { from, to, amount, fee, timestamp, nonce, publicKey, signature });
  }

  get id() {
    return sha256(`${this.from}|${this.to}|${this.amount}|${this.fee}|${this.timestamp}|${this.nonce}`);
  }

  sign(privateKeyPem, publicKeyPem) {
    this.publicKey = publicKeyPem;
    this.signature = sign(this.id, privateKeyPem);
  }

  isValid() {
    if (this.from === null) return true;
    if (typeof this.to !== 'string' || !/^CW[0-9a-f]{40}$/.test(this.to)) return false;
    if (typeof this.amount !== 'number' || !Number.isFinite(this.amount) || this.amount <= 0) return false;
    if (typeof this.fee !== 'number' || !Number.isFinite(this.fee) || this.fee < 0) return false;
    if (typeof this.timestamp !== 'number' || !Number.isFinite(this.timestamp)) return false;
    if (!this.signature || !this.publicKey) return false;
    if (addressFromPublicKey(this.publicKey) !== this.from) return false;
    return verify(this.id, this.signature, this.publicKey);
  }

  toJSON() {
    return { id: this.id, from: this.from, to: this.to, amount: this.amount, fee: this.fee, timestamp: this.timestamp, nonce: this.nonce, publicKey: this.publicKey, signature: this.signature };
  }
}

module.exports = Transaction;
