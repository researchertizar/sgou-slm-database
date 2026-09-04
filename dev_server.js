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

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);

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

      https.get(upstream, upstreamRes => {
        if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
          res.writeHead(302, { Location: upstreamRes.headers.location });
          return res.end();
        }

        const headers = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff'
        };

        const cl = upstreamRes.headers['content-length'];
        if (cl) headers['Content-Length'] = cl;

        res.writeHead(upstreamRes.statusCode || 200, headers);
        upstreamRes.pipe(res);
      }).on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream fetch failed', message: err.message }));
      });
      return;
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
  }

  // Handle static files
  let filePath = path.join(__dirname, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Rewrite /view/:course or clean /view to view.html
  if (reqUrl.pathname === '/view' || reqUrl.pathname.startsWith('/view/')) {
    filePath = path.join(__dirname, 'view.html');
  }

  // Fallback check in data/ folder if not found in root (e.g. /sgou_slm_data.json -> /data/sgou_slm_data.json)
  if (!fs.existsSync(filePath) && fs.existsSync(path.join(__dirname, 'data', path.basename(reqUrl.pathname)))) {
    filePath = path.join(__dirname, 'data', path.basename(reqUrl.pathname));
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

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  SGOU SLM Browser Local Server`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Edge download proxy active on /api/download`);
  console.log(`========================================\n`);
});
