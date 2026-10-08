# SGOU Academic Database

> **Enterprise-Grade, Offline-First Digital Academic Repository for Sree Narayana Guru Open University (SGOU)**  
> Engineered with pure vanilla web standards, modular component architecture, S.O.L.I.D principles, cognitive UX ergonomics, sub-100ms startup hydration, zero-cost edge streaming, and 60fps FLIP animations.  
> **Designed and Developed by Ahayas**

[![Version](https://img.shields.io/badge/version-v3.1.0-emerald.svg)](#overview)
[![Test Suite](https://img.shields.io/badge/tests-70%2F70%20passing-brightgreen.svg)](#automated-verification-suite)
[![PWA](https://img.shields.io/badge/PWA-offline--first%20(v149)-blue.svg)](#offline-pwa--service-worker-lifecycle)
[![Architecture](https://img.shields.io/badge/architecture-Modular%20Components%20%26%20S.O.L.I.D-purple.svg)](#solid-system-architecture)
[![Edge CDN](https://img.shields.io/badge/bandwidth-zero--cost%20CloudFront-orange.svg)](#zero-cost-edge-architecture--bandwidth-protection)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license--acknowledgments)

---

## Table of Contents
1. [Executive Overview](#executive-overview)
2. [Key Capabilities & Innovations](#key-capabilities--innovations)
3. [Modular Component System](#modular-component-system)
4. [S.O.L.I.D System Architecture](#solid-system-architecture)
5. [UI/UX Psychology & Cognitive Ergonomics](#uiux-psychology--cognitive-ergonomics)
6. [Voluntary Community Support Architecture](#voluntary-community-support-architecture)
7. [Zero-Cost Edge Architecture & Bandwidth Protection](#zero-cost-edge-architecture--bandwidth-protection)
8. [High-Performance PDF Viewer & Canvas Reader Engine](#high-performance-pdf-viewer--canvas-reader-engine)
9. [FLIP Card Pinning & Animation Engine](#flip-card-pinning--animation-engine)
10. [Startup & Runtime Performance Engineering](#startup--runtime-performance-engineering)
11. [Offline PWA & Service Worker Lifecycle](#offline-pwa--service-worker-lifecycle)
12. [Standalone Document Viewer (`view.html`)](#standalone-document-viewer-viewhtml)
13. [Search Engine & AI Discovery (SEO / GEO / LLMs)](#search-engine--ai-discovery-seo--geo--llms)
14. [Keyboard Navigation & Accessibility Standards](#keyboard-navigation--accessibility-standards)
15. [Repository Structure](#repository-structure)
16. [Local Development](#local-development)
17. [Automated Verification Suite](#automated-verification-suite)
18. [Production Deployment Guide](#production-deployment-guide)
19. [Data Schemas & Indexing](#data-schemas--indexing)
20. [Security & SSRF Mitigation](#security--ssrf-mitigation)
21. [License & Acknowledgments](#license--acknowledgments)

---

## Executive Overview

The **SGOU Academic Database** is an open-access, zero-bloat digital repository built specifically for students and faculty of **Sree Narayana Guru Open University (SGOU)**, Kollam, Kerala. It unifies, normalizes, and indexes the complete academic catalog:

- **1,200+ Course Self-Learning Material (SLM) Textbooks** across FYUG, UG, and PG curricula
- **950+ Previous Year Exam Question Papers (PYQs)** organized by examination session and degree
- **75+ Official Assignment Question Booklets**

### Core Architectural Philosophy
1. **Zero External Runtime Bloat**: Zero megabyte runtime dependencies. Zero client-side frameworks (no React, Vue, or Angular bundles). The entire runtime is constructed with lightweight, browser-native HTML5, CSS3, and modern ECMAScript.
2. **Instant Cognitive Relief**: Academic portals are notoriously congested and disorienting. SGOU Academic Database leverages cognitive psychology, clear visual hierarchy, and instant client-side search to remove friction for learners.
3. **Resilient Offline Autonomy**: Full offline PWA support ensures students in low-connectivity rural regions can search curricula, read downloaded coursework, and browse degree syllabi without active cellular data.
4. **Infinite Free-Tier Scalability**: All binary streaming delegates directly to university CloudFront edge distribution nodes, completely protecting hosting budgets from bandwidth exhaustion.

---

## Key Capabilities & Innovations

- **Multi-Category Navigation**: Switch seamlessly between **SLM Books**, **PYQs**, and **Assignments** with scoped degree level filtering (`All`, `FYUG`, `PG`, `UG`).
- **Animated FLIP Card Pinning**: Star favourite programmes with a physics-based micro-animation and smooth 60fps FLIP (First-Last-Invert-Play) transition, gliding cards into position with zero layout thrashing and persistent `localStorage` memory.
- **Progressive Two-Stage Startup**: Delivers First Contentful Paint (FCP) in under **100ms** by rendering programme shells immediately and deferring search token indexing to background idle cycles (`requestIdleCallback`).
- **High-Speed Virtualized Search Engine**: Real-time multi-token search with an $O(1)$ LRU memoization cache and chunked DOM virtualization for stutter-free 60 FPS typing.
- **Distraction-Free Reading**: Dual reading environments featuring a distraction-free, high-DPI HTML5 canvas vector reader (`reader.html`) and direct CloudFront HTTP Range streaming on desktop.
- **Community Support Integration**: Non-transactional, empathetic community tip jar allowing students and supporters to keep the platform ad-free via instant UPI payments and dynamic QR code generation.
- **Dual-Theme Academic Design System**: Carefully calibrated Antique Scholar palette featuring parchment light mode and obsidian scholar dark mode, meeting WCAG AAA contrast standards.
- **Comprehensive Verification**: 70-point automated integrity suite ensuring JSON correctness, CSS brace balance, shell parity, and live HTTP endpoint availability.

---

## Modular Component System

To eliminate code duplication across pages (`index.html`, `view.html`, `reader.html`) while maintaining 100% dependency-free operation, the codebase is decomposed into clean, self-contained modular components:

```
css/components/
├── support-modal.css           # Modular styling for voluntary contribution modal
└── toast.css                   # Modular toast alert & notification styles

js/components/
├── support-modal.js            # Universal self-mounting SupportModal component (UMD)
├── theme.js                    # Cross-tab synchronized light/dark theme manager
└── toast.js                    # Non-blocking, accessible toast feedback system

js/utils/
└── clipboard.js                # Resilient async navigator.clipboard with execCommand fallback
```

### Component Architecture Highlights

- **Universal Module Definition (UMD)**: All shared components export cleanly via UMD, enabling usage directly via `<script>` tags, CommonJS, or AMD environments without bundlers.
- **Self-Mounting Architecture**: `SupportModal` and `Toast` auto-detect the DOM environment. If pre-rendered markup exists, they attach to it; if absent, they mount their isolated DOM tree dynamically on first access.
- **Event Delegation**: Global triggers (`#headerSupportBtn`, `#topbarSupport`, `[data-action="support"]`) bind to a single top-level event listener, preventing memory leaks during rapid page changes.

---

## S.O.L.I.D System Architecture

The client application within [script.js](file:///d:/Apps/sgou-database/js/script.js) adheres to **S.O.L.I.D** software design principles:

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

## UI/UX Psychology & Cognitive Ergonomics

Designing for distance education students requires mitigating **cognitive load**, **visual fatigue**, and **transaction anxiety**. The design system applies principles from cognitive psychology:

### 1. Standardized Academic Typographic Hierarchy
The platform standardizes on an intentional three-typeface academic triad loaded with font-display swap:
- **Primary Interface**: `'Plus Jakarta Sans'`, modern geometric sans-serif engineered for digital legibility, optimal x-height, and low reading strain.
- **Academic Headings**: `'DM Serif Display'`, transitional editorial serif evoking scholarly distinction and trust.
- **Monospace & Metadata**: `'DM Mono'`, clean fixed-width font providing tabular clarity for course codes, dates, and file sizes.

#### Cognitive Typographic Tokens
All font sizes derive from mathematical typographic scales calibrated for cognitive scanning:
```css
:root {
  --text-2xs:  10px;    /* Micro tags & metadata chips */
  --text-xs:   11.5px;  /* Secondary captions, timestamps */
  --text-sm:   13px;    /* Course codes, subheaders, chips */
  --text-base: 14px;    /* Standard UI reading body text */
  --text-md:   15.5px;  /* Section subheadings, callouts */
  --text-lg:   18px;    /* Card titles, modal headers */
  --text-xl:   22px;    /* Hero titles, primary headings */
  --text-2xl:  28px;    /* Display banner headlines */
}
```

### 2. Warm Antique Scholar Palette (WCAG AAA)
- **Light Theme (Parchment Scholar)**: Warm parchment background (`#ebe4d6`) paired with deep charcoal ink (`#181512`), delivering over $16.5:1$ contrast ratio without the harsh retina glare of pure `#ffffff`.
- **Dark Theme (Obsidian Scholar)**: Rich obsidian background (`#141210`) with soft ivory text (`#f0ede8`), eliminating blue-light sleep disruption during late-night study sessions.

### 3. Fitts's Law Ergonomic Touch Expansion
All interactive mobile touch targets (close buttons, share links, star pins, search reset) are expanded via pseudo-elements to meet or exceed the standard $44\times 44\text{px}$ touch envelope, preventing mis-taps on touchscreen devices.

---

## Voluntary Community Support Architecture

To keep the platform ad-free, independent, and free for all students, a voluntary contribution modal is integrated with psychological care:

### Empathetic, Non-Transactional Copy
- **Zero Commercial Phrasing**: Words like "Pay", "Buy", "Fee", or "Checkout" are strictly avoided to eliminate transactional apprehension.
- **Community Warmth**: Phrased around "Support Project", "Keep this community academic portal free & active", and "Voluntary student contribution".

### Highlighted Crimson Heart Touchpoints
- Standardized crimson rose highlight tokens (`--heart-red: #e11d48` in light theme, `#fb7185` in dark theme).
- Soft tinted background pill (`--heart-red-bg: rgba(225, 29, 72, 0.08)`), subtle border, and filled heart SVG.
- Instant keyboard invocation: Pressing <kbd>U</kbd> anywhere on desktop opens the support modal; <kbd>Escape</kbd> closes it.

### Desktop & Mobile Frictionless Flow
- **Mobile (1-Tap Deep Linking)**: Dynamic UPI URI (`upi://pay?pa=ahayas.info@oksbi&pn=Ahayas&am=25...`) opens Google Pay, PhonePe, Paytm, BHIM, or CRED directly with one tap.
- **Desktop (Vector QR Code)**: Dynamic 145px crisp SVG QR generated in-memory via vendored `qrcode.min.js`, allowing instant scanning from phone cameras without third-party gateways.
- **Resilient VPA Copying**: One-click clipboard copy of UPI ID (`ahayas.info@oksbi`) with visual feedback (`Copied! ✓`) and non-blocking toast notifications.

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

## High-Performance PDF Viewer & Canvas Reader Engine

To ensure flawless reading across all devices without external service dependencies, 25MB file size limits, or unauthorized third-party download prompts:

### 1. Universal Canvas Reader (`reader.html`)
- **HTML5 Canvas Vector Engine**: High-performance canvas rendering powered by PDF.js with complete touch pinch-zoom isolation (preventing parent window scrolling interference).
- **Uncompromising Vector Typography**: `getOptimalRasterScale` maintains 100% razor-sharp, print-grade vector resolution across all zoom levels (scaling up to 3.2x on mobile, 4.0x on desktop) without text blurriness or downsampling.
- **Precision Focal Centering**: `applySmoothScale` calculates fractional page offsets, keeping tapped or pinched coordinates stationary directly under the user's finger with zero leftward drift.
- **3-State Natural Double-Tap Zoom**:
  - *Zoomed Out (below Fit Width)*: Double-tap restores directly to exact **Fit Width** (e.g. 68% on mobile).
  - *At Fit Width*: Double-tap smoothly zooms in (1.65x) centered directly where the user double-tapped.
  - *Zoomed In*: Double-tap smoothly restores back to **Fit Width**.
- **Pre-Emptive 600px Pre-Rendering & Sequential Queue**: `queuePageRender` processes pages sequentially with single-worker priority, cancelling obsolete tasks instantly on navigation/zoom. IntersectionObserver pre-renders pages 600px ahead, while a sliding window (`keepDistance = 6`) caches adjacent pages for 60fps butter-smooth scrolling with zero placeholder flashes.
- **Eye-Comfort Modes**: Instant toggling between Normal, Parchment Sepia, and Obsidian Dark reading modes with persistent local preferences.
- **Distraction-Free Controls Bar**: Streamlined floating toolbar `< 1 / 243 > | ➖ 57% ➕ | 🌙 🏳️ ⛶` focused purely on reading, navigation, and page rendering.

### 2. Direct CloudFront Native Streaming
- Embeds the document directly inside `<iframe id="viewerPanelFrame">` using the canonical CloudFront URL (`pdfUrl + '#toolbar=1&navpanes=0'`).
- Utilizes CloudFront HTTP Range requests for instant page-to-page seeking without waiting for full multi-megabyte downloads.
- Eliminates external Google Docs / GView third-party intermediaries, guaranteeing 100% privacy, stability, and zero quota or billing risks.

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
- **Service Worker Version**: `sgou-v149` with asset versioning query parameters (`v=20261008_04`).
- **Static Shell (Cache-First)**: `index.html`, `style.css`, `script.js`, `css/components/*`, `js/components/*`, `js/utils/*`, `js/qrcode.min.js`, `view.html`, `reader.html`, `pdfjs/pdf.min.js`, `pdfjs/pdf.worker.min.js`, `manifest.json`, `opensearch.xml`, `data/pyq_overrides.json`, and touch icons are served instantaneously from CacheStorage.
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

## Keyboard Navigation & Accessibility Standards

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| <kbd>/</kbd> or <kbd>Ctrl + K</kbd> | Global | Focuses the main search input immediately |
| <kbd>U</kbd> | Global / Viewer / Reader | Opens voluntary UPI Support & Community Tip Jar modal |
| <kbd>Escape</kbd> | Global | Clears active search query / Closes PDF viewer panel / Closes drawer / Closes modals |
| <kbd>Tab</kbd> / <kbd>Shift + Tab</kbd> | Global | Accessible linear focus navigation across all interactive elements |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Cards & Buttons | Expands accordions, toggles filters, stars programmes |
| <kbd>T</kbd> | Catalog / Viewer | Toggles dark / light scholar theme |
| <kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd> | Canvas Reader | Zoom in, zoom out, restore fit-to-width zoom |

- **High-Contrast Rings**: High-visibility `:focus-visible` rings ensure full visibility without mouse focus styling.
- **Screen Reader Announcements**: Live region (`aria-live="polite"`) announces search result counts and filter updates.

---

## Repository Structure

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
│   ├── components/                     # Modular component styles
│   │   ├── support-modal.css           # Voluntary contribution modal design tokens
│   │   └── toast.css                   # Floating feedback toast alert component
│   └── style.css                       # Core design system (8px grid, typography, FLIP animations)
├── data/
│   ├── pyq_overrides.json              # Curated metadata overrides for question papers
│   ├── sgou_questions_cleaned.json     # Cleaned PYQs and assignments dataset
│   └── sgou_slm_data.json              # Complete SGOU SLM textbook repository dataset (37 progs)
├── js/
│   ├── components/                     # Reusable UI component modules (UMD)
│   │   ├── support-modal.js            # Self-mounting SupportModal component
│   │   ├── theme.js                    # Cross-tab synchronized light/dark theme manager
│   │   └── toast.js                    # Non-blocking, accessible toast feedback system
│   ├── utils/                          # Common utility modules
│   │   └── clipboard.js                # Async clipboard helper with execCommand fallback
│   ├── qrcode.min.js                   # Zero-dependency offline vector QR code generator (20KB)
│   └── script.js                       # S.O.L.I.D client architecture, search & UI controller
├── pdfjs/                              # Standalone PDF.js vector engine for in-app reader
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
│   ├── sync_to_github.cmd              # Production sync batch launcher
│   └── sync_to_github.py               # Production mirror synchronizer & integrity cleaner
├── .gitignore                          # Production git ignore configuration
├── 4a8f9c1d2e3b4a5f60718293a4b5c6d7.txt # IndexNow search engine verification key
├── dev_server.js                       # Zero-dependency local development server with proxying
├── index.html                          # Main application, Schema.org Graph & Open Graph
├── llms.txt                            # Standard LLM crawler specification (ChatGPT, Claude)
├── llms-full.txt                       # Machine-readable university syllabus catalog
├── manifest.json                       # PWA web application manifest (Root-scoped)
├── opensearch.xml                      # OpenSearch 1.1 description for browser address bars
├── reader.html                         # Full-screen zero-download in-app vector PDF reader
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

The repository includes a comprehensive 70-point automated verification suite:

```bash
node scratch/verify_all.js
```

### What It Tests
1. **JSON Schemas & Manifest Integrity**: Validates `manifest.json`, `vercel.json`, and all academic datasets. Confirms every icon declared in the manifest exists on disk.
2. **CSS Balance & Rules**: Checks matching braces across 124KB+ of CSS, verifies mobile viewer decongestion rules, and ensures drawer z-index elevations (`z-index: 950`).
3. **HTML & Schema Validation**: Verifies Schema.org JSON-LD nodes, critical DOM IDs, and zero-CLS pre-rendered filter pills.
4. **Service Worker Version Parity**: Enforces synchronized version hashes between `index.html`, `style.css`, `script.js`, `support-modal.css`, and `sw.js`.
5. **Runtime Logic & History Management**: Confirms single-state secondary tab hierarchy, root SLM back-exit navigation, viewer panel dismissals, fallback stores, and Content-Security-Policy headers.
6. **PDF Reader Vector Engine**: Verifies serial queue execution (`queuePageRender`), opaque 2D canvas context, and high-DPI rasterization scaling in `reader.html`.
7. **Live HTTP Responses**: Boots an in-memory HTTP server and verifies status 200, MIME types, and Content-Length across all 14 primary endpoints.

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

## Security & SSRF Mitigation

- **Strict Host Allowlisting**: The edge download proxy strictly validates upstream URLs against official SGOU endpoints (`d198y4z1gpgoxg.cloudfront.net`, `sgou.ac.in`, `www.sgou.ac.in`) to prevent Server-Side Request Forgery (SSRF).
- **Header Injection & Traversal Protection**: Filenames and URL parameters are sanitized to remove carriage returns, null bytes, and path traversal sequences (`../`).
- **Context-Safe Clipboard Fallback**: Uses modern asynchronous `navigator.clipboard` with an automatic `execCommand('copy')` fallback for non-secure contexts.
- **Accessibility Standards**: Meets **WCAG 2.1 Level AA** standards with accessible ARIA landmarks (`role="tablist"`, `role="tab"`, `aria-expanded`, `aria-controls`), focus rings, and screen-reader announcements via `aria-live`.

---

## License & Acknowledgments

- **Platform Architecture & Development**: Designed, engineered, and maintained by **Ahayas**.
- **Educational Disclaimer**: Materials, textbooks, syllabi, question papers, and course names are the intellectual property of **Sree Narayana Guru Open University (SGOU)**, Kollam, Kerala. This project is an open educational utility designed to assist distance education students.
- **License**: Released under the [MIT License](https://opensource.org/licenses/MIT).
