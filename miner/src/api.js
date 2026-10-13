const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}, retryAuth = true) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  });
  if (response.status === 401 && retryAuth && !['/auth/login', '/auth/refresh', '/auth/logout'].includes(path)) {
    try {
      await request('/auth/refresh', { method: 'POST' }, false);
      return request(path, options, false);
    } catch { /* Preserve the original unauthorized response for the caller. */ }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'CryWallet API request failed.');
  return data;
}

export const api = {
  session: () => request('/auth/session'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
  logout: () => request('/auth/logout', { method: 'POST' }, false),
  wallet: () => request('/wallet'),
  chain: () => request('/blockchain'),
  referrals: () => request('/auth/referrals'),
  mine: () => request('/blockchain/mine', { method: 'POST' }),
};
