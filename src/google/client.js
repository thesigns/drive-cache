const { google } = require('googleapis');
const config = require('../config');

let driveClient = null;
let sheetsClient = null;

async function init() {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.google.serviceAccountPath,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });

  const authClient = await auth.getClient();

  driveClient = google.drive({ version: 'v3', auth: authClient });
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });

  console.log('[google] API clients initialized');
}

function drive() {
  if (!driveClient) throw new Error('Google client not initialized');
  return driveClient;
}

function sheets() {
  if (!sheetsClient) throw new Error('Google client not initialized');
  return sheetsClient;
}

module.exports = { init, drive, sheets };
