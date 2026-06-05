#!/usr/bin/env python3
import argparse
import base64
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

import requests


def api_headers(token: str) -> Dict[str, str]:
  return {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "projektmelody-runpod-ingest"
  }


def parse_repo(repo: str) -> Tuple[str, str]:
  raw = repo.strip()
  raw = raw.replace("https://github.com/", "").replace("http://github.com/", "")
  parts = [p for p in raw.split("/") if p]
  if len(parts) != 2:
    raise ValueError("GITHUB_REPO must be owner/repo or a github.com URL")
  return parts[0], parts[1]


def get_json(session: requests.Session, url: str) -> Any:
  r = session.get(url, timeout=30)
  r.raise_for_status()
  return r.json()


def put_json(session: requests.Session, url: str, payload: Any) -> Any:
  r = session.put(url, json=payload, timeout=60)
  r.raise_for_status()
  return r.json()


def post_json(session: requests.Session, url: str, payload: Any) -> Any:
  r = session.post(url, json=payload, timeout=60)
  r.raise_for_status()
  return r.json()


def decode_content(b64: str) -> str:
  return base64.b64decode(b64.encode("utf-8")).decode("utf-8")


def encode_content(txt: str) -> str:
  return base64.b64encode(txt.encode("utf-8")).decode("utf-8")


def normalize_catalog(existing: Any) -> List[Dict[str, Any]]:
  if isinstance(existing, list):
    out = []
    for x in existing:
      if isinstance(x, dict):
        out.append(x)
    return out
  raise ValueError("videos.json must be a JSON array")


def upsert_entry(arr: List[Dict[str, Any]], entry: Dict[str, Any]) -> List[Dict[str, Any]]:
  vid = str(entry.get("id") or "")
  rest = [x for x in arr if str(x.get("id") or "") != vid]
  return [entry] + rest


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument("--repo", required=True)
  ap.add_argument("--token", required=True)
  ap.add_argument("--stream-id", required=True)
  ap.add_argument("--title", required=True)
  ap.add_argument("--date", required=True)
  ap.add_argument("--duration", required=True)
  ap.add_argument("--hls-src", required=True)
  ap.add_argument("--thumb-src", default="", help="Optional static thumb; site auto-generates from middle HLS segment when omitted")
  ap.add_argument("--pinned", required=True)
  ap.add_argument("--tags", required=True)
  ap.add_argument("--thumb-class", required=True)
  ap.add_argument("--monogram", required=True)
  ap.add_argument("--cc-src", default="", help="Optional WebVTT path, e.g. /videos/streams/.../nsfw.vtt")
  args = ap.parse_args()

  owner, name = parse_repo(args.repo)
  token = args.token

  session = requests.Session()
  session.headers.update(api_headers(token))

  repo_url = f"https://api.github.com/repos/{owner}/{name}"
  repo_info = get_json(session, repo_url)
  default_branch = str(repo_info.get("default_branch") or "main")

  base_ref = get_json(session, f"{repo_url}/git/ref/heads/{default_branch}")
  base_sha = str(base_ref["object"]["sha"])

  branch_name = f"ingest/{args.stream_id}"
  ref_name = f"refs/heads/{branch_name}"
  try:
    post_json(session, f"{repo_url}/git/refs", {"ref": ref_name, "sha": base_sha})
  except requests.HTTPError as e:
    if e.response is None or e.response.status_code != 422:
      raise
    put_json(
      session,
      f"{repo_url}/git/refs/heads/{branch_name}",
      {"sha": base_sha, "force": True}
    )

  try:
    duration = int(float(args.duration))
  except Exception:
    duration = 0

  pinned = str(args.pinned).lower() == "true"
  tags = [t.strip() for t in str(args.tags).split(",") if t.strip()]

  entry: Dict[str, Any] = {
    "id": args.stream_id,
    "title": args.title,
    "date": args.date,
    "duration": duration,
    "views": 0,
    "tags": tags,
    "pinned": pinned,
    "ready": True,
    "thumbClass": args.thumb_class,
    "monogram": args.monogram,
    "hlsSrc": args.hls_src
  }
  thumb_src = str(args.thumb_src or "").strip()
  if thumb_src:
    entry["thumbSrc"] = thumb_src
  cc_src = str(args.cc_src or "").strip()
  if cc_src:
    entry["ccSrc"] = cc_src
  paths = ["public/catalog-source.json", "videos.json"]
  for p in paths:
    content_url = f"{repo_url}/contents/{p}"
    cur = get_json(session, f"{content_url}?ref={default_branch}")
    sha = str(cur.get("sha") or "")
    text = decode_content(str(cur.get("content") or ""))
    arr = normalize_catalog(json.loads(text))
    nxt = upsert_entry(arr, entry)
    out_txt = json.dumps(nxt, indent=2, ensure_ascii=False) + "\n"
    put_json(
      session,
      content_url,
      {
        "message": f"Add stream {args.date}: {args.title}",
        "content": encode_content(out_txt),
        "sha": sha,
        "branch": branch_name
      }
    )

  pr = post_json(
    session,
    f"{repo_url}/pulls",
    {
      "title": f"Add stream {args.date}: {args.title}",
      "head": branch_name,
      "base": default_branch,
      "body": "\n".join(
        [
          f"stream-id: {args.stream_id}",
          f"hls: {args.hls_src}",
          f"thumb: {thumb_src or '(auto from middle HLS segment)'}",
          f"cc: {cc_src or '(none)'}",
          "ladder: 1080p + 720p",
          "segments: 4s",
          "uploader: s5cmd (R2 S3)"
        ]
      )
    }
  )

  print(pr.get("html_url") or "")


if __name__ == "__main__":
  main()

