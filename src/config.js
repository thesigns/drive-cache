require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3100'),
  apiKey: process.env.API_KEY || 'change-me',

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
