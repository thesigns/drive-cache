const { drive, sheets } = require('./client');

const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

/**
 * Get file metadata from Drive
 */
async function getFileMeta(fileId) {
  const res = await drive().files.get({
    fileId,
    fields: 'id, name, mimeType, modifiedTime, md5Checksum, size',
  });
  return res.data;
}

/**
 * List all files in the watched folder (recursive)
 */
async function listFolderFiles(folderId) {
  const files = [];
  let pageToken = null;

  do {
    const res = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size)',
      pageSize: 100,
      pageToken,
    });

    files.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Fetch sheet data as JSON (all sheets in the spreadsheet)
 */
async function fetchSheetData(fileId) {
  // First get all sheet names
  const meta = await sheets().spreadsheets.get({
    spreadsheetId: fileId,
    fields: 'sheets.properties.title',
  });

  const sheetNames = meta.data.sheets.map((s) => s.properties.title);

  // Fetch all sheets in one batch
  const res = await sheets().spreadsheets.values.batchGet({
    spreadsheetId: fileId,
    ranges: sheetNames,
  });

  // Convert to a clean object: { "SheetName": [ [row], [row], ... ] }
  const data = {};
  for (const range of res.data.valueRanges) {
    // Range is like "'Sheet1'!A1:Z100" or "Sheet1"
    const name = range.range.split('!')[0].replace(/'/g, '');
    data[name] = range.values || [];
  }

  return data;
}

/**
 * Fetch binary file content (PNG, etc.)
 */
async function fetchBinaryFile(fileId) {
  const res = await drive().files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

/**
 * Fetch a file - routes to the right method based on MIME type
 * Returns { data: Buffer|object, extension: string }
 */
async function fetchFile(fileId, mimeType) {
  if (mimeType === GOOGLE_SHEET_MIME) {
    const data = await fetchSheetData(fileId);
    return {
      data: Buffer.from(JSON.stringify(data, null, 2)),
      extension: '.json',
    };
  }

  const data = await fetchBinaryFile(fileId);
  const ext = mimeExtension(mimeType);
  return { data, extension: ext };
}

function mimeExtension(mimeType) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/svg+xml': '.svg',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/csv': '.csv',
  };
  return map[mimeType] || '';
}

module.exports = {
  getFileMeta,
  listFolderFiles,
  fetchFile,
  fetchSheetData,
  fetchBinaryFile,
  GOOGLE_SHEET_MIME,
};
