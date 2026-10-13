const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let refreshInFlight;
let sessionInFlight;

function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/refresh', { method: 'POST', retryAuth: false })
      .finally(() => { refreshInFlight = undefined; });
  }
  return refreshInFlight;
}

function loadSession() {
  if (!sessionInFlight) {
    sessionInFlight = request('/auth/session')
      .finally(() => { sessionInFlight = undefined; });
  }
  return sessionInFlight;
}

async function request(path, { method = 'GET', body, retryAuth = true } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && retryAuth && !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path)) {
    try {
      await refreshSession();
      return request(path, { method, body, retryAuth: false });
    } catch {
      // Fall through and report the original unauthorized response.
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Request failed'); error.status = response.status; throw error; }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  googleLogin: (credential) => request('/auth/google', { method: 'POST', body: { credential }, retryAuth: false }),
  googleRegister: (body) => request('/auth/google/register', { method: 'POST', body, retryAuth: false }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email }, retryAuth: false }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token }, retryAuth: false }),
  forgotPassword: (email) => request('/auth/password/forgot', { method: 'POST', body: { email }, retryAuth: false }),
  resetPassword: (token, password) => request('/auth/password/reset', { method: 'POST', body: { token, password }, retryAuth: false }),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  refresh: () => request('/auth/refresh', { method: 'POST', retryAuth: false }),
  me: () => loadSession(),
  sessions: () => request('/auth/sessions'),
  referrals: () => request('/auth/referrals'),
  revokeOtherSessions: () => request('/auth/sessions/others', { method: 'DELETE' }),
  revokeSession: (id) => request(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  wallet: () => request('/wallet'),
  send: (body) => request('/transactions/send', { method: 'POST', body }),
  transactions: () => request('/transactions'),
  transaction: (id) => request(`/transactions/${encodeURIComponent(id)}`),
  chainInfo: () => request('/blockchain'),
  blocks: (page = 1, limit = 20) => request(`/blockchain/blocks?page=${page}&limit=${limit}`),
  block: (id) => request(`/blockchain/blocks/${encodeURIComponent(id)}`),
  explorerTransaction: (id) => request(`/blockchain/transactions/${encodeURIComponent(id)}`),
  mempool: () => request('/blockchain/mempool'),
  fees: () => request('/blockchain/fees'),
  addressHistory: (address) => request(`/blockchain/address/${encodeURIComponent(address)}/history`),
  market: () => request('/market'),
  coinHistory: (coinId, period) => request(`/market/${encodeURIComponent(coinId)}/history?period=${encodeURIComponent(period)}`),
  forexHistory: (pair, period) => request(`/forex?pair=${encodeURIComponent(pair)}&period=${encodeURIComponent(period)}`),
  news: () => request('/news'),
};
