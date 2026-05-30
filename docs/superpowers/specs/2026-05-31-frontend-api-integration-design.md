# Frontend API Integration (Videos, Timestamps, Ads)

## Goal

Make the Cloudflare Pages frontend use the deployed Render API (`projektmelody-archive.onrender.com`) as the source of truth for:

- Video catalog (list + featured/latest)
- Video details (timestamps)
- Timestamp creation
- VAST preroll proxy (server-side fetch)

Preserve HLS hosting on Cloudflare Pages/R2 paths and keep the existing UI/UX.

## Current State

- Frontend catalog comes from `public/videos.json` (static).
- HLS playback uses Pages Function-backed `/videos/<id>/master.m3u8`.
- Preroll is implemented in the frontend and can call a Pages Function VAST proxy (`/ads/vast`).
- Backend API is deployed to Render and verified via `/healthz`.

## Target Architecture

### Data Sources

- **Catalog/metadata/timestamps**: Render API
- **HLS playlists + segments**: Cloudflare Pages (existing `/videos/...` routing)
- **Thumbnails**: derived by convention in the frontend from the Pages origin

### API Base URL

Frontend uses a single configurable `API_BASE` constant:

- Default: `https://projektmelody-archive.onrender.com`
- Optional override (debug): query param `?apiBase=<url>` or `localStorage.API_BASE`

## Frontend Changes

### Catalog Fetch

Replace static `./videos.json` usage with:

- `GET ${API_BASE}/api/videos`

The API ordering determines “latest”.

### Featured Video Rule

- Featured/latest = **first item** from `GET /api/videos` (backend ordered by `createdAt desc`)

### Thumbnail Derivation

No DB changes for thumbnails. Frontend derives:

- `thumbUrl = https://projektmelody.cc/assets/${video.id}-thumb.jpg`
- If the image fails to load, fallback to existing monogram/gradient UI

### Video Playback

Frontend will use `video.hlsMasterUrl` returned by API, which must be an absolute URL pointing to the Pages origin (e.g. `https://projektmelody.cc/videos/<id>/master.m3u8`).

### Timestamps

- Fetch details (including timestamps) on open:
  - `GET ${API_BASE}/api/videos/:id`
- Create timestamp:
  - `POST ${API_BASE}/api/videos/:id/timestamps`
  - body: `{ "timeInSec": number, "description": string }`
- After successful POST, refresh timestamps from `GET /api/videos/:id` (or append response if shape matches UI needs).

### Ads (Preroll)

Preferred:

- `GET ${API_BASE}/api/ads/pre-roll`

Fallback:

- If the API call fails or returns unusable/no-fill XML, either:
  - try existing Pages Function proxy `/ads/vast` (if still present), or
  - skip preroll and start HLS immediately

## Backend Changes

### Import Existing Catalog into Neon

Add a one-time import script that reads `public/videos.json` and upserts:

- `Video`
  - `id` from JSON
  - `title` from JSON
  - `description` empty string
  - `hlsMasterUrl` absolute URL: `https://projektmelody.cc` + `hlsSrc` (from JSON)
  - `createdAt` derived from `date` in JSON to preserve ordering
- `Tag` for each unique tag name in JSON
- `VideoTag` join rows connecting each Video to its tags

Script properties:

- Safe to re-run (idempotent)
- Does not require Prisma Studio
- Runs locally only (not part of production server start)

### Ensure API Supports Frontend Needs

The existing endpoints already cover:

- `GET /api/videos`
- `GET /api/videos/:id` (includes timestamps)
- `POST /api/videos/:id/timestamps`
- `GET /api/ads/pre-roll`

Confirm `GET /api/videos` returns `hlsMasterUrl` as an absolute URL suitable for the Pages player.

## Success Criteria

- Landing page loads videos from API (no dependency on `public/videos.json` at runtime)
- Featured/latest is the most recent `createdAt`
- Clicking a video plays HLS from Pages origin
- Timestamps list loads and new timestamps submit successfully (rate limiting still applies)
- Preroll requests go to Render API and do not break playback when ads are unavailable

