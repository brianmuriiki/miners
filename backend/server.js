require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required');
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    await connectDB();
    app.listen(PORT, () => console.log(`CryWallet API running on port ${PORT}`));
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exitCode = 1;
  }
}

start();
