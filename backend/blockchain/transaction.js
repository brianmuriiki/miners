const { sha256, verify, addressFromPublicKey } = require('../utils/crypto');

const ADDRESS = /^CW[0-9a-f]{40}$/;
const canonical = (value) => JSON.stringify(Object.keys(value).sort().reduce((out, key) => { out[key] = value[key]; return out; }, {}));
const bodyOf = ({ from, to, amount, fee, timestamp, nonce, referralAddresses }) => ({ from, to, amount, fee, timestamp, nonce, ...(Array.isArray(referralAddresses) && referralAddresses.length ? { referralAddresses } : {}) });

class Transaction {
  constructor({ from, to, amount, fee = 0, timestamp = Date.now(), nonce, publicKey = null, signature = null, id, referralAddresses }) {
    Object.assign(this, { from, to, amount, fee, timestamp, nonce, publicKey, signature });
    if (referralAddresses !== undefined) this.referralAddresses = referralAddresses;
    this.id = id || Transaction.idFor(this);
  }

  static idFor(tx) { return sha256(canonical(bodyOf(tx))); }

  static fromRequest(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Transaction body must be an object');
    const keys = ['id', 'from', 'to', 'amount', 'fee', 'timestamp', 'nonce', 'publicKey', 'signature'];
    if (Object.keys(raw).some((key) => !keys.includes(key))) throw new Error('Transaction contains unsupported fields');
    return new Transaction(raw);
  }

  isValid() {
    if (typeof this.from !== 'string' || !ADDRESS.test(this.from) || typeof this.to !== 'string' || !ADDRESS.test(this.to)) return false;
    if (this.from === this.to || !Number.isSafeInteger(this.amount) || this.amount <= 0 || !Number.isSafeInteger(this.fee) || this.fee < 0 || !Number.isSafeInteger(this.amount + this.fee)) return false;
    if (!Number.isSafeInteger(this.timestamp) || this.timestamp < 0 || this.timestamp > Date.now() + 10 * 60 * 1000 || !Number.isSafeInteger(this.nonce) || this.nonce < 0) return false;
    return typeof this.publicKey === 'string' && addressFromPublicKey(this.publicKey) === this.from && typeof this.signature === 'string' && this.id === Transaction.idFor(this) && verify(this.id, this.signature, this.publicKey);
  }

  toJSON() { return { id: this.id, ...bodyOf(this), publicKey: this.publicKey, signature: this.signature }; }
}

module.exports = Transaction;
