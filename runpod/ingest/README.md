# Runpod Ingest (URL / Torrent → HLS → R2 → PR)

Containerized ingestion job for Runpod GPU pods:

- **URL mode:** download a direct HTTP(S) video file, adaptive HLS encode, upload, PR
- **Magnet mode:** download via qBittorrent-nox, dual 1080p+720p encode, upload, PR

Both paths upload to Cloudflare R2 (s5cmd), verify playlists + tail segments, and open a GitHub PR updating `public/videos.json` and `videos.json`.

## Input modes

### URL (single run)

Set `URL` to a direct file link (`.mp4`, `.mkv`, etc.). No torrent or file-list step.

Required env:

- `URL` — direct `https://…` video file URL
- `DATE` (`YYYY-MM-DD`)

`TITLE` is optional — when omitted, it is taken from the URL filename (e.g. `my-stream.mp4` → title `my-stream`).

Or on the pod:

```bash
/app/run-url.sh "https://cdn.example.com/my-stream.mp4" "2026-06-02"
# DATE defaults to today (UTC) if omitted:
/app/run-url.sh "https://cdn.example.com/my-stream.mp4"
```

Loads secrets from `runpod/ingest/.env.ingest` when present (`ENV_FILE` overrides path).

### Magnet (two runs)

1. `MODE=list` — print torrent files, exit
2. `MODE=run` — encode chosen `SELECT_PATH`, upload, PR

Required env:

- `MODE`: `list` or `run`
- `MAGNET`
- `DATE`
- `SELECT_PATH` (required for `MODE=run`)

`TITLE` is optional for `MODE=run` — when omitted, it is taken from `SELECT_PATH` filename.

## Adaptive quality ladder (URL mode)

Source height is detected with `ffprobe`:

| Source height | Output |
|---------------|--------|
| ≥ 1080 (incl. 4K) | `1080p/` + `720p/` + `master.m3u8` |
| 720–1079 | `720p/` + `master.m3u8` only |
| < 720 | Upscale to 720p → `720p/` + `master.m3u8` only |

Magnet mode always produces **1080p + 720p** (unchanged).

## R2 + GitHub env vars

R2:

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (default `r2-videos`)

GitHub:

- `GITHUB_REPO` (example: `kentangwire/projektmelody-archive`)
- `GITHUB_TOKEN`

Optional:

- `FORCE=1` — overwrite existing R2 prefix
- `CLEANUP_ON_FAIL=1` — delete local artifacts on failure
- `WORK_DIR` — default `/work` (mount ≥80GB volume)
- `IDLE=1` — when no `URL`/`MAGNET`, keep pod running (default). Set `IDLE=0` to exit instead.

## RunPod quick start

See **[RUNPOD.md](RUNPOD.md)** for pod GPU, volume, env, and terminal commands.

With the default image, **no entrypoint override is needed** — the pod idles until you run:

```bash
/app/run-url.sh "https://example.com/my-stream.mp4"
```

## Outputs

R2 keys:

- `streams/<date>-<slug>/master.m3u8`
- `streams/<date>-<slug>/1080p/…` (when encoded)
- `streams/<date>-<slug>/720p/…`
- `streams/<date>-<slug>/thumb.jpg`

Catalog entry (via PR):

- `hlsSrc`: `/videos/streams/<date>-<slug>/master.m3u8`
- `thumbSrc`: `/videos/streams/<date>-<slug>/thumb.jpg`

## Windows helper

From the repo root:

```powershell
.\tools\ingest-url.ps1
```

Prompts for URL and date; title is derived from the URL filename. Writes `runpod/ingest/.env.ingest` (gitignored); prints RunPod env and a `docker run` one-liner.

## Docker image

Published on push to `master` when `runpod/ingest/**` changes:

`ghcr.io/kentangwire/projektmelody-runpod-ingest:latest`

Local build:

```bash
docker build -t projektmelody-runpod-ingest runpod/ingest
```

Run URL ingest:

```bash
docker run --rm --gpus all -v /work:/work --env-file runpod/ingest/.env.ingest \
  -e URL="https://example.com/my-stream.mp4" \
  -e DATE="2026-06-02" \
  ghcr.io/kentangwire/projektmelody-runpod-ingest:latest
```

## Typical magnet usage

1) List files:

- `MODE=list`, `MAGNET`, `TITLE`, `DATE`

2) Encode + upload + PR:

- `MODE=run`, same vars + `SELECT_PATH` from list output
