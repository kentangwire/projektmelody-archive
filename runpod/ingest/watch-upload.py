#!/usr/bin/env python3
"""Live R2 upload monitor — run in a second terminal."""
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

OUT = os.path.join(os.environ.get("WORK_DIR", "/workspace"), "out")
PREFIX = os.environ.get(
    "R2_PREFIX", "streams/2026-06-01-projektmelody-2023-01-22-21-05-03"
)
BUCKET = os.environ.get("R2_BUCKET", "r2-videos")
ENDPOINT = os.environ.get("R2_ENDPOINT", "")
KEY = os.environ.get("R2_ACCESS_KEY_ID", "")
SECRET = os.environ.get("R2_SECRET_ACCESS_KEY", "")
UI_SEC = int(os.environ.get("REFRESH", "5"))
R2_SEC = int(os.environ.get("R2_REFRESH", "30"))


def human(n: int) -> str:
    for u in ("B", "KiB", "MiB", "GiB", "TiB"):
        if n < 1024 or u == "TiB":
            return f"{n:.1f} {u}" if u != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TiB"


def local_bytes() -> int:
    r = subprocess.run(["du", "-sb", OUT], capture_output=True, text=True, check=False)
    if r.returncode == 0 and r.stdout.split():
        return int(r.stdout.split()[0])
    return 0


def s5cmd_running() -> bool:
    try:
        r = subprocess.run(["pgrep", "-f", "[s]5cmd"], capture_output=True)
        return r.returncode == 0
    except FileNotFoundError:
        return False


def r2_bytes() -> int:
    if not ENDPOINT or not KEY or not SECRET:
        return 0
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = KEY
    env["AWS_SECRET_ACCESS_KEY"] = SECRET
    r = subprocess.run(
        ["s5cmd", "--endpoint-url", ENDPOINT, "du", f"s3://{BUCKET}/{PREFIX}/"],
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )
    total = 0
    for line in r.stdout.splitlines():
        parts = line.split()
        if not parts or "s3://" not in line:
            continue
        for i, p in enumerate(parts):
            if p.startswith("s3://") and i > 0:
                try:
                    total += int(parts[i - 1].replace("B", "").replace(",", ""))
                except ValueError:
                    pass
                break
    return total


def bar(pct: int) -> str:
    pct = max(0, min(100, pct))
    w = 28
    f = pct * w // 100
    return f"  [{'#' * f}{'-' * (w - f)}] {pct:3d}%"


def main() -> int:
    if not os.path.isfile(os.path.join(OUT, "master.m3u8")):
        print(f"ERROR: {OUT}/master.m3u8 missing", file=sys.stderr)
        return 1

    print("Measuring local size (one time)...", flush=True)
    total = local_bytes()
    if total <= 0:
        print(f"ERROR: {OUT} empty", file=sys.stderr)
        return 1
    print(f"Local total: {human(total)}\nMonitor running — Ctrl+C stops view only.\n", flush=True)

    start = time.time()
    remote = 0
    pct = 0
    last_r2 = 0.0

    while True:
        now = time.time()
        elapsed = int(now - start)
        em, es = divmod(elapsed, 60)

        if now - last_r2 >= R2_SEC:
            print("Checking R2 size...", flush=True)
            try:
                remote = r2_bytes()
                pct = min(100, remote * 100 // total) if total else 0
            except subprocess.TimeoutExpired:
                print("(R2 check timed out — will retry)", flush=True)
            last_r2 = now

        if s5cmd_running():
            status = "UPLOADING"
        elif pct >= 99:
            status = "DONE"
        else:
            status = "STOPPED"

        next_r2 = max(0, int(R2_SEC - (now - last_r2)))
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")

        lines = [
            "==============================================",
            "  UPLOAD MONITOR",
            "==============================================",
            f"Time:     {ts} UTC  ({em}m {es:02d}s elapsed)",
            f"Status:   {status}",
            "",
            f"Local:    {human(total)}",
            f"R2:       {human(remote)}",
            f"Target:   s3://{BUCKET}/{PREFIX}/",
            "",
            bar(pct),
            "",
            f"R2 check every {R2_SEC}s (next in {next_r2}s)",
            "Ctrl+C stops this view only — upload keeps running",
        ]
        if shutil.get_terminal_size(fallback=(100, 24)).columns >= 40:
            sys.stdout.write("\033[H\033[J")
        print("\n".join(lines), flush=True)
        time.sleep(UI_SEC)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nMonitor stopped.")
        raise SystemExit(0)
