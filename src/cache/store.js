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

/**
 * List all files in the cache directory (recursive, relative paths).
 */
function listFiles(dir = config.cache.dir, prefix = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      results.push(...listFiles(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Delete a directory and all its contents from cache.
 */
function deleteDir(dirname) {
  const dirPath = path.join(config.cache.dir, dirname);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true });
  }
}

/**
 * List top-level directories in the cache directory.
 */
function listDirs() {
  if (!fs.existsSync(config.cache.dir)) return [];
  return fs.readdirSync(config.cache.dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

module.exports = { saveFile, readFile, deleteFile, deleteDir, ensureDir, listFiles, listDirs };
