const httpError = require('../utils/httpError');
const { getNews } = require('../utils/newsFeed');

exports.list = async (req, res) => {
  try { res.json(await getNews()); }
  catch { throw httpError(502, 'News is temporarily unavailable'); }
};
