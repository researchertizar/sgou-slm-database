# Security Audit Vulnerability Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the three confirmed security vulnerabilities identified in the deep security audit (`dom-xss-unvalidated-pdfurl-href`, `path-traversal-dev-server-prefix-bypass`, and `information-disclosure-dev-server-git-dotfiles`) using strict test-driven development.

**Architecture:**
- In `view.html`, implement an authoritative URL validation helper `isValidPdfUrl(rawUrl)` enforcing HTTPS protocol and an approved host allowlist (`sgou.ac.in`, `www.sgou.ac.in`, `d198y4z1gpgoxg.cloudfront.net`, and same-origin hostnames). Protect all DOM `href` bindings, `showFallback()` links, and `window.open` calls from executing untrusted schemes.
- In `dev_server.js`, fix the sibling directory traversal check by anchoring the boundary with `path.sep` (`path.resolve(__dirname) + path.sep`).
- In `dev_server.js`, add a dotfile rejection filter that intercepts any path segments containing leading dots (`.*`, such as `/.git/...`), immediately returning HTTP 403 Forbidden before filesystem checks.

**Tech Stack:** Vanilla JavaScript (ES6+ / Browser JS), Node.js built-in runtime (`http`, `path`, `fs`, `node:test`, `node:assert`).

**Spec:** [`REPORT.md`](file:///C:/Users/Ahayas/security-audit-skill/sgou-database/run-1/REPORT.md) and [`FINDINGS-DETAIL.md`](file:///C:/Users/Ahayas/security-audit-skill/sgou-database/run-1/FINDINGS-DETAIL.md).

## Global Constraints
- Target source files: `view.html` and `dev_server.js`.
- No new external runtime dependencies; use Node.js built-ins (`node:test`, `node:assert`).
- Preserve existing viewer functionality for legitimate academic PDFs from `sgou.ac.in` and CloudFront CDN.
- Maintain existing dev server asset fallbacks (`data/`, `assets/icons/`, `assets/images/`).

## Review Focus
- Attempting `javascript:alert(1)` in `url` query parameter must be rejected and never bound to clickable `href` or `window.open`.
- Attempting `/../sgou-database-backup/secret.txt` on `dev_server.js` must yield HTTP 403 Forbidden.
- Attempting `/.git/config` on `dev_server.js` must yield HTTP 403 Forbidden.
- Legitimate URLs (`https://d198y4z1gpgoxg.cloudfront.net/...` and `https://sgou.ac.in/...`) must pass validation.
- Legitimate static files (`/index.html`, `/view.html`, `/assets/...`) must continue to serve normally with HTTP 200.

---

### Task 1: DOM XSS Defense in `view.html` (`dom-xss-unvalidated-pdfurl-href`)

**Files:**
- Create: `tests/view_security.test.js`
- Modify: `view.html`

**Interfaces:**
- Produces: `isValidPdfUrl(raw: string): boolean` helper in `view.html`.

- [x] **Step 1: Write the failing test for URL validation in `tests/view_security.test.js`**
  Cover `javascript:alert(1)`, `data:text/html,...`, `http://evil.com/fake.pdf`, and verify `https://sgou.ac.in/test.pdf` and `https://d198y4z1gpgoxg.cloudfront.net/test.pdf` pass.

- [x] **Step 2: Run test to verify it fails**
  Run: `node --test tests/view_security.test.js`
  Expected: FAIL with missing function or module.

- [x] **Step 3: Implement `isValidPdfUrl` and guard `href`/`window.open`/`showFallback` in `view.html`**
  Add helper function `isValidPdfUrl(rawUrl)` and ensure non-whitelisted URLs are blocked from DOM navigation and `href` binding.

- [x] **Step 4: Run test to verify it passes**
  Run: `node --test tests/view_security.test.js`
  Expected: PASS

---

### Task 2: Path Traversal Sibling Prefix Guard in `dev_server.js` (`path-traversal-dev-server-prefix-bypass`)

**Files:**
- Create: `tests/dev_server_security.test.js`
- Modify: `dev_server.js`

**Interfaces:**
- Consumes: Node `http`, `path`, `fs`, `dev_server.js` exported server.

- [x] **Step 1: Write failing test for sibling directory traversal in `tests/dev_server_security.test.js`**
  Send a GET request for `/../sgou-database-fake/test.txt` and verify it receives HTTP 403.

- [x] **Step 2: Run test to verify it fails**
  Run: `node --test tests/dev_server_security.test.js`
  Expected: FAIL (or not returning 403).

- [x] **Step 3: Implement strict path root anchoring in `dev_server.js`**
  Use `const safeRoot = path.resolve(__dirname) + path.sep;` and verify `resolvedPath.startsWith(safeRoot)`.

- [x] **Step 4: Run test to verify it passes**
  Run: `node --test tests/dev_server_security.test.js`
  Expected: PASS

---

### Task 3: Dotfile & `.git` Directory Exposure Guard in `dev_server.js` (`information-disclosure-dev-server-git-dotfiles`)

**Files:**
- Modify: `tests/dev_server_security.test.js`
- Modify: `dev_server.js`

- [x] **Step 1: Add failing test for dotfile blocking in `tests/dev_server_security.test.js`**
  Send GET requests for `/.git/config`, `/.env`, and `/.gitignore` and verify they return HTTP 403 Forbidden.

- [x] **Step 2: Run test to verify it fails**
  Run: `node --test tests/dev_server_security.test.js`
  Expected: FAIL (currently serves HTTP 200 for `.gitignore` and `.git` files).

- [x] **Step 3: Implement dotfile filter in `dev_server.js`**
  Block any request where the path or any path segment begins with a dot (`.`), returning HTTP 403.

- [x] **Step 4: Run test to verify it passes**
  Run: `node --test tests/dev_server_security.test.js`
  Expected: PASS

---

### Task 4: Comprehensive Verification & Regression Check

**Files:**
- Test: All tests in `tests/`

- [x] **Step 1: Run complete test suite**
  Run: `node --test tests/*.test.js`
  Expected: All tests PASS with 0 failures.

- [x] **Step 2: Verify git diff is minimal and targeted**
  Run: `git diff --stat`
  Expected: Only `view.html`, `dev_server.js`, and `tests/` modified.
