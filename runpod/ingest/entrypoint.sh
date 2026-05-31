#!/usr/bin/env bash
set -euo pipefail

req() {
  local v="${1}"
  if [[ -z "${!v:-}" ]]; then
    echo "missing env: ${v}" >&2
    exit 2
  fi
}

MODE="${MODE:-run}"
WORK_DIR="${WORK_DIR:-/work}"
TOR_DIR="${WORK_DIR}/torrents"
OUT_DIR="${WORK_DIR}/out"
QBT_PROFILE="${WORK_DIR}/qbt-profile"
QBT_PORT="${QBT_PORT:-8080}"

mkdir -p "${TOR_DIR}" "${OUT_DIR}" "${QBT_PROFILE}"

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
  qbittorrent-nox \
    --profile="${QBT_PROFILE}" \
    --webui-port="${QBT_PORT}" \
    --save-path="${TOR_DIR}" \
    >"${log}" 2>&1 &
  echo $! > "${WORK_DIR}/qbittorrent.pid"
  local user="admin"
  local pw="adminadmin"
  local creds
  if creds="$(wait_for_qbt_creds "${log}")"; then
    user="${creds%%$'\t'*}"
    pw="${creds#*$'\t'}"
  fi
  local i=0
  while [[ $i -lt 60 ]]; do
    if qbt_login "${user}" "${pw}"; then
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  i=0
  while [[ $i -lt 60 ]]; do
    if qbt_login "admin" "adminadmin"; then
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  echo "failed to login qbittorrent webui" >&2
  if [[ -f "${log}" ]]; then
    tail -n 200 "${log}" >&2 || true
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
    local h
    h="$(qbt_first_hash || true)"
    if [[ -n "${h}" ]]; then
      echo "${h}"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  echo "torrent not visible in qbittorrent" >&2
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
      return 0
    fi
    sleep 5
    i=$((i+5))
  done
  echo "torrent download timeout" >&2
  exit 6
}

ffmpeg_require_nvenc() {
  if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -q "h264_nvenc"; then
    echo "ffmpeg missing h264_nvenc encoder (NVENC unavailable)" >&2
    exit 7
  fi
}

probe_duration() {
  local f="${1}"
  local dur
  dur="$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "${f}" || true)"
  python3 - <<PY
import math,sys
try:
  d=float("${dur}")
except:
  d=0.0
print(str(int(math.floor(d+0.5))))
PY
}

encode_hls() {
  local input="${1}"
  local out="${2}"
  rm -rf "${out}"
  mkdir -p "${out}"
  ffmpeg_require_nvenc

  ffmpeg -y -hide_banner -loglevel error -i "${input}" \
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

make_thumb() {
  local input="${1}"
  local out="${2}"
  ffmpeg -y -hide_banner -loglevel error -ss 300 -i "${input}" -frames:v 1 -q:v 2 "${out}/thumb.jpg" || true
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
    echo "destination already exists in R2 (set FORCE=1 to overwrite): ${prefix}" >&2
    exit 8
  fi

  s5cmd "$(s5cmd_base)" sync "${OUT_DIR}/" "s3://${bucket}/${prefix}/"

  r2_exists "${prefix}/master.m3u8" || { echo "missing in r2: master.m3u8" >&2; exit 9; }
  r2_exists "${prefix}/1080p/index.m3u8" || { echo "missing in r2: 1080p/index.m3u8" >&2; exit 9; }
  r2_exists "${prefix}/720p/index.m3u8" || { echo "missing in r2: 720p/index.m3u8" >&2; exit 9; }

  local seg1080 seg720
  seg1080="$(grep -Eo 'seg-[0-9]{5}\.ts' "${OUT_DIR}/1080p/index.m3u8" | tail -n 1)"
  seg720="$(grep -Eo 'seg-[0-9]{5}\.ts' "${OUT_DIR}/720p/index.m3u8" | tail -n 1)"
  [[ -n "${seg1080}" ]] || { echo "could not parse 1080p last segment" >&2; exit 9; }
  [[ -n "${seg720}" ]] || { echo "could not parse 720p last segment" >&2; exit 9; }
  r2_exists "${prefix}/1080p/${seg1080}" || { echo "missing in r2: 1080p/${seg1080}" >&2; exit 9; }
  r2_exists "${prefix}/720p/${seg720}" || { echo "missing in r2: 720p/${seg720}" >&2; exit 9; }
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
  rm -rf "${TOR_DIR}" "${OUT_DIR}" "${QBT_PROFILE}" || true
}

main() {
  req MAGNET
  req TITLE
  req DATE

  STREAM_SLUG="$(slugify "${TITLE}")"
  STREAM_ID="${DATE}-${STREAM_SLUG}"
  export STREAM_ID
  export R2_PREFIX="streams/${STREAM_ID}"

  qbt_start
  qbt_add_magnet "${MAGNET}"
  HASH="$(qbt_wait_for_hash)"
  export HASH

  if [[ "${MODE}" == "list" ]]; then
    qbt_files_json "${HASH}" | jq -r '.[] | "\(.size)\t\(.name)"'
    exit 0
  fi

  if [[ "${MODE}" != "run" ]]; then
    echo "invalid MODE: ${MODE}" >&2
    exit 2
  fi

  req SELECT_PATH
  qbt_select_file "${HASH}" "${SELECT_PATH}"
  qbt_wait_complete "${HASH}"

  INPUT_FILE="${TOR_DIR}/${SELECT_PATH}"
  if [[ ! -f "${INPUT_FILE}" ]]; then
    echo "selected file not found on disk: ${INPUT_FILE}" >&2
    exit 10
  fi

  DURATION="$(probe_duration "${INPUT_FILE}")"
  export DURATION

  encode_hls "${INPUT_FILE}" "${OUT_DIR}"
  make_thumb "${INPUT_FILE}" "${OUT_DIR}"

  upload_and_verify
  create_pr
  cleanup
}

trap 'if [[ "${CLEANUP_ON_FAIL:-0}" == "1" ]]; then cleanup; fi' EXIT
main
