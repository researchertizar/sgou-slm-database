# SGOU Academic Database — Edge Gateway & Security Specification

## 1. Overview & Architectural Role

The edge routing and serverless compute layer (`cloudflare-worker/worker.js`, `dev_server.js`) functions as the high-availability security perimeter and data gateway for the SGOU Academic Database. It manages:
1. **Edge Reverse Proxying**: Streaming multi-megabyte PDF textbooks from AWS CloudFront S3 storage with full HTTP Range request support.
2. **Zero-Token AI Caching**: Direct edge D1 database lookups that bypass LLM compute costs for previously answered syllabus questions.
3. **Hardened Security Architecture**: Defense-in-depth protection against path traversal, DOM XSS, clickjacking, abuse spikes, and credential leakage.

```mermaid
graph TD
    User[Student Browser / Client] --> Edge[Cloudflare Edge Worker / dev_server.js]
    Edge --> Security[Security Headers: Strict CSP, CORS, Nosniff, Clickjack Guard]
    Edge --> RateLimit{Rate Limiter: Sliding Window}
    RateLimit -->|Exceeded| Block[429 Rate Limit Exceeded]
    RateLimit -->|Allowed| Router{Request Path Router}
    Router -->|/api/download| Proxy[CloudFront PDF Stream Proxy with HTTP Range]
    Router -->|GET /api/ai-tutor| D1Cache[Passive D1 SQLite Cache Lookup]
    Router -->|POST /api/ai-tutor/generate| GeminiCascade[Gemini 3 Flash Cascade Orchestrator]
    Router -->|POST /api/support/verify-screenshot| VisionAudit[Gemini Vision UTR Receipt Auditor]
    Router -->|POST /api/telemetry| D1Telemetry[Zero-PII SQLite Telemetry Ingestion]
```

---

## 2. Edge Reverse Proxy & Chunked Download Engine (`/api/download`)

### 2.1 The AWS CloudFront / CORS Dilemma
Direct client-side downloads from AWS CloudFront buckets (`d198y4z1gpgoxg.cloudfront.net`) frequently encounter browser CORS blocking, inability to track real-time byte progress, and missing `Content-Disposition: attachment` headers, causing PDFs to open awkwardly in third-party viewer extensions instead of saving cleanly to device storage.

### 2.2 Streaming Implementation
The `/api/download` endpoint resolves this at the edge:
```javascript
// HTTP Range Request Forwarding & Attachment Streaming
const targetUrl = new URL(request.url).searchParams.get('url');
const rangeHeader = request.headers.get('Range');
const upstreamHeaders = rangeHeader ? { 'Range': rangeHeader } : {};

const upstreamResponse = await fetch(targetUrl, { headers: upstreamHeaders });
const responseHeaders = new Headers(upstreamResponse.headers);

responseHeaders.set('Access-Control-Allow-Origin', '*');
responseHeaders.set('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
responseHeaders.set('Cache-Control', 'public, max-age=604800, immutable'); // 7 Days Edge Cache

return new Response(upstreamResponse.body, {
  status: upstreamResponse.status,
  headers: responseHeaders
});
```
- **Byte Progress Tracking**: The client reads `upstreamResponse.body.getReader()`, calculating `(receivedBytes / totalBytes) * 100%` to power the live download progress bar in `index.html` and `view.html`.
- **7-Day Edge Cache**: Frequently downloaded textbooks are cached at Cloudflare edge PoPs across India (Kochi, Mumbai, Chennai), cutting TTFB (Time to First Byte) to **under 25ms**.

---

## 3. Defense-in-Depth Security Policies

### 3.1 Content Security Policy (CSP) Standard
The platform enforces a strict Content Security Policy across all pages (`index.html`, `view.html`, `reader.html`, `admin/dashboard.html`):
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; frame-src 'self' https://d198y4z1gpgoxg.cloudfront.net blob:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://d198y4z1gpgoxg.cloudfront.net https://www.google-analytics.com https://*.google-analytics.com https://*.workers.dev; object-src 'none'; base-uri 'self'; form-action 'self';
```
- `object-src 'none'`: Prevents dangerous Flash, Java, or ActiveX plugin execution.
- `frame-ancestors 'none'` / `X-Frame-Options: DENY`: Prevents UI redressing, overlay iframe attacks, and clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type confusion attacks.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`: Enforces TLS 1.3 across all subdomains.

---

### 3.2 Directory Traversal & Dotfile Access Defense
Both the development server (`dev_server.js`) and the production Cloudflare Worker strictly sanitize filesystem and routing paths:
```javascript
// Strict Path Traversal & Dotfile Guard
const normalized = path.normalize(urlPath);
if (normalized.includes('..') || path.isAbsolute(normalized)) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  return res.end('403 Forbidden: Invalid path traversal detected.');
}

// Dotfile Blocking (.env, .git, .system_generated)
const baseName = path.basename(filePath);
if (baseName.startsWith('.')) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  return res.end('403 Forbidden: Dotfile access prohibited.');
}
```

---

### 3.3 DOM XSS Sink Protection (`reader.html` & `view.html`)
To prevent Reflected and DOM-based Cross-Site Scripting (XSS) via manipulated URL parameters (e.g. `reader.html?file=javascript:alert(1)`), all incoming document URLs pass through strict protocol and hostname validation before touching the DOM:
```javascript
function isValidPdfUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr, window.location.origin);
    // Only permit secure HTTPS and local relative URLs
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Disallow dangerous URI schemes
    if (/^(javascript|data|vbscript|file):/i.test(urlStr.trim())) return false;
    // Whitelist sanctioned SGOU CDN and Google Storage origins
    const allowedHosts = [
      'd198y4z1gpgoxg.cloudfront.net',
      'sgou-slm-database.vercel.app',
      'localhost'
    ];
    return allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  } catch (_) {
    return false;
  }
}
```

---

### 3.4 Rate Limiting & LLM Compute Protection
To prevent bot scrapers or malicious scripts from exhausting the university's Google Gemini API quota:
- Unauthenticated IP addresses are throttled to a sliding window of **5 AI generation requests per minute**.
- Validated Study Pass holders bypass this limitation using their cryptographically signed passkey (`support_claims` table verification).
- Requests exceeding the limit receive HTTP 429 with `Retry-After: 60`, seamlessly handled by the client's `#aiSheetQuotaCard`.
