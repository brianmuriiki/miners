const fs = require('fs');
const path = require('path');
const Block = require('./block');
const Transaction = require('./transaction');
const { merkleProof, merkleRoot, verifyMerkleProof } = require('./merkle');

const FILE = process.env.CRYCHAIN_FILE || path.join(__dirname, '..', 'data', 'crychain-v2.json');
const UNIT = 100_000_000;
const REWARD = 50 * UNIT;
const REFERRAL_REWARD = 100 * UNIT;
const MIN_FEE = 1_000;
const MAX_TXS = 50;
const MAX_PENDING = 1_000;
const MIN_DIFF = 2;
const MAX_DIFF = 6;
const TARGET_BLOCK_MS = 10_000;
const ADJUST_EVERY = 10;
const GENESIS_TIME = 1700000000000;
const emptyGenesis = () => new Block(0, GENESIS_TIME, [], '0', 0, MIN_DIFF);
const account = (state, address) => state.get(address) || { balance: 0, nonce: 0 };
const validAddress = (value) => typeof value === 'string' && /^CW[0-9a-f]{40}$/.test(value);
const bySenderNonce = (a, b) => a.from === b.from ? a.nonce - b.nonce || b.fee - a.fee || a.id.localeCompare(b.id) : a.from.localeCompare(b.from);

function nextDifficulty(chain, height) {
  const previous = chain[height - 1];
  if (height % ADJUST_EVERY !== 0) return previous.difficulty;
  const start = chain[height - ADJUST_EVERY];
  if (!start) return previous.difficulty;
  const actual = previous.timestamp - start.timestamp;
  const expected = TARGET_BLOCK_MS * ADJUST_EVERY;
  let difficulty = previous.difficulty;
  if (actual < expected / 2) difficulty += 1;
  else if (actual > expected * 2) difficulty -= 1;
  return Math.max(MIN_DIFF, Math.min(MAX_DIFF, difficulty));
}

class Blockchain {
  constructor(file = FILE) {
    this.file = file;
    this.chain = [emptyGenesis()];
    this.pending = [];
    this.state = new Map();
    this.load();
  }

  get latest() { return this.chain[this.chain.length - 1]; }

  getAccount(address) {
    if (!validAddress(address)) throw new Error('Invalid address');
    const current = account(this.state, address);
    const outgoing = this.pending.filter((tx) => tx.from === address);
    const pendingOutgoing = outgoing.reduce((sum, tx) => sum + tx.amount + tx.fee, 0);
    return {
      address, balance: current.balance, nonce: current.nonce,
      pendingOutgoing, available: current.balance - pendingOutgoing,
      nextNonce: current.nonce + outgoing.length,
    };
  }

  _admit(tx) {
    if (!(tx instanceof Transaction) || !tx.isValid()) throw new Error('Invalid transaction or signature');
    if (this.findTransaction(tx.id)) throw new Error('Duplicate transaction');
    if (this.pending.length >= MAX_PENDING) throw new Error('Mempool is full');
    const sender = this.getAccount(tx.from);
    if (tx.fee < MIN_FEE) throw new Error(`Fee must be at least ${MIN_FEE} base units`);
    if (tx.nonce !== sender.nextNonce) throw new Error(`Invalid nonce; expected ${sender.nextNonce}`);
    if (!Number.isSafeInteger(sender.pendingOutgoing + tx.amount + tx.fee)) throw new Error('Pending amount exceeds the safe integer limit');
    if (sender.available < tx.amount + tx.fee) throw new Error('Insufficient balance');
    this.pending.push(tx);
    return tx;
  }

  addTransaction(raw) {
    const tx = raw instanceof Transaction ? raw : Transaction.fromRequest(raw);
    this._admit(tx);
    this.save();
    return tx;
  }

  selectPending() {
    const queues = new Map();
    for (const tx of this.pending) {
      if (!queues.has(tx.from)) queues.set(tx.from, []);
      queues.get(tx.from).push(tx);
    }
    for (const queue of queues.values()) queue.sort((a, b) => a.nonce - b.nonce);
    const balances = new Map(); const nonces = new Map(); const selected = [];
    while (selected.length < MAX_TXS) {
      let best = null;
      for (const [address, queue] of queues) {
        const tx = queue[0];
        if (!tx) continue;
        const current = account(this.state, address);
        const balance = balances.get(address) ?? current.balance;
        const nonce = nonces.get(address) ?? current.nonce;
        if (tx.nonce !== nonce || balance < tx.amount + tx.fee) { queue.length = 0; continue; }
        if (!best || tx.fee > best.fee || (tx.fee === best.fee && tx.id < best.id)) best = tx;
      }
      if (!best) break;
      queues.get(best.from).shift();
      selected.push(best);
      balances.set(best.from, (balances.get(best.from) ?? account(this.state, best.from).balance) - best.amount - best.fee);
      nonces.set(best.from, best.nonce + 1);
    }
    return selected;
  }

  claimedReferralAddresses() {
    return new Set(this.chain.flatMap((block) => block.transactions.flatMap((tx) => tx.referralAddresses || [])));
  }

  minePending(minerAddress, referralAddresses = []) {
    if (!validAddress(minerAddress)) throw new Error('Invalid miner address');
    const claimed = this.claimedReferralAddresses();
    const referrals = [...new Set(referralAddresses.filter(validAddress).filter((address) => !claimed.has(address)))].slice(0, MAX_TXS);
    const selected = this.selectPending();
    const included = new Set(selected.map((tx) => tx.id));
    const remaining = this.pending.filter((tx) => !included.has(tx.id));
    const fees = selected.reduce((sum, tx) => sum + tx.fee, 0);
    const rewardAmount = REWARD + fees + referrals.length * REFERRAL_REWARD;
    if (!Number.isSafeInteger(fees) || !Number.isSafeInteger(rewardAmount)) throw new Error('Block reward exceeds the safe integer limit');
    const height = this.chain.length;
    const timestamp = Math.max(Date.now(), this.latest.timestamp + 1);
    const difficulty = nextDifficulty(this.chain, height);
    const reward = new Transaction({ from: null, to: minerAddress, amount: rewardAmount, fee: 0, timestamp, nonce: height, ...(referrals.length ? { referralAddresses: referrals } : {}) });
    const block = new Block(height, timestamp, [reward, ...selected], this.latest.hash, 0, difficulty);
    block.mine(difficulty);
    const next = this.validateBlock(block, this.state);
    this.chain.push(block);
    this.state = next;
    this.pending = [];
    for (const tx of remaining.sort(bySenderNonce)) { try { this._admit(tx); } catch { /* Drop transactions made invalid by the new block. */ } }
    this.save();
    return block;
  }

  validateBlock(block, priorState) {
    const height = this.chain.length;
    if (!block || block.index !== height || block.previousHash !== this.latest.hash || !Number.isSafeInteger(block.timestamp) || block.timestamp <= this.latest.timestamp || !Number.isSafeInteger(block.nonce) || block.nonce < 0 || block.difficulty !== nextDifficulty(this.chain, height)) throw new Error('Invalid block header');
    if (!Array.isArray(block.transactions) || block.transactions.length < 1 || block.transactions.length > MAX_TXS + 1) throw new Error('Invalid transaction count');
    const candidate = block instanceof Block ? block : this.restoreBlock(block);
    if (candidate.merkleRoot !== merkleRoot(candidate.transactions) || candidate.hash !== candidate.calculateHash() || !candidate.hash.startsWith('0'.repeat(candidate.difficulty))) throw new Error('Invalid block commitment or proof of work');
    const [reward, ...txs] = candidate.transactions;
    const fees = txs.reduce((sum, tx) => sum + tx.fee, 0);
    const referrals = reward.referralAddresses === undefined ? [] : reward.referralAddresses;
    const claimedReferrals = this.claimedReferralAddresses();
    if (!Array.isArray(referrals) || referrals.length > MAX_TXS || referrals.some((address) => !validAddress(address)) || new Set(referrals).size !== referrals.length || referrals.some((address) => claimedReferrals.has(address))) throw new Error('Invalid referral reward');
    const expectedReward = REWARD + fees + referrals.length * REFERRAL_REWARD;
    if (!Number.isSafeInteger(fees) || !Number.isSafeInteger(expectedReward) || reward.from !== null || !validAddress(reward.to) || reward.fee !== 0 || reward.timestamp !== candidate.timestamp || reward.nonce !== candidate.index || reward.publicKey !== null || reward.signature !== null || reward.id !== Transaction.idFor(reward) || !Number.isSafeInteger(reward.amount) || reward.amount !== expectedReward) throw new Error('Invalid mining reward');
    const next = new Map(priorState);
    for (const tx of txs) {
      if (!tx.isValid()) throw new Error('Invalid transaction or signature');
      const sender = account(next, tx.from);
      if (tx.fee < MIN_FEE || tx.nonce !== sender.nonce || sender.balance < tx.amount + tx.fee) throw new Error('Invalid fee, account nonce, or balance');
      if (!Number.isSafeInteger(sender.balance - tx.amount - tx.fee) || !Number.isSafeInteger(sender.nonce + 1)) throw new Error('Account state exceeds the safe integer limit');
      next.set(tx.from, { balance: sender.balance - tx.amount - tx.fee, nonce: sender.nonce + 1 });
      const recipient = account(next, tx.to);
      if (!Number.isSafeInteger(recipient.balance + tx.amount)) throw new Error('Account state exceeds the safe integer limit');
      next.set(tx.to, { ...recipient, balance: recipient.balance + tx.amount });
    }
    const miner = account(next, reward.to);
    if (!Number.isSafeInteger(miner.balance + reward.amount)) throw new Error('Account state exceeds the safe integer limit');
    next.set(reward.to, { ...miner, balance: miner.balance + reward.amount });
    return next;
  }

  validateChain(chain) {
    if (!Array.isArray(chain) || !chain.length) throw new Error('Invalid chain');
    const first = this.restoreBlock(chain[0]);
    if (first.hash !== emptyGenesis().hash || first.hash !== first.calculateHash() || first.index !== 0 || first.timestamp !== GENESIS_TIME || first.previousHash !== '0' || first.nonce !== 0 || first.difficulty !== MIN_DIFF || first.transactions.length !== 0 || first.merkleRoot !== merkleRoot([])) throw new Error('Invalid genesis block');
    const originalChain = this.chain; const originalState = this.state;
    this.chain = [first]; this.state = new Map();
    try {
      for (const raw of chain.slice(1)) {
        const block = this.restoreBlock(raw);
        this.state = this.validateBlock(block, this.state);
        this.chain.push(block);
      }
      return { chain: this.chain, state: this.state };
    } finally { this.chain = originalChain; this.state = originalState; }
  }

  restoreBlock(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.transactions)) throw new Error('Invalid block data');
    const txs = raw.transactions.map((tx) => new Transaction(tx));
    const block = new Block(raw.index, raw.timestamp, txs, raw.previousHash, raw.nonce, raw.difficulty, raw.merkleRoot);
    block.difficulty = raw.difficulty;
    block.merkleRoot = raw.merkleRoot;
    block.hash = raw.hash;
    return block;
  }

  findTransaction(id) {
    const pending = this.pending.find((tx) => tx.id === id);
    if (pending) return { ...pending.toJSON(), status: 'pending', blockHash: null };
    for (const block of [...this.chain].reverse()) {
      const tx = block.transactions.find((item) => item.id === id);
      if (tx) {
        const proof = merkleProof(block.transactions, block.transactions.indexOf(tx));
        return { ...tx.toJSON(), status: 'confirmed', blockHash: block.hash, blockIndex: block.index, confirmations: this.chain.length - block.index, merkleRoot: block.merkleRoot, proof, proofValid: verifyMerkleProof(tx.id, proof, block.merkleRoot) };
      }
    }
    return null;
  }

  getAddressTransactions(address) {
    return [
      ...this.pending.filter((tx) => tx.from === address || tx.to === address).map((tx) => ({ ...tx.toJSON(), status: 'pending', blockHash: null })),
      ...[...this.chain].reverse().flatMap((block) => block.transactions.filter((tx) => tx.from === address || tx.to === address).map((tx) => ({ ...tx.toJSON(), status: 'confirmed', blockHash: block.hash, blockIndex: block.index, confirmations: this.chain.length - block.index }))),
    ];
  }

  balanceHistory(address) {
    if (!validAddress(address)) throw new Error('Invalid address');
    let balance = 0; const history = [];
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount + tx.fee;
        if (tx.to === address) balance += tx.amount;
      }
      history.push({ blockIndex: block.index, blockHash: block.hash, timestamp: block.timestamp, balance });
    }
    return history;
  }

  blockById(id) {
    if (typeof id !== 'string') return null;
    if (/^\d+$/.test(id)) return this.chain[Number(id)] || null;
    return /^[0-9a-f]{64}$/.test(id) ? this.chain.find((block) => block.hash === id) || null : null;
  }

  totalWork(chain = this.chain) {
    return chain.reduce((total, block) => total + (16n ** BigInt(block.difficulty)), 0n);
  }

  addBlock(raw) {
    const known = this.chain.find((block) => block.hash === raw?.hash);
    if (known) return 'known';
    if (!raw || raw.index !== this.chain.length || raw.previousHash !== this.latest.hash) return raw?.index > this.chain.length ? 'ahead' : 'fork';
    const block = this.restoreBlock(raw);
    const next = this.validateBlock(block, this.state);
    this.chain.push(block); this.state = next;
    const included = new Set(block.transactions.map((tx) => tx.id));
    const carry = this.pending.filter((tx) => !included.has(tx.id));
    this.pending = [];
    for (const tx of carry.sort(bySenderNonce)) { try { this._admit(tx); } catch { /* Remove transactions invalidated by the accepted block. */ } }
    this.save();
    return 'added';
  }

  replaceChain(candidate) {
    const validated = this.validateChain(candidate);
    const candidateWork = this.totalWork(validated.chain);
    const currentWork = this.totalWork(this.chain);
    const workWins = candidateWork > currentWork;
    const tieWins = candidateWork === currentWork && validated.chain.at(-1).hash < this.latest.hash;
    if (!workWins && !tieWins) return false;
    const candidateTxIds = new Set(validated.chain.flatMap((block) => block.transactions.map((tx) => tx.id)));
    const orphaned = this.chain.flatMap((block) => block.transactions).filter((tx) => tx.from !== null && !candidateTxIds.has(tx.id));
    const pending = this.pending;
    this.chain = validated.chain; this.state = validated.state;
    this.pending = [];
    for (const tx of [...pending, ...orphaned].sort(bySenderNonce)) { try { this._admit(tx); } catch { /* Discard conflicts and transactions invalid under the winning chain. */ } }
    this.save();
    return true;
  }

  info() {
    return { height: this.chain.length - 1, tipHash: this.latest.hash, difficulty: nextDifficulty(this.chain, this.chain.length), work: this.totalWork().toString(), pending: this.pending.length, reward: REWARD, unit: UNIT, minFee: MIN_FEE, maxTxsPerBlock: MAX_TXS, targetBlockMs: TARGET_BLOCK_MS, valid: this.isChainValid() };
  }

  fees() {
    const values = this.pending.map((tx) => tx.fee).sort((a, b) => a - b);
    const percentile = (p) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : MIN_FEE;
    return { slow: MIN_FEE, normal: Math.max(MIN_FEE, percentile(0.5)), fast: Math.max(MIN_FEE * 2, percentile(0.9)) };
  }

  verifyTransactionProof(id, proof, root) { return verifyMerkleProof(id, proof, root); }

  isChainValid() {
    try { this.validateChain(this.chain.map((block) => block.toJSON())); return true; }
    catch { return false; }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tempFile = `${this.file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify({ version: 2, chain: this.chain.map((block) => block.toJSON()), pending: this.pending.map((tx) => tx.toJSON()) }));
    fs.renameSync(tempFile, this.file);
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    const stored = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (stored.version !== 2) throw new Error('Unsupported chain data version; preserve this file and configure a new CryChain v2 data path.');
    const validated = this.validateChain(stored.chain);
    this.chain = validated.chain; this.state = validated.state; this.pending = [];
    if (Array.isArray(stored.pending)) for (const item of stored.pending.sort(bySenderNonce)) { try { this._admit(Transaction.fromRequest(item)); } catch { /* Discard invalid pending entries on startup. */ } }
  }
}

const blockchain = new Blockchain();
blockchain.Blockchain = Blockchain;
blockchain.constants = { UNIT, REWARD, REFERRAL_REWARD, MIN_FEE, MAX_TXS, MAX_PENDING, MIN_DIFF, MAX_DIFF, TARGET_BLOCK_MS, ADJUST_EVERY };
blockchain.nextDifficulty = nextDifficulty;
module.exports = blockchain;
