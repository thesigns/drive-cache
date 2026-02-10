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

  if (!key || key !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send current version as initial event
  const current = manifest.get();
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      version: current.version,
      assetCount: Object.keys(current.assets).length,
    })}\n\n`
  );

  // Keepalive every 30s
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(keepalive);
  });

  broadcaster.addClient(res);
});

module.exports = router;
