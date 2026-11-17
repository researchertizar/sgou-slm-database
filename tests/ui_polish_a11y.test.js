const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('UI Polish, Dark Mode Contrast, WhatsApp Previews & A11y', async (t) => {
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const aiCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'components', 'ai-companion.css'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');
  const viewHtml = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  await t.test('index.html has #a11yAnnouncer live region for screen readers', () => {
    assert.match(
      indexHtml,
      /<div[^>]*id="a11yAnnouncer"[^>]*aria-live="polite"/,
      'index.html must have #a11yAnnouncer with aria-live="polite"'
    );
  });

  await t.test('css/style.css enhances dark mode course card contrast and depth', () => {
    assert.match(
      cssStyle,
      /\[data-theme="dark"\]\s+\.course-card|\.course-card/,
      'css/style.css must have course-card dark mode border and contrast definition'
    );
  });

  await t.test('css/components/ai-companion.css adds pulse / glow animation to trigger button', () => {
    assert.match(
      aiCss,
      /@keyframes\s+aiPillGlow|aiPulse|pulse/i,
      'ai-companion.css must define subtle pulse/glow animation for discoverability'
    );
  });

  await t.test('js/script.js and view.html WhatsApp share text complies with Zero-Emoji rule', () => {
    // Check WhatsApp share strings in script.js
    const scriptShareMatches = scriptJs.match(/formatWhatsAppShare|shareUrl|waText[\s\S]*?encodeURIComponent/gi) || [];
    assert.doesNotMatch(
      scriptJs,
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
      'script.js must contain zero emojis in WhatsApp share texts'
    );
    assert.doesNotMatch(
      viewHtml,
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
      'view.html must contain zero emojis in WhatsApp share texts'
    );
  });
});
