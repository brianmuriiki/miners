const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Blockchain } = require('./blockchain');
const Transaction = require('./transaction');
const { merkleProof, merkleRoot, verifyMerkleProof } = require('./merkle');
const { sha256, addressFromPublicKey } = require('../utils/crypto');

const canonical = (value) => JSON.stringify(Object.keys(value).sort().reduce((out, key) => { out[key] = value[key]; return out; }, {}));
function makeWallet() {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const publicKey = `04${Buffer.from(jwk.x, 'base64url').toString('hex')}${Buffer.from(jwk.y, 'base64url').toString('hex')}`;
  return { privateKey: pair.privateKey, publicKey, address: addressFromPublicKey(publicKey) };
}

function signedTransfer(wallet, to, amount, fee, nonce) {
  const body = { from: wallet.address, to, amount, fee, timestamp: Date.now(), nonce };
  const id = sha256(canonical(body));
  const signature = crypto.sign('sha256', Buffer.from(id), { key: wallet.privateKey, dsaEncoding: 'ieee-p1363' }).toString('hex');
  return new Transaction({ ...body, id, publicKey: wallet.publicKey, signature });
}

function tempChain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crychain-'));
  return { dir, file: path.join(dir, 'chain.json') };
}

test('signed transactions use integer base units and advance account nonces', () => {
  const { dir, file } = tempChain();
  try {
    const sender = makeWallet(); const recipient = makeWallet();
    const chain = new Blockchain(file);
    chain.minePending(sender.address);
    assert.equal(chain.getAccount(sender.address).balance, 5_000_000_000);
    const tx = signedTransfer(sender, recipient.address, 1_250_000_000, 25_000, 0);
    chain.addTransaction(tx);
    assert.equal(chain.getAccount(sender.address).available, 3_749_975_000);
    assert.equal(chain.getAccount(sender.address).nextNonce, 1);
    assert.throws(() => chain.addTransaction(tx), /Duplicate/);
    assert.throws(() => chain.addTransaction(signedTransfer(sender, recipient.address, 1, 1_000, 0)), /nonce/i);
    chain.minePending(recipient.address);
    assert.equal(chain.getAccount(sender.address).balance, 3_749_975_000);
    assert.equal(chain.getAccount(sender.address).nonce, 1);
    assert.equal(chain.getAccount(recipient.address).balance, 6_250_025_000);
    assert.equal(chain.findTransaction(tx.id).status, 'confirmed');
    assert.equal(chain.findTransaction(tx.id).proofValid, true);
    assert.equal(chain.balanceHistory(recipient.address).at(-1).balance, 6_250_025_000);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('startup restores state and chain validation detects transaction tampering', () => {
  const { dir, file } = tempChain();
  try {
    const sender = makeWallet(); const recipient = makeWallet();
    const chain = new Blockchain(file);
    chain.minePending(sender.address);
    chain.addTransaction(signedTransfer(sender, recipient.address, 500_000_000, 1_000, 0));
    chain.minePending(recipient.address);
    const restored = new Blockchain(file);
    assert.equal(restored.getAccount(recipient.address).balance, 5_500_001_000);
    assert.equal(restored.getAccount(sender.address).nonce, 1);
    const tampered = restored.chain.map((block) => JSON.parse(JSON.stringify(block.toJSON())));
    tampered[2].transactions[1].amount += 1;
    assert.throws(() => restored.validateChain(tampered));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('mempool selection orders fee opportunities while preserving each sender nonce', () => {
  const { dir, file } = tempChain();
  try {
    const first = makeWallet(); const second = makeWallet(); const recipient = makeWallet();
    const chain = new Blockchain(file);
    chain.minePending(first.address); chain.minePending(second.address);
    const firstTx0 = signedTransfer(first, recipient.address, 1, 1_000, 0);
    const firstTx1 = signedTransfer(first, recipient.address, 1, 10_000, 1);
    const secondTx0 = signedTransfer(second, recipient.address, 1, 5_000, 0);
    chain.addTransaction(firstTx0); chain.addTransaction(firstTx1); chain.addTransaction(secondTx0);
    assert.deepEqual(chain.selectPending().map((tx) => tx.id), [secondTx0.id, firstTx0.id, firstTx1.id]);
    assert.equal(require('./blockchain').constants.MAX_TXS, 50);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('block transaction capacity and Merkle proofs are enforced', () => {
  const { dir, file } = tempChain();
  try {
    const sender = makeWallet(); const recipient = makeWallet();
    const chain = new Blockchain(file); chain.minePending(sender.address);
    for (let nonce = 0; nonce < 51; nonce += 1) chain.addTransaction(signedTransfer(sender, recipient.address, 1, 1_000, nonce));
    assert.equal(chain.selectPending().length, 50);
    chain.minePending(recipient.address);
    assert.equal(chain.latest.transactions.length, 51);
    assert.equal(chain.pending.length, 1);
    const txs = [{ id: 'a'.repeat(64) }, { id: 'b'.repeat(64) }, { id: 'c'.repeat(64) }];
    const root = merkleRoot(txs);
    txs.forEach((tx, index) => assert.equal(verifyMerkleProof(tx.id, merkleProof(txs, index), root), true));
    assert.equal(verifyMerkleProof(txs[0].id, merkleProof(txs, 0), 'f'.repeat(64)), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('difficulty adjustment reacts to ten-block timing windows within bounds', () => {
  const { nextDifficulty } = require('./blockchain');
  const fast = Array.from({ length: 10 }, (_, index) => ({ timestamp: 1700000000000 + index * 3_000, difficulty: 3 }));
  const slow = Array.from({ length: 10 }, (_, index) => ({ timestamp: 1700000000000 + index * 25_000, difficulty: 3 }));
  assert.equal(nextDifficulty(fast, 10), 4);
  assert.equal(nextDifficulty(slow, 10), 2);
});
