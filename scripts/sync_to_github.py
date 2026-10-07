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
REPO_ROOT = Path(__file__).resolve().parent.parent
DEST_DIR = Path(r"D:\Github\sgou-slm-database")

# Explicit Whitelist of Root Production Files
ROOT_FILES = [
    ".gitignore",
    "4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt",
    "dev_server.js",
    "index.html",
    "llms-full.txt",
    "llms.txt",
    "manifest.json",
    "opensearch.xml",
    "README.md",
    "robots.txt",
    "sitemap.xml",
    "sw.js",
    "vercel.json",
    "view.html",
    "reader.html",
    "sync_to_github.cmd",
]

# Explicit Whitelist of Subdirectories to Sync (recursive)
SUBDIRS = [
    "api",
    "assets",
    "css",
    "data",
    "js",
    "pdfjs",
    "scripts",
    "sitemaps",
]

# Directories and files explicitly forbidden in destination root
FORBIDDEN_ROOT_NAMES = {
    "scratch",
    "sr",
    "__pycache__",
    ".cache",
    ".system_generated",
    ".tempmediaStorage",
    "og-image-old.png",
    "og-image.png",
    "og-image-dark.png",
    "apple-touch-icon.png",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "icon.svg",
    "icon-192.png",
    "icon-512.png",
    "style.css",
    "script.js",
    "sitemap-courses.xml",
    "sitemap-main.xml",
    "sitemap-programmes.xml",
    "extract_new_sr.py",
    "scan_changes.py",
    "test_pyq.json",
    "test_slm.json",
    "verify_all.js",
    "sync_to_github.py",
}

def get_file_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def sync_directory_recursive(src_dir, dest_dir, rel_prefix=""):
    copied = []
    skipped = []
    dest_dir.mkdir(parents=True, exist_ok=True)

    for item in src_dir.iterdir():
        if item.name == "__pycache__" or item.name.startswith("."):
            continue
        rel_path = f"{rel_prefix}/{item.name}" if rel_prefix else item.name
        dest_item = dest_dir / item.name

        if item.is_dir():
            c, s = sync_directory_recursive(item, dest_item, rel_path)
            copied.extend(c)
            skipped.extend(s)
        elif item.is_file():
            if dest_item.exists() and get_file_sha256(item) == get_file_sha256(dest_item):
                skipped.append(rel_path)
                print(f"  [OK - SYNCED] {rel_path}")
            else:
                shutil.copy2(item, dest_item)
                copied.append(rel_path)
                print(f"  [COPIED]     {rel_path}")

    return copied, skipped

def sync():
    print("=" * 64)
    print(" SGOU Academic Database — Production Repository Sync")
    print("=" * 64)
    print(f" Source:      {REPO_ROOT}")
    print(f" Destination: {DEST_DIR}\n")

    if not REPO_ROOT.exists():
        print(f"[ERROR] Source directory does not exist: {REPO_ROOT}")
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
        src_file = REPO_ROOT / filename
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
    print("\n--- 2. Synchronizing Modular Subdirectories ---")
    for subdir in SUBDIRS:
        src_subdir = REPO_ROOT / subdir
        dest_subdir = DEST_DIR / subdir

        if not src_subdir.exists():
            continue

        c, s = sync_directory_recursive(src_subdir, dest_subdir, subdir)
        copied.extend(c)
        skipped.extend(s)

    # 3. Clean Obsolete / Temporary Items from Destination Root
    print("\n--- 3. Cleaning Obsolete / Non-Production Items from Destination ---")
    if DEST_DIR.exists():
        for dest_item in DEST_DIR.iterdir():
            name = dest_item.name
            # NEVER touch .git!
            if name == ".git":
                continue

            if name in FORBIDDEN_ROOT_NAMES:
                if dest_item.is_dir():
                    shutil.rmtree(dest_item)
                    cleaned.append(f"{name}/")
                    print(f"  [REMOVED DIR]  {name}/")
                else:
                    dest_item.unlink()
                    cleaned.append(name)
                    print(f"  [REMOVED FILE] {name}")

    print("\n" + "=" * 64)
    print(" Sync Summary:")
    print(f"   Files Copied / Updated : {len(copied)}")
    print(f"   Files Already Synced   : {len(skipped)}")
    print(f"   Items Cleaned/Pruned   : {len(cleaned)}")
    print("=" * 64)
    print("SUCCESS: Target directory D:\\Github\\sgou-slm-database is fully synchronized!\n")

if __name__ == "__main__":
    sync()
