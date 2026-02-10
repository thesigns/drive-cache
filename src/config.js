require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3100'),
  apiKey: process.env.API_KEY || 'change-me',

  google: {
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  },

  cache: {
    dir: process.env.CACHE_DIR || '/opt/drive-cache/data',
    manifestPath: process.env.MANIFEST_PATH || '/opt/drive-cache/data/manifest.json',
    pageTokenPath: process.env.PAGE_TOKEN_PATH || '/opt/drive-cache/data/.page-token',
  },

  pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),
  webhookUrl: process.env.WEBHOOK_URL || null,
};
