# Runpod Ingest (Torrent → HLS → R2 → PR)

This folder contains a containerized ingestion job intended to run on Runpod:

- Download from `MAGNET` using qBittorrent-nox
- Encode to HLS (1080p + 720p) using NVIDIA NVENC
- Upload to Cloudflare R2 using s5cmd (S3 API)
- Verify playlists + tail segments exist in R2
- Open a GitHub PR updating `public/videos.json` and `videos.json`

## Required env vars

Job:
- `MODE`: `list` or `run`
- `MAGNET`
- `TITLE`
- `DATE` (YYYY-MM-DD)
- `SELECT_PATH` (required for `MODE=run`)

R2:
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (default `r2-videos`)

GitHub:
- `GITHUB_REPO` (example: `kentangwire/projektmelody-archive`)
- `GITHUB_TOKEN`

Optional:
- `FORCE=1` (overwrite existing destination prefix)
- `CLEANUP_ON_FAIL=1` (delete local artifacts even if the job fails)

## Outputs

R2 keys:
- `streams/<date>-<slug>/master.m3u8`
- `streams/<date>-<slug>/1080p/index.m3u8` + `seg-*.ts`
- `streams/<date>-<slug>/720p/index.m3u8` + `seg-*.ts`
- `streams/<date>-<slug>/thumb.jpg`

Catalog entry written by PR:
- `hlsSrc`: `/videos/streams/<date>-<slug>/master.m3u8`
- `thumbSrc`: `/videos/streams/<date>-<slug>/thumb.jpg`

## Typical usage

1) List files (first run):
- Set `MODE=list`
- Set `MAGNET`, `TITLE`, `DATE`
- Read output lines and pick a path to encode

2) Run encode + upload + PR (second run):
- Set `MODE=run`
- Set `SELECT_PATH` to an exact file path printed from list mode

