const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('H-01 & H-02: Index Skeleton Loading & Progressive Chunked Rendering', async (t) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  await t.test('index.html contains initial skeleton cards in #grid for instant 0ms FCP paint', () => {
    assert.match(
      indexHtml,
      /<div class="programme-grid" id="grid"[^>]*>[\s\S]*?skeleton-card/,
      'index.html #grid must have initial skeleton cards in static HTML'
    );
  });

  await t.test('css/style.css defines skeleton animation and placeholder styles', () => {
    assert.match(cssStyle, /\.skeleton-card/, 'css/style.css must define .skeleton-card');
    assert.match(cssStyle, /\.skel/, 'css/style.css must define .skel');
  });

  await t.test('js/script.js implements progressive chunking for large programme list', () => {
    assert.match(
      scriptJs,
      /CHUNK_SIZE/,
      'script.js must define CHUNK_SIZE for chunked programme rendering'
    );
    assert.match(
      scriptJs,
      /requestAnimationFrame/,
      'script.js must use requestAnimationFrame for progressive chunking'
    );
  });
});
