const express = require('express');

const router = express.Router();

// Callback for sync handler (set by index.js)
let onChangeNotification = null;

function setChangeHandler(handler) {
  onChangeNotification = handler;
}

// Google sends a POST to verify the channel, then for each change
router.post('/drive', (req, res) => {
  const state = req.headers['x-goog-resource-state'];
  const channelId = req.headers['x-goog-channel-id'];

  if (state === 'sync') {
    // Initial sync message - just acknowledge
    console.log(`[webhook] Channel sync confirmed: ${channelId}`);
    return res.status(200).end();
  }

  if (state === 'change') {
    console.log(`[webhook] Change notification received`);
    if (onChangeNotification) {
      // Trigger async sync - don't block the webhook response
      onChangeNotification().catch((err) =>
        console.error('[webhook] Sync error:', err.message)
      );
    }
  }

  res.status(200).end();
});

module.exports = router;
module.exports.setChangeHandler = setChangeHandler;
