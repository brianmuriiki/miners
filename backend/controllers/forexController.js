const httpError = require('../utils/httpError');
const { CURRENCY_PAIRS, getForexHistory } = require('../utils/forexData');

const PERIODS = new Set(['1M', '3M', '6M', '1Y']);

exports.history = async (req, res) => {
  const { pair, period } = req.query;
  if (typeof pair !== 'string' || !Object.hasOwn(CURRENCY_PAIRS, pair)) throw httpError(400, 'Choose a supported currency pair');
  if (typeof period !== 'string' || !PERIODS.has(period)) throw httpError(400, 'Choose a supported history period');
  try { res.json(await getForexHistory(pair, period)); }
  catch (error) {
    if (error.status === 400) throw error;
    throw httpError(502, 'Forex reference data is temporarily unavailable');
  }
};
