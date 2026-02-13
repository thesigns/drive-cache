const { drive, sheets } = require('./client');

const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

/**
 * Get file metadata from Drive
 */
async function getFileMeta(fileId) {
  const res = await drive().files.get({
    fileId,
    fields: 'id, name, mimeType, modifiedTime, md5Checksum, size',
    supportsAllDrives: true,
  });
  return res.data;
}

/**
 * List all files in the watched folder (recursive)
 */
async function listFolderFiles(folderId, prefix = '') {
  const files = [];
  let pageToken = null;

  do {
    const res = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of res.data.files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listFolderFiles(file.id, prefix + file.name + '/');
        files.push(...subFiles);
      } else {
        file.name = prefix + file.name;
        files.push(file);
      }
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Fetch sheet data as JSON (all sheets in the spreadsheet).
 * Returns data in Google Sheets API values format:
 *   { range: "Sheet!A1:Z100", majorDimension: "ROWS", values: [[...], ...] }
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

  // Return raw API response per tab: { "SheetName": { range, majorDimension, values } }
  const data = {};
  for (const range of res.data.valueRanges) {
    const name = range.range.split('!')[0].replace(/'/g, '');
    data[name] = {
      range: range.range,
      majorDimension: range.majorDimension || 'ROWS',
      values: range.values || [],
    };
  }

  return data;
}

/**
 * Fetch binary file content (PNG, etc.)
 */
async function fetchBinaryFile(fileId) {
  const res = await drive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

/**
 * Fetch a file - routes to the right method based on MIME type.
 * For sheets: returns { files: [{ name, data }], extension: '.json', isSheet: true }
 * For others: returns { data: Buffer, extension: string, isSheet: false }
 */
async function fetchFile(fileId, mimeType) {
  if (mimeType === GOOGLE_SHEET_MIME) {
    const tabData = await fetchSheetData(fileId);
    const files = Object.entries(tabData).map(([tabName, table]) => ({
      name: tabName,
      data: Buffer.from(JSON.stringify(table, null, 2)),
    }));
    return { files, extension: '.json', isSheet: true };
  }

  const data = await fetchBinaryFile(fileId);
  const ext = mimeExtension(mimeType);
  return { data, extension: ext, isSheet: false };
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
