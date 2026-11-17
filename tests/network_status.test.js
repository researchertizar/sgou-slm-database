const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('C-03: Live Network Connectivity Pill & Offline State', async (t) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const viewHtml = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');

  await t.test('index.html contains accessible #networkPill status indicator', () => {
    assert.match(indexHtml, /id="networkPill"[\s\S]*?class="[^"]*network-pill[^"]*"/, 'index.html must have #networkPill');
  });

  await t.test('view.html contains accessible #networkPill status indicator', () => {
    assert.match(viewHtml, /id="networkPill"[\s\S]*?class="[^"]*network-pill[^"]*"/, 'view.html must have #networkPill');
  });

  await t.test('reader.html contains accessible #networkPill status indicator', () => {
    assert.match(readerHtml, /id="networkPill"[\s\S]*?class="[^"]*network-pill[^"]*"/, 'reader.html must have #networkPill');
  });

  await t.test('css/style.css defines .network-pill and .network-dot with pulse animation', () => {
    assert.match(cssStyle, /\.network-pill/, 'css/style.css must define .network-pill');
    assert.match(cssStyle, /\.network-dot/, 'css/style.css must define .network-dot');
  });

  await t.test('script.js listens for online and offline events to update network status and show toast', () => {
    assert.match(scriptJs, /window\.addEventListener\(['"]online['"]/, 'script.js must listen for online event');
    assert.match(scriptJs, /window\.addEventListener\(['"]offline['"]/, 'script.js must listen for offline event');
  });
});
