#!/usr/bin/env bash
# Live ingest % — run in a second Web Terminal.
set -u

OUT="${WORK_DIR:-/workspace}/out"
SRC="${WORK_DIR:-/workspace}/downloads/source.mkv"
INTERVAL="${REFRESH:-5}"
HLS_SEC=4

ffprobe_bin() {
  command -v ffprobe 2>/dev/null || true
  [[ -x /opt/jellyfin-ffmpeg/ffprobe ]] && echo /opt/jellyfin-ffmpeg/ffprobe && return
  [[ -x /usr/local/bin/ffprobe ]] && echo /usr/local/bin/ffprobe
}

dur_sec() {
  local fp d
  fp="$(ffprobe_bin || true)"
  [[ -z "${fp}" || ! -f "${SRC}" ]] && echo 0 && return
  d="$("${fp}" -v error -show_entries format=duration -of default=nw=1:nk=1 "${SRC}" 2>/dev/null || echo 0)"
  printf '%.0f' "${d}" 2>/dev/null || echo 0
}

count_ts() {
  find "${OUT}/1080p" -maxdepth 1 -name '*.ts' 2>/dev/null | wc -l | tr -d ' '
}

bar() {
  local pct="$1" w=30 f e i
  [[ "${pct}" -lt 0 ]] && pct=0
  [[ "${pct}" -gt 100 ]] && pct=100
  f=$(( pct * w / 100 )); e=$(( w - f ))
  printf '['
  for ((i=0; i<f; i++)); do printf '#'; done
  for ((i=0; i<e; i++)); do printf '-'; done
  printf '] %3d%%' "${pct}"
}

DUR="$(dur_sec)"
[[ "${DUR}" -le 0 ]] && DUR=1

while true; do
  segs="$(count_ts)"
  enc_sec=$(( segs * HLS_SEC ))
  pct=$(( enc_sec * 100 / DUR ))
  [[ "${pct}" -gt 100 ]] && pct=100

  echo "========== $(date -u '+%H:%M:%S UTC') =========="
  if pgrep -f '[f]fmpeg' >/dev/null 2>&1; then
    echo "Status:  ENCODING"
  elif [[ -f "${OUT}/master.m3u8" ]]; then
    echo "Status:  ENCODE DONE"
    pct=100
  else
    echo "Status:  FINISHING / UPLOAD"
  fi

  bar "${pct}"
  echo "Time:    $(( enc_sec / 60 )) / $(( DUR / 60 )) min"
  echo "1080p:   ${segs} segments  $(du -sh "${OUT}/1080p" 2>/dev/null | awk '{print $1}')"
  echo "720p:    $(find "${OUT}/720p" -maxdepth 1 -name '*.ts' 2>/dev/null | wc -l | tr -d ' ') segments  $(du -sh "${OUT}/720p" 2>/dev/null | awk '{print $1}')"
  echo "Ctrl+C stops this view only."
  echo
  sleep "${INTERVAL}"
done
