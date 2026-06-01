# RunPod pod setup

## Deploy settings

| Setting | Value |
|---------|--------|
| GPU | Any **NVIDIA** (NVENC required) |
| Container image | `ghcr.io/kentangwire/projektmelody-runpod-ingest:latest` |
| Container disk | 20–30 GB |
| Network volume | **≥ 80 GB** |
| Volume mount path | **`/work`** |
| Container start command | *(leave empty — image idles automatically)* |
| Container entrypoint | *(leave empty — use image default)* |

If the volume is mounted at `/workspace` instead, set `WORK_DIR=/workspace`.

## Environment variables (set once)

Copy from [`env.ingest.example`](env.ingest.example) and fill in secrets:

```bash
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=r2-videos
GITHUB_REPO=kentangwire/projektmelody-archive
GITHUB_TOKEN=ghp_...
WORK_DIR=/work
IDLE=1
```

Do **not** set `URL` or `MAGNET` on the pod template for a persistent workflow.

Remove any empty `MAGNET=` from pod env if present.

## After the pod starts

The container **idles** when no job is configured (`IDLE=1`, default). Open **Web Terminal**:

```bash
# Verify NVENC
ffmpeg -hide_banner -encoders 2>/dev/null | grep h264_nvenc

# Verify volume
df -h /work

# Run an ingest (title from filename)
/app/run-url.sh "https://example.com/my-stream.mp4"
/app/run-url.sh "https://example.com/my-stream.mp4" "2026-06-02"
```

## One-shot pod (optional)

Set `IDLE=0` and provide job env before start:

```bash
URL=https://example.com/my-stream.mp4
DATE=2026-06-02
```

Pod runs ingest once and exits.

## Rebuild image on the pod

If GHCR image is stale:

```bash
git clone https://github.com/kentangwire/projektmelody-archive.git
cd projektmelody-archive/runpod/ingest
docker build -t ingest .
```

Point the pod at your `ingest` image tag.

## Windows helper

From repo root on your PC:

```powershell
.\tools\ingest-url.ps1
```

Writes `runpod/ingest/.env.ingest` (gitignored) with secrets placeholders.
