#!/usr/bin/env python3
import argparse
import hashlib
import json
import mimetypes
import os
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple
from urllib.parse import urlparse

import requests

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"}
IMAGE_CT_PREFIX = "image/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download Heptabase images and rewrite data URLs to local paths")
    parser.add_argument("--whiteboard-id", required=True, help="Heptabase whiteboard ID")
    parser.add_argument("--api-base", default="https://heptabase-api-five.vercel.app", help="API base URL")
    parser.add_argument("--output-dir", required=True, help="Local directory to store downloaded images")
    parser.add_argument("--manifest", required=True, help="Path to output manifest JSON")
    parser.add_argument("--rewrite-output", required=True, help="Path to rewritten JSON output")
    parser.add_argument("--local-prefix", default="/heptabase-assets", help="Public URL prefix for local assets")
    return parser.parse_args()


def fetch_data(api_base: str, whiteboard_id: str) -> Dict[str, Any]:
    api_base = api_base.rstrip("/")
    url = f"{api_base}/?whiteboard_id={whiteboard_id}"
    resp = requests.get(url, timeout=90)
    resp.raise_for_status()
    data = resp.json()

    cards = data.get("data", {}).get("cards")
    if not isinstance(cards, list):
        raise ValueError("Invalid response format: data.cards is not an array")

    return data


def extract_urls_from_string(text: str) -> Set[str]:
    urls: Set[str] = set()

    md_matches = re.findall(r"!\[[^\]]*\]\((https?://[^\s)]+)\)", text)
    for u in md_matches:
        urls.add(u)

    direct_matches = re.findall(r"https?://[^\s\"'<>]+", text)
    for u in direct_matches:
        lower_u = u.lower()
        path = urlparse(u).path.lower()
        if any(ext in lower_u for ext in IMAGE_EXTS) or any(path.endswith(ext) for ext in IMAGE_EXTS):
            urls.add(u)

    return urls


def collect_image_urls(node: Any, urls: Set[str]) -> None:
    if isinstance(node, dict):
        node_type = node.get("type")
        attrs = node.get("attrs")

        if node_type == "image" and isinstance(attrs, dict):
            src = attrs.get("src")
            if isinstance(src, str) and src.startswith("http"):
                urls.add(src)

        for key in ("src", "url", "href"):
            value = node.get(key)
            if isinstance(value, str) and value.startswith("http"):
                path_lower = urlparse(value).path.lower()
                if any(path_lower.endswith(ext) for ext in IMAGE_EXTS):
                    urls.add(value)

        for value in node.values():
            collect_image_urls(value, urls)

    elif isinstance(node, list):
        for item in node:
            collect_image_urls(item, urls)

    elif isinstance(node, str):
        for u in extract_urls_from_string(node):
            urls.add(u)


def guess_ext(url: str, content_type: str) -> str:
    path_ext = Path(urlparse(url).path).suffix.lower()
    if path_ext in IMAGE_EXTS:
        return path_ext

    if content_type:
        mime = content_type.split(";")[0].strip().lower()
        ext = mimetypes.guess_extension(mime)
        if ext:
            return ".jpg" if ext == ".jpe" else ext

    return ".bin"


def download_image(url: str, output_dir: Path, session: requests.Session) -> Tuple[bool, str, int]:
    try:
        resp = session.get(url, timeout=90, stream=True)
        resp.raise_for_status()

        content_type = (resp.headers.get("Content-Type") or "").lower()
        if content_type and not content_type.startswith(IMAGE_CT_PREFIX):
            return False, "not_image", 0

        ext = guess_ext(url, content_type)
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
        filename = f"{digest}{ext}"
        target = output_dir / filename

        size = 0
        with target.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)
                    size += len(chunk)

        return True, filename, size
    except Exception:
        return False, "download_failed", 0


def replace_urls(node: Any, mapping: Dict[str, str]) -> Any:
    if isinstance(node, dict):
        return {k: replace_urls(v, mapping) for k, v in node.items()}

    if isinstance(node, list):
        return [replace_urls(item, mapping) for item in node]

    if isinstance(node, str):
        text = node
        for old, new in mapping.items():
            if old in text:
                text = text.replace(old, new)
        return text

    return node


def main() -> None:
    args = parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    rewrite_path = Path(args.rewrite_output)
    rewrite_path.parent.mkdir(parents=True, exist_ok=True)

    data = fetch_data(args.api_base, args.whiteboard_id)

    urls: Set[str] = set()
    collect_image_urls(data, urls)

    session = requests.Session()
    session.headers.update({"User-Agent": "heptabase-image-sync/1.0"})

    downloaded: List[Dict[str, Any]] = []
    failed: List[Dict[str, Any]] = []
    mapping: Dict[str, str] = {}

    local_prefix = args.local_prefix.rstrip("/")

    for url in sorted(urls):
        ok, result, size = download_image(url, output_dir, session)
        if ok:
            local_url = f"{local_prefix}/{result}"
            mapping[url] = local_url
            downloaded.append({"url": url, "file": result, "size": size, "local_url": local_url})
        else:
            failed.append({"url": url, "reason": result})

    rewritten = replace_urls(deepcopy(data), mapping)

    with rewrite_path.open("w", encoding="utf-8") as f:
        json.dump(rewritten, f, ensure_ascii=False)

    manifest = {
        "whiteboard_id": args.whiteboard_id,
        "api_base": args.api_base.rstrip("/"),
        "found_urls": len(urls),
        "downloaded_count": len(downloaded),
        "failed_count": len(failed),
        "downloaded": downloaded,
        "failed": failed,
    }

    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Found image-like URLs: {len(urls)}")
    print(f"Downloaded: {len(downloaded)}")
    print(f"Failed: {len(failed)}")


if __name__ == "__main__":
    main()
