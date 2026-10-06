const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const csrfOrigin = require('./middleware/csrfOrigin');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(csrfOrigin);
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'CryWallet' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/blockchain', require('./routes/blockchain'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
