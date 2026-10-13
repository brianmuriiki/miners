const crypto = require('crypto');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const PUBLIC_KEY = /^04[0-9a-f]{128}$/;
const addressFromPublicKey = (publicKey) => `CW${sha256(publicKey).slice(0, 40)}`;

function publicKeyObject(publicKey) {
  if (typeof publicKey !== 'string' || !PUBLIC_KEY.test(publicKey)) throw new Error('Invalid public key');
  const bytes = Buffer.from(publicKey.slice(2), 'hex');
  return crypto.createPublicKey({
    key: {
      kty: 'EC', crv: 'secp256k1',
      x: bytes.subarray(0, 32).toString('base64url'),
      y: bytes.subarray(32, 64).toString('base64url'),
    },
    format: 'jwk',
  });
}

function verify(data, signatureHex, publicKey) {
  try {
    if (typeof signatureHex !== 'string' || !/^[0-9a-f]{128}$/.test(signatureHex)) return false;
    return crypto.verify('sha256', Buffer.from(data), { key: publicKeyObject(publicKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { sha256, addressFromPublicKey, verify, PUBLIC_KEY, publicKeyObject };
