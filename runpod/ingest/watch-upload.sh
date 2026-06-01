#!/usr/bin/env bash
# Upload monitor for a second terminal. Fast UI; R2 size check every 30s only.
set -u

OUT="${WORK_DIR:-/workspace}/out"
R2_PREFIX="${R2_PREFIX:-streams/2026-06-01-projektmelody-2023-01-22-21-05-03}"
R2_BUCKET="${R2_BUCKET:-r2-videos}"
UI_SEC="${REFRESH:-5}"
R2_SEC="${R2_REFRESH:-30}"

if [[ -f /app/.env.ingest ]]; then
  set -a
  # shellcheck disable=SC1091
  source /app/.env.ingest
  set +a
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"

human() {
  numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "${1} B"
}

bar() {
  local pct="$1" w=28 f e i
  [[ "${pct}" -lt 0 ]] && pct=0
  [[ "${pct}" -gt 100 ]] && pct=100
  f=$(( pct * w / 100 )); e=$(( w - f ))
  printf '  ['
  for ((i=0; i<f; i++)); do printf '#'; done
  for ((i=0; i<e; i++)); do printf '-'; done
  printf '] %3d%%\n' "${pct}"
}

echo "Measuring local upload size (one time)..."
TOTAL_B="$(du -sb "${OUT}" 2>/dev/null | awk '{print $1}')"
[[ -z "${TOTAL_B}" || "${TOTAL_B}" -le 0 ]] && { echo "ERROR: ${OUT} missing or empty"; exit 1; }
echo "Local total: $(human "${TOTAL_B}")"
echo "Starting monitor (Ctrl+C stops view only)..."
echo

START=$(date +%s)
REMOTE_B=0
PCT=0
LAST_R2=$(date +%s)
NEXT_R2=0

refresh_r2() {
  [[ -z "${R2_ENDPOINT:-}" ]] && return
  [[ -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" ]] && return
  local sum
  sum="$(
    s5cmd --endpoint-url "${R2_ENDPOINT}" du "s3://${R2_BUCKET}/${R2_PREFIX}/" 2>/dev/null \
      | awk 'NF>=2 && $2 ~ /^[0-9]+$/ {s+=$2} END {print s+0}'
  )"
  if [[ -n "${sum}" && "${sum}" -gt 0 ]]; then
    REMOTE_B="${sum}"
    PCT=$(( REMOTE_B * 100 / TOTAL_B ))
    [[ "${PCT}" -gt 100 ]] && PCT=100
  fi
  LAST_R2=$(date +%s)
}

refresh_r2

while true; do
  NOW=$(date +%s)
  ELAPSED=$(( NOW - START ))
  EM=$(( ELAPSED / 60 ))
  ES=$(( ELAPSED % 60 ))

  if pgrep -f '[s]5cmd' >/dev/null 2>&1; then
    STATUS="UPLOADING"
  elif [[ "${PCT}" -ge 99 ]]; then
    STATUS="DONE (R2 looks full)"
  else
    STATUS="STOPPED"
  fi

  NEXT_R2=$(( R2_SEC - (NOW - LAST_R2) ))
  [[ "${NEXT_R2}" -lt 0 ]] && NEXT_R2=0
  if [[ "${NEXT_R2}" -eq 0 ]]; then
    refresh_r2
    NEXT_R2=${R2_SEC}
  fi

  printf '\033[H\033[J'
  echo "=============================================="
  echo "  UPLOAD MONITOR"
  echo "=============================================="
  printf "Time:     %s UTC  (%dm %02ds elapsed)\n" "$(date -u +%H:%M:%S)" "${EM}" "${ES}"
  echo "Status:   ${STATUS}"
  echo
  echo "Local:    $(human "${TOTAL_B}")  (${OUT})"
  echo "R2:       $(human "${REMOTE_B}")  (s3://${R2_BUCKET}/${R2_PREFIX}/)"
  echo
  bar "${PCT}"
  echo
  echo "R2 refresh every ${R2_SEC}s (next in ${NEXT_R2}s)"
  echo "UI refresh every ${UI_SEC}s — Ctrl+C stops this view only"
  sleep "${UI_SEC}"
done
