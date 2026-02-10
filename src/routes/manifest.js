const express = require('express');
const manifest = require('../cache/manifest');

const router = express.Router();

// Get current manifest
router.get('/', (req, res) => {
  res.json(manifest.get());
});

// Get just the version (lightweight check)
router.get('/version', (req, res) => {
  res.json({ version: manifest.getVersion() });
});

module.exports = router;
