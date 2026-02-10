const clients = new Map(); // res -> subfolder

/**
 * Add a new SSE client (Express response object) scoped to a subfolder
 */
function addClient(res, subfolder) {
  clients.set(res, subfolder);
  console.log(`[sse] Client connected for ${subfolder} (total: ${clients.size})`);

  res.on('close', () => {
    clients.delete(res);
    console.log(`[sse] Client disconnected (total: ${clients.size})`);
  });
}

/**
 * Broadcast an event to all connected clients (unfiltered)
 */
function broadcast(event, data, id) {
  const payload =
    (id ? `id: ${id}\n` : '') +
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n\n`;

  for (const [client] of clients) {
    client.write(payload);
  }
}

/**
 * Send an update notification to clients, filtered by subfolder.
 * Each client only sees changed files within their scoped subfolder,
 * with the subfolder prefix stripped from filenames.
 */
function notifyUpdate(version, changedFiles) {
  for (const [client, subfolder] of clients) {
    const prefix = subfolder + '/';
    const visible = changedFiles
      .filter(f => f.name && f.name.startsWith(prefix))
      .map(f => ({ ...f, name: f.name.slice(prefix.length) }));

    // Skip clients that have no relevant changes (unless it's a full sync with empty list)
    if (changedFiles.length > 0 && visible.length === 0) continue;

    const payload =
      `id: ${version}\n` +
      `event: update\n` +
      `data: ${JSON.stringify({
        version,
        changed: visible,
        timestamp: new Date().toISOString(),
      })}\n\n`;

    client.write(payload);
  }
}

/**
 * Get the number of connected clients
 */
function clientCount() {
  return clients.size;
}

module.exports = { addClient, broadcast, notifyUpdate, clientCount };
