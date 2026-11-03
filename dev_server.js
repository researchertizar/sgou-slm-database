// ===============================================
//  SGOU Local Development Server
//  Run: node dev_server.js
//  Provides local static file hosting AND proxies /api/download
// ===============================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3030);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

// In-memory telemetry buffer for local testing
const localTelemetry = {
  sessions: new Map(),
  events: [],
  zeroSearches: new Map([
    ['fyug semester 3 syllabus', { category: 'FYUG', hit_count: 42, last_searched: new Date().toISOString() }],
    ['bca cloud computing', { category: 'UG', hit_count: 28, last_searched: new Date().toISOString() }],
    ['mcom project guidelines', { category: 'PG', hit_count: 19, last_searched: new Date().toISOString() }],
    ['b21eg05 pyq may 2024', { category: 'UG', hit_count: 15, last_searched: new Date().toISOString() }],
    ['nano entrepreneurship model paper', { category: 'UG', hit_count: 12, last_searched: new Date().toISOString() }]
  ]),
  rageClicks: new Map([
    ['button#viewerClose', { text_sample: 'Close', rage_count: 38, last_rage: new Date().toISOString() }],
    ['div.filter-pill[data-val="fyug"]', { text_sample: 'FYUG', rage_count: 14, last_rage: new Date().toISOString() }],
    ['button#readerFullscreen', { text_sample: 'Fullscreen', rage_count: 11, last_rage: new Date().toISOString() }]
  ])
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);

  // 1. Handle local telemetry ingestion (/api/telemetry)
  if (reqUrl.pathname === '/api/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const sid = payload.sid || 'local_session';
        const profile = payload.profile || {};
        const events = payload.events || [];

        localTelemetry.sessions.set(sid, {
          session_id: sid,
          region: 'Kerala',
          city: 'Kollam',
          isp: 'Local Development Server',
          device_type: profile.touch ? 'mobile' : 'desktop',
          profile,
          last_active: new Date().toISOString()
        });

        for (const evt of events) {
          localTelemetry.events.unshift({
            session_id: sid,
            event_type: evt.t,
            page_url: evt.url,
            time_offset_ms: evt.ts,
            details: evt.d,
            created_at: new Date().toISOString()
          });
          if (localTelemetry.events.length > 200) localTelemetry.events.pop();

          if (evt.t === 'zero_search' && evt.d?.q) {
            const q = String(evt.d.q).trim().toLowerCase();
            const existing = localTelemetry.zeroSearches.get(q) || { category: evt.d.tab || 'ALL', hit_count: 0 };
            existing.hit_count++;
            existing.last_searched = new Date().toISOString();
            localTelemetry.zeroSearches.set(q, existing);
          }

          if (evt.t === 'rage_click' && evt.d?.selector) {
            const s = String(evt.d.selector);
            const existing = localTelemetry.rageClicks.get(s) || { text_sample: evt.d.text || '', rage_count: 0 };
            existing.rage_count++;
            existing.last_rage = new Date().toISOString();
            localTelemetry.rageClicks.set(s, existing);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, received: events.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Handle dashboard query endpoint (/api/analytics/query)
  if (reqUrl.pathname === '/api/analytics/query') {
    const action = reqUrl.searchParams.get('action') || 'overview';
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });

    if (action === 'overview') {
      return res.end(JSON.stringify({
        overview: {
          total_sessions: Math.max(localTelemetry.sessions.size, 142),
          today_sessions: Math.max(localTelemetry.sessions.size, 68),
          zero_searches_count: localTelemetry.zeroSearches.size,
          rage_clicks_count: Array.from(localTelemetry.rageClicks.values()).reduce((a, b) => a + b.rage_count, 0),
          avg_dwell_seconds: 312
        }
      }));
    }

    if (action === 'geo') {
      return res.end(JSON.stringify({
        geo: [
          { region: 'Kerala', city: 'Kollam', count: 54 },
          { region: 'Kerala', city: 'Thiruvananthapuram', count: 38 },
          { region: 'Kerala', city: 'Ernakulam', count: 24 },
          { region: 'Kerala', city: 'Kozhikode', count: 18 },
          { region: 'Kerala', city: 'Kannur', count: 11 },
          { region: 'Kerala', city: 'Malappuram', count: 9 }
        ]
      }));
    }

    if (action === 'zero_searches') {
      const results = Array.from(localTelemetry.zeroSearches.entries()).map(([query, data]) => ({
        query,
        category: data.category,
        hit_count: data.hit_count,
        last_searched: data.last_searched
      })).sort((a, b) => b.hit_count - a.hit_count);
      return res.end(JSON.stringify({ zero_searches: results }));
    }

    if (action === 'frictions') {
      const results = Array.from(localTelemetry.rageClicks.entries()).map(([element_selector, data]) => ({
        element_selector,
        text_sample: data.text_sample,
        rage_count: data.rage_count,
        last_rage: data.last_rage
      })).sort((a, b) => b.rage_count - a.rage_count);
      return res.end(JSON.stringify({ rage_clicks: results }));
    }

    if (action === 'devices') {
      return res.end(JSON.stringify({
        devices: [{ device_type: 'mobile', count: 118 }, { device_type: 'desktop', count: 32 }, { device_type: 'tablet', count: 6 }],
        networks: [{ network_type: '4g', count: 104 }, { network_type: '3g', count: 26 }, { network_type: 'wifi', count: 26 }]
      }));
    }

    if (action === 'recent_events') {
      return res.end(JSON.stringify({ recent_events: localTelemetry.events.slice(0, 50) }));
    }

    return res.end(JSON.stringify({ error: 'Unknown action' }));
  }

  // Handle local proxy for /api/download so progress bar and downloads work on localhost
  if (reqUrl.pathname === '/api/download') {
    const raw = reqUrl.searchParams.get('url');
    let customFilename = reqUrl.searchParams.get('filename');

    if (!raw) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const upstream = new URL(raw);
      const ALLOWED_HOSTS = new Set(['d198y4z1gpgoxg.cloudfront.net', 'sgou.ac.in', 'www.sgou.ac.in']);

      if (upstream.protocol !== 'https:' || !ALLOWED_HOSTS.has(upstream.hostname.toLowerCase())) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Host or protocol forbidden' }));
      }

      let filename = (customFilename || '')
        .replace(/[\r\n\x00-\x1f\x7f/\\]/g, '')
        .replace(/\.\.+/g, '')
        .trim();

      if (!filename) {
        const segs = upstream.pathname.split('/').filter(Boolean);
        filename = (segs[segs.length - 1] || 'course_slm.pdf')
          .replace(/[\r\n\x00-\x1f\x7f/\\]/g, '')
          .trim();
      }
      if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

      const getOptions = {
        headers: { 'User-Agent': 'SGOU-DevServer/2.0' }
      };
      if (req.headers.range) {
        getOptions.headers['Range'] = req.headers.range;
      }

      const upstreamReq = https.get(upstream, getOptions, upstreamRes => {
        if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
          if (!res.headersSent) {
            res.writeHead(302, { Location: upstreamRes.headers.location });
            res.end();
          }
          return;
        }

        const isInline = reqUrl.searchParams.get('inline') === '1';
        const disposition = isInline ? 'inline' : 'attachment';

        const headers = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, Content-Range, Accept-Ranges',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff'
        };

        const cl = upstreamRes.headers['content-length'];
        if (cl) headers['Content-Length'] = cl;
        const cr = upstreamRes.headers['content-range'];
        if (cr) headers['Content-Range'] = cr;
        const ar = upstreamRes.headers['accept-ranges'];
        if (ar) headers['Accept-Ranges'] = ar;

        res.writeHead(upstreamRes.statusCode || 200, headers);
        upstreamRes.pipe(res);
      });

      upstreamReq.on('error', err => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Upstream fetch failed', message: err.message }));
        } else {
          res.destroy();
        }
      });

      req.on('close', () => {
        upstreamReq.destroy();
      });
      return;
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
  }

  // Security: prevent directory traversal (reject any raw traversal tokens before resolution)
  const rawUrl = req.url || '';
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }
  try {
    if (decodeURIComponent(rawUrl).includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  // Security: block dotfiles and hidden dot-directories (.git, .env, .gitignore, etc.)
  const pathSegments = reqUrl.pathname.split('/');
  if (pathSegments.some(seg => seg.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  // Handle static files
  const safeRoot = path.resolve(__dirname) + path.sep;
  let filePath = path.resolve(__dirname, reqUrl.pathname === '/' ? 'index.html' : '.' + reqUrl.pathname);

  // Security: prevent directory traversal by anchoring to root with directory separator
  if (!filePath.startsWith(safeRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  // Rewrite /view/:course or clean /view to view.html
  if (reqUrl.pathname === '/view' || reqUrl.pathname.startsWith('/view/')) {
    filePath = path.join(__dirname, 'view.html');
  }

  // Rewrite /dashboard or /admin to admin/dashboard.html
  if (reqUrl.pathname === '/dashboard' || reqUrl.pathname === '/admin' || reqUrl.pathname === '/admin/dashboard') {
    filePath = path.join(__dirname, 'admin', 'dashboard.html');
  }

  // Rewrite /reader to reader.html
  if (reqUrl.pathname === '/reader' || reqUrl.pathname.startsWith('/reader/')) {
    filePath = path.join(__dirname, 'reader.html');
  }

  // Support clean URLs (e.g. /reader -> reader.html, /view -> view.html)
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  // Fallback checks for moved assets in subdirectories (data/, assets/icons/, assets/images/)
  if (!fs.existsSync(filePath)) {
    const base = path.basename(reqUrl.pathname);
    if (fs.existsSync(path.join(__dirname, 'data', base))) {
      filePath = path.join(__dirname, 'data', base);
    } else if (fs.existsSync(path.join(__dirname, 'assets', 'icons', base))) {
      filePath = path.join(__dirname, 'assets', 'icons', base);
    } else if (fs.existsSync(path.join(__dirname, 'assets', 'images', base))) {
      filePath = path.join(__dirname, 'assets', 'images', base);
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  SGOU SLM Browser Local Server`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`  Edge download proxy active on /api/download`);
    console.log(`========================================\n`);
  });
}

module.exports = server;
