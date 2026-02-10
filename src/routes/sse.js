const express = require('express');
const config = require('../config');
const broadcaster = require('../sse/broadcaster');
const manifest = require('../cache/manifest');

const router = express.Router();

router.get('/events', (req, res) => {
  // Auth check (key can come as query param for SSE since headers are tricky in some clients)
  const key =
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.key;

  const subfolder = config.apiKeys.get(key);
  if (!key || subfolder === undefined) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send current version as initial event, scoped to this client's subfolder
  const current = manifest.get();
  const prefix = subfolder + '/';
  const visibleCount = Object.values(current.assets)
    .filter(a => a.filename.startsWith(prefix)).length;

  res.write(
    `event: connected\ndata: ${JSON.stringify({
      version: current.version,
      assetCount: visibleCount,
    })}\n\n`
  );

  // Keepalive every 30s
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(keepalive);
  });

  broadcaster.addClient(res, subfolder);
});

module.exports = router;
