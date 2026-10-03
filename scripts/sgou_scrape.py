#!/usr/bin/env python3
"""Scrape SGOU course SLM textbooks and write a structured JSON catalog."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = str(REPO_ROOT / "data" / "sgou_slm_data.json")
BASE_URL = "https://sgou.ac.in"
MAIN_URL = urljoin(BASE_URL, "/public/slmprogrammes")


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/152.0 Safari/537.36"
            )
        }
    )
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=0.6,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def get_programme_links_with_level(session: requests.Session, timeout: float = 30.0) -> list[dict[str, str]]:
    """
    Scrapes the main SLM page and returns a list of dictionaries:
    [
        {"url": "...", "name": "...", "level": "UG"},
        ...
    ]
    """
    logging.info("Fetching main page: %s", MAIN_URL)
    resp = session.get(MAIN_URL, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Tab ID to level mapping
    tab_level_map = {
        "v-pills-home": "UG",
        "v-pills-profile": "FYUG",  # four-year programmes
        "v-pills-messages": "PG",
    }

    programmes = []
    for tab_id, level in tab_level_map.items():
        tab = soup.find("div", id=tab_id)
        if not tab:
            continue
        for a in tab.find_all("a", href=True):
            href = a["href"]
            if "/public/slmprogrammes/slm-list/" in href:
                full_url = urljoin(BASE_URL, href)
                programme_name = a.get_text(strip=True)
                programmes.append({
                    "url": full_url,
                    "name": programme_name,
                    "level": level,
                })

    # Remove duplicates preserving order
    unique = {}
    for p in programmes:
        if p["url"] not in unique:
            unique[p["url"]] = p
    return list(unique.values())


def scrape_programme_details(
    session: requests.Session, programme_info: dict[str, str], timeout: float = 30.0
) -> dict | None:
    """
    Scrapes a single programme page and returns a full record:
    {
        "programme_name": "...",
        "level": "...",
        "url": "...",
        "semesters": [ ... ]
    }
    """
    url = programme_info["url"]
    logging.info("Scraping: %s", url)
    try:
        resp = session.get(url, timeout=timeout)
        resp.raise_for_status()
    except Exception as e:
        logging.error("Failed to fetch %s: %s", url, e)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    programme_name = programme_info["name"]
    level = programme_info["level"]

    semesters = []
    semester_headers = soup.find_all("li", class_="semester-header")
    for header in semester_headers:
        semester = header.get("data-semester")
        if not semester:
            continue
        courses = []
        next_siblings = header.find_next_siblings("li", class_="course-item")
        for item in next_siblings:
            if item.get("data-semester") != semester:
                break
            text = item.get_text(strip=True)
            name = text.split("Download PDF")[0].strip()
            pdf_tag = item.find("a", href=True)
            pdf_url = pdf_tag["href"] if pdf_tag else None

            code = None
            parts = name.split(" - ")
            if len(parts) > 1 and parts[-1] and parts[-1][0].isalnum():
                code = parts[-1].strip()
                name = " - ".join(parts[:-1])

            courses.append({
                "name": name,
                "code": code,
                "pdf_url": pdf_url,
            })
        if courses:
            semesters.append({
                "semester": semester,
                "courses": courses,
            })

    return {
        "programme_name": programme_name,
        "level": level,
        "url": url,
        "semesters": semesters,
    }


def save_json(data: object, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(output.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    tmp.replace(output)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape SGOU SLM textbook catalogs into JSON.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP timeout in seconds")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between requests in seconds")
    parser.add_argument("--limit", type=int, default=None, help="Scrape only first N programmes")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    session = build_session()
    programme_list = get_programme_links_with_level(session, timeout=args.timeout)
    logging.info("Found %d programmes on SGOU portal", len(programme_list))

    if args.limit is not None:
        programme_list = programme_list[: max(0, args.limit)]

    all_data = []
    for idx, prog in enumerate(programme_list, start=1):
        logging.info("[%d/%d] Scraping %s", idx, len(programme_list), prog["name"])
        data = scrape_programme_details(session, prog, timeout=args.timeout)
        if data:
            all_data.append(data)
        if args.delay:
            time.sleep(args.delay)

    output = Path(args.output)
    save_json(all_data, output)
    logging.info("Done: Saved %d programmes to %s", len(all_data), output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
