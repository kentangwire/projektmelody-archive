#!/usr/bin/env python3
"""Live R2 upload monitor — pipe or run in a second terminal."""
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

UI_SEC = int(os.environ.get("REFRESH", "5"))
R2_SEC = int(os.environ.get("R2_REFRESH", "30"))

PREFIX = os.environ.get(
    "R2_PREFIX", "streams/2026-06-01-projektmelody-2023-01-22-21-05-03"
)
BUCKET = os.environ.get("R2_BUCKET", "r2-videos")
ENDPOINT = os.environ.get("R2_ENDPOINT", "")
KEY = os.environ.get("R2_ACCESS_KEY_ID", "")
SECRET = os.environ.get("R2_SECRET_ACCESS_KEY", "")


def find_out_dir() -> str:
    env_out = os.environ.get("OUT_DIR", "")
    if env_out and os.path.isfile(os.path.join(env_out, "master.m3u8")):
        return env_out
    for cand in (
        os.path.join(os.environ.get("WORK_DIR", "/workspace"), "out"),
        "/workspace/out",
        "/work/out",
    ):
        if os.path.isfile(os.path.join(cand, "master.m3u8")):
            return cand
    return os.path.join(os.environ.get("WORK_DIR", "/workspace"), "out")


OUT = find_out_dir()


def human(n: int) -> str:
    x = float(n)
    for u in ("B", "KiB", "MiB", "GiB", "TiB"):
        if x < 1024 or u == "TiB":
            return f"{int(x)} B" if u == "B" else f"{x:.1f} {u}"
        x /= 1024
    return f"{x:.1f} TiB"


def local_bytes() -> int:
    r = subprocess.run(["du", "-sb", OUT], capture_output=True, text=True, check=False)
    if r.returncode == 0 and r.stdout.split():
        return int(r.stdout.split()[0])
    return 0


def s5cmd_running() -> bool:
    r = subprocess.run(["pgrep", "-f", "[s]5cmd"], capture_output=True)
    return r.returncode == 0


def r2_bytes() -> int:
    if not ENDPOINT or not KEY or not SECRET:
        return -1
    env = os.environ.copy()
    env["AWS_ACCESS_KEY_ID"] = KEY
    env["AWS_SECRET_ACCESS_KEY"] = SECRET
    r = subprocess.run(
        ["s5cmd", "--endpoint-url", ENDPOINT, "du", f"s3://{BUCKET}/{PREFIX}/"],
        capture_output=True,
        text=True,
        env=env,
        timeout=180,
    )
    if r.returncode != 0:
        return -1
    total = 0
    for line in r.stdout.splitlines():
        parts = line.split()
        if "s3://" not in line:
            continue
        for i, p in enumerate(parts):
            if p.startswith("s3://") and i > 0:
                try:
                    total += int(parts[i - 1].replace("B", "").replace(",", ""))
                except ValueError:
                    pass
                break
    return total


def bar(pct: int, width: int = 32) -> str:
    pct = max(0, min(100, pct))
    filled = pct * width // 100
    return f"[{'#' * filled}{'-' * (width - filled)}] {pct:3d}%"


def fmt_eta(seconds: int) -> str:
    if seconds < 0 or seconds > 86400 * 7:
        return "calculating..."
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def main() -> int:
    master = os.path.join(OUT, "master.m3u8")
    if not os.path.isfile(master):
        print(f"ERROR: encode not found at {master}", file=sys.stderr)
        print("Use the same pod/volume where encode finished.", file=sys.stderr)
        return 1

    print(f"Local folder: {OUT}", flush=True)
    print("Measuring size (once)...", flush=True)
    total = local_bytes()
    if total <= 0:
        print(f"ERROR: {OUT} is empty", file=sys.stderr)
        return 1

    print(f"Upload target: s3://{BUCKET}/{PREFIX}/", flush=True)
    print(f"Local total:   {human(total)}", flush=True)
    if not ENDPOINT or not KEY or not SECRET:
        print("Note: R2 keys missing — will show UPLOADING only (no % bar).", flush=True)
    print("\nCtrl+C stops this view only.\n", flush=True)

    start = time.time()
    remote = 0
    last_remote = 0
    last_speed_t = start
    speed_bps = 0.0
    pct = 0
    last_r2 = 0.0
    r2_note = ""

    while True:
        now = time.time()
        elapsed = int(now - start)
        em, es = divmod(elapsed, 60)

        if now - last_r2 >= R2_SEC:
            r2_note = "Checking R2..."
            sys.stdout.write(r2_note + "\n")
            sys.stdout.flush()
            try:
                got = r2_bytes()
                if got >= 0:
                    if last_remote > 0 and got > last_remote:
                        dt = max(now - last_speed_t, 0.001)
                        speed_bps = (got - last_remote) / dt
                    last_remote = remote
                    remote = got
                    last_speed_t = now
                    pct = min(100, remote * 100 // total) if total else 0
                    r2_note = ""
                else:
                    r2_note = "(R2 check failed — retrying)"
            except subprocess.TimeoutExpired:
                r2_note = "(R2 check slow — retrying)"
            last_r2 = now

        uploading = s5cmd_running()
        if uploading:
            status = "UPLOADING"
        elif pct >= 99:
            status = "DONE"
        elif remote > 0:
            status = "PAUSED / FINISHING"
        else:
            status = "WAITING (start s5cmd in other terminal)"

        eta = "—"
        if speed_bps > 0 and remote < total:
            eta = fmt_eta(int((total - remote) / speed_bps))

        speed_mib = speed_bps / (1024 * 1024) if speed_bps > 0 else 0.0
        next_r2 = max(0, int(R2_SEC - (now - last_r2)))
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")

        print("==============================================")
        print("  UPLOAD MONITOR")
        print("==============================================")
        print(f"Time:      {ts} UTC   ({em}m {es:02d}s elapsed)")
        print(f"Status:    {status}")
        print()
        print(f"Local:     {human(total)}")
        if remote >= 0:
            print(f"Uploaded:  {human(remote)}")
            print(f"Progress:  {bar(pct)}")
            print(f"Speed:     {speed_mib:.1f} MiB/s (avg since last R2 check)")
            print(f"ETA:       {eta}")
        else:
            print("Uploaded:  (R2 size unknown — check keys)")
        print()
        print(f"Target:    s3://{BUCKET}/{PREFIX}/")
        if r2_note:
            print(f"Note:      {r2_note}")
        print(f"Next R2 check in {next_r2}s  |  UI every {UI_SEC}s")
        print("==============================================")
        print(flush=True)

        time.sleep(UI_SEC)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nMonitor stopped (upload unaffected).")
        raise SystemExit(0)
