exports.notFound = (req, res) => res.status(404).json({ error: 'Route not found' });

exports.errorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message });
};
