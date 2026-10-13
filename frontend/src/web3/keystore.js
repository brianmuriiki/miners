import { Wallet } from 'ethers';

const STORAGE_KEY = 'cw_keystore';

export function hasKeystore() {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch { return false; }
}

async function encryptAndStore(wallet, password) {
  const encryptedJson = await wallet.encrypt(password);
  // Only encrypted keystore JSON is persisted. The wallet/private key stays in memory.
  localStorage.setItem(STORAGE_KEY, encryptedJson);
  return wallet;
}

export async function createWallet(password) {
  const wallet = Wallet.createRandom();
  await encryptAndStore(wallet, password);
  return { wallet, mnemonic: wallet.mnemonic.phrase };
}

export async function importWallet(secret, password) {
  if (typeof secret !== 'string' || !secret.trim()) throw new Error('Wallet secret is required');
  const normalized = secret.trim();
  const wallet = normalized.includes(' ')
    ? Wallet.fromPhrase(normalized)
    : new Wallet(normalized.startsWith('0x') ? normalized : `0x${normalized}`);
  return encryptAndStore(wallet, password);
}

export async function unlock(password) {
  const encryptedJson = localStorage.getItem(STORAGE_KEY);
  if (!encryptedJson) throw new Error('No encrypted wallet is stored in this browser');
  return Wallet.fromEncryptedJson(encryptedJson, password);
}

export function forget() { localStorage.removeItem(STORAGE_KEY); }
