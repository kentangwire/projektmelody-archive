#!/usr/bin/env bash
# Generate nsfw.vtt from a local media file (no encode/upload).
# Usage: /app/run-cc.sh /workspace/downloads/source.mkv [/workspace/out/nsfw.vtt]
set -euo pipefail

INPUT="${1:-}"
OUT="${2:-${WORK_DIR:-/work}/out/nsfw.vtt}"

if [[ -z "${INPUT}" || ! -f "${INPUT}" ]]; then
  echo "Usage: $0 <video-or-audio> [output.vtt]" >&2
  exit 1
fi

export FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
if [[ -x /opt/jellyfin-ffmpeg/ffmpeg ]]; then
  export FFMPEG_BIN=/opt/jellyfin-ffmpeg/ffmpeg
fi

exec python3 /app/generate_cc.py --input "${INPUT}" --output "${OUT}"
