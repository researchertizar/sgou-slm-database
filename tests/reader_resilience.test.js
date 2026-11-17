const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('reader.html: multi-tier fetch fallback and offline cache loading', async (t) => {
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');

  await t.test('has multi-stage fallback cascade attempting both proxy and direct routes', () => {
    assert.match(
      readerHtml,
      /tryFallbackLoad|fallbackProxyUrl|fallbackSuccess/,
      'reader.html must implement multi-stage fallback cascade for network or CORS failures'
    );
  });

  await t.test('checks CacheStorage before network fetch for offline reading', () => {
    assert.match(
      readerHtml,
      /caches\.open\(['"]sgou-offline-docs['"]\)/,
      'reader.html must check CacheStorage sgou-offline-docs before or during load'
    );
  });

  await t.test('provides actionable fallback actions on error without emojis', () => {
    assert.match(
      readerHtml,
      /id="errorDirectBtn"/,
      'reader.html must retain direct browser link button in errorBox'
    );
    assert.doesNotMatch(
      readerHtml,
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
      'reader.html must comply with Zero-Emoji Academic Policy'
    );
  });
});
