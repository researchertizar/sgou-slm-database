#!/usr/bin/env python3
"""
SGOU Academic Database — 1-Click Production Sync Tool
Synchronizes only essential, verified production files from the development
workspace to the production repository (D:\\Github\\sgou-slm-database).

Excludes:
- Screen recordings and audio files (sr/)
- Scratch test scripts and temp data (scratch/)
- Python byte-cache (__pycache__/)
- Obsolete assets (e.g. og-image-old.png)
- Any temporary or IDE-generated files

Safeguards:
- Preserves the destination .git directory untouched
- Verifies SHA-256 hashes to only copy modified or new files
- Automatically cleans obsolete/temporary files from the destination
"""

import os
import sys
import shutil
import hashlib
from pathlib import Path

# Paths
SRC_DIR = Path(__file__).resolve().parent
DEST_DIR = Path(r"D:\Github\sgou-slm-database")

# Explicit Whitelist of Root Production Files
ROOT_FILES = [
    ".gitignore",
    "4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt",
    "apple-touch-icon.png",
    "dev_server.js",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon.ico",
    "icon-192.png",
    "icon-512.png",
    "icon.svg",
    "index.html",
    "llms-full.txt",
    "llms.txt",
    "manifest.json",
    "og-image-dark.png",
    "og-image.png",
    "opensearch.xml",
    "README.md",
    "robots.txt",
    "script.js",
    "sitemap-courses.xml",
    "sitemap-main.xml",
    "sitemap-programmes.xml",
    "sitemap.xml",
    "style.css",
    "sw.js",
    "vercel.json",
    "view.html",
    "sync_to_github.py",
    "sync_to_github.cmd",
    "reader.html",
]

# Explicit Whitelist of Subdirectories and Allowed Extensions
SUBDIRS = {
    "api": [".js"],
    "data": [".json"],
    "scripts": [".py"],
    "pdfjs": [".js"],
}

# Directories and files explicitly forbidden in destination
FORBIDDEN_NAMES = {
    "scratch",
    "sr",
    "__pycache__",
    ".cache",
    ".system_generated",
    ".tempmediaStorage",
    "og-image-old.png",
    "extract_new_sr.py",
    "scan_changes.py",
    "test_pyq.json",
    "test_slm.json",
    "verify_all.js"
}

def get_file_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def sync():
    print("=" * 64)
    print(" SGOU Academic Database — Production Repository Sync")
    print("=" * 64)
    print(f" Source:      {SRC_DIR}")
    print(f" Destination: {DEST_DIR}\n")

    if not SRC_DIR.exists():
        print(f"[ERROR] Source directory does not exist: {SRC_DIR}")
        sys.exit(1)

    if not DEST_DIR.exists():
        print(f"[*] Creating destination directory: {DEST_DIR}")
        DEST_DIR.mkdir(parents=True, exist_ok=True)

    copied = []
    skipped = []
    cleaned = []

    # 1. Sync Root Files
    print("--- 1. Synchronizing Root Production Files ---")
    for filename in ROOT_FILES:
        src_file = SRC_DIR / filename
        dest_file = DEST_DIR / filename

        if not src_file.exists():
            continue

        if dest_file.exists():
            if get_file_sha256(src_file) == get_file_sha256(dest_file):
                skipped.append(filename)
                print(f"  [OK - SYNCED] {filename}")
                continue

        dest_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_file, dest_file)
        copied.append(filename)
        print(f"  [COPIED]     {filename}")

    # 2. Sync Whitelisted Subdirectories
    print("\n--- 2. Synchronizing Subdirectories (api, data, scripts) ---")
    for subdir, extensions in SUBDIRS.items():
        src_subdir = SRC_DIR / subdir
        dest_subdir = DEST_DIR / subdir

        if not src_subdir.exists():
            continue

        dest_subdir.mkdir(parents=True, exist_ok=True)

        for src_item in src_subdir.iterdir():
            if src_item.is_file() and src_item.suffix.lower() in extensions:
                rel_path = f"{subdir}/{src_item.name}"
                dest_item = dest_subdir / src_item.name

                if dest_item.exists():
                    if get_file_sha256(src_item) == get_file_sha256(dest_item):
                        skipped.append(rel_path)
                        print(f"  [OK - SYNCED] {rel_path}")
                        continue

                shutil.copy2(src_item, dest_item)
                copied.append(rel_path)
                print(f"  [COPIED]     {rel_path}")

    # 3. Clean Obsolete / Temporary Items from Destination
    print("\n--- 3. Cleaning Obsolete / Non-Production Items from Destination ---")
    if DEST_DIR.exists():
        for dest_item in DEST_DIR.iterdir():
            name = dest_item.name
            # NEVER touch .git!
            if name == ".git":
                continue

            if name in FORBIDDEN_NAMES:
                if dest_item.is_dir():
                    shutil.rmtree(dest_item)
                    cleaned.append(f"{name}/")
                    print(f"  [REMOVED DIR]  {name}/")
                else:
                    dest_item.unlink()
                    cleaned.append(name)
                    print(f"  [REMOVED FILE] {name}")

        # Also check scripts/ in destination for __pycache__
        dest_scripts = DEST_DIR / "scripts"
        if dest_scripts.exists():
            for s_item in dest_scripts.iterdir():
                if s_item.name in FORBIDDEN_NAMES or s_item.suffix.lower() not in [".py"]:
                    if s_item.is_dir():
                        shutil.rmtree(s_item)
                    else:
                        s_item.unlink()
                    cleaned.append(f"scripts/{s_item.name}")
                    print(f"  [REMOVED]      scripts/{s_item.name}")

    # Summary
    print("\n" + "=" * 64)
    print(" Sync Summary:")
    print(f"   Files Copied / Updated : {len(copied)}")
    print(f"   Files Already Synced   : {len(skipped)}")
    print(f"   Items Cleaned/Pruned   : {len(cleaned)}")
    print("=" * 64)
    print("SUCCESS: Target directory D:\\Github\\sgou-slm-database is fully synchronized!\n")

if __name__ == "__main__":
    sync()
