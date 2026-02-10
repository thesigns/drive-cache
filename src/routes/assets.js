const express = require('express');
const path = require('path');
const config = require('../config');

const router = express.Router();

// Serve cached files statically
router.use('/', express.static(config.cache.dir, {
  maxAge: 0, // No browser caching - clients rely on manifest for freshness
  etag: true,
  lastModified: true,
}));

module.exports = router;
