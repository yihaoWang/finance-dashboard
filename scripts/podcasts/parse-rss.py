#!/usr/bin/env python3
"""Parse podcast RSS or YouTube channel RSS, output JSON list of recent episodes.

Usage:
  parse-rss.py podcast <rss-url> [max-items]
  parse-rss.py youtube <channel-id> [max-items]
"""
import sys
import json
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 tickr-podcasts/1.0"


def fetch(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"only http/https schemes allowed, got: {parsed.scheme}")
    result = subprocess.run(
        ["curl", "-fsSL", "--max-time", "30", "-A", UA, "--", url],
        capture_output=True,
        check=True,
    )
    return result.stdout


def parse_pubdate(s: str | None) -> int:
    if not s:
        return 0
    try:
        return int(parsedate_to_datetime(s).timestamp() * 1000)
    except Exception:
        try:
            return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
        except Exception:
            return 0


def parse_podcast(url: str, max_items: int) -> list[dict]:
    data = fetch(url)
    root = ET.fromstring(data)
    items = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        guid = (item.findtext("guid") or item.findtext("link") or title).strip()
        link = (item.findtext("link") or "").strip() or None
        pub = parse_pubdate(item.findtext("pubDate"))
        enc = item.find("enclosure")
        audio_url = enc.get("url") if enc is not None else None
        if not audio_url or pub == 0:
            continue
        items.append({
            "id": guid,
            "title": title,
            "episodeUrl": link,
            "audioUrl": audio_url,
            "publishedAt": pub,
        })
        if len(items) >= max_items:
            break
    return items


def parse_youtube(channel_id: str, max_items: int) -> list[dict]:
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    data = fetch(url)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
    }
    root = ET.fromstring(data)
    items = []
    for entry in root.findall("atom:entry", ns):
        video_id_el = entry.find("yt:videoId", ns)
        title_el = entry.find("atom:title", ns)
        published_el = entry.find("atom:published", ns)
        if video_id_el is None or title_el is None or published_el is None:
            continue
        video_id = video_id_el.text or ""
        link = f"https://www.youtube.com/watch?v={video_id}"
        items.append({
            "id": f"yt:{video_id}",
            "title": (title_el.text or "").strip(),
            "episodeUrl": link,
            "audioUrl": None,
            "publishedAt": parse_pubdate(published_el.text),
            "videoId": video_id,
        })
        if len(items) >= max_items:
            break
    return items


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    kind = sys.argv[1]
    target = sys.argv[2]
    max_items = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    if kind == "podcast":
        items = parse_podcast(target, max_items)
    elif kind == "youtube":
        items = parse_youtube(target, max_items)
    else:
        print(f"unknown kind: {kind}", file=sys.stderr)
        return 2
    json.dump(items, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
