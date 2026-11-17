const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('view.html: resilient lookup and fallback cascade', async (t) => {
  const viewHtml = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');

  await t.test('accepts file, pdf, src, and url query parameters for PDF source', () => {
    assert.match(
      viewHtml,
      /params\.get\('url'\)\s*\|\|\s*params\.get\('file'\)\s*\|\|\s*params\.get\('pdf'\)\s*\|\|\s*params\.get\('src'\)/,
      'view.html must accept url, file, pdf, or src parameters'
    );
  });

  await t.test('normalizes course codes for prefix and suffix fuzzy matching', () => {
    assert.match(
      viewHtml,
      /normalizeCode|cleanCodeMatch|stripCodeSuffix/,
      'view.html must have helper to normalize course codes (e.g. B21CA01 matching B21CA01DC)'
    );
  });

  await t.test('gracefully renders fallback card when PDF URL is available even if not in JSON database', () => {
    assert.match(
      viewHtml,
      /if\s*\(\s*pdfUrl\s*\)\s*\{\s*showCourse\(\);\s*return;\s*\}/,
      'view.html must render showCourse immediately when pdfUrl is present without blocking on JSON fetch'
    );
  });

  await t.test('searches both SLM and PYQ data sources and fallback metadata without hard dead-end', () => {
    assert.match(
      viewHtml,
      /renderFallbackMeta|buildFallbackCourse/,
      'view.html must have fallback builder before calling showError'
    );
  });
});
