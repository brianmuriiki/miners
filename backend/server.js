require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
    await connectDB();
    app.listen(PORT, () => console.log(`CryWallet API running on port ${PORT}`));
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exitCode = 1;
  }
}

start();
