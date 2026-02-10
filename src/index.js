const express = require('express');
const config = require('./config');
const auth = require('./auth');
const googleClient = require('./google/client');
const fetcher = require('./google/fetcher');
const changes = require('./google/changes');
const store = require('./cache/store');
const manifest = require('./cache/manifest');
const broadcaster = require('./sse/broadcaster');

// Routes
const sseRoutes = require('./routes/sse');
const manifestRoutes = require('./routes/manifest');
const assetRoutes = require('./routes/assets');
const webhookRoutes = require('./routes/webhook');

const app = express();

// --- Middleware ---
app.use(express.json());
app.use('/webhook', webhookRoutes); // Webhook is unauthenticated (Google calls it)
app.use(auth); // Everything else requires API key

// --- Routes ---
app.use('/sse', sseRoutes);
app.use('/manifest', manifestRoutes);
app.use('/assets', assetRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: manifest.getVersion(),
    clients: broadcaster.clientCount(),
    uptime: process.uptime(),
  });
});

// --- Helpers ---

/**
 * Walk up the parent chain to check if a file is inside the watched folder.
 * Returns the relative path (e.g. "subfolder/file.png") or null if not in tree.
 */
async function resolveFilePath(fileId) {
  const parts = [];
  let currentId = fileId;

  for (let depth = 0; depth < 20; depth++) {
    const res = await googleClient.drive().files.get({
      fileId: currentId,
      fields: 'name, parents',
      supportsAllDrives: true,
    });

    const { name, parents } = res.data;
    parts.unshift(currentId === fileId ? name : name + '/');

    if (!parents || parents.length === 0) return null;
    if (parents.includes(config.google.folderId)) return parts.join('');

    currentId = parents[0];
  }

  return null;
}

// --- Sync Logic ---

let currentPageToken = null;

/**
 * Full sync: fetch all files from the watched folder and rebuild cache.
 */
async function fullSync() {
  console.log('[sync] Starting full sync...');
  const files = await fetcher.listFolderFiles(config.google.folderId);
  const seenIds = new Set();
  let dirty = false;

  for (const file of files) {
    seenIds.add(file.id);
    try {
      const result = await syncFile(file.id, file.name, file.mimeType, file.modifiedTime);
      if (result) dirty = true;
    } catch (err) {
      console.error(`[sync] Failed to sync ${file.name}: ${err.message}`);
    }
  }

  // Remove cached files that no longer exist in Drive
  for (const [fileId, asset] of Object.entries(manifest.get().assets)) {
    if (!seenIds.has(fileId)) {
      store.deleteFile(asset.filename);
      manifest.removeAsset(fileId);
      dirty = true;
      console.log(`[sync] Pruned stale file: ${asset.filename}`);
    }
  }

  if (dirty) {
    const version = manifest.commit();
    broadcaster.notifyUpdate(version, []);
  }

  currentPageToken = await changes.getStartPageToken();
  console.log(`[sync] Full sync complete: ${seenIds.size} files cached`);
}

/**
 * Incremental sync: fetch only changes since last check.
 */
async function incrementalSync() {
  if (!currentPageToken) return;

  const { changes: changeList, newPageToken } = await changes.listChanges(currentPageToken);

  if (changeList.length === 0) {
    currentPageToken = newPageToken;
    return;
  }

  console.log(`[sync] Processing ${changeList.length} changes...`);

  const changedFiles = [];
  let dirty = false;

  for (const change of changeList) {
    if (change.removed) {
      const asset = manifest.get().assets[change.fileId];
      if (asset) {
        store.deleteFile(asset.filename);
        manifest.removeAsset(change.fileId);
        changedFiles.push({ id: change.fileId, name: asset.filename, action: 'removed' });
        dirty = true;
      }
      continue;
    }

    if (change.file) {
      if (change.file.mimeType === 'application/vnd.google-apps.folder') continue;

      const filePath = await resolveFilePath(change.file.id);
      if (!filePath) continue;

      try {
        const result = await syncFile(
          change.file.id,
          filePath,
          change.file.mimeType,
          change.file.modifiedTime
        );
        if (result) {
          changedFiles.push({
            id: change.file.id,
            name: filePath,
            action: 'updated',
          });
          dirty = true;
        }
      } catch (err) {
        console.error(`[sync] Failed to sync ${filePath}: ${err.message}`);
      }
    }
  }

  currentPageToken = newPageToken;

  if (dirty) {
    const version = manifest.commit();
    broadcaster.notifyUpdate(version, changedFiles);
    console.log(`[sync] Incremental sync done: ${changedFiles.length} files changed`);
  }
}

/**
 * Sync a single file: fetch from Drive, save to cache, update manifest.
 * Returns true if the file was actually updated.
 */
async function syncFile(fileId, fileName, mimeType, modifiedTime) {
  const { data, extension } = await fetcher.fetchFile(fileId, mimeType);

  // Sanitize filename: strip original extension for sheets, keep for others
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const cacheFilename = `${baseName}${extension}`;

  const { hash, size } = store.saveFile(cacheFilename, data);

  const type = mimeType === fetcher.GOOGLE_SHEET_MIME ? 'sheet' : 'binary';

  return manifest.upsertAsset(fileId, {
    filename: cacheFilename,
    type,
    hash,
    size,
    modifiedTime,
  });
}

// --- Polling ---

let pollTimer = null;

function startPolling() {
  pollTimer = setInterval(async () => {
    try {
      await incrementalSync();
    } catch (err) {
      console.error('[poll] Sync error:', err.message);
    }
  }, config.pollInterval);

  console.log(`[poll] Polling every ${config.pollInterval / 1000}s`);
}

// --- Webhook ---

let webhookChannel = null;

async function setupWebhook() {
  if (!config.webhookUrl) {
    console.log('[webhook] No WEBHOOK_URL configured, using polling only');
    return;
  }

  try {
    webhookChannel = await changes.registerWebhook(config.webhookUrl);

    // Set up the handler that runs when a notification comes in
    webhookRoutes.setChangeHandler(incrementalSync);

    // Renew before expiration (1 hour before)
    const renewIn = webhookChannel.expiration - Date.now() - 3600000;
    if (renewIn > 0) {
      setTimeout(async () => {
        console.log('[webhook] Renewing channel...');
        try {
          await changes.stopWebhook(
            webhookChannel.channelId,
            webhookChannel.resourceId
          );
        } catch (_) {}
        await setupWebhook();
      }, renewIn);
    }
  } catch (err) {
    console.error('[webhook] Failed to register:', err.message);
    console.log('[webhook] Falling back to polling only');
  }
}

// --- Startup ---

async function start() {
  try {
    // Init Google API clients
    await googleClient.init();

    // Always full sync on startup
    await fullSync();

    // Start polling as a safety net
    startPolling();

    // Set up webhook if configured
    await setupWebhook();

    // Start HTTP server
    app.listen(config.port, () => {
      console.log(`[server] drive-cache running on port ${config.port}`);
      console.log(`[server] Assets: ${Object.keys(manifest.get().assets).length} files cached`);
      console.log(`[server] Endpoints:`);
      console.log(`  GET /manifest        - Current asset manifest`);
      console.log(`  GET /manifest/version - Quick version check`);
      console.log(`  GET /assets/:file    - Download cached file`);
      console.log(`  GET /sse/events      - SSE stream (pass ?key=...)`);
      console.log(`  GET /health          - Health check`);
    });
  } catch (err) {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[shutdown] Received SIGTERM');
  clearInterval(pollTimer);
  if (webhookChannel) {
    try {
      await changes.stopWebhook(webhookChannel.channelId, webhookChannel.resourceId);
    } catch (_) {}
  }
  process.exit(0);
});

start();
