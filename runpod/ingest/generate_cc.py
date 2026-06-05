#!/usr/bin/env python3
"""Extract speech from video/audio and write WebVTT for NSFW closed captions."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile


def extract_audio(input_path: str, wav_path: str, ffmpeg: str) -> None:
    cmd = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        wav_path,
    ]
    subprocess.run(cmd, check=True)


def sec_to_vtt(t: float) -> str:
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def segments_to_vtt(segments) -> str:
    lines = ["WEBVTT", ""]
    for seg in segments:
        start = float(getattr(seg, "start", 0) or 0)
        end = float(getattr(seg, "end", 0) or 0)
        text = str(getattr(seg, "text", "") or "").strip()
        if not text or end <= start:
            continue
        lines.append(f"{sec_to_vtt(start)} --> {sec_to_vtt(end)}")
        lines.append(text)
        lines.append("")
    body = "\n".join(lines).strip()
    return (body + "\n") if body else "WEBVTT\n"


def pick_device(requested: str) -> tuple[str, str]:
    if requested in ("cuda", "cpu"):
        dev = requested
    else:
        dev = "cpu"
        try:
            import ctranslate2

            if ctranslate2.get_cuda_device_count() > 0:
                dev = "cuda"
        except Exception:
            pass
    compute = "float16" if dev == "cuda" else "int8"
    return dev, compute


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate WebVTT from speech in a media file")
    ap.add_argument("--input", required=True, help="Source video or audio file")
    ap.add_argument("--output", required=True, help="Output .vtt path (e.g. nsfw.vtt)")
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    ap.add_argument("--language", default=os.environ.get("WHISPER_LANGUAGE", "en"))
    ap.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_BIN", "ffmpeg"))
    ap.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "auto"))
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        print(f"input not found: {args.input}", file=sys.stderr)
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed in this image", file=sys.stderr)
        return 1

    device, compute_type = pick_device(args.device)
    lang = (args.language or "").strip() or None

    print(
        f"[cc] model={args.model} device={device} language={lang or 'auto'}",
        file=sys.stderr,
    )

    with tempfile.TemporaryDirectory(prefix="pm-cc-") as td:
        wav = os.path.join(td, "audio.wav")
        extract_audio(args.input, wav, args.ffmpeg)
        model = WhisperModel(args.model, device=device, compute_type=compute_type)
        segments_iter, _info = model.transcribe(
            wav,
            language=lang,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            beam_size=5,
        )
        vtt = segments_to_vtt(list(segments_iter))

    if vtt.strip() in ("WEBVTT", "WEBVTT\n"):
        print("[cc] no speech detected", file=sys.stderr)
        return 2

    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(vtt)
    print(f"[cc] wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
