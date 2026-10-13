const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret-long-enough-for-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-distinct-and-long';
process.env.GOOGLE_CLIENT_ID = 'crywallet-test-client.apps.googleusercontent.com';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.SMTP_HOST = 'smtp.test.invalid';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test-user';
process.env.SMTP_PASSWORD = 'test-password';
process.env.SMTP_FROM = 'CryWallet <test@example.invalid>';

const nodemailer = require('nodemailer');
const deliveries = [];
nodemailer.createTransport = () => ({ sendMail: async (mail) => { deliveries.push(mail); return { accepted: [mail.to] }; } });
const app = require('../app');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Session = require('../models/Session');
const EmailToken = require('../models/EmailToken');
const { OAuth2Client } = require('google-auth-library');
const { addressFromPublicKey } = require('../utils/crypto');
const request = require('supertest');

const users = [];
const wallets = [];
const sessions = [];
const emailTokens = [];
let googlePayload;
const same = (left, right) => String(left) === String(right);
const queryResult = (value) => ({ select() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

function fakeUser(data) {
  return { _id: new mongoose.Types.ObjectId(), role: 'user', emailVerifiedAt: null, pendingEmail: null, ...data, async save() { return this; } };
}

function matchesUser(user, query) {
  if (query.$or) return query.$or.some((condition) => matchesUser(user, condition));
  return Object.entries(query).every(([key, value]) => user[key] === value);
}

User.findOne = async (query) => users.find((user) => matchesUser(user, query)) || null;
User.create = async (data) => { const user = fakeUser(data); users.push(user); return user; };
User.findById = (id) => queryResult(users.find((user) => same(user._id, id)) || null);
User.findByIdAndUpdate = async (id, update) => { const user = users.find((item) => same(item._id, id)); if (user) Object.assign(user, update.$set); return user || null; };
User.deleteOne = async ({ _id }) => { const index = users.findIndex((user) => same(user._id, _id)); if (index >= 0) users.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; };
Wallet.create = async (data) => { const wallet = { _id: new mongoose.Types.ObjectId(), ...data }; wallets.push(wallet); return wallet; };
Wallet.deleteOne = async ({ userId }) => { const index = wallets.findIndex((wallet) => same(wallet.userId, userId)); if (index >= 0) wallets.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; };

Session.prototype.save = async function saveSession() {
  const row = { _id: this._id, userId: this.userId, refreshTokenHash: this.refreshTokenHash, expiresAt: this.expiresAt, userAgent: this.userAgent, ipAddress: this.ipAddress, createdAt: new Date(), updatedAt: new Date() };
  sessions.push(row); return row;
};
Session.findOne = (query) => queryResult(sessions.find((session) => Object.entries(query).every(([key, value]) => {
  if (key === 'expiresAt') return session.expiresAt > value.$gt;
  return same(session[key], value);
})) || null);
Session.findOneAndUpdate = async (query, update) => {
  const session = sessions.find((item) => same(item._id, query._id) && same(item.userId, query.userId) && item.refreshTokenHash === query.refreshTokenHash && item.expiresAt > query.expiresAt.$gt);
  if (!session) return null;
  Object.assign(session, update.$set); session.updatedAt = new Date(); return session;
};
Session.find = (query) => ({ select() { return this; }, sort() { return this; }, lean: async () => sessions.filter((session) => same(session.userId, query.userId) && session.expiresAt > query.expiresAt.$gt) });
Session.deleteOne = async (query) => { const index = sessions.findIndex((session) => same(session._id, query._id) && same(session.userId, query.userId)); if (index >= 0) sessions.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; };
Session.deleteMany = async (query) => {
  const before = sessions.length;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    const matches = (!query.userId || same(session.userId, query.userId)) && (!query._id?.$ne || !same(session._id, query._id.$ne));
    if (matches) sessions.splice(index, 1);
  }
  return { deletedCount: before - sessions.length };
};
Session.findOneAndDelete = async (query) => { const index = sessions.findIndex((session) => same(session._id, query._id) && same(session.userId, query.userId)); return index < 0 ? null : sessions.splice(index, 1)[0]; };

EmailToken.deleteMany = async ({ userId, purpose }) => { const before = emailTokens.length; for (let index = emailTokens.length - 1; index >= 0; index -= 1) if (same(emailTokens[index].userId, userId) && emailTokens[index].purpose === purpose) emailTokens.splice(index, 1); return { deletedCount: before - emailTokens.length }; };
EmailToken.create = async (data) => { const token = { _id: new mongoose.Types.ObjectId(), ...data }; emailTokens.push(token); return token; };
EmailToken.findOneAndDelete = async (query) => {
  const index = emailTokens.findIndex((token) => token.tokenHash === query.tokenHash && (Array.isArray(query.purpose.$in) ? query.purpose.$in.includes(token.purpose) : token.purpose === query.purpose) && token.expiresAt > query.expiresAt.$gt);
  return index < 0 ? null : emailTokens.splice(index, 1)[0];
};
OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => googlePayload });

test.beforeEach(() => {
  users.length = 0; wallets.length = 0; sessions.length = 0; emailTokens.length = 0; deliveries.length = 0;
  googlePayload = { sub: 'google-sub-1', email: 'google@example.com', email_verified: true };
});

function googleWallet() {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const publicKey = `04${Buffer.from(jwk.x, 'base64url').toString('hex')}${Buffer.from(jwk.y, 'base64url').toString('hex')}`;
  return { publicKey, address: addressFromPublicKey(publicKey) };
}

function emailTokenFromDelivery() {
  const token = deliveries.at(-1)?.text.match(/token=([0-9a-f]{64})/)?.[1];
  assert.ok(token, 'expected a one-time link in the email');
  return token;
}

test('registration requires valid input, sends verification, and login creates a revocable session', async () => {
  const invalid = await request(app).post('/api/auth/register').send({ username: [], email: 'bad', password: '123', address: 'x', publicKey: 'x' });
  assert.equal(invalid.status, 400);
  const wallet = googleWallet();
  const registered = await request(app).post('/api/auth/register').send({ username: 'alice', email: 'alice@example.com', password: 'password123', ...wallet });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.emailVerificationRequired, true);
  assert.equal(registered.body.verificationSent, true);
  assert.equal(sessions.length, 0);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'password123' })).status, 403);
  assert.equal((await request(app).post('/api/auth/login').send({ email: [], password: 'password123' })).status, 400);
  const token = emailTokenFromDelivery();
  const verified = await request(app).post('/api/auth/verify-email').send({ token });
  assert.equal(verified.status, 200);
  assert.ok(users[0].emailVerifiedAt);
  assert.equal((await request(app).post('/api/auth/verify-email').send({ token })).status, 400);

  const agent = request.agent(app);
  const loggedIn = await agent.post('/api/auth/login').set('User-Agent', 'CryWallet Test Browser').send({ email: 'alice@example.com', password: 'password123' });
  assert.equal(loggedIn.status, 200);
  assert.equal(sessions[0].userAgent, 'CryWallet Test Browser');
  const listed = await agent.get('/api/auth/sessions');
  assert.equal(listed.status, 200);
  assert.equal(listed.body[0].current, true);
  assert.equal(listed.body[0].userAgent, 'CryWallet Test Browser');
  const oldHash = sessions[0].refreshTokenHash;
  assert.equal((await agent.post('/api/auth/refresh').set('Origin', process.env.CLIENT_URL)).status, 200);
  assert.notEqual(sessions[0].refreshTokenHash, oldHash);
  assert.equal((await agent.delete(`/api/auth/sessions/${sessions[0]._id}`).set('Origin', process.env.CLIENT_URL)).status, 204);
  assert.equal(sessions.length, 0);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('Google registration validates verified identity and Google login reuses the browser wallet account', async () => {
  const malformed = await request(app).post('/api/auth/google/register').send({ credential: [], username: 'alice' });
  assert.equal(malformed.status, 400);
  assert.equal((await request(app).post('/api/auth/google').send({ credential: [] })).status, 400);
  const wallet = googleWallet();
  const signup = await request(app).post('/api/auth/google/register').send({ credential: 'signed-google-id-token', username: 'googleuser', ...wallet });
  assert.equal(signup.status, 201);
  assert.equal(users[0].email, 'google@example.com');
  assert.equal(users[0].passwordHash, undefined);
  assert.equal(wallets[0].address, wallet.address);
  const login = await request(app).post('/api/auth/google').send({ credential: 'signed-google-id-token' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, 'google@example.com');
});

test('profile edits validate username and verify email changes before replacing the active email', async () => {
  const wallet = googleWallet();
  await request(app).post('/api/auth/register').send({ username: 'profileuser', email: 'profile@example.com', password: 'password123', ...wallet });
  await request(app).post('/api/auth/verify-email').send({ token: emailTokenFromDelivery() });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'profile@example.com', password: 'password123' });
  assert.equal((await agent.patch('/api/auth/profile').set('Origin', process.env.CLIENT_URL).send({ username: 'x' })).status, 400);
  const updated = await agent.patch('/api/auth/profile').set('Origin', process.env.CLIENT_URL).send({ username: 'newprofile', email: 'new-profile@example.com', currentPassword: 'password123' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.username, 'newprofile');
  assert.equal(updated.body.user.email, 'profile@example.com');
  assert.equal(updated.body.user.pendingEmail, 'new-profile@example.com');
  const confirmation = emailTokenFromDelivery();
  assert.equal((await request(app).post('/api/auth/verify-email').send({ token: confirmation })).status, 200);
  assert.equal(users[0].email, 'new-profile@example.com');
  assert.equal(users[0].pendingEmail, null);
});

test('password reset tokens are one-time, verify the email, and revoke existing sessions', async () => {
  assert.equal((await request(app).post('/api/auth/password/reset').send({ token: [], password: 'short' })).status, 400);
  const wallet = googleWallet();
  const registered = await request(app).post('/api/auth/register').send({ username: 'resetuser', email: 'reset@example.com', password: 'password123', ...wallet });
  assert.equal(registered.status, 201);
  await request(app).post('/api/auth/verify-email').send({ token: emailTokenFromDelivery() });
  const agent = request.agent(app);
  assert.equal((await agent.post('/api/auth/login').send({ email: 'reset@example.com', password: 'password123' })).status, 200);
  const beforeReset = sessions.length;
  const forgot = await request(app).post('/api/auth/password/forgot').send({ email: 'reset@example.com' });
  assert.equal(forgot.status, 200);
  const token = emailTokenFromDelivery();
  const reset = await request(app).post('/api/auth/password/reset').send({ token, password: 'new-password-123' });
  assert.equal(reset.status, 200);
  assert.equal(sessions.length, beforeReset - 1);
  assert.ok(users[0].emailVerifiedAt);
  assert.equal((await request(app).post('/api/auth/password/reset').send({ token, password: 'another-password' })).status, 400);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'new-password-123' })).status, 200);
});
