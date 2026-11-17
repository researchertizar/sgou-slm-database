const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('H-03: Mobile Bottom Navigation Bar & Touch Ergonomics', async (t) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');

  await t.test('index.html contains #mobileBottomNav with 4 SVG action tabs', () => {
    assert.match(
      indexHtml,
      /<nav[^>]*id="mobileBottomNav"[^>]*class="[^"]*mobile-bottom-nav[^"]*"[^>]*aria-label="Mobile Navigation"/,
      'index.html must have #mobileBottomNav with proper accessibility attributes'
    );
    assert.match(indexHtml, /data-tab="browse"/, 'Bottom nav must have browse tab');
    assert.match(indexHtml, /data-tab="recent"/, 'Bottom nav must have recent/continue reading tab');
    assert.match(indexHtml, /data-tab="favorites"/, 'Bottom nav must have favorites tab');
    assert.match(indexHtml, /data-tab="support"/, 'Bottom nav must have support tab');
  });

  await t.test('Mobile bottom nav uses pure SVG icons and zero emojis', () => {
    const navMatch = indexHtml.match(/<nav[^>]*id="mobileBottomNav"[\s\S]*?<\/nav>/);
    assert.ok(navMatch, 'mobile bottom nav block must exist');
    const navHtml = navMatch[0];
    assert.doesNotMatch(
      navHtml,
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
      'Mobile nav must not contain any raw emojis'
    );
    const svgMatches = navHtml.match(/<svg/g);
    assert.ok(svgMatches && svgMatches.length >= 4, 'Mobile nav must have at least 4 SVG icons');
  });

  await t.test('css/style.css styles mobile bottom nav with safe-area insets', () => {
    assert.match(cssStyle, /\.mobile-bottom-nav/, 'css/style.css must define .mobile-bottom-nav');
    assert.match(cssStyle, /env\(safe-area-inset-bottom\)/, 'Must account for iPhone notch / home indicator with safe-area-inset-bottom');
  });

  await t.test('js/script.js wires tab clicks to active catalog actions', () => {
    assert.match(
      scriptJs,
      /mobileBottomNav|initMobileBottomNav/,
      'script.js must initialize mobile bottom navigation actions'
    );
  });
});
