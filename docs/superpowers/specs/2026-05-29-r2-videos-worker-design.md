## Goal
Serve large MP4 archives from Cloudflare R2 at `https://projektmelody.cc/videos/<key>` while keeping the site hosted on Cloudflare Pages.

## Constraints
- Videos must be playable via a standard HTML `<video>` element.
- Seeking must work, so HTTP Range requests must be supported.
- Cheapest setup: public videos (no signed URLs / auth).

## Architecture
- Cloudflare Pages hosts the static site (HTML/CSS/JS).
- A Cloudflare Pages Function handles `GET /videos/*` requests.
- The Pages Function fetches objects from an R2 bucket bound to the Pages project as `R2_VIDEOS`.

## Routing
- Request path: `/videos/<key>`
- R2 object key: `<key>` (the path after `/videos/`), URL-decoded.
- Missing objects return `404`.

## Response behavior
- `GET /videos/<key>` without `Range`:
  - Status: `200`
  - Body: full object stream
  - Headers: `Content-Type`, `Content-Length` (when available), `Accept-Ranges: bytes`
- `GET /videos/<key>` with `Range: bytes=start-end`:
  - Status: `206`
  - Body: partial object stream (byte range)
  - Headers: `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`
- Invalid Range requests:
  - Status: `416`
  - Header: `Content-Range: bytes */<size>` when size known

## MIME types
- `.mp4` served as `video/mp4`
- Unknown extensions default to `application/octet-stream`

## Site integration
- Update the archive data model so each item uses `/videos/<filename>.mp4` as its `src`.
- Example: `src: '/videos/evening-stream-2026-05-28.mp4'`

## Deployment steps (Cloudflare dashboard)
- Pages project → Settings → Functions:
  - Enable Functions
  - Add R2 binding:
    - Variable name: `R2_VIDEOS`
    - Bucket: (your chosen bucket)
- Upload MP4s to the bound bucket using Cloudflare dashboard or `wrangler r2 object put`.

