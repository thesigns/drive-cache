require('dotenv').config();

function parseApiKeys(raw) {
  const map = new Map();
  if (!raw) return map;
  for (const entry of raw.split(',')) {
    const sep = entry.indexOf(':');
    if (sep === -1) continue;
    const subfolder = entry.slice(0, sep).trim();
    const key = entry.slice(sep + 1).trim();
    if (subfolder && key) map.set(key, subfolder);
  }
  return map;
}

module.exports = {
  port: parseInt(process.env.PORT || '3100'),
  apiKeys: parseApiKeys(process.env.API_KEYS),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  },

  cache: {
    dir: process.env.CACHE_DIR || '/opt/drive-cache/data',
  },

  pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),
  webhookUrl: process.env.WEBHOOK_URL || null,
};
