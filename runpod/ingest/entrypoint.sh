#!/usr/bin/env bash
set -euo pipefail

ts() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[$(ts)] $*" >&2
}

req() {
  local v="${1}"
  if [[ -z "${!v:-}" ]]; then
    log "missing env: ${v}"
    exit 2
  fi
}

sanitize_url() {
  # Web Terminal paste often injects CR/LF into the URL and breaks curl (exit 3).
  printf '%s' "${1}" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

resolve_ffmpeg_bins() {
  if [[ -n "${FFMPEG_BIN:-}" && -x "${FFMPEG_BIN}" ]]; then
    FFPROBE_BIN="${FFPROBE_BIN:-$(dirname "${FFMPEG_BIN}")/ffprobe}"
    export FFMPEG_BIN FFPROBE_BIN
    return 0
  fi

  local cand probe
  cand="$(find /opt/jellyfin-ffmpeg -name ffmpeg -type f 2>/dev/null | head -1 || true)"
  if [[ -z "${cand}" && -x /usr/local/bin/ffmpeg ]]; then
    cand="/usr/local/bin/ffmpeg"
  fi
  if [[ -z "${cand}" && -x /opt/jellyfin-ffmpeg/ffmpeg ]]; then
    cand="/opt/jellyfin-ffmpeg/ffmpeg"
  fi
  if [[ -n "${cand}" && -x "${cand}" ]]; then
    FFMPEG_BIN="${cand}"
    probe="$(dirname "${cand}")/ffprobe"
    if [[ ! -x "${probe}" ]]; then
      probe="$(find /opt/jellyfin-ffmpeg -name ffprobe -type f 2>/dev/null | head -1 || true)"
    fi
    FFPROBE_BIN="${probe:-ffprobe}"
    export FFMPEG_BIN FFPROBE_BIN
    return 0
  fi

  FFMPEG_BIN=ffmpeg
  FFPROBE_BIN=ffprobe
  export FFMPEG_BIN FFPROBE_BIN
}

NVENC_FIX_SO="${NVENC_FIX_SO:-/opt/libnvenc_fix.so}"

run_nvenc_ffmpeg() {
  if [[ -n "${NVENC_FIX_SO:-}" && -f "${NVENC_FIX_SO}" ]]; then
    LD_PRELOAD="${NVENC_FIX_SO}${LD_PRELOAD:+:${LD_PRELOAD}}" "${FFMPEG_BIN}" "$@"
  else
    "${FFMPEG_BIN}" "$@"
  fi
}

MODE="${MODE:-run}"
WORK_DIR="${WORK_DIR:-/work}"
TOR_DIR="${WORK_DIR}/torrents"
OUT_DIR="${WORK_DIR}/out"
DL_DIR="${WORK_DIR}/downloads"
QBT_PROFILE="${WORK_DIR}/qbt-profile"
QBT_PORT="${QBT_PORT:-8080}"

QBT_TAIL_PID=""

on_exit() {
  local code=$?
  set +e
  if [[ -n "${QBT_TAIL_PID:-}" ]]; then
    kill "${QBT_TAIL_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${code}" != "0" ]]; then
    log "exit code=${code}"
  else
    log "done"
  fi
  if [[ "${CLEANUP_ON_FAIL:-0}" == "1" ]] && [[ "${code}" != "0" ]]; then
    cleanup
  fi
}

slugify() {
  python3 - "$1" <<'PY'
import re,sys
s=sys.argv[1].strip().lower()
s=s.replace("_","-").replace(" ","-")
s=re.sub(r"[^a-z0-9-]+","",s)
s=re.sub(r"-{2,}","-",s).strip("-")
print(s)
PY
}

wait_for_qbt_creds() {
  local log="${1}"
  local i=0
  while [[ $i -lt 120 ]]; do
    if (( i % 10 == 0 )); then
      log "waiting for qbittorrent WebUI creds..."
    fi
    if [[ -f "${log}" ]]; then
      local creds
      creds="$(python3 - "${log}" <<'PY'
import re,sys
try:
  txt=open(sys.argv[1],"r",encoding="utf-8",errors="ignore").read()
except:
  txt=""
user=""
pw=""
m=re.search(r"The WebUI administrator username is:\\s*([^\\s]+)", txt)
if m:
  user=m.group(1)
m=re.search(r"temporary password[^:]*:\\s*([A-Za-z0-9]+)", txt, flags=re.IGNORECASE)
if m:
  pw=m.group(1)
if not pw:
  m=re.search(r"WebUI:.*Password:\\s*([A-Za-z0-9]+)", txt)
  if m:
    pw=m.group(1)
if not user:
  m=re.search(r"WebUI:.*Username:\\s*([^\\s]+)", txt)
  if m:
    user=m.group(1)
if user and pw:
  print(f"{user}\\t{pw}")
PY
)"
      if [[ -n "${creds}" ]]; then
        echo "${creds}"
        return 0
      fi
    fi
    sleep 1
    i=$((i+1))
  done
  return 1
}

qbt_api() {
  local method="${1}"
  local path="${2}"
  shift 2
  curl -fsS -X "${method}" "http://127.0.0.1:${QBT_PORT}${path}" -b "${WORK_DIR}/qbt.cookies" "$@"
}

qbt_login() {
  local user="${1}"
  local pw="${2}"
  local resp
  resp="$(curl -sS -c "${WORK_DIR}/qbt.cookies" -X POST "http://127.0.0.1:${QBT_PORT}/api/v2/auth/login" \
    --data-urlencode "username=${user}" \
    --data-urlencode "password=${pw}" || true)"
  [[ "${resp}" == "Ok." ]]
}

qbt_start() {
  local log="${WORK_DIR}/qbittorrent.log"
  rm -f "${log}"
  log "starting qbittorrent-nox..."
  qbittorrent-nox \
    --profile="${QBT_PROFILE}" \
    --webui-port="${QBT_PORT}" \
    --save-path="${TOR_DIR}" \
    >"${log}" 2>&1 &
  echo $! > "${WORK_DIR}/qbittorrent.pid"
  log "qbittorrent pid=$(cat "${WORK_DIR}/qbittorrent.pid")"
  if [[ "${QBT_TAIL_STDOUT:-1}" == "1" ]]; then
    (
      while [[ ! -f "${log}" ]]; do sleep 0.2; done
      tail -n 200 -F "${log}"
    ) &
    QBT_TAIL_PID=$!
  fi
  local user="admin"
  local pw="adminadmin"
  local creds
  if creds="$(wait_for_qbt_creds "${log}")"; then
    user="${creds%%$'\t'*}"
    pw="${creds#*$'\t'}"
  fi
  local i=0
  while [[ $i -lt 60 ]]; do
    if (( i % 5 == 0 )); then
      log "waiting for qbt login (${i}/60)..."
    fi
    if qbt_login "${user}" "${pw}"; then
      log "qbt login ok user=${user}"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  i=0
  while [[ $i -lt 60 ]]; do
    if (( i % 5 == 0 )); then
      log "waiting for qbt login fallback (${i}/60)..."
    fi
    if qbt_login "admin" "adminadmin"; then
      log "qbt login ok user=admin"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  log "failed to login qbittorrent webui"
  if [[ -f "${log}" ]]; then
    tail -n 200 "${log}" || true
  fi
  exit 3
}

qbt_add_magnet() {
  local magnet="${1}"
  qbt_api POST "/api/v2/torrents/add" \
    --data-urlencode "urls=${magnet}" \
    --data-urlencode "savepath=${TOR_DIR}" \
    --data-urlencode "sequentialDownload=false" >/dev/null
}

qbt_first_hash() {
  python3 - <<'PY'
import json,sys,subprocess,os
port=os.environ.get("QBT_PORT","8080")
cookies=os.environ.get("WORK_DIR","/work")+"/qbt.cookies"
out=subprocess.check_output(["curl","-fsS","-b",cookies,f"http://127.0.0.1:{port}/api/v2/torrents/info"]).decode()
data=json.loads(out)
print((data[0]["hash"] if data else ""))
PY
}

qbt_wait_for_hash() {
  local i=0
  while [[ $i -lt 120 ]]; do
    if (( i % 5 == 0 )); then
      log "waiting for torrent to appear in qbittorrent (${i}/120)..."
    fi
    local h
    h="$(qbt_first_hash || true)"
    if [[ -n "${h}" ]]; then
      log "torrent hash=${h}"
      echo "${h}"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  log "torrent not visible in qbittorrent"
  exit 4
}

qbt_files_json() {
  local hash="${1}"
  qbt_api GET "/api/v2/torrents/files?hash=${hash}"
}

qbt_select_file() {
  local hash="${1}"
  local select_path="${2}"
  local files
  files="$(qbt_files_json "${hash}")"

  local all_ids sel_ids
  all_ids="$(python3 - "${files}" <<'PY'
import json,sys
data=json.loads(sys.argv[1] or "[]")
ids=[str(x.get("id")) for x in data if "id" in x]
print("|".join(ids))
PY
)"
  sel_ids="$(python3 - "${files}" "${select_path}" <<'PY'
import json,sys
data=json.loads(sys.argv[1] or "[]")
select=sys.argv[2]
ids=[str(x.get("id")) for x in data if x.get("name")==select]
print("|".join(ids))
PY
)"
  if [[ -z "${sel_ids}" ]]; then
    echo "SELECT_PATH not found in torrent file list" >&2
    echo "${files}" >&2
    exit 5
  fi

  if [[ -n "${all_ids}" ]]; then
    qbt_api POST "/api/v2/torrents/filePrio" \
      --data-urlencode "hash=${hash}" \
      --data-urlencode "id=${all_ids}" \
      --data-urlencode "priority=0" >/dev/null || true
  fi

  qbt_api POST "/api/v2/torrents/filePrio" \
    --data-urlencode "hash=${hash}" \
    --data-urlencode "id=${sel_ids}" \
    --data-urlencode "priority=1" >/dev/null
}

qbt_wait_complete() {
  local hash="${1}"
  local i=0
  while [[ $i -lt 43200 ]]; do
    local info
    info="$(qbt_api GET "/api/v2/torrents/info?hashes=${hash}")"
    if (( i % 30 == 0 )); then
      python3 - <<'PY' <<<"${info}" || true
import json,sys
data=json.loads(sys.stdin.read() or "[]")
if not data:
  print("[progress] missing torrent info")
  raise SystemExit(0)
t=data[0]
name=t.get("name","")
prog=float(t.get("progress",0))
state=str(t.get("state",""))
dls=float(t.get("dlspeed",0))
ups=float(t.get("upspeed",0))
print(f"[progress] {prog*100:.1f}% state={state} dl={dls/1024/1024:.2f}MB/s up={ups/1024/1024:.2f}MB/s name={name}")
PY
    fi
    local done
    done="$(python3 - <<PY
import json,sys
data=json.loads(sys.stdin.read() or "[]")
if not data:
  print("0"); sys.exit(0)
t=data[0]
prog=float(t.get("progress",0))
state=str(t.get("state",""))
print("1" if prog>=0.999 and state not in ("error","missingFiles") else "0")
PY
<<<"${info}")"
    if [[ "${done}" == "1" ]]; then
      log "download complete"
      return 0
    fi
    sleep 5
    i=$((i+5))
  done
  log "torrent download timeout"
  exit 6
}

ffmpeg_require_nvenc() {
  resolve_ffmpeg_bins
  log "ffmpeg bin=${FFMPEG_BIN}"
  log "ffmpeg version=$("${FFMPEG_BIN}" -hide_banner -version 2>&1 | head -1 || echo unknown)"

  if run_nvenc_ffmpeg -hide_banner -f lavfi -i testsrc=size=1280x720:rate=30 -t 1 \
      -c:v h264_nvenc -f null - >/dev/null 2>&1; then
    return 0
  fi

  echo "NVENC unavailable (runtime encode probe failed)" >&2
  "${FFMPEG_BIN}" -hide_banner -encoders 2>&1 | grep -i nvenc >&2 || true
  if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi -L >&2 || true
  else
    echo "hint: deploy an NVIDIA GPU pod (not CPU)" >&2
  fi
  if ! ldconfig -p 2>/dev/null | grep -q nvidia-encode; then
    echo "hint: set NVIDIA_DRIVER_CAPABILITIES=compute,video,utility on the pod, then restart" >&2
  else
    echo "hint: pull latest ingest image (libnvenc_fix for multi-GPU RunPod hosts)" >&2
  fi
  exit 7
}

probe_duration() {
  resolve_ffmpeg_bins
  local f="${1}"
  local dur
  dur="$("${FFPROBE_BIN}" -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "${f}" || true)"
  python3 - <<PY
import math,sys
try:
  d=float("${dur}")
except:
  d=0.0
print(str(int(math.floor(d+0.5))))
PY
}

probe_height() {
  resolve_ffmpeg_bins
  local f="${1}"
  local h
  h="$("${FFPROBE_BIN}" -v error -select_streams v:0 -show_entries stream=height -of csv=p=0:s=x "${f}" 2>/dev/null || true)"
  if [[ -z "${h}" ]]; then
    echo "0"
  else
    echo "${h}"
  fi
}

url_ext_from_path() {
  python3 - "$1" <<'PY'
import os, sys, urllib.parse
path = urllib.parse.urlparse(sys.argv[1]).path
ext = os.path.splitext(path)[1].lower()
if ext in (".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"):
  print(ext)
else:
  print(".mp4")
PY
}

title_from_url() {
  python3 - "$1" <<'PY'
import os, sys, urllib.parse
path = urllib.parse.urlparse(sys.argv[1]).path
base = os.path.basename(path)
base = urllib.parse.unquote(base)
name, _ = os.path.splitext(base)
name = name.strip()
print(name if name else "stream")
PY
}

title_from_path() {
  python3 - "$1" <<'PY'
import os, sys
base = os.path.basename(sys.argv[1])
name, _ = os.path.splitext(base)
name = name.strip()
print(name if name else "stream")
PY
}

ensure_title_from_url() {
  if [[ -z "${TITLE:-}" ]]; then
    TITLE="$(title_from_url "${URL}")"
    export TITLE
    log "title from filename: ${TITLE}"
  fi
}

ensure_title_from_path() {
  if [[ -z "${TITLE:-}" ]]; then
    TITLE="$(title_from_path "${1}")"
    export TITLE
    log "title from filename: ${TITLE}"
  fi
}

download_url() {
  req URL
  URL="$(sanitize_url "${URL}")"
  export URL
  mkdir -p "${DL_DIR}"
  local ext dest
  ext="$(url_ext_from_path "${URL}")"
  dest="${DL_DIR}/source${ext}"
  log "downloading URL=${URL} -> ${dest}"
  curl -fL --retry 5 --retry-delay 5 -C - -o "${dest}" "${URL}"
  echo "${dest}"
}

encode_hls_dual() {
  local input="${1}"
  local out="${2}"
  rm -rf "${out}"
  mkdir -p "${out}"
  ffmpeg_require_nvenc

  run_nvenc_ffmpeg -y -hide_banner -loglevel error -i "${input}" \
    -filter_complex "[0:v]split=2[v0][v1];[v0]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080];[v1]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720]" \
    -map "[v1080]" -map 0:a:0 \
    -c:v:0 h264_nvenc -preset p4 -profile:v:0 high -b:v:0 6000k -maxrate:v:0 6600k -bufsize:v:0 12000k -g 120 -keyint_min 120 \
    -force_key_frames "expr:gte(t,n_forced*4)" \
    -c:a:0 aac -b:a:0 160k -ac:a:0 2 \
    -map "[v720]" -map 0:a:0 \
    -c:v:1 h264_nvenc -preset p4 -profile:v:1 high -b:v:1 3200k -maxrate:v:1 3520k -bufsize:v:1 6400k -g 120 -keyint_min 120 \
    -force_key_frames "expr:gte(t,n_forced*4)" \
    -c:a:1 aac -b:a:1 160k -ac:a:1 2 \
    -f hls \
    -hls_time 4 \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_filename "${out}/%v/seg-%05d.ts" \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p" \
    "${out}/%v/index.m3u8"
}

encode_hls_720_only() {
  local input="${1}"
  local out="${2}"
  rm -rf "${out}"
  mkdir -p "${out}"
  ffmpeg_require_nvenc

  run_nvenc_ffmpeg -y -hide_banner -loglevel error -i "${input}" \
    -filter_complex "[0:v]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720]" \
    -map "[v720]" -map 0:a:0 \
    -c:v:0 h264_nvenc -preset p4 -profile:v:0 high -b:v:0 3200k -maxrate:v:0 3520k -bufsize:v:0 6400k -g 120 -keyint_min 120 \
    -force_key_frames "expr:gte(t,n_forced*4)" \
    -c:a:0 aac -b:a:0 160k -ac:a:0 2 \
    -f hls \
    -hls_time 4 \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_filename "${out}/%v/seg-%05d.ts" \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,a:0,name:720p" \
    "${out}/%v/index.m3u8"
}

encode_hls_adaptive() {
  local input="${1}"
  local out="${2}"
  local height
  height="$(probe_height "${input}")"
  log "source height=${height}px"
  if [[ "${height}" -ge 1080 ]]; then
    encode_hls_dual "${input}" "${out}"
    export LADDER_VARIANTS="1080,720"
  else
    encode_hls_720_only "${input}" "${out}"
    export LADDER_VARIANTS="720"
  fi
}

make_thumb() {
  resolve_ffmpeg_bins
  local input="${1}"
  local out="${2}"
  "${FFMPEG_BIN}" -y -hide_banner -loglevel error -ss 300 -i "${input}" -frames:v 1 -q:v 2 "${out}/thumb.jpg" || true
}

s5cmd_base() {
  req R2_ENDPOINT
  req R2_ACCESS_KEY_ID
  req R2_SECRET_ACCESS_KEY
  export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
  export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
  export AWS_REGION="${AWS_REGION:-auto}"
  echo "--endpoint-url" "${R2_ENDPOINT}"
}

r2_exists() {
  local key="${1}"
  local bucket="${R2_BUCKET:-r2-videos}"
  if s5cmd "$(s5cmd_base)" ls "s3://${bucket}/${key}" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

upload_and_verify() {
  req R2_PREFIX
  local bucket="${R2_BUCKET:-r2-videos}"
  local prefix="${R2_PREFIX}"

  if [[ "${FORCE:-0}" != "1" ]] && r2_exists "${prefix}/master.m3u8"; then
    log "destination already exists in R2 (set FORCE=1 to overwrite): ${prefix}"
    exit 8
  fi

  log "uploading to r2 bucket=${bucket} prefix=${prefix}"
  s5cmd "$(s5cmd_base)" sync "${OUT_DIR}/" "s3://${bucket}/${prefix}/"

  r2_exists "${prefix}/master.m3u8" || { echo "missing in r2: master.m3u8" >&2; exit 9; }

  verify_variant_tail() {
    local variant="${1}"
    r2_exists "${prefix}/${variant}/index.m3u8" || { echo "missing in r2: ${variant}/index.m3u8" >&2; exit 9; }
    local seg
    seg="$(grep -Eo 'seg-[0-9]{5}\.ts' "${OUT_DIR}/${variant}/index.m3u8" | tail -n 1)"
    [[ -n "${seg}" ]] || { echo "could not parse ${variant} last segment" >&2; exit 9; }
    r2_exists "${prefix}/${variant}/${seg}" || { echo "missing in r2: ${variant}/${seg}" >&2; exit 9; }
  }

  if [[ "${LADDER_VARIANTS:-}" == *"1080"* ]]; then
    verify_variant_tail "1080p"
  fi
  if [[ "${LADDER_VARIANTS:-}" == *"720"* ]]; then
    verify_variant_tail "720p"
  fi
}

create_pr() {
  req GITHUB_TOKEN
  req GITHUB_REPO
  req STREAM_ID
  req TITLE
  req DATE
  req DURATION
  req R2_PREFIX

  local hls_src="/videos/${R2_PREFIX}/master.m3u8"
  local thumb_src="/videos/${R2_PREFIX}/thumb.jpg"

  python3 /app/github_pr.py \
    --repo "${GITHUB_REPO}" \
    --token "${GITHUB_TOKEN}" \
    --stream-id "${STREAM_ID}" \
    --title "${TITLE}" \
    --date "${DATE}" \
    --duration "${DURATION}" \
    --hls-src "${hls_src}" \
    --thumb-src "${thumb_src}" \
    --pinned "true" \
    --tags "Stream" \
    --thumb-class "t2" \
    --monogram "PM"
}

cleanup() {
  rm -rf "${TOR_DIR}" "${OUT_DIR}" "${QBT_PROFILE}" "${DL_DIR}" || true
}

finish_ingest() {
  local input_file="${1}"
  DURATION="$(probe_duration "${input_file}")"
  export DURATION

  log "thumbnail..."
  make_thumb "${input_file}" "${OUT_DIR}"

  log "upload+verify..."
  upload_and_verify
  log "creating pr..."
  create_pr
  log "cleanup..."
  cleanup
}

main_url() {
  req URL
  req DATE

  URL="$(sanitize_url "${URL}")"
  export URL

  mkdir -p "${DL_DIR}" "${OUT_DIR}"
  log "boot source=URL WORK_DIR=${WORK_DIR}"

  ensure_title_from_url

  STREAM_SLUG="$(slugify "${TITLE}")"
  STREAM_ID="${DATE}-${STREAM_SLUG}"
  export STREAM_ID
  export R2_PREFIX="streams/${STREAM_ID}"

  INPUT_FILE="$(download_url)"
  if [[ ! -f "${INPUT_FILE}" ]]; then
    log "download failed: ${INPUT_FILE}"
    exit 10
  fi
  resolve_ffmpeg_bins
  log "download size=$(stat -c%s "${INPUT_FILE}" 2>/dev/null || echo 0) bytes ffprobe=${FFPROBE_BIN}"

  log "encoding hls (adaptive)..."
  encode_hls_adaptive "${INPUT_FILE}" "${OUT_DIR}"
  finish_ingest "${INPUT_FILE}"
}

main_magnet() {
  req MAGNET

  mkdir -p "${TOR_DIR}" "${OUT_DIR}" "${QBT_PROFILE}"
  log "boot MODE=${MODE} WORK_DIR=${WORK_DIR} QBT_PORT=${QBT_PORT}"

  qbt_start
  log "adding magnet..."
  qbt_add_magnet "${MAGNET}"
  HASH="$(qbt_wait_for_hash)"
  export HASH

  if [[ "${MODE}" == "list" ]]; then
    log "listing files..."
    qbt_files_json "${HASH}" | jq -r '.[] | "\(.size)\t\(.name)"'
    exit 0
  fi

  if [[ "${MODE}" != "run" ]]; then
    log "invalid MODE: ${MODE}"
    exit 2
  fi

  req DATE

  req SELECT_PATH
  ensure_title_from_path "${SELECT_PATH}"
  STREAM_SLUG="$(slugify "${TITLE}")"
  STREAM_ID="${DATE}-${STREAM_SLUG}"
  export STREAM_ID
  export R2_PREFIX="streams/${STREAM_ID}"

  log "selecting file SELECT_PATH=${SELECT_PATH}"
  qbt_select_file "${HASH}" "${SELECT_PATH}"
  log "downloading..."
  qbt_wait_complete "${HASH}"

  INPUT_FILE="${TOR_DIR}/${SELECT_PATH}"
  if [[ ! -f "${INPUT_FILE}" ]]; then
    log "selected file not found on disk: ${INPUT_FILE}"
    exit 10
  fi

  log "encoding hls..."
  encode_hls_dual "${INPUT_FILE}" "${OUT_DIR}"
  export LADDER_VARIANTS="1080,720"
  finish_ingest "${INPUT_FILE}"
}

trap on_exit EXIT

if [[ -n "${URL:-}" ]]; then
  main_url
elif [[ -n "${MAGNET:-}" ]]; then
  main_magnet
elif [[ "${IDLE:-1}" == "1" ]]; then
  log "idle — no URL or MAGNET (persistent pod mode)"
  log "run ingest: /app/run-url.sh \"https://example.com/video.mp4\" [YYYY-MM-DD]"
  exec sleep infinity
else
  log "missing URL or MAGNET (set IDLE=1 to keep pod running)"
  exit 2
fi
