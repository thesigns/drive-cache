const express = require('express');
const path = require('path');
const config = require('../config');

const router = express.Router();

// Serve cached files, scoped to the client's subfolder
router.get('/*', (req, res) => {
  const requestedPath = req.path.slice(1); // strip leading /
  if (!requestedPath) return res.status(400).json({ error: 'No file specified' });

  // Resolve the real path on disk by prepending the subfolder
  const fullPath = path.resolve(config.cache.dir, req.subfolder, requestedPath);
  const allowedRoot = path.resolve(config.cache.dir, req.subfolder);

  // Prevent path traversal outside the allowed subfolder
  if (!fullPath.startsWith(allowedRoot + path.sep) && fullPath !== allowedRoot) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.sendFile(fullPath, { etag: true, lastModified: true }, (err) => {
    if (err && !res.headersSent) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      res.status(500).json({ error: 'Internal error' });
    }
  });
});

module.exports = router;
