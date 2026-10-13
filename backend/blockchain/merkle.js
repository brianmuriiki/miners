const { sha256 } = require('../utils/crypto');

const leafHash = (transactionId) => sha256(`tx:${transactionId}`);
const parentHash = (left, right) => sha256(`node:${left}${right}`);

function merkleLayers(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return [[sha256('empty-crychain-block')]];
  const layers = [transactions.map((tx) => leafHash(tx.id))];
  while (layers.at(-1).length > 1) {
    const previous = layers.at(-1); const next = [];
    for (let i = 0; i < previous.length; i += 2) next.push(parentHash(previous[i], previous[i + 1] || previous[i]));
    layers.push(next);
  }
  return layers;
}

const merkleRoot = (transactions) => merkleLayers(transactions).at(-1)[0];

function merkleProof(transactions, index) {
  if (!Number.isInteger(index) || index < 0 || index >= transactions.length) throw new Error('Invalid transaction index');
  const layers = merkleLayers(transactions); const proof = []; let position = index;
  for (let level = 0; level < layers.length - 1; level += 1) {
    const current = layers[level]; const siblingIndex = position ^ 1;
    proof.push({ hash: current[siblingIndex] || current[position], side: siblingIndex < position ? 'left' : 'right' });
    position = Math.floor(position / 2);
  }
  return proof;
}

function verifyMerkleProof(transactionId, proof, root) {
  if (typeof transactionId !== 'string' || !Array.isArray(proof) || typeof root !== 'string') return false;
  let hash = leafHash(transactionId);
  for (const step of proof) {
    if (!step || typeof step.hash !== 'string' || !/^[0-9a-f]{64}$/.test(step.hash) || !['left', 'right'].includes(step.side)) return false;
    hash = step.side === 'left' ? parentHash(step.hash, hash) : parentHash(hash, step.hash);
  }
  return hash === root;
}

module.exports = { merkleRoot, merkleProof, verifyMerkleProof };
