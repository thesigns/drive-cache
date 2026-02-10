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

module.exports = { upsertAsset, removeAsset, commit, get, getVersion };
