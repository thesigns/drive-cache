const fs = require('fs');
const config = require('../config');
const store = require('./store');

let manifest = {
  version: 0,
  updatedAt: null,
  assets: {},
};

/**
 * Load manifest from disk on startup
 */
function load() {
  if (fs.existsSync(config.cache.manifestPath)) {
    try {
      const raw = fs.readFileSync(config.cache.manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
      console.log(
        `[manifest] Loaded: version=${manifest.version}, assets=${Object.keys(manifest.assets).length}`
      );
    } catch (err) {
      console.error('[manifest] Failed to load, starting fresh:', err.message);
    }
  }
}

/**
 * Save manifest to disk
 */
function save() {
  store.ensureDir(require('path').dirname(config.cache.manifestPath));
  fs.writeFileSync(config.cache.manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Update or add an asset entry. Returns true if the asset actually changed.
 */
function upsertAsset(fileId, { filename, type, hash, size, modifiedTime }) {
  const existing = manifest.assets[fileId];

  if (existing && existing.hash === hash) {
    return false; // No change
  }

  manifest.assets[fileId] = {
    filename,
    type,
    hash,
    size,
    modifiedTime,
    url: `/assets/${filename}`,
  };

  return true;
}

/**
 * Remove an asset entry
 */
function removeAsset(fileId) {
  if (manifest.assets[fileId]) {
    delete manifest.assets[fileId];
    return true;
  }
  return false;
}

/**
 * Bump version and save. Call after a batch of upserts.
 */
function commit() {
  manifest.version++;
  manifest.updatedAt = new Date().toISOString();
  save();
  console.log(`[manifest] Committed version ${manifest.version}`);
  return manifest.version;
}

/**
 * Get the current manifest (for serving to clients)
 */
function get() {
  return manifest;
}

/**
 * Get current version number
 */
function getVersion() {
  return manifest.version;
}

module.exports = { load, save, upsertAsset, removeAsset, commit, get, getVersion };
