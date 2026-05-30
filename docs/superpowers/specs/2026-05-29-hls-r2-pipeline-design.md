## Goal
Reduce buffering by switching from direct MP4 playback to HLS adaptive playback while keeping hosting cost low.

## Constraints
- Cloudflare Pages hosts the website.
- Cloudflare R2 stores video outputs.
- Videos served on root domain path: `https://projektmelody.cc/videos/...`
- Works on iOS Safari, Android Chrome, and desktop browsers.
- Keep the system public (no auth) for lowest cost.

## High-level architecture
- Encode source MP4 into HLS outputs (multiple renditions) using `ffmpeg`.
- Upload the full HLS folder to R2 (playlist + segments).
- Serve files from R2 through the existing Pages Function route `/videos/*`.
- Player logic:
  - Prefer native HLS (`video.canPlayType('application/vnd.apple.mpegurl')`) for Safari/iOS.
  - Use `hls.js` for browsers without native HLS (Chrome/Edge/Firefox).

## URL and key layout
For a given `videoId`:
- Public entry URL: `https://projektmelody.cc/videos/<videoId>/master.m3u8`
- R2 keys:
  - `<videoId>/master.m3u8`
  - `<videoId>/v360p.m3u8`
  - `<videoId>/v720p.m3u8`
  - `<videoId>/seg-00001.ts` (and more segments)

## Encoding profile (baseline)
- 2 renditions: 360p and 720p.
- Segment length: ~6s.
- Output segments: `.ts` for broad compatibility.
- Master playlist references the variants.

## Serving requirements
Pages Function `/videos/*` must return correct `Content-Type`:
- `.m3u8` → `application/vnd.apple.mpegurl`
- `.ts` → `video/mp2t`
- `.m4s` → `video/iso.segment`
- `.mp4` → `video/mp4` (optional fallback)
- default → `application/octet-stream`

Range requests:
- Keep Range support (useful for MP4 fallback); HLS primarily fetches individual segment files.

## Player integration in the site
Data model:
- Each video entry uses `src: '/videos/<videoId>/master.m3u8'`.

Modal playback:
- On open:
  - Destroy any previous `hls.js` instance.
  - If native HLS supported: set `video.src = m3u8Url` and play.
  - Else: load `hls.js` (CDN), create `new Hls()`, `loadSource(m3u8Url)`, `attachMedia(video)`.
- On close:
  - Pause and clear video.
  - Destroy `hls.js` instance to avoid leaks.

## Deployment steps (Cloudflare)
- R2 bucket exists and is bound to Pages as `R2_VIDEOS`.
- Upload HLS output folders to the bucket (preserving paths).
- Redeploy the Pages project so updated site code loads HLS sources.

