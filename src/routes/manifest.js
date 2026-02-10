const express = require('express');
const manifest = require('../cache/manifest');

const router = express.Router();

/**
 * Filter manifest assets to those under the given subfolder,
 * stripping the subfolder prefix from filenames and URLs.
 */
function getVisibleAssets(subfolder) {
  const all = manifest.get().assets;
  const prefix = subfolder + '/';
  const filtered = {};
  for (const [id, asset] of Object.entries(all)) {
    if (asset.filename.startsWith(prefix)) {
      const stripped = asset.filename.slice(prefix.length);
      filtered[id] = {
        ...asset,
        filename: stripped,
        url: `/assets/${stripped}`,
      };
    }
  }
  return filtered;
}

// Get current manifest (filtered to key's subfolder)
router.get('/', (req, res) => {
  const full = manifest.get();
  res.json({
    version: full.version,
    updatedAt: full.updatedAt,
    assets: getVisibleAssets(req.subfolder),
  });
});

// Get just the version (lightweight check)
router.get('/version', (req, res) => {
  res.json({ version: manifest.getVersion() });
});

module.exports = router;
