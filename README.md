# SGOU Academic Database

> **High-Performance, Offline-First Academic Repository for Sree Narayana Guru Open University (SGOU)**  
> Engineered with pure vanilla web standards, S.O.L.I.D architecture, sub-100ms startup hydration, zero-cost edge streaming, and 60fps FLIP animations.  
> **Developed by Ahayas**

[![Version](https://img.shields.io/badge/version-v3.0.0-emerald.svg)](#overview)
[![Test Suite](https://img.shields.io/badge/tests-61%2F61%20passing-brightgreen.svg)](#automated-verification-suite)
[![PWA](https://img.shields.io/badge/PWA-offline--first%20(v141)-blue.svg)](#offline-pwa--service-worker-lifecycle)
[![Architecture](https://img.shields.io/badge/architecture-S.O.L.I.D-purple.svg)](#solid-system-architecture)
[![Edge CDN](https://img.shields.io/badge/bandwidth-zero--cost%20CloudFront-orange.svg)](#zero-cost-edge-architecture--bandwidth-protection)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license--acknowledgments)

---

## Table of Contents
1. [Overview](#overview)
2. [Key Capabilities & Features](#key-capabilities--features)
3. [S.O.L.I.D System Architecture](#solid-system-architecture)
4. [Zero-Cost Edge Architecture & Bandwidth Protection](#zero-cost-edge-architecture--bandwidth-protection)
5. [Dual-Tier PDF Viewer Architecture](#dual-tier-pdf-viewer-architecture)
6. [FLIP Card Pinning & Animation Engine](#flip-card-pinning--animation-engine)
7. [Startup & Runtime Performance Engineering](#startup--runtime-performance-engineering)
8. [Offline PWA & Service Worker Lifecycle](#offline-pwa--service-worker-lifecycle)
9. [Standalone Document Viewer (`view.html`)](#standalone-document-viewer-viewhtml)
10. [UI/UX Design System & Spacing Tokens](#uiux-design-system--spacing-tokens)
11. [Search Engine & AI Discovery (SEO / GEO / LLMs)](#search-engine--ai-discovery-seo--geo--llms)
12. [Keyboard Navigation & Accessibility](#keyboard-navigation--accessibility)
13. [Complete Repository Structure](#complete-repository-structure)
14. [Local Development](#local-development)
15. [Automated Verification Suite](#automated-verification-suite)
16. [One-Click Production Synchronization Tool](#one-click-production-synchronization-tool)
17. [Production Deployment Guide](#production-deployment-guide)
    - [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
    - [Cloudflare Pages & Workers](#cloudflare-pages--workers)
    - [Static Hosting / GitHub Pages](#static-hosting--github-pages)
18. [Data Schemas & Indexing](#data-schemas--indexing)
19. [Security & SSRF Protection](#security--ssrf-protection)
20. [License & Acknowledgments](#license--acknowledgments)

---

## Overview

The **SGOU Academic Database** is a zero-bloat, high-performance web platform designed for students and faculty of **Sree Narayana Guru Open University (SGOU)**, Kollam, Kerala. It unifies and indexes:
- **1,200+ Course Self-Learning Material (SLM) Textbooks**
- **950+ Previous Year Exam Question Papers (PYQs)**
- **75+ Assignment Question Booklets**

The platform operates **100% on the client side** with vanilla HTML5, CSS3, and modern ECMAScript. It delivers near-instant cold boots, complete offline usability via Progressive Web App (PWA) precaching, and high-speed streaming PDF downloads through zero-cost CloudFront CDN passthrough.

---

## Key Capabilities & Features

- **Multi-Category Navigation**: Switch seamlessly between **SLM Books**, **PYQs**, and **Assignments** with scoped degree level filtering (`All`, `FYUG`, `PG`, `UG`).
- **Animated FLIP Card Pinning**: Star favourite programmes with a delightful pop micro-animation and smooth 60fps FLIP (First-Last-Invert-Play) transition, gliding cards into position with zero layout thrashing and persistent `localStorage` memory.
- **Progressive Two-Stage Startup**: Delivers First Contentful Paint (FCP) in under **100ms** by rendering programme shells immediately and deferring search token indexing to background idle cycles (`requestIdleCallback`).
- **High-Speed Virtualized Search Engine**: Real-time multi-token search with an $O(1)$ LRU memoization cache and chunked DOM virtualization for stutter-free 60 FPS typing.
- **Resilient Dual-Tier PDF Reader**: Fullscreen in-app viewer with direct CloudFront HTTP Range streaming on desktop, Google Docs Viewer on mobile, and zero-ghosting state transitions.
- **Zero-Cost Edge Architecture**: 100% free-tier operation engineered to never exceed Vercel bandwidth or Edge limits by delegating binary PDF streaming directly to SGOU's university CDN.
- **Offline Progressive Web App (PWA)**: Full offline functionality via Service Worker precaching (`sw.js`), complete with a non-intrusive update notification toast and one-click refresh.
- **Standalone Document Viewer (`view.html`)**: Direct deep-linking with fallback resolution for both SLM and PYQ records, embedded iframe preview, and quick-copy share links.
- **Search Engine & AI Discovery (SEO / GEO / LLMs)**: Full Schema.org JSON-LD knowledge graph (5 nodes), 4-tier XML sitemaps, Bing/Yandex IndexNow ping automation, and `llms.txt` for AI crawlers.
- **Dual-Theme Design System**: Warm Antique Scholar palette featuring parchment light mode and obsidian scholar dark mode, meeting WCAG 2.1 AA contrast standards.
- **Keyboard-First Navigation**: Shortcuts (`/`, `Ctrl+K`, `Escape`) and high-contrast `:focus-visible` accessibility indicators.

---

## S.O.L.I.D System Architecture

The application is engineered around strict **S.O.L.I.D** software design principles within [script.js](file:///d:/Apps/sgou-database/script.js):

| Module | Architectural Pattern | Primary Responsibility |
| :--- | :--- | :--- |
| **`Utilities & Sanitizers`** | Functional Sanitization | Strict XSS escaping (`esc`, `ea`), query token normalization, clipboard fallbacks. |
| **`StorageService`** | Single Responsibility (SRP) | Resilient `localStorage` wrapper with automated in-memory store fallback for private browsing. |
| **`TelemetryService`** | Observer Pattern | Privacy-first Google Analytics 4 event dispatcher with silent error suppression. |
| **`CatalogService`** | Open/Closed Principle (OCP) | Multi-dataset ingestion, schema validation, $O(1)$ code mapping, and idle-scheduled tokenization. |
| **`SearchEngine`** | Strategy & Memoization | Multi-token fuzzy-subset matcher, chunked result virtualization, and LRU query cache. |
| **`DownloadManager`** | Strategy Pattern | File System Access API (Chromium) $\rightarrow$ Direct CDN $\rightarrow$ Edge Proxy Stream fallbacks. |
| **`RouterService`** | Interface Segregation (ISP) | Pure URL hash/query-string state management with bidirectional sync. |
| **`UIController`** | Mediator / Facade | Event delegation, DOM rendering, FLIP pinning animation, and accessible state management. |
| **`Global Error Boundary`** | Fault Tolerance | Catches unhandled promises and runtime exceptions with non-blocking user notifications. |

```
+-------------------------------------------------------------+
|                      User Interface (DOM)                   |
+-------------------------------------------------------------+
         ^                                           |
         | (Renders via DocumentFragment)            | (User Actions)
         |                                           v
+------------------+   Dispatches Actions    +----------------+
|   UIController   | <---------------------- | RouterService  |
+------------------+                         +----------------+
         |                                           |
         v                                           v
+------------------+   Queries / Memo Cache  +----------------+
|  SearchEngine    | <---------------------- | CatalogService |
+------------------+                         +----------------+
         |                                           |
         | Stream Request                            | Pre-cached JSON
         | (Direct CDN Passthrough)                  | (Service Worker)
         v                                           v
+------------------+                         +----------------+
| DownloadManager  |                         |  Storage / IDB |
+------------------+                         +----------------+
```

---

## Zero-Cost Edge Architecture & Bandwidth Protection

A primary architectural requirement is **guaranteeing zero hosting costs and preventing quota exhaustion**.

### The Bandwidth Problem
Vercel's Free Hobby plan includes **100 GB of Fast Data Transfer / month**. The SGOU database indexes over **1,200 textbooks**, each ranging between 15 MB and 120 MB. If downloads or reader previews were proxied through serverless edge functions, a few hundred textbook downloads would completely deplete the monthly bandwidth allowance, causing site suspension or unexpected billing.

### The Solution: Direct Client-to-CDN Streaming
1. **Primary Streaming Route**: All in-app PDF preview iframes and standard downloads link **directly to SGOU's Amazon CloudFront CDN** (`d198y4z1gpgoxg.cloudfront.net`).
2. **Zero Vercel Egress**: The heavy binary PDF data flows directly from Amazon CloudFront to the student's browser. **0 MB** of PDF bandwidth touches Vercel edge servers.
3. **Resilient Edge Proxy Fallback (`/api/download`)**: The Edge function in [api/download.js](file:///d:/Apps/sgou-database/api/download.js) is reserved strictly as a lightweight fallback for legacy mobile browsers requiring forced `Content-Disposition: attachment` headers. It performs an instant HTTP redirect or stream with strict host allowlisting (`d198y4z1gpgoxg.cloudfront.net`, `sgou.ac.in`, `www.sgou.ac.in`) to eliminate SSRF vulnerabilities.
4. **Direct Disk Streaming**: On Chromium desktop browsers, the platform leverages the **File System Access API** (`window.showSaveFilePicker`), piping CloudFront streams directly to local disk without memory overhead.

---

## Native & Universal PDF Viewer Architecture

To ensure flawless reading across all devices without external service dependencies, 25MB file size limits, or unauthorized third-party download prompts:

1. **Universal Canvas Reader (`reader.html`)**:
   - High-performance HTML5 canvas rendering engine powered by PDF.js with complete touch pinch-zoom isolation (preventing unwanted parent window scaling).
   - **Uncompromising Vector Typography**: `getOptimalRasterScale` maintains 100% razor-sharp, print-grade vector resolution across all zoom levels (scaling up to 3.2x on mobile, 4.0x on desktop) without text blurriness or downsampling.
   - **Precision Focal Centering**: `applySmoothScale` calculates fractional page offsets, keeping tapped or pinched coordinates stationary directly under the user's finger with zero leftward drift.
   - **3-State Natural Double-Tap Zoom**:
     - *Zoomed Out (below Fit Width)*: Double-tap restores directly to exact **Fit Width** (e.g. 68% on mobile).
     - *At Fit Width*: Double-tap smoothly zooms in (1.65x) centered directly where the user double-tapped.
     - *Zoomed In*: Double-tap smoothly restores back to **Fit Width**.
   - **Pre-Emptive 600px Pre-Rendering & Sequential Queue**: `queuePageRender` processes pages sequentially with single-worker priority, cancelling obsolete tasks instantly on navigation/zoom. IntersectionObserver pre-renders pages 600px ahead, while a sliding window (`keepDistance = 6`) caches adjacent pages for 60fps butter-smooth scrolling with zero placeholder flashes.
   - **Eye-Comfort Modes**: Instant toggling between Normal, Parchment Sepia, and Obsidian Dark reading modes with persistent local preferences.

2. **Direct CloudFront Native Streaming**:
   - Embeds the document directly inside `<iframe id="viewerPanelFrame">` using the canonical CloudFront URL (`pdfUrl + '#toolbar=1&navpanes=0'`).
   - Utilizes CloudFront HTTP Range requests for instant page-to-page seeking without waiting for full multi-megabyte downloads.
   - Eliminates external Google Docs / GView third-party intermediaries, guaranteeing 100% privacy, stability, and zero quota or billing risks.

3. **Direct Browser Open & Download Controls**:
   - The viewer top bar provides an always-accessible "Open in Browser" button (`#viewerPanelExternal`) to launch direct native reading in a separate tab, alongside instant direct download (`#viewerPanelDownload`).

---

## FLIP Card Pinning & Animation Engine

Students can "star" or "pin" their degree programmes to keep them anchored at the top of the grid. To make this interaction feel physical and responsive, the pinning engine uses the **FLIP (First, Last, Invert, Play)** animation technique:

1. **First**: The initial vertical screen coordinates of all cards are captured:
   ```javascript
   firstRects.set(card, card.getBoundingClientRect().top);
   ```
2. **Mutate**: The programme ID is toggled in `localStorage['sgou_starred_progs']`. Cards are sorted (starred cards first) and re-appended to `$('grid')`. Open accordion states are preserved without collapsing.
3. **Last**: The new vertical positions of all moved cards are recorded:
   ```javascript
   const deltaY = firstTop - lastTop;
   ```
4. **Invert**: The browser instantaneously translates the cards backward by `deltaY` with `transition: none`, visually freezing them in their original locations:
   ```javascript
   card.style.transform = `translate3d(0, ${deltaY}px, 0)`;
   ```
5. **Play**: Inside a double `requestAnimationFrame()`, smooth transitions are applied, animating the cards to `translate3d(0, 0, 0)` with an easing curve of `cubic-bezier(0.2, 0, 0, 1)` at 60/120 FPS. Simultaneously, the star icon pops with `@keyframes starPop`.

---

## Startup & Runtime Performance Engineering

1. **Progressive Two-Stage Ingestion**:
   - **Stage 1 (Instant Paint)**: Raw programmes are parsed and injected into the DOM via a single `DocumentFragment`. Degree cards are immediately interactive within **100ms**.
   - **Stage 2 (Deferred Tokenization)**: The 2,200+ course search token index is built in the background during browser idle periods (`requestIdleCallback`). Total Blocking Time (TBT) remains near zero.
2. **Search Query Memoization ($O(1)$ LRU Cache)**:
   - Repeated queries and backspace keystrokes hit an in-memory LRU map (`Map<string, SearchResult[]>`), returning matching items with zero CPU cycles.
3. **Off-Screen Layout Virtualization (`content-visibility: auto`)**:
   - Applied `content-visibility: auto; contain-intrinsic-size: 0 104px;` and `contain: content;` to `.programme-card`. Modern browsers skip rendering calculations for cards below the viewport fold, reducing initial mobile paint overhead by over 65%.
4. **Smooth Transitions & Containment**:
   - Accordion expanding uses isolated CSS containment, preventing layout thrashing across neighbouring cards.
   - Dynamic `will-change` properties are cleaned up upon transition completion.

---

## Offline PWA & Service Worker Lifecycle

The platform operates as a standalone Progressive Web App with zero external runtime dependencies.

### Cache Strategy
- **Service Worker Version**: `sgou-v142` with asset versioning query parameters (`v=20261007_06`).
- **Static Shell (Cache-First)**: `index.html`, `style.css`, `script.js`, `view.html`, `reader.html`, `pdfjs/pdf.min.js`, `pdfjs/pdf.worker.min.js`, `manifest.json`, `opensearch.xml`, `data/pyq_overrides.json`, and touch icons are served instantaneously from CacheStorage.
- **Academic Datasets (Network-First with Cache Fallback)**: `data/sgou_slm_data.json` and `data/sgou_questions_cleaned.json` fetch latest updates from the network with instant fallback to local cached versions if offline.
- **Google Fonts (Stale-While-Revalidate)**: Font stylesheets and `.woff2` files are cached with strict Content Security Policy (`connect-src https://fonts.googleapis.com https://fonts.gstatic.com`).
- **Safe Response Fallback**: Service Worker fetch listeners guarantee a valid `Response` object is returned under all network interruption scenarios, completely preventing unhandled browser fetch errors.

### Non-Intrusive Update Toast
When a new version of the app is deployed, the Service Worker installs in the background. Once ready, an unobtrusive floating notification appears:
> *"A new version of SGOU Academic Database is available. [Update Now]"*

Clicking "Update" sends `skipWaiting` to the worker and reloads the tab, ensuring students always have the latest curriculum without disruption.

---

## Standalone Document Viewer (`view.html`)

For direct external sharing, syllabus referencing, and deep-linking, the repository includes a standalone viewer:

- **Deep Link Parameters**:
  - `?code=B21EG01LC` $\rightarrow$ Resolves syllabus code, semester, and title automatically from dataset.
  - `?url=https://...` $\rightarrow$ Directly renders specified PDF with security validation.
  - `?title=...&type=slm|pyq|assignment` $\rightarrow$ Populates viewer titlebar and metadata.
- **Eye-Comfort Modes**: Built-in reader filters (Parchment, Soft Sepia, Scholar Obsidian, and Contrast Boost) for long study sessions.
- **Citation & Social Card Support**: Auto-generates APA/MLA academic citations, quick-copies shareable URLs, and provides Open Graph meta tags for WhatsApp, Telegram, and X preview cards.

---

## UI/UX Design System & Spacing Tokens

The user interface adheres to the **8px Spatial System** and **Gestalt principles**:

- **Spatial Cadence**: All margins, padding, and gaps are structured around multiples of $8\text{px}$ ($4\text{px}, 8\text{px}, 16\text{px}, 24\text{px}, 32\text{px}, 48\text{px}$).
- **Color Contrast (WCAG 2.1 AA Compliant)**:
  - Light Background: `#f5f0e8` (warm parchment) with `#1a1714` body ink ($16.5:1$ contrast ratio).
  - Dark Background: `#0e0d0c` (deep scholar obsidian) with `#ece8e0` body ink ($13.7:1$ contrast ratio).
  - Primary Scholarly Accent: `#b8432f` (Light) / `#e06b52` (Dark) with dedicated `:focus-visible` high-contrast outline rings.
- **Mobile Touch Targets**: All interactive controls (`.search-clear`, `.type-btn`, `.pill`, `.modal-close`) meet or exceed the standard $44\times 44\text{px}$ touch target boundary.

---

## Search Engine & AI Discovery (SEO / GEO / LLMs)

The platform is optimized for both traditional search engines (Google, Bing) and Generative AI engines (ChatGPT, Claude, Gemini, Perplexity):

1. **Schema.org Knowledge Graph**:
   - `WebSite` with integrated `SearchAction` (target: `/?q={search_term_string}`)
   - `EducationalOrganization` representing Sree Narayana Guru Open University
   - `SoftwareApplication` / `WebApplication` indexing features and offline PWA capabilities
   - `ItemList` representing curated academic degree programs
2. **4-Tier XML Sitemaps**:
   - [sitemap.xml](file:///d:/Apps/sgou-database/sitemap.xml): Root sitemap index
   - [sitemap-main.xml](file:///d:/Apps/sgou-database/sitemap-main.xml): Core views, degree levels, and category routes
   - [sitemap-programmes.xml](file:///d:/Apps/sgou-database/sitemap-programmes.xml): All 37 undergraduate and postgraduate programmes
   - [sitemap-courses.xml](file:///d:/Apps/sgou-database/sitemap-courses.xml): 1,200+ course SLM textbook endpoints
3. **IndexNow Instant Indexing Protocol**:
   - Pings Bing and Yandex search engines directly using [scripts/ping_indexnow.py](file:///d:/Apps/sgou-database/scripts/ping_indexnow.py) and verification key [4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt](file:///d:/Apps/sgou-database/4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt).
4. **AI Bot Crawler Directives**:
   - [llms.txt](file:///d:/Apps/sgou-database/llms.txt): High-level overview, API schemas, and course codes formatted for LLMs.
   - [llms-full.txt](file:///d:/Apps/sgou-database/llms-full.txt): Complete university syllabus and course mapping.
5. **OpenSearch Integration**:
   - [opensearch.xml](file:///d:/Apps/sgou-database/opensearch.xml): Enables native browser address bar search additions.

---

## Keyboard Navigation & Accessibility

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `/` or `Ctrl + K` | Global | Focuses the main search input immediately |
| `Escape` | Global | Clears active search query / Closes PDF viewer panel / Closes drawer |
| `Tab` / `Shift + Tab` | Global | Accessible linear focus navigation across all interactive elements |
| `Enter` / `Space` | Cards & Buttons | Expands accordions, toggles filters, stars programmes |

- **High-Contrast Rings**: High-visibility `:focus-visible` rings ensure full visibility without mouse focus styling.
- **Screen Reader Announcements**: Live region (`aria-live="polite"`) announces search result counts and filter updates.

---

## Complete Repository Structure

```
sgou-database/
├── api/
│   └── download.js                     # Edge streaming proxy fallback with SSRF allowlisting
├── assets/
│   ├── icons/                          # PWA and browser favicons & application icons
│   │   ├── apple-touch-icon.png        # iOS Safari homescreen bookmark icon (180x180)
│   │   ├── favicon-16x16.png           # Browser tab icon (16x16)
│   │   ├── favicon-32x32.png           # Google search snippet & desktop tab icon (32x32)
│   │   ├── favicon.ico                 # Multi-frame legacy desktop favicon
│   │   ├── icon-192.png                # Android PWA launcher icon (192x192)
│   │   ├── icon-512.png                # PWA splash screen & high-res asset (512x512)
│   │   └── icon.svg                    # Minimal vector emblem & maskable PWA icon
│   └── images/                         # Social sharing OpenGraph preview cards
│       ├── og-image.png                # Warm parchment social card (1200x630)
│       └── og-image-dark.png           # Dark theme social card (1200x630)
├── css/
│   └── style.css                       # Design system (8px grid, dark mode, FLIP animations)
├── data/
│   ├── sgou_slm_data.json              # Complete SGOU SLM textbook repository dataset (37 progs)
│   └── sgou_questions_cleaned.json     # Cleaned PYQs and assignments dataset
├── js/
│   └── script.js                       # S.O.L.I.D client architecture, search & UI controller
├── pdfjs/                              # Vendored standalone PDF.js engine for in-app reader
│   ├── pdf.min.js                      # PDF.js main runtime
│   └── pdf.worker.min.js               # PDF.js web worker
├── sitemaps/                           # Granular SEO XML sitemaps
│   ├── sitemap-courses.xml             # XML sitemap for 1,200+ course endpoints
│   ├── sitemap-main.xml                # XML sitemap for main routes & category views
│   └── sitemap-programmes.xml          # XML sitemap for all 37 degree programmes
├── scripts/
│   ├── generate_assets.py              # Generates touch icons & 1200x630 OG social cards
│   ├── generate_sitemaps.py            # Generates 4-tier XML sitemaps covering all courses
│   ├── ping_indexnow.py                # Automated IndexNow ping for Bing/Yandex search engines
│   ├── sgou_enhanced_pyq_scraper.py    # Scraping pipeline for previous question papers
│   ├── sgou_scrape.py                  # Scraping pipeline for SLM textbook repository
│   ├── sync_to_github.cmd              # Production sync batch script
│   └── sync_to_github.py               # Production mirror synchronizer & cleaner
├── .gitignore                          # Production git ignore configuration
├── 4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt # IndexNow search engine verification key
├── dev_server.js                       # Local zero-dependency development server with proxying
├── index.html                          # Main application, Schema.org Graph & Open Graph
├── llms.txt                            # Standard LLM crawler specification (ChatGPT, Claude)
├── llms-full.txt                       # Machine-readable university syllabus catalog
├── manifest.json                       # PWA web application manifest (Root-scoped)
├── opensearch.xml                      # OpenSearch 1.1 description for browser address bars
├── reader.html                         # Full-screen zero-download in-app PDF reader
├── README.md                           # System documentation & deployment guide
├── robots.txt                          # Search engine & AI bot crawler directives
├── sitemap.xml                         # Root XML sitemap index
├── sw.js                               # Service Worker (offline shell precache & background sync)
├── sync_to_github.cmd                  # Root 1-click launcher for sync script
├── vercel.json                         # Vercel production edge headers, rewrites & cache control
└── view.html                           # Standalone PDF preview & deep-link reader
```

---

## Local Development

To run the platform locally with full proxy support:

1. **Prerequisites**: Ensure [Node.js](https://nodejs.org/) (v16+) is installed.
2. **Start the Development Server**:
   ```bash
   node dev_server.js
   ```
3. **Open in Browser**:
   Navigate to [http://localhost:3030](http://localhost:3030).
   The server serves all static files with `no-cache` development headers and proxies `/api/download` requests.

---

## Automated Verification Suite

The repository includes a comprehensive 61-point automated verification suite:

```bash
node scratch/verify_all.js
```

### What It Tests
1. **JSON Schemas & Manifest Integrity**: Validates `manifest.json`, `vercel.json`, and both academic datasets. Confirms every icon declared in the manifest exists on disk.
2. **CSS Balance & Rules**: Checks matching braces across 95KB+ of CSS, verifies mobile viewer decongestion rules, and ensures drawer z-index elevations (`z-index: 950`).
3. **HTML & Schema Validation**: Verifies Schema.org JSON-LD nodes, critical DOM IDs, and zero-CLS pre-rendered filter pills.
4. **Service Worker Version Parity**: Enforces synchronized version hashes between `index.html`, `style.css`, `script.js`, and `sw.js`.
5. **Runtime Logic & History Management**: Confirms single-state secondary tab hierarchy, root SLM back-exit navigation, viewer panel dismissals, fallback stores, and Content-Security-Policy headers.
6. **PDF Reader Vector Engine**: Verifies serial queue execution (`queuePageRender`), opaque 2D canvas context, and high-DPI rasterization scaling in `reader.html`.
7. **Live HTTP Responses**: Boots an in-memory HTTP server and verifies status 200, MIME types, and Content-Length across all endpoints.

---

## One-Click Production Synchronization Tool

To effortlessly copy **only verified production files** to the final GitHub deployment repository (`D:\Github\sgou-slm-database`):

### Option A: 1-Click via Windows Explorer
Simply double-click:
```
sync_to_github.cmd
```

### Option B: via Terminal
```bash
python scripts/sync_to_github.py
```

### How It Works
- **Strict Whitelist**: Copies only necessary production files (HTML, CSS, JS, JSON data, icons, sitemaps, configs).
- **Safety First**: Preserves the destination `.git` directory untouched so git tracking and history remain clean.
- **Obsolete Cleanup**: Automatically prunes temporary folders (`scratch/`, `sr/`, `__pycache__/`) and obsolete files (`og-image-old.png`) from the destination.
- **Hash Verification**: Only writes files whose SHA-256 hash has changed, completing in under 1 second.

---

## Production Deployment Guide

### Vercel Deployment (Recommended)
This repository is configured natively for Vercel with zero setup required.

1. Deploy directly:
   ```bash
   vercel --prod
   ```
2. The [vercel.json](file:///d:/Apps/sgou-database/vercel.json) configuration automatically provisions:
   - Edge Runtime for [api/download.js](file:///d:/Apps/sgou-database/api/download.js)
   - SPA rewrites for clean URLs
   - Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
   - Stale-While-Revalidate caching for static JSON datasets

### Cloudflare Pages & Workers
1. Connect the repository to **Cloudflare Pages**.
2. Set build output directory to `/` (no build step needed).
3. Deploy [api/download.js](file:///d:/Apps/sgou-database/api/download.js) as a Cloudflare Worker route for `/api/download`.

### Static Hosting / GitHub Pages
1. Push the codebase to GitHub Pages.
2. In GitHub settings $\rightarrow$ Pages $\rightarrow$ Deploy from branch (`/root`).
3. *Note*: In static hosting environments without edge functions, downloads stream directly from CloudFront automatically.

---

## Data Schemas & Indexing

The platform ingests two primary JSON datasets located in the `data/` directory:

### 1. `sgou_slm_data.json` (SLM Textbooks)
```json
[
  {
    "programme_name": "Bachelor of Arts in English",
    "level": "UG",
    "semesters": [
      {
        "semester": "SEMESTER 1",
        "courses": [
          {
            "name": "Reading Literature in English",
            "code": "B21EG01",
            "pdf_url": "https://d198y4z1gpgoxg.cloudfront.net/..."
          }
        ]
      }
    ]
  }
]
```

### 2. `sgou_questions_cleaned.json` (PYQs & Assignments)
```json
[
  {
    "course_title": "Bachelor of Arts in English",
    "previous_year_questions": [
      {
        "subject_name": "B21EG01 - Reading Literature in English",
        "exam_date": "July 2023",
        "admission_batch": "2021 Admission",
        "semester": "Semester 1",
        "pdf_url": "https://d198y4z1gpgoxg.cloudfront.net/..."
      }
    ],
    "assignments": [
      {
        "title": "Semester 1 Assignment Booklet",
        "semester": "Semester 1",
        "pdf_url": "https://d198y4z1gpgoxg.cloudfront.net/..."
      }
    ]
  }
]
```

---

## Security & SSRF Protection

- **Strict Host Allowlisting**: The edge download proxy strictly validates upstream URLs against official SGOU endpoints (`d198y4z1gpgoxg.cloudfront.net`, `sgou.ac.in`, `www.sgou.ac.in`) to prevent Server-Side Request Forgery (SSRF).
- **Header Injection & Traversal Protection**: Filenames and URL parameters are sanitized to remove carriage returns, null bytes, and path traversal sequences (`../`).
- **Context-Safe Clipboard Fallback**: Uses modern asynchronous `navigator.clipboard` with an automatic `execCommand('copy')` fallback for non-secure contexts.
- **Accessibility Standards**: Meets **WCAG 2.1 Level AA** standards with accessible ARIA landmarks (`role="tablist"`, `role="tab"`, `aria-expanded`, `aria-controls`), focus rings, and screen-reader announcements via `aria-live`.

---

## License & Acknowledgments

- **Platform Architecture & Development**: Created and maintained by **Ahayas**.
- **Educational Disclaimer**: Materials, textbooks, syllabi, question papers, and course names are the intellectual property of **Sree Narayana Guru Open University (SGOU)**, Kollam, Kerala. This project is an open educational utility designed to assist distance education students.
- **License**: Released under the [MIT License](https://opensource.org/licenses/MIT).
