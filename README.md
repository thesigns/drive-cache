# drive-cache

Google Drive caching server for Unity hot-reload. Watches a Drive folder, caches Sheets (as JSON) and binary files (PNGs, etc.), and pushes update notifications via SSE.

## Architecture

```
Google Drive  --webhook/poll-->  drive-cache  --SSE+HTTP-->  Unity
   (Sheets, PNGs)                 (Express)               (Game Client)
```

## Setup

### 1. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable **Google Drive API** and **Google Sheets API**
4. Create a **Service Account** under Credentials
5. Download the JSON key file
6. Place it at `./credentials/service-account.json`

### 2. Share Your Drive Folder

Share your target Google Drive folder with the service account email (found in the JSON key file as `client_email`). Give it **Viewer** access.

Copy the folder ID from the URL: `https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID`

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:
- `API_KEYS` — per-subfolder API keys in `SUBFOLDER:key` format, comma-separated (e.g. `TRTCU:randomkey1,OTHER:randomkey2`). Each key grants access only to files under that subfolder in the Drive folder.
- `GOOGLE_DRIVE_FOLDER_ID` — your shared folder ID
- `WEBHOOK_URL` — (optional) public HTTPS URL for push notifications

### 4. Run

```bash
docker compose up -d
```

### 5. Verify

```bash
# Health check
curl http://localhost:3100/health

# Manifest (with auth) — only shows files under the key's subfolder
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3100/manifest

# Download an asset (path is relative to the key's subfolder)
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3100/assets/myfile.json
```

## Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /manifest` | Yes | Asset manifest (scoped to key's subfolder) |
| `GET /manifest/version` | Yes | Just the version number |
| `GET /assets/*` | Yes | Download a cached file (path relative to subfolder) |
| `GET /sse/events?key=...` | Yes | SSE stream (filtered to key's subfolder) |
| `GET /health` | No | Health check |
| `POST /webhook/drive` | No | Google Drive webhook receiver |

## SSE Events

Connect to `/sse/events?key=YOUR_KEY` to receive:

- `connected` — sent immediately with current version and asset count
- `update` — sent when assets change, includes version and list of changed files

## How Sync Works

1. **On startup**: if no prior state, does a full sync of the watched folder
2. **Incremental sync**: uses Drive Changes API with a persisted page token — only fetches what changed since last check
3. **Polling**: checks for changes every 30s (configurable) as a safety net
4. **Webhook** (optional): receives push notifications from Google for near-instant sync
5. **Recovery**: page token is persisted to disk, so restarts pick up exactly where they left off
