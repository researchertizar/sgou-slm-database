#!/usr/bin/env python3
"""
SGOU Academic Database — IndexNow Instant Search Engine Submission
Pings Bing, Yandex, Seznam, and Naver search engines with all academic URLs
for rapid, sub-hour crawling and indexing bypass of regular queue latency.
"""

import os
import json
import urllib.request
import urllib.error

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "sgou-slm-database.vercel.app"
KEY = "4a8f9c1d2e3b4a5f60718293a4b5c6d7"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"

def ping_indexnow():
    print(f"Preparing IndexNow submission for {HOST}...")

    # Collect priority URLs
    urls = [
        f"https://{HOST}/",
        f"https://{HOST}/?type=slm",
        f"https://{HOST}/?type=pyq",
        f"https://{HOST}/?type=assignment",
        f"https://{HOST}/?level=fyug",
        f"https://{HOST}/?level=ug",
        f"https://{HOST}/?level=pg",
        f"https://{HOST}/view.html",
        f"https://{HOST}/llms.txt",
    ]

    slm_path = os.path.join(REPO_ROOT, "data", "sgou_slm_data.json")
    if os.path.exists(slm_path):
        with open(slm_path, encoding="utf-8") as f:
            data = json.load(f)
        for prog in data:
            p_name = prog.get("programme_name", "").strip()
            if p_name:
                urls.append(f"https://{HOST}/?search={p_name.replace(' ', '%20')}")
            for sem in prog.get("semesters", []):
                for c in sem.get("courses", []):
                    code = c.get("code", "").strip()
                    if code:
                        urls.append(f"https://{HOST}/?course={code}")
                        urls.append(f"https://{HOST}/view/{code}")

    # Deduplicate while preserving order, cap at 10,000 (IndexNow limit per batch)
    seen = set()
    deduped_urls = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            deduped_urls.append(u)

    print(f"Submitting {len(deduped_urls)} URLs to IndexNow endpoints...")

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": deduped_urls
    }

    data_bytes = json.dumps(payload).encode("utf-8")

    endpoints = [
        "https://api.indexnow.org/indexnow",
        "https://www.bing.com/indexnow",
        "https://yandex.com/indexnow"
    ]

    for ep in endpoints:
        req = urllib.request.Request(
            ep,
            data=data_bytes,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f"  [+] Success from {ep}: HTTP {resp.status}")
        except urllib.error.HTTPError as e:
            # Note: HTTP 200 or 202 means submitted/accepted
            print(f"  [-] Response from {ep}: HTTP {e.code} ({e.reason})")
        except Exception as e:
            print(f"  [-] Failed to connect to {ep}: {e}")

if __name__ == "__main__":
    ping_indexnow()
