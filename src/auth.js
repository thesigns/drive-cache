const config = require('./config');

function authMiddleware(req, res, next) {
  // SSE and webhook endpoints handle auth separately
  if (req.path === '/webhook/drive') return next();

  const key =
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.key;

  const subfolder = config.apiKeys.get(key);
  if (!key || subfolder === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.subfolder = subfolder;
  next();
}

module.exports = authMiddleware;
