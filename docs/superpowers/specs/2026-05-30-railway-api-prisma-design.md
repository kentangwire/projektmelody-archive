## Goal
Add a production-ready Node/Express + Prisma API (hosted on Railway + Postgres) to power:
- Video catalog + tag filters
- Community timestamps with basic abuse controls
- ExoClick VAST pre-roll proxy (same-origin to the website)

## Constraints
- Cloudflare Pages continues to host the static site (deployed from `public/`).
- API runs as a separate service on Railway.
- Database: Postgres.
- Use Prisma for schema + migrations.
- Store user IP (for rate limiting) with IPv4/IPv6 support.
- Keep request validation and error handling consistent and predictable.

## High-level architecture
- Cloudflare Pages site:
  - Fetches catalog/timestamps from the Railway API over HTTPS.
  - Fetches VAST XML from Railway API endpoint (ad proxy).
- Railway service:
  - Express app providing `/api/*` endpoints.
  - Prisma Client for DB access.
  - Environment variables for DB connection and ExoClick upstream URL.
- Postgres:
  - Stores videos, tags, video-tag join, timestamps.

## Data model (Prisma)
### Video
- Stores:
  - HLS master playlist URL (string)
  - Title + description
  - Optional torrent URL + magnet link
- Relationships:
  - Many-to-many with Tag via VideoTag
  - One-to-many to Timestamp

### Tag
- Stores normalized tags used for filtering and classification.
- Examples:
  - Platform sources
  - Interactive toy statuses
  - Niche classifications

### VideoTag (join table)
- Explicit join table with composite PK:
  - `videoId`
  - `tagId`

### Timestamp
- Stores:
  - `timeInSec` (int)
  - short `description` (max 60 chars)
  - `upvotes`, `downvotes` (int)
  - `userIp` (string, up to 45 chars)
- Rate limiting support:
  - Query by `(videoId, userIp, createdAt)` to check “last 60 seconds”.
- Ordering:
  - Return timestamps ordered by `timeInSec ASC, createdAt ASC`.

## API routes
### GET /api/ads/pre-roll
- Fetch upstream VAST XML from ExoClick.
- Return the exact response body as XML:
  - `Content-Type: application/xml`
  - `Cache-Control: no-store`
- Upstream configured by env:
  - default: `https://s.magsrv.com/v1/vast.php?id=5938356`

### GET /api/videos
- Returns all videos with tags.
- Optional filter:
  - `?tagIds=tag1,tag2` (comma-separated)
  - Returns videos that have at least one of the requested tags.

### GET /api/videos/:id
- Returns a single video with:
  - tags
  - timestamps ordered `timeInSec ASC, createdAt ASC`

### POST /api/videos/:id/timestamps
- JSON body:
  - `timeInSec` integer
  - `description` string (max 60)
- Reject any description containing:
  - HTML-like tags `<...>`
  - URLs `http://` or `https://`
- Rate limit:
  - `req.ip` (trust proxy enabled)
  - block if same IP posted to the same video within last 60 seconds
  - return `429`
- Persist via Prisma.

## Server behavior
- Express app:
  - `app.set('trust proxy', 1)` for correct `req.ip` behind Railway
  - JSON body parsing
  - CORS enabled for the Cloudflare Pages origins
  - Central error handler returning consistent JSON errors
- Strict TypeScript:
  - Typed request bodies, params, and response payloads.

## Deployment (Railway)
### Environment variables
- `DATABASE_URL` (Railway Postgres plugin provides this)
- `EXOCLICK_VAST_URL` (optional override)
- `CORS_ORIGINS` (comma-separated allowed origins, e.g. `https://projektmelody.cc,https://www.projektmelody.cc`)

### Migrations
- Local dev:
  - `npx prisma migrate dev --name init`
- On Railway deploy:
  - `npx prisma migrate deploy`
