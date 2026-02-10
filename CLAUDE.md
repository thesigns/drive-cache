# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**drive-cache** is a Google Drive caching server for Unity hot-reload workflows. It watches a Google Drive folder, caches Google Sheets (as JSON) and binary files (PNGs, etc.), and pushes real-time update notifications to Unity clients via Server-Sent Events (SSE).

```
Google Drive  --webhook/poll-->  drive-cache (Express)  --SSE+HTTP-->  Unity Client
```

## Commands

```bash
# Development (uses node --watch for auto-restart)
npm run dev

# Production
npm start

# Docker
docker compose up -d          # start
docker compose up -d --build  # rebuild and start
docker compose logs -f        # follow logs
```

No test framework is currently configured.

## Architecture

The server runs on Express (port 3100) with Node.js 20. Key flows:

**Sync pipeline**: Google Drive → fetch (Sheets→JSON or binary) → hash (MD5) → cache to disk → bump manifest version → broadcast SSE update

**Dual sync strategy**: Webhooks for near-instant updates + polling (30s) as fallback. Page token persisted to disk so incremental sync survives restarts.

### Module Layout (`src/`)

- **index.js** — Entry point. Orchestrates full/incremental sync, polling, webhook setup, and Express server startup. Contains `fullSync()`, `incrementalSync()`, and `syncFile()`.
- **config.js** — Centralizes all environment variables.
- **auth.js** — Per-key auth middleware (Bearer header or `?key=` query param). Looks up the key in `config.apiKeys`, sets `req.subfolder` to the scoped subfolder. Exempts `/webhook/drive`.
- **google/client.js** — Initializes authenticated Drive v3 and Sheets v4 clients from service account credentials.
- **google/fetcher.js** — Downloads files: Sheets become multi-tab JSON, binaries preserved as-is. Routes by MIME type.
- **google/changes.js** — Incremental sync via Changes API. Webhook registration/renewal (7-day expiry, auto-renews 1hr before).
- **cache/store.js** — File system ops: save/read/delete cached files, persist/load page token.
- **cache/manifest.js** — Version-controlled asset registry. Tracks filename, type, hash, size, modifiedTime, URL per asset. `commit()` bumps version only if changes occurred.
- **sse/broadcaster.js** — Manages SSE client connections (Map of res→subfolder). Broadcasts `update` events filtered per client's subfolder, stripping the subfolder prefix from filenames.
- **routes/** — `manifest.js` (GET manifest filtered by subfolder + version), `assets.js` (file serving scoped to subfolder with path traversal protection), `sse.js` (SSE stream with 30s keepalive, subfolder-scoped), `webhook.js` (Google Drive push notification receiver).

### API Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | No | Health check (status, version, clients, uptime) |
| `GET /manifest` | Yes | Asset manifest (scoped to key's subfolder) |
| `GET /manifest/version` | Yes | Version number only |
| `GET /assets/*` | Yes | Cached file download (path relative to subfolder) |
| `GET /sse/events` | Yes | SSE stream filtered to key's subfolder |
| `POST /webhook/drive` | No | Google Drive webhook receiver |

### Docker Setup

- Persistent volume `cache-data` at `/opt/drive-cache/data` for manifest + cached files
- Read-only bind mount `./credentials` for service account JSON
- Connects to external `caddy_default` network for reverse proxy
- Healthcheck via `/health` endpoint

### Key Dependencies

- `googleapis` — Google Drive and Sheets API access
- `express` — HTTP server
- `dotenv` — Environment config from `.env`
