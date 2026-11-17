const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('H-06 & H-07: First-Visit Onboarding Modal & Dedicated Favorites Filter', async (t) => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  await t.test('index.html contains #onboardingModal with degree options', () => {
    assert.match(
      indexHtml,
      /<div[^>]*id="onboardingModal"/,
      'index.html must have #onboardingModal element'
    );
    assert.match(
      indexHtml,
      /data-level="FYUG"|data-level="UG"|data-level="PG"/,
      'Onboarding modal must provide degree level selection options'
    );
  });

  await t.test('index.html contains #filterFavoritesBtn chip in category filter deck', () => {
    assert.match(
      indexHtml,
      /id="filterFavoritesBtn"/,
      'index.html must have #filterFavoritesBtn chip'
    );
  });

  await t.test('js/script.js checks onboarding status and manages favorites filter state', () => {
    assert.match(
      scriptJs,
      /initOnboarding|checkOnboarding/,
      'script.js must check onboarding state on boot'
    );
    assert.match(
      scriptJs,
      /sgou-onboarded|sgou_onboarded/,
      'script.js must persist onboarding completion key'
    );
    assert.match(
      scriptJs,
      /toggleFavoritesFilter/,
      'script.js must have toggleFavoritesFilter method'
    );
  });

  await t.test('css/style.css styles onboarding cards and favorites button', () => {
    assert.match(cssStyle, /\.onboarding-card|\.onboarding-grid/, 'css/style.css must style onboarding cards');
    assert.match(cssStyle, /#filterFavoritesBtn|\.btn-favorites-filter/, 'css/style.css must style favorites filter button');
  });

  await t.test('Zero emojis used across onboarding modal and favorites components', () => {
    const modalMatch = indexHtml.match(/<div[^>]*id="onboardingModal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    if (modalMatch) {
      assert.doesNotMatch(
        modalMatch[0],
        /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
        'Onboarding modal must not contain emojis'
      );
    }
  });
});
