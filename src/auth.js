const config = require('./config');

function authMiddleware(req, res, next) {
  // SSE and webhook endpoints handle auth separately
  if (req.path === '/webhook/drive') return next();

  const key =
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.key;

  if (!key || key !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = authMiddleware;
