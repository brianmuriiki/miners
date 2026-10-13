import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { createCryChainWallet, hasCryChainKeystore, lockCryChainWallet, prepareCryChainWallet, storePreparedCryChainWallet, unlockCryChainWallet } from './crychain/keys.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    lockCryChainWallet();
    const data = await api.login({ email, password });
    try { await unlockCryChainWallet(password); } catch { /* Login can still inspect the account when its keystore is unavailable. */ }
    setUser(data.user);
  }

  const loginGoogle = useCallback(async (credential) => {
    lockCryChainWallet();
    const data = await api.googleLogin(credential);
    setUser(data.user);
  }, []);

  const registerGoogle = useCallback(async ({ credential, username, walletPassword, referralCode }) => {
    if (hasCryChainKeystore()) throw new Error('This browser already has an encrypted CryChain wallet. Back it up or use another browser to create a new account.');
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) throw new Error('Enter a username between 3 and 30 characters first.');
    if (typeof walletPassword !== 'string' || walletPassword.length < 8) throw new Error('Choose a wallet password with at least 8 characters first.');
    const created = await prepareCryChainWallet(walletPassword);
    const data = await api.googleRegister({ credential, username: username.trim(), address: created.address, publicKey: created.publicKey, referralCode });
    try { storePreparedCryChainWallet(created); }
    catch {
      lockCryChainWallet();
      return { mnemonic: created.mnemonic, user: data.user, storageWarning: 'Your account was created, but this browser could not save its encrypted keystore. Keep the recovery phrase safe and restore the wallet before sending.' };
    }
    return { mnemonic: created.mnemonic, user: data.user };
  }, []);

  async function register(form) {
    const created = await createCryChainWallet(form.password);
    let data;
    try { data = await api.register({ ...form, address: created.address, publicKey: created.publicKey }); }
    catch (error) { lockCryChainWallet(); throw error; }
    return { mnemonic: created.mnemonic, user: data.user, emailVerificationRequired: data.emailVerificationRequired, verificationSent: data.verificationSent };
  }

  function completeRegistration(registeredUser) { setUser(registeredUser); }
  const updateCurrentUser = useCallback((nextUser) => setUser(nextUser), []);

  async function logout() {
    try { await api.logout(); } catch { /* Clear local app state even if the API is offline. */ }
    setUser(null);
    lockCryChainWallet();
  }

  return <AuthContext.Provider value={{ user, loading, login, loginGoogle, register, registerGoogle, completeRegistration, updateCurrentUser, logout }}>{children}</AuthContext.Provider>;
}
