let manifest = {
  version: 0,
  updatedAt: null,
  assets: {},
};

/**
 * Update or add an asset entry. Returns true if the asset actually changed.
 */
function upsertAsset(fileId, { filename, type, hash, size, modifiedTime }) {
  const existing = manifest.assets[fileId];

  if (existing && existing.hash === hash && existing.filename === filename) {
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
 * Remove an asset entry. Returns the removed entry (or null).
 */
function removeAsset(key) {
  const entry = manifest.assets[key];
  if (entry) {
    delete manifest.assets[key];
    return entry;
  }
  return null;
}

/**
 * Remove all asset entries whose key starts with fileId + ':'.
 * Used when a Google Sheet is deleted (each tab is keyed as "fileId:tabName").
 * Returns array of removed entries.
 */
function removeAssetsByPrefix(fileIdPrefix) {
  const prefix = fileIdPrefix + ':';
  const removed = [];
  for (const key of Object.keys(manifest.assets)) {
    if (key.startsWith(prefix)) {
      removed.push(manifest.assets[key]);
      delete manifest.assets[key];
    }
  }
  return removed;
}

/**
 * Bump version. Call after a batch of upserts.
 */
function commit() {
  manifest.version++;
  manifest.updatedAt = new Date().toISOString();
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

module.exports = { upsertAsset, removeAsset, removeAssetsByPrefix, commit, get, getVersion };
