const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('C-04: Content Security Policy & Security Headers Hardening', async (t) => {
  const vercelJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const devServer = fs.readFileSync(path.join(__dirname, '..', 'dev_server.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const viewHtml = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');
  const workerJs = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker', 'worker.js'), 'utf8');

  await t.test('vercel.json enforces CSP with object-src none, base-uri self, and nosniff', () => {
    const globalHeader = vercelJson.headers.find(h => h.source === '/(.*)');
    assert.ok(globalHeader, 'vercel.json must have global headers for /(.*)');
    const csp = globalHeader.headers.find(k => k.key === 'Content-Security-Policy');
    assert.ok(csp, 'vercel.json must define Content-Security-Policy header');
    assert.match(csp.value, /object-src 'none'/, 'CSP must enforce object-src none');
    assert.match(csp.value, /base-uri 'self'/, 'CSP must enforce base-uri self');

    const nosniff = globalHeader.headers.find(k => k.key === 'X-Content-Type-Options');
    assert.ok(nosniff && nosniff.value === 'nosniff', 'vercel.json must enforce X-Content-Type-Options: nosniff');
  });

  await t.test('dev_server.js sets X-Content-Type-Options and security headers on responses', () => {
    assert.match(devServer, /'X-Content-Type-Options':\s*'nosniff'/, 'dev_server.js must set nosniff on static files');
  });

  await t.test('HTML meta CSP enforces object-src none and base-uri self across pages', () => {
    [indexHtml, viewHtml, readerHtml].forEach((html, idx) => {
      assert.match(html, /object-src 'none'/, `Page ${idx} must have object-src 'none'`);
      assert.match(html, /base-uri 'self'/, `Page ${idx} must have base-uri 'self'`);
    });
  });

  await t.test('cloudflare worker sets nosniff and security headers', () => {
    assert.match(workerJs, /X-Content-Type-Options/, 'cloudflare worker must set X-Content-Type-Options');
  });
});
