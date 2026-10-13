import { SigningKey, Wallet, sha256, toUtf8Bytes } from 'ethers';

const STORAGE_KEY = 'crychain_keystore_v1';
let unlockedWallet = null;

export function publicKeyFor(wallet) {
  return SigningKey.computePublicKey(wallet.privateKey, false).slice(2).toLowerCase();
}

export function addressFor(publicKey) {
  return `CW${sha256(toUtf8Bytes(publicKey)).slice(2, 42).toLowerCase()}`;
}

export async function prepareCryChainWallet(password) {
  const wallet = Wallet.createRandom();
  const publicKey = publicKeyFor(wallet);
  const encryptedJson = await wallet.encrypt(password);
  return { wallet, publicKey, address: addressFor(publicKey), mnemonic: wallet.mnemonic.phrase, encryptedJson };
}

export function storePreparedCryChainWallet(created) {
  if (hasCryChainKeystore()) throw new Error('This browser already has an encrypted CryChain wallet. Back it up or use another browser before creating a new one.');
  localStorage.setItem(STORAGE_KEY, created.encryptedJson);
  unlockedWallet = created.wallet;
}

export async function createCryChainWallet(password) {
  const created = await prepareCryChainWallet(password);
  storePreparedCryChainWallet(created);
  return created;
}

export async function unlockCryChainWallet(password) {
  const encryptedJson = localStorage.getItem(STORAGE_KEY);
  if (!encryptedJson) throw new Error('This browser has no encrypted CryChain wallet. Register on this browser or import a recovery phrase.');
  unlockedWallet = await Wallet.fromEncryptedJson(encryptedJson, password);
  return unlockedWallet;
}

export function hasCryChainKeystore() {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch { return false; }
}

export async function restoreCryChainWallet(phrase, password, expectedPublicKey) {
  const wallet = Wallet.fromPhrase(phrase.trim());
  const publicKey = publicKeyFor(wallet);
  if (publicKey !== expectedPublicKey) throw new Error('That recovery phrase does not match this CryChain account.');
  localStorage.setItem(STORAGE_KEY, await wallet.encrypt(password));
  unlockedWallet = wallet;
  return wallet;
}

export function lockCryChainWallet() { unlockedWallet = null; }
export function isCryChainWalletUnlocked() { return Boolean(unlockedWallet); }

export function signCryChainTransaction({ to, amount, fee, nonce }) {
  if (!unlockedWallet) throw new Error('Unlock your CryChain wallet before sending.');
  const publicKey = publicKeyFor(unlockedWallet);
  const body = { from: addressFor(publicKey), to, amount, fee, timestamp: Date.now(), nonce };
  const canonical = JSON.stringify(Object.keys(body).sort().reduce((out, key) => { out[key] = body[key]; return out; }, {}));
  const id = sha256(toUtf8Bytes(canonical)).slice(2);
  const signature = unlockedWallet.signingKey.sign(sha256(toUtf8Bytes(id)));
  return { ...body, id, publicKey, signature: `${signature.r.slice(2)}${signature.s.slice(2)}`.toLowerCase() };
}
