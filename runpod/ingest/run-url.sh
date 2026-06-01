#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <URL> [DATE]" >&2
  echo "Example: $0 \"https://cdn.example.com/my-stream.mp4\" \"2026-06-02\"" >&2
  echo "Title is derived from the URL filename. DATE defaults to today (UTC)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.ingest}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export URL="$1"
export DATE="${2:-$(date -u +%Y-%m-%d)}"
unset TITLE
export MODE=run

exec /app/entrypoint.sh
