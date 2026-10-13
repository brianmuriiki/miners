const httpError = require('../utils/httpError');
const { getMarket, getCoinHistory } = require('../utils/marketData');

exports.list = async (req, res) => {
  try { res.json(await getMarket()); }
  catch { throw httpError(502, 'Market data is temporarily unavailable'); }
};

exports.history = async (req, res) => {
  const { coinId } = req.params;
  const period = req.query.period === undefined ? '1W' : req.query.period;
  if (typeof period !== 'string' || !['1D', '1W', '1M', '1Y'].includes(period)) {
    throw httpError(400, 'Choose a supported chart period');
  }
  try {
    const history = await getCoinHistory(coinId, period);
    if (!history) throw httpError(404, 'Coin or chart period not found');
    res.json(history);
  } catch (error) {
    if (error.status) throw error;
    const reason = typeof error?.cause?.code === 'string'
      ? error.cause.code
      : (/^Provider returned HTTP \d{3}$/.test(error?.message || '') ? error.message : 'provider unavailable');
    console.warn(`Coin chart provider unavailable for ${period}: ${reason}`);
    throw httpError(502, 'Coin chart data is temporarily unavailable');
  }
};
