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
NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
NVIDIA_VISIBLE_DEVICES=all
```

Do **not** set `URL` or `MAGNET` on the pod template for a persistent workflow.

Remove any empty `MAGNET=` from pod env if present.

## After the pod starts

The container **idles** when no job is configured (`IDLE=1`, default). Open **Web Terminal**:

```bash
# Verify NVENC (restart pod after changing NVIDIA_DRIVER_CAPABILITIES)
ldconfig -p | grep nvidia-encode || echo "missing libnvidia-encode — add video to NVIDIA_DRIVER_CAPABILITIES and restart"
ffmpeg -hide_banner -encoders 2>&1 | grep h264_nvenc

# Verify volume
df -h /work

# Run an ingest (title from filename)
/app/run-url.sh "https://example.com/my-stream.mp4"
/app/run-url.sh "https://example.com/my-stream.mp4" "2026-06-02"
```

### Quick ingest script (paste whole block)

**Before running:** set `NVIDIA_DRIVER_CAPABILITIES=compute,video,utility` on the pod and **restart** the pod. Swap in a **fresh** direct download URL.

```bash
ldconfig -p | grep nvidia-encode || { echo "Add NVIDIA_DRIVER_CAPABILITIES=compute,video,utility in RunPod, restart pod, then re-run."; exit 1; }

curl -fsSL -o /tmp/jffm.tar.xz \
  "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v7.1.4-1/jellyfin-ffmpeg_7.1.4-1_portable_linux64-gpl.tar.xz"
rm -rf /opt/jellyfin-ffmpeg
mkdir -p /opt/jellyfin-ffmpeg
tar -xJf /tmp/jffm.tar.xz -C /opt/jellyfin-ffmpeg
FFMPEG_BIN="$(find /opt/jellyfin-ffmpeg -name ffmpeg -type f | head -1)"
FFPROBE_BIN="$(find /opt/jellyfin-ffmpeg -name ffprobe -type f | head -1)"
ln -sf "$FFMPEG_BIN" /usr/local/bin/ffmpeg
ln -sf "$FFPROBE_BIN" /usr/local/bin/ffprobe

"$FFMPEG_BIN" -hide_banner -encoders 2>&1 | grep h264_nvenc
"$FFPROBE_BIN" -v error -select_streams v:0 -show_entries stream=height -of csv=p=0:s=x /workspace/downloads/source.mkv 2>/dev/null || true

/app/run-url.sh "$(printf '%s' 'https://YOUR-FRESH-DIRECT-LINK.mkv' | tr -d '\r\n')"
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
