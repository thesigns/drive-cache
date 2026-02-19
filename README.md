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

## Unity Plugin

The `unity/com.airon.drive` package syncs cached assets into a configurable local directory (default `Assets/Resources/Drive/`) for runtime access via `Resources.Load()`.

### Install

Add to your Unity project's `Packages/manifest.json`:

```json
{
  "dependencies": {
    "com.airon.drive": "file:../../drive-cache/unity/com.airon.drive"
  }
}
```

Or copy the `unity/com.airon.drive` folder into your project's `Packages/` directory.

### Configure

Open **Project Settings > Drive Sync** and enter:

- **Server URL** — e.g. `https://your-server.com` or `http://localhost:3100`
- **API Key** — one of the keys from your `API_KEYS` config
- **Resource Directory** — local path where synced files are saved (default: `Assets/Resources/Drive`)

### How It Works

- **On editor load**: runs a full sync (downloads all assets from the server)
- **On entering play mode**: checks the server's manifest version and only syncs if there are changes
- **Manual**: click "Sync Now" in Project Settings > Drive Sync
- Files are placed under the configured Resource Directory (default `Assets/Resources/Drive/`) and can be loaded at runtime with `Resources.Load("Drive/filename")`

## How Sync Works

1. **On startup**: full sync of the watched folder
2. **Incremental sync**: uses Drive Changes API with a persisted page token — only fetches what changed since last check
3. **Webhook** (optional): receives push notifications from Google for near-instant sync
4. **Drift check**: folder comparison triggered on manifest requests and non-file Drive changes, catches anything the Changes API misses (e.g. Shared Drive trash restores)
5. **Recovery**: page token is persisted to disk, so restarts pick up exactly where they left off
