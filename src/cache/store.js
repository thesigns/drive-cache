const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save a file to the cache directory.
 * Returns { path, hash, size }
 */
function saveFile(filename, data) {
  const filePath = path.join(config.cache.dir, filename);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, data);

  const hash = crypto.createHash('md5').update(data).digest('hex');
  return { path: filePath, hash, size: data.length };
}

/**
 * Read a file from cache. Returns Buffer or null.
 */
function readFile(filename) {
  const filePath = path.join(config.cache.dir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Delete a file from cache.
 */
function deleteFile(filename) {
  const filePath = path.join(config.cache.dir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = { saveFile, readFile, deleteFile, ensureDir };
