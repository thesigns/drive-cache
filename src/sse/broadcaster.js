const clients = new Set();

/**
 * Add a new SSE client (Express response object)
 */
function addClient(res) {
  clients.add(res);
  console.log(`[sse] Client connected (total: ${clients.size})`);

  res.on('close', () => {
    clients.delete(res);
    console.log(`[sse] Client disconnected (total: ${clients.size})`);
  });
}

/**
 * Broadcast an event to all connected clients
 */
function broadcast(event, data, id) {
  const payload =
    (id ? `id: ${id}\n` : '') +
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

/**
 * Send an update notification to all clients
 */
function notifyUpdate(version, changedFiles) {
  broadcast(
    'update',
    {
      version,
      changed: changedFiles,
      timestamp: new Date().toISOString(),
    },
    version
  );
}

/**
 * Get the number of connected clients
 */
function clientCount() {
  return clients.size;
}

module.exports = { addClient, broadcast, notifyUpdate, clientCount };
