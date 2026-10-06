const crypto = require('crypto');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function generateKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const addressFromPublicKey = (publicKey) => `CW${sha256(publicKey).slice(0, 40)}`;
const sign = (data, privateKeyPem) => crypto.sign('sha256', Buffer.from(data), privateKeyPem).toString('hex');

function verify(data, signatureHex, publicKeyPem) {
  try {
    if (typeof signatureHex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(signatureHex)) return false;
    return crypto.verify('sha256', Buffer.from(data), publicKeyPem, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

function encryptionKey() {
  const encoded = process.env.WALLET_ENC_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(encoded)) throw new Error('WALLET_ENC_KEY must be exactly 64 hexadecimal characters');
  return Buffer.from(encoded, 'hex');
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { data: data.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

function decrypt({ data, iv, tag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

module.exports = { sha256, generateKeyPair, addressFromPublicKey, sign, verify, encrypt, decrypt };
