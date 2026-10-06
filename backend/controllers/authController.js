const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const httpError = require('../utils/httpError');
const { generateKeyPair, addressFromPublicKey, encrypt } = require('../utils/crypto');

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (![username, email, password].every((value) => typeof value === 'string' && value.trim().length)) throw httpError(400, 'username, email and password are required');
  if (username.trim().length < 3 || username.trim().length > 30) throw httpError(400, 'Username must be 3 to 30 characters');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Invalid email');
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
  if (exists) throw httpError(409, 'Username or email already in use');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username: normalizedUsername, email: normalizedEmail, passwordHash });
  try {
    const { publicKey, privateKey } = generateKeyPair();
    const wallet = await Wallet.create({ userId: user._id, address: addressFromPublicKey(publicKey), publicKey, encryptedPrivateKey: encrypt(privateKey) });
    res.status(201).json({ token: signToken(user), user: { id: user._id, username: user.username, email: user.email }, wallet: { address: wallet.address } });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') throw httpError(400, 'email and password are required');
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw httpError(401, 'Invalid credentials');
  res.json({ token: signToken(user), user: { id: user._id, username: user.username, email: user.email } });
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) throw httpError(404, 'User not found');
  res.json({ user });
};
