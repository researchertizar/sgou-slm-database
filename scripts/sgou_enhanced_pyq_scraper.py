#!/usr/bin/env python3
"""Scrape SGOU question/assignment PDFs and write a cleaned JSON dataset.

Combines the original scraper and transformer into one script.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://sgou.ac.in"
QUESTIONS_URL = f"{BASE_URL}/examination/questions"
DEFAULT_OUTPUT = "sgou_questions_cleaned.json"

COURSE_PAGE_RE = re.compile(r"/questions-more/\d+")
PDF_RE = re.compile(r"\.pdf(?:$|[?#])", re.IGNORECASE)
COURSE_CODE_RE = re.compile(r"\b([A-Z0-9]{7,10})\b", re.IGNORECASE)
EXAM_DATE_RE = re.compile(
    r"\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|"
    r"SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}\b",
    re.IGNORECASE,
)
ADMISSION_RE = re.compile(r"\(([^)]*admissions?[^)]*)\)", re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class Resource:
    title: str
    semester: str
    pdf_url: str


class SGOUTool:
    def __init__(self, timeout: float = 20.0, delay: float = 0.15) -> None:
        self.timeout = timeout
        self.delay = max(0.0, delay)
        self.session = self._build_session()

    @staticmethod
    def _build_session() -> requests.Session:
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

    def get_soup(self, url: str) -> BeautifulSoup:
        logging.debug("GET %s", url)
        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")

    def discover_course_pages(self) -> list[dict[str, str]]:
        logging.info("Fetching course index: %s", QUESTIONS_URL)
        soup = self.get_soup(QUESTIONS_URL)

        seen: set[str] = set()
        courses: list[dict[str, str]] = []
        for link in soup.find_all("a", href=COURSE_PAGE_RE):
            href = link.get("href")
            if not href:
                continue
            url = urljoin(BASE_URL, href)
            if url in seen:
                continue
            seen.add(url)
            title = clean_text(link.get_text(" ", strip=True)) or "Untitled course"
            courses.append({"course_title": title, "course_page_url": url})

        logging.info("Found %d course sections", len(courses))
        return courses

    def scrape_course(self, course: dict[str, str]) -> dict:
        title = course["course_title"]
        url = course["course_page_url"]
        logging.info("Scraping %s", title)
        soup = self.get_soup(url)

        resources: list[Resource] = []
        seen_pdf_urls: set[str] = set()

        # The SGOU pages currently expose resources in tables. Iterating rows lets
        # us retain row-level metadata such as semester while still tolerating
        # multiple PDF links in a single row.
        for row in soup.find_all("tr"):
            cells = [clean_text(td.get_text(" ", strip=True)) for td in row.find_all("td")]
            semester = infer_semester(cells)

            for link in row.find_all("a", href=True):
                href = link.get("href", "")
                if not PDF_RE.search(href):
                    continue
                pdf_url = urljoin(BASE_URL, href)
                if pdf_url in seen_pdf_urls:
                    continue
                seen_pdf_urls.add(pdf_url)
                pdf_title = clean_text(link.get_text(" ", strip=True)) or "PDF Document"
                resources.append(Resource(pdf_title, semester, pdf_url))

        if self.delay:
            time.sleep(self.delay)

        return transform_course(course, resources)

    def scrape_all(self, limit: int | None = None) -> list[dict]:
        courses = self.discover_course_pages()
        if limit is not None:
            courses = courses[: max(0, limit)]

        result: list[dict] = []
        for index, course in enumerate(courses, start=1):
            try:
                logging.info("[%d/%d] %s", index, len(courses), course["course_title"])
                result.append(self.scrape_course(course))
            except requests.RequestException as exc:
                logging.error("Failed %s: %s", course["course_page_url"], exc)
                result.append(empty_course(course, error=str(exc)))
        return result


def clean_text(value: str) -> str:
    return WHITESPACE_RE.sub(" ", value or "").strip()


def infer_semester(cells: list[str]) -> str:
    """Prefer an explicit semester-looking cell; otherwise preserve old fallback."""
    for cell in reversed(cells):
        if re.search(r"\b(?:semester|sem)\b", cell, re.IGNORECASE):
            return cell
    return cells[-1] if len(cells) > 1 and cells[-1] else "N/A"


def is_assignment(resource: Resource) -> bool:
    title = resource.title.upper()
    url = resource.pdf_url.lower()
    return "ASSIGNMENT" in title or "/examasgnmnt/" in url or "assignment" in url


def parse_pyq(resource: Resource) -> dict[str, str]:
    raw_title = clean_text(resource.title)

    code_match = COURSE_CODE_RE.search(raw_title)
    course_code = code_match.group(1).upper() if code_match else "N/A"

    date_match = EXAM_DATE_RE.search(raw_title)
    exam_date = date_match.group(0).upper() if date_match else "N/A"

    batch_match = ADMISSION_RE.search(raw_title)
    admission_batch = clean_text(batch_match.group(1)) if batch_match else "N/A"

    subject_name = extract_subject_name(raw_title, course_code)

    return {
        "subject_name": subject_name,
        "course_code": course_code,
        "semester": resource.semester or "N/A",
        "exam_date": exam_date,
        "admission_batch": admission_batch,
        "pdf_url": resource.pdf_url,
    }


def extract_subject_name(raw_title: str, course_code: str) -> str:
    candidate = raw_title
    if course_code != "N/A":
        parts = re.split(
            re.escape(course_code) + r"\s*[–—-]\s*",
            raw_title,
            maxsplit=1,
            flags=re.IGNORECASE,
        )
        if len(parts) > 1:
            candidate = parts[1]

    # Remove metadata commonly appended in parentheses, plus an exam date that
    # may remain outside parentheses.
    candidate = re.sub(r"\([^)]*\)", " ", candidate)
    candidate = EXAM_DATE_RE.sub(" ", candidate)
    candidate = clean_text(candidate).strip(" -–—:|")

    if candidate:
        return candidate

    fallback = re.sub(r"\([^)]*\)", " ", raw_title)
    return clean_text(fallback) or "N/A"


def transform_course(course: dict[str, str], resources: Iterable[Resource]) -> dict:
    assignments: list[dict[str, str]] = []
    pyqs: list[dict[str, str]] = []

    for resource in resources:
        if is_assignment(resource):
            assignments.append(
                {
                    "title": clean_text(resource.title),
                    "semester": resource.semester or "N/A",
                    "pdf_url": resource.pdf_url,
                }
            )
        else:
            pyqs.append(parse_pyq(resource))

    return {
        "course_title": course.get("course_title") or "Untitled course",
        "course_page_url": course.get("course_page_url") or "",
        "total_pdf_count": len(assignments) + len(pyqs),
        "assignment_count": len(assignments),
        "pyq_count": len(pyqs),
        "assignments": assignments,
        "previous_year_questions": pyqs,
    }


def empty_course(course: dict[str, str], error: str) -> dict:
    data = transform_course(course, [])
    data["error"] = error
    return data


def save_json(data: object, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(output.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    tmp.replace(output)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape and clean SGOU previous-year questions and assignments."
    )
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout in seconds")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between course requests")
    parser.add_argument("--limit", type=int, default=None, help="Scrape only the first N courses")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    try:
        tool = SGOUTool(timeout=args.timeout, delay=args.delay)
        cleaned_data = tool.scrape_all(limit=args.limit)
        output = Path(args.output)
        save_json(cleaned_data, output)
    except (requests.RequestException, OSError, ValueError) as exc:
        logging.error("Fatal error: %s", exc)
        return 1

    total_courses = len(cleaned_data)
    total_pdfs = sum(item["total_pdf_count"] for item in cleaned_data)
    total_assignments = sum(item["assignment_count"] for item in cleaned_data)
    total_pyqs = sum(item["pyq_count"] for item in cleaned_data)
    logging.info(
        "Done: %d courses, %d PDFs (%d PYQs, %d assignments) -> %s",
        total_courses,
        total_pdfs,
        total_pyqs,
        total_assignments,
        output,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
