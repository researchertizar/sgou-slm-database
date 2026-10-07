#!/usr/bin/env python3
"""Audit SGOU PYQ dataset for content mismatches, upstream errors, and corrupt files.

Reads data/sgou_questions_cleaned.json, downloads PDFs (concurrently), extracts
text from the first 2 pages, and verifies if declared course codes / subjects
match the actual PDF text.
"""

from __future__ import annotations

import concurrent.futures
import io
import json
import logging
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

try:
    import pypdf
except ImportError:
    print("Error: pypdf is required. Install via pip install pypdf")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_JSON = REPO_ROOT / "data" / "sgou_questions_cleaned.json"
OVERRIDES_JSON = REPO_ROOT / "data" / "pyq_overrides.json"
AUDIT_REPORT_JSON = REPO_ROOT / "data" / "pyq_audit_report.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SGOU-Auditor/1.0"


def normalize_text(text: str) -> str:
    """Normalize text by stripping spaces to defeat kerning/spacing issues in PDFs."""
    return re.sub(r"[\s\-_–—]+", "", text or "").upper()


def extract_pdf_info(url: str, timeout: float = 12.0) -> dict:
    """Download PDF header and extract text from first 2 pages."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()
    except Exception as exc:
        return {"status": "fetch_error", "error": str(exc), "pages": 0, "text": ""}

    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        num_pages = len(reader.pages)
        extracted = []
        for p in reader.pages[:2]:
            extracted.append(p.extract_text() or "")
        raw_text = " ".join(extracted)
        return {
            "status": "ok",
            "pages": num_pages,
            "text": raw_text,
            "size": len(content),
        }
    except Exception as exc:
        return {"status": "pdf_parse_error", "error": str(exc), "pages": 0, "text": ""}


def audit_item(item: dict, prog_title: str) -> dict:
    code = (item.get("course_code") or "").strip().upper()
    sub_name = item.get("subject_name") or ""
    url = item.get("pdf_url") or ""

    if not url:
        return {"url": url, "result": "missing_url"}

    pdf_info = extract_pdf_info(url)
    if pdf_info["status"] != "ok":
        return {
            "url": url,
            "code": code,
            "subject": sub_name,
            "program": prog_title,
            "result": pdf_info["status"],
            "error": pdf_info.get("error"),
        }

    raw_text = pdf_info["text"]
    norm_doc = normalize_text(raw_text)

    # If document has almost no text, it might be scanned image
    if len(raw_text.strip()) < 30:
        return {
            "url": url,
            "code": code,
            "subject": sub_name,
            "program": prog_title,
            "result": "scanned_or_empty",
            "pages": pdf_info["pages"],
        }

    # Match check: is course code present?
    code_match = bool(code and normalize_text(code) in norm_doc)

    # Check for keywords from subject name or programme
    clean_sub = item.get("clean_subject_name") or ""
    sub_words = [w for w in re.findall(r"[A-Za-z]{4,}", clean_sub) if w.upper() not in {"EXAMINATIONS", "SEMESTER", "ADMISSIONS", "DEGREE"}]
    sub_matches = [w for w in sub_words if normalize_text(w) in norm_doc]

    # Look for QP Code and Course Code candidates in the document text
    qp_match = re.search(r"QP\s*CODE\s*[:\s]*([A-Z0-9]+)", raw_text, re.IGNORECASE)
    doc_qp_code = qp_match.group(1) if qp_match else None

    # Detect any course codes present in document (e.g. M23EC01DC)
    codes_in_doc = list(set(re.findall(r"\b([BM]\d{2}[A-Z]{2}\d{2,3}[A-Z]{0,2})\b", raw_text, re.IGNORECASE)))

    is_mismatch = False
    mismatch_reason = ""

    if code and code != "N/A":
        if not code_match and not sub_matches:
            # Code doesn't match and no subject words match
            if codes_in_doc and code not in [c.upper() for c in codes_in_doc]:
                is_mismatch = True
                mismatch_reason = f"Document contains codes {codes_in_doc} instead of declared {code}"
            else:
                mismatch_reason = f"Neither code {code} nor subject words found in text"

    return {
        "url": url,
        "declared_code": code,
        "declared_subject": sub_name,
        "program": prog_title,
        "result": "mismatch" if is_mismatch else ("verified" if code_match or sub_matches else "inconclusive"),
        "mismatch_reason": mismatch_reason,
        "codes_in_doc": codes_in_doc,
        "qp_code": doc_qp_code,
        "header_sample": raw_text[:250].strip().replace("\n", " "),
        "pages": pdf_info["pages"],
    }


def main():
    if not QUESTIONS_JSON.exists():
        logging.error("File not found: %s", QUESTIONS_JSON)
        sys.exit(1)

    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_items = []
    for prog in data:
        prog_title = prog.get("course_title", "Unknown")
        for q in prog.get("previous_year_questions", []):
            all_items.append((q, prog_title))

    total = len(all_items)
    logging.info("Found %d total question papers across %d programmes.", total, len(data))

    # Test sample or run full? Can accept --limit argument
    limit = None
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        limit = int(sys.argv[1])
        all_items = all_items[:limit]
        logging.info("Auditing first %d items (limit specified)...", limit)

    results = []
    mismatches = []
    errors = []

    start_time = time.time()
    # Concurrently audit using ThreadPoolExecutor
    workers = 16
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_item = {
            executor.submit(audit_item, item, prog): item for item, prog in all_items
        }
        done_count = 0
        for future in concurrent.futures.as_completed(future_to_item):
            done_count += 1
            if done_count % 50 == 0 or done_count == len(all_items):
                logging.info("Progress: %d / %d (%.1f%%)", done_count, len(all_items), (done_count / len(all_items)) * 100)
            res = future.result()
            results.append(res)
            if res.get("result") == "mismatch":
                mismatches.append(res)
            elif "error" in res:
                errors.append(res)

    duration = time.time() - start_time
    logging.info("Audit completed in %.2fs. Total audited: %d", duration, len(results))
    logging.info("Mismatches found: %d | Errors: %d", len(mismatches), len(errors))

    for m in mismatches:
        logging.warning("MISMATCH: [%s] declared %s -> %s (URL: %s)", m["program"], m["declared_code"], m["mismatch_reason"], m["url"])

    # Save full audit report
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_audited": len(results),
        "mismatches_count": len(mismatches),
        "errors_count": len(errors),
        "mismatches": mismatches,
        "errors": errors,
    }
    with open(AUDIT_REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    logging.info("Wrote audit report to %s", AUDIT_REPORT_JSON)


if __name__ == "__main__":
    main()
