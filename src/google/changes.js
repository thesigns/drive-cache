const { v4: uuidv4 } = require('crypto');
const { drive } = require('./client');
const config = require('../config');

let sharedDriveId = null;

/**
 * Detect if the watched folder is on a Shared Drive.
 * Must be called once at startup before using the Changes API.
 */
async function detectSharedDrive() {
  try {
    const res = await drive().files.get({
      fileId: config.google.folderId,
      fields: 'driveId',
      supportsAllDrives: true,
    });
    sharedDriveId = res.data.driveId || null;
    if (sharedDriveId) {
      console.log(`[changes] Shared Drive detected: ${sharedDriveId}`);
    } else {
      console.log('[changes] Folder is on My Drive');
    }
  } catch (err) {
    console.error('[changes] Failed to detect drive type:', err.message);
  }
}

/**
 * Get the initial page token (marks "now" as the starting point)
 */
async function getStartPageToken() {
  const params = { supportsAllDrives: true };
  if (sharedDriveId) {
    params.driveId = sharedDriveId;
  }
  const res = await drive().changes.getStartPageToken(params);
  return res.data.startPageToken;
}

/**
 * List all changes since the given page token.
 * Returns { changes: [...], newPageToken: string }
 */
async function listChanges(pageToken) {
  const allChanges = [];
  let token = pageToken;

  do {
    const params = {
      pageToken: token,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, md5Checksum, parents, trashed))',
      pageSize: 100,
      includeRemoved: true,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };
    if (sharedDriveId) {
      params.driveId = sharedDriveId;
    }
    const res = await drive().changes.list(params);

    allChanges.push(...(res.data.changes || []));

    if (res.data.newStartPageToken) {
      // No more pages - this is the new token for next poll
      return { changes: allChanges, newPageToken: res.data.newStartPageToken };
    }

    token = res.data.nextPageToken;
  } while (token);

  return { changes: allChanges, newPageToken: token };
}

/**
 * Register a webhook channel for push notifications.
 * Returns channel info including expiration.
 */
async function registerWebhook(webhookUrl) {
  const channelId = `drive-cache-${Date.now()}`;
  const params = {
    pageToken: await getStartPageToken(),
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days max
    },
  };
  if (sharedDriveId) {
    params.driveId = sharedDriveId;
  }
  const res = await drive().changes.watch(params);

  console.log(
    `[changes] Webhook registered: channel=${channelId}, expires=${new Date(
      parseInt(res.data.expiration)
    ).toISOString()}`
  );

  return {
    channelId: res.data.id,
    resourceId: res.data.resourceId,
    expiration: parseInt(res.data.expiration),
  };
}

/**
 * Stop a webhook channel
 */
async function stopWebhook(channelId, resourceId) {
  await drive().channels.stop({
    requestBody: { id: channelId, resourceId },
  });
  console.log(`[changes] Webhook stopped: channel=${channelId}`);
}

module.exports = {
  detectSharedDrive,
  getStartPageToken,
  listChanges,
  registerWebhook,
  stopWebhook,
};
