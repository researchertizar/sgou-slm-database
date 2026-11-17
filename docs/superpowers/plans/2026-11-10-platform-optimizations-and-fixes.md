# SGOU Platform Optimizations, Critical Fixes & Native UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all findings from the deep platform analysis: fix critical runtime issues (C-01 viewer material lookup, C-02 reader fetch failure, C-03 offline indicator, C-04 CSP hardening), optimize DOM rendering for low-end mobile devices (H-01, H-02), implement native-app UX patterns (H-03, H-04, H-05, H-06, H-07, F-03, F-04, F-08), polish UI/UX (U-01, U-02, U-03, U-05, U-06), and enforce platform rate-limit/quota safeguards across edge and client layers.

**Architecture:** Vanilla ES6+ architecture with zero runtime frameworks, hardware-accelerated canvas rendering via PDF.js, dual-tier client/edge caching, and resilient fallback chains for network requests and data lookups. Client state is persisted locally in `localStorage` and `CacheStorage` to minimize upstream network and API compute costs.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3 Custom Properties, Mozilla PDF.js v3.11, Service Worker API, Cloudflare Workers, Cloudflare D1 (SQLite), Node.js v24 Test Runner.

**Spec:** `docs/platform-specification/README.md` and `C:\Users\Ahayas\.gemini\antigravity\brain\d47b47d7-c5c0-480f-8a5c-52191fd48fdf\sgou-platform-deep-analysis.md`

## Global Constraints

- **Zero Client Runtime Tax:** No external JavaScript frameworks (no React, Vue, Next.js, or lodash).
- **Zero-Emoji Policy:** Monochrome and terracotta SVG icons only (Feather/Lucide style). No emojis in UI buttons, banners, or modals.
- **Admin Secret Unchanged:** Do NOT modify C-05 (Admin Dashboard authentication) in this milestone per user instruction.
- **Preserve User Screen Records:** Do NOT touch or delete the `sr/` directory per user instruction.
- **Platform Limit Shield:** Prevent quota or bandwidth exhaustion across Gemini API, Cloudflare Workers, and Vercel by enforcing multi-tier caching (`CacheStorage`, `localStorage`, Cloudflare edge cache), client debouncing, and payload compression.
- **Color Token Integrity:** All UI styles must strictly adhere to `--bg`, `--surface`, `--accent` (`#b8432f`), `--ink`, and dark mode tokens defined in `02_DESIGN_SYSTEM_AND_TOKENS.md`.

## Review Focus

1. **Viewer fallback lookup with missing course codes (C-01, R-03):** When a user visits `view.html?course=XYZ` or `view.html?url=...` without an exact match in `sgou_slm_data.json`, verify it falls back to PYQs, URL parameters, or generic PDF preview without ever rendering a dead-end error.
2. **Reader stream fallback on CORS/network failure (C-02):** When direct PDF fetch fails in `reader.html`, verify the fallback cascade tries edge proxy and browser fallback gracefully without a permanent blank canvas.
3. **Low-end Android DOM performance (H-01, H-02):** Rendering thousands of course items must use chunked/virtual rendering and instant skeleton placeholders so initial layout takes <100ms.
4. **CacheStorage offline resilience (C-03, Task 11):** Verifying that cached JSON datasets and previously opened textbooks load without an active internet connection.
5. **Mobile safe-area & navigation dock collisions (H-03):** Verifying that the mobile bottom navigation bar and reader bottom dock do not overlap or obscure interactive buttons on small viewports.

---

### Task 1: Fix Document Viewer (C-01 & R-03) Resilient Lookup & Fallback Cascade

**Files:**
- Modify: `view.html` (lines 1820-2070)
- Test: `tests/view_resilience.test.js`

**Interfaces:**
- Consumes: URL query parameters (`course`, `code`, `url`, `name`, `prog`, `level`, `type`, `examdate`), `sgou_slm_data.json`, `sgou_questions_cleaned.json`.
- Produces: Populated metadata header, stream preview stage, or direct PDF preview fallback without "Material not found" errors when valid URL/metadata exists.

- [ ] **Step 1: Write failing test in `tests/view_resilience.test.js`**

Verify that `view.html` extracts course metadata from fallback URL query parameters and searches both SLM and PYQ datasets with case-insensitive and normalized code matching, and never calls `showError` when `url` or `name` is present.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/view_resilience.test.js`  
Expected: FAIL (file or assertion missing).

- [ ] **Step 3: Implement resilient lookup logic in `view.html`**

Update `view.html`:
1. If `pdfUrl` is provided in the URL query, render `showCourse()` immediately using passed parameters (`name`, `code`, `prog`, `level`, `matType`), avoiding blocking JSON network fetches.
2. If only `courseCode` is provided, check both SLM textbooks and PYQ question papers simultaneously with normalized alphanumeric matching (e.g., matching `B21CA01` against `B21CA01DC`).
3. If not found in either dataset but `rawPdfUrl` exists, construct a fallback display model rather than invoking `showError`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/view_resilience.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add view.html tests/view_resilience.test.js
git commit -m "fix(viewer): implement resilient course metadata lookup and URL fallback"
```

---

### Task 2: Fix Academic Reader (C-02) Multi-Tier Fetch Fallback

**Files:**
- Modify: `reader.html` (lines 500-650)
- Test: `tests/reader_resilience.test.js`

**Interfaces:**
- Consumes: Target PDF URL, `window.SGOU_CONFIG.PDF_PROXY_URL`, browser `CacheStorage`.
- Produces: Resilient PDF document loading via direct fetch, edge proxy `/api/download?url=...&inline=1`, or cached blob.

- [ ] **Step 1: Write failing test in `tests/reader_resilience.test.js`**

Verify `reader.html` includes a retry cascade with proxy fallback when direct CloudFront fetch fails, and verifies offline `CacheStorage` fallback.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reader_resilience.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement multi-stage fallback in `reader.html`**

In `reader.html`:
1. Check `caches.match(fileUrl)` first for offline/instant render.
2. If network fetch fails with `TypeError: Failed to fetch` or CORS error, automatically retry via edge download proxy with `&inline=1`.
3. If both fail, display an informative, actionable fallback with direct download link, "Open in Browser", and retry buttons with clean typography (zero emojis).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/reader_resilience.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reader.html tests/reader_resilience.test.js
git commit -m "fix(reader): add multi-tier edge proxy fallback and offline cache loading"
```

---

### Task 3: Live Network Connectivity Pill & Offline State (C-03)

**Files:**
- Modify: `index.html`, `view.html`, `reader.html`
- Modify: `css/style.css`
- Modify: `js/script.js`
- Test: `tests/network_status.test.js`

**Interfaces:**
- Consumes: `navigator.onLine`, `window.addEventListener('online')`, `window.addEventListener('offline')`.
- Produces: Visual connection status pill in header: `.network-pill` (Online / Offline).

- [ ] **Step 1: Write failing test in `tests/network_status.test.js`**

Verify markup and event listeners for network status tracking exist across `index.html`, `view.html`, and `reader.html`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/network_status.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement network pill and offline handler**

1. Add `<div id="networkPill" class="network-pill" aria-live="polite"><span class="network-dot"></span><span class="network-text">Online</span></div>` to top navigation in `index.html`, `view.html`, and `reader.html`.
2. Add CSS in `css/style.css` for `.network-pill`, `.network-dot` with green online pulse and amber offline indicator.
3. Wire `online` and `offline` event handlers to update status dynamically and display a brief toast notification when offline.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/network_status.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html view.html reader.html css/style.css js/script.js tests/network_status.test.js
git commit -m "feat(ux): add live network connectivity indicator and offline feedback"
```

---

### Task 4: Content Security Policy Hardening (C-04)

**Files:**
- Modify: `index.html`, `view.html`, `reader.html`
- Modify: `dev_server.js`, `cloudflare-worker/worker.js`, `vercel.json`
- Test: `tests/csp_hardening.test.js`

**Interfaces:**
- Consumes: HTTP Security headers and HTML meta tags.
- Produces: Hardened CSP policy eliminating dangerous sinks while permitting Google Analytics 4, Google Fonts, and CloudFront PDF streams.

- [ ] **Step 1: Write failing test in `tests/csp_hardening.test.js`**

Verify that CSP headers restrict object-src, base-uri, frame-ancestors, and do not allow wildcards in connect-src or script-src beyond trusted origins.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/csp_hardening.test.js`  
Expected: FAIL.

- [ ] **Step 3: Update CSP in meta tags, Worker, and Vercel configuration**

1. Restrict CSP connect-src and frame-src strictly to `self`, `sgou.ac.in`, `d198y4z1gpgoxg.cloudfront.net`, `googletagmanager.com`, `google-analytics.com`, `workers.dev`.
2. Add `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
3. Synchronize `vercel.json`, `cloudflare-worker/worker.js`, and `dev_server.js` with identical security headers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/csp_hardening.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html view.html reader.html dev_server.js cloudflare-worker/worker.js vercel.json tests/csp_hardening.test.js
git commit -m "sec(csp): harden content security policies across edge and static headers"
```

---

### Task 5: Index Page Skeleton Loading & Progressive DOM Chunking (H-01, H-02)

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/script.js`
- Test: `tests/index_performance.test.js`

**Interfaces:**
- Consumes: Catalog dataset (2,400+ courses/PYQs).
- Produces: Instant skeleton preview on first paint, followed by chunked/lazy DOM insertion using `requestAnimationFrame` and `IntersectionObserver`.

- [ ] **Step 1: Write failing test in `tests/index_performance.test.js`**

Verify skeleton loader markup exists in `#courseGrid` and `js/script.js` employs chunked/batched rendering instead of synchronous 4,000-node DOM insertion.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/index_performance.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement skeleton cards and chunked catalog rendering**

1. Insert 6 accessible skeleton cards in `index.html` inside `#courseGrid` with shimmering gradients in `css/style.css`.
2. In `js/script.js`, chunk catalog rendering: render initial 24 cards immediately, then render subsequent cards in idle batches using `requestAnimationFrame` or on scroll proximity.
3. Preserve instant search filtering by querying the in-memory array rather than DOM nodes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/index_performance.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/script.js tests/index_performance.test.js
git commit -m "perf(catalog): add skeleton loaders and chunked DOM rendering for high performance"
```

---

### Task 6: Mobile Bottom Navigation Bar & Native App Touch Ergonomics (H-03)

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/script.js`
- Test: `tests/mobile_navigation.test.js`

**Interfaces:**
- Consumes: Touch events, mobile viewport detection (`@media (max-width: 640px)`).
- Produces: Fixed bottom navigation bar with 4 tabs: "Catalog", "Continue Reading", "Favorites", and "Support".

- [ ] **Step 1: Write failing test in `tests/mobile_navigation.test.js`**

Verify bottom navigation element `#mobileBottomNav` exists, has proper ARIA roles and labels, and activates respective views.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mobile_navigation.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement mobile bottom navigation bar**

1. Add semantic `<nav id="mobileBottomNav" class="mobile-bottom-nav" aria-label="Mobile Navigation">` with SVG icons (Catalog, Continue Reading, Favorites, Support).
2. Add CSS: sticky/fixed to bottom with `env(safe-area-inset-bottom)`, blur background, terracotta active state, hidden on desktop (>640px).
3. Wire tab click handlers to scroll to relevant sections or toggle filters (e.g. clicking "Favorites" immediately activates the Favorites filter).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mobile_navigation.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/script.js tests/mobile_navigation.test.js
git commit -m "feat(mobile): implement native-style bottom navigation bar with safe-area support"
```

---

### Task 7: "Continue Reading" Hero Shelf & Study Streak/Dwell Time (H-04, F-04)

**Files:**
- Modify: `reader.html`
- Modify: `index.html`
- Modify: `js/script.js`
- Modify: `css/style.css`
- Test: `tests/recent_reads.test.js`

**Interfaces:**
- Consumes: Reading progress and page position from `reader.html`.
- Produces: `localStorage` item `sgou_recent_reads` and a "Continue Reading" shelf on `index.html` showing the latest 2 accessed textbooks with page number, progress, and streak/dwell badge.

- [ ] **Step 1: Write failing test in `tests/recent_reads.test.js`**

Verify `reader.html` updates `sgou_recent_reads` with course code, page, progress, and timestamp, and `index.html` renders `#continueReadingShelf` when history exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/recent_reads.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement reading state persistence and Continue Reading shelf**

1. In `reader.html`: on page scroll/navigation, debounced write to `localStorage.setItem('sgou_recent_reads', JSON.stringify([...]))`.
2. In `index.html`: add container `<section id="continueReadingShelf" class="continue-reading-shelf" style="display:none;"></section>`.
3. In `js/script.js`: if recent reads exist, populate card with textbook title, course code, page progress (`Page 12 of 316`), study dwell badge, and direct "Resume Reading" button linking to `reader.html?file=...&page=12`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/recent_reads.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reader.html index.html js/script.js css/style.css tests/recent_reads.test.js
git commit -m "feat(reading): add Continue Reading shelf and reading position memory"
```

---

### Task 8: Fuzzy Search, Autocomplete & "Did You Mean?" Suggestions (H-05)

**Files:**
- Modify: `js/script.js`
- Modify: `index.html`
- Test: `tests/fuzzy_search.test.js`

**Interfaces:**
- Consumes: User search query string from `#searchInput`.
- Produces: Filtered course cards with fuzzy typo tolerance (e.g. "pyhton" -> "python", "progamming" -> "programming") and suggestions when 0 exact results match.

- [ ] **Step 1: Write failing test in `tests/fuzzy_search.test.js`**

Verify typo tolerance and suggestion generator in `js/script.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fuzzy_search.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement fuzzy matching and suggestions**

1. Add lightweight character subsequence matching and Levenshtein distance check (<2 edits) for search tokens.
2. If exact search returns 0 results, run fuzzy pass. If matches found, render them with a notice: `Showing results for "programming" instead`.
3. Record zero-result searches to telemetry only if fuzzy pass also returns 0 results.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fuzzy_search.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/script.js index.html tests/fuzzy_search.test.js
git commit -m "feat(search): add typo-tolerant fuzzy search and smart suggestions"
```

---

### Task 9: First-Visit Onboarding Guide & Dedicated Favorites View (H-06, H-07)

**Files:**
- Modify: `index.html`
- Modify: `js/script.js`
- Modify: `css/style.css`
- Test: `tests/onboarding_favorites.test.js`

**Interfaces:**
- Consumes: `localStorage.getItem('sgou_favorites')`, `localStorage.getItem('sgou_onboarded_v1')`.
- Produces: Dedicated "Favorites" filter chip showing count `Favorites (N)` and a 2-step fast programme selector for first-time visitors.

- [ ] **Step 1: Write failing test in `tests/onboarding_favorites.test.js`**

Verify Favorites filter chip dynamically reflects saved favorites, and first-time visitor onboarding modal triggers when not previously dismissed.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/onboarding_favorites.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement Favorites filter chip and Onboarding Guide**

1. Add `#filterFavoritesBtn` chip in filter bar (`♥ Favorites (0)`). Clicking filters `#courseGrid` to only display favorited courses.
2. Add `#onboardingModal` modal offering 1-click selection: "Choose your degree (BCA, BCom, BA, MA, MCom...)" and semester. Selecting saves preference and auto-applies filter.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/onboarding_favorites.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html js/script.js css/style.css tests/onboarding_favorites.test.js
git commit -m "feat(onboarding): add first-visit course picker and dedicated favorites catalog filter"
```

---

### Task 10: UI Polish, Dark Mode Contrast, WhatsApp Previews & Accessibility (U-01, U-02, U-03, U-05, U-06, F-03, F-08)

**Files:**
- Modify: `css/style.css`
- Modify: `js/script.js`
- Modify: `view.html`, `reader.html`, `index.html`
- Test: `tests/ui_polish_a11y.test.js`

**Interfaces:**
- Consumes: Theme tokens, card layout, Open Graph meta tags, screen reader live regions.
- Produces:
  - U-01, U-05: Course cards with material type & freshness indicators.
  - U-02: Enhanced dark mode border and elevation contrast.
  - U-03: AI companion discoverability pulse animation and first-time hint.
  - U-06: Strict prose max-line-length constraints (`max-width: 68ch`).
  - F-03: WhatsApp/Web Share deep link with rich text summary.
  - F-08: Screen reader `aria-live` route announcements.

- [ ] **Step 1: Write failing test in `tests/ui_polish_a11y.test.js`**

Verify dark mode token contrast, AI pulse styling, WhatsApp share text builder, and aria-live announcements.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ui_polish_a11y.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement UI Polish & Accessibility improvements**

1. In `css/style.css`: Adjust `[data-theme="dark"] .course-card` with higher border opacity and subtle shadow depth.
2. In `css/components/ai-companion.css`: Add subtle initial pulse animation to `#aiCompanionBtn` in reader bottom dock.
3. In `js/script.js` & `view.html`: Enhance WhatsApp share handler with formatted text and canonical deep links.
4. Add `#a11yAnnouncer` (`aria-live="polite"`, `class="sr-only"`) for screen reader transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ui_polish_a11y.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/style.css css/components/ai-companion.css js/script.js view.html reader.html tests/ui_polish_a11y.test.js
git commit -m "feat(ui): refine dark mode contrast, AI discoverability, WhatsApp sharing, and a11y announcements"
```

---

### Task 11: Platform Limit Shield & Deployment Hygiene (R-01, R-02)

**Files:**
- Modify: `sw.js`
- Modify: `cloudflare-worker/worker.js`
- Modify: `.vercelignore`, `.gitignore`
- Test: `tests/platform_limits_shield.test.js`

**Interfaces:**
- Consumes: Cloudflare Worker, Service Worker, Gemini API client.
- Produces: Guaranteed zero quota overruns: JSON dataset caching in `CacheStorage`, Gemini request rate limiting, scratch/test deployment exclusion. `sr/` folder preserved.

- [ ] **Step 1: Write failing test in `tests/platform_limits_shield.test.js`**

Verify `sw.js` caches `sgou_slm_data.json` and `sgou_questions_cleaned.json` with CacheFirst strategy, and `.vercelignore` excludes `.playwright-mcp/` and `scratch/`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/platform_limits_shield.test.js`  
Expected: FAIL.

- [ ] **Step 3: Implement caching and deployment exclusions**

1. Update `sw.js`: add `sgou_slm_data.json` and `sgou_questions_cleaned.json` to the offline cache pool with `StaleWhileRevalidate` or `CacheFirst` so repeat visits consume 0 bandwidth.
2. In `cloudflare-worker/worker.js`: ensure AI cache TTL remains 15 days in D1 and sliding-window rate limit enforces 5 req/min per unauthenticated IP.
3. Update `.vercelignore`: ensure `scratch/`, `.playwright-mcp/`, and test log files are strictly ignored. Keep `sr/` intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/platform_limits_shield.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sw.js cloudflare-worker/worker.js .vercelignore tests/platform_limits_shield.test.js
git commit -m "perf(shield): enforce dataset CacheStorage caching and deployment payload minimization"
```

---

### Task 12: End-to-End Regression & Verification Suite

**Files:**
- Test: `tests/*.test.js`

**Interfaces:**
- Runs the complete automated test suite across all 31+ existing tests and new test suites.

- [ ] **Step 1: Run all unit and integration tests**

Run: `node --test tests/*.test.js`  
Expected: 100% tests PASS, 0 failures.

- [ ] **Step 2: Verify zero-emoji compliance**

Ensure all newly created SVGs and text strings follow the Zero-Emoji Academic Policy.

- [ ] **Step 3: Commit and update plan state**

```bash
git status
git commit -m "test: verify all platform fixes, optimizations, and regression tests pass"
```
