const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const csrfOrigin = require('./middleware/csrfOrigin');

const app = express();
const allowedOrigins = new Set([process.env.CLIENT_URL, process.env.MINER_CLIENT_URL].filter(Boolean));
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: { directives: { scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'], frameSrc: ["'self'", 'https://accounts.google.com/gsi/'], connectSrc: ["'self'", 'https://accounts.google.com/gsi/'] } },
}));
app.use(cors({ origin(origin, callback) { callback(null, Boolean(origin && allowedOrigins.has(origin))); }, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(csrfOrigin);
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 20 }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'CryWallet' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/blockchain', require('./routes/blockchain'));
app.use('/api/market', require('./routes/market'));
app.use('/api/forex', require('./routes/forex'));
app.use('/api/news', require('./routes/news'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
