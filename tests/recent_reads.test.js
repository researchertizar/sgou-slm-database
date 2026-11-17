const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('H-04 & F-04: Continue Reading Shelf & Study Progress Tracking', async (t) => {
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');
  const cssStyle = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  await t.test('reader.html saves reading state into localStorage key sgou-recent-reads', () => {
    assert.match(
      readerHtml,
      /sgou-recent-reads|sgou_recent_reads/,
      'reader.html must record document reading progress to localStorage'
    );
    assert.match(
      readerHtml,
      /saveReadingProgress|recordRecentRead/,
      'reader.html must have function to save reading position'
    );
  });

  await t.test('index.html contains #continueReadingShelf container', () => {
    assert.match(
      indexHtml,
      /<section[^>]*id="continueReadingShelf"[^>]*class="[^"]*continue-reading-shelf[^"]*"/,
      'index.html must have #continueReadingShelf section'
    );
  });

  await t.test('js/script.js renders continue reading hero card and handles resume reading', () => {
    assert.match(
      scriptJs,
      /renderContinueReading|initContinueReadingShelf/,
      'script.js must render recent read cards with resume links'
    );
    assert.match(
      scriptJs,
      /sgou-recent-reads|sgou_recent_reads/,
      'script.js must read from recent reads localStorage key'
    );
  });

  await t.test('css/style.css defines styles for continue-reading-shelf and progress bar', () => {
    assert.match(cssStyle, /\.continue-reading-shelf/, 'css/style.css must style .continue-reading-shelf');
    assert.match(cssStyle, /\.reading-progress-fill|\.shelf-progress/, 'css/style.css must style reading progress bar');
  });

  await t.test('Zero emojis used across continue reading components', () => {
    const shelfMatch = indexHtml.match(/<section[^>]*id="continueReadingShelf"[\s\S]*?<\/section>/);
    if (shelfMatch) {
      assert.doesNotMatch(
        shelfMatch[0],
        /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
        'index.html shelf must have no emojis'
      );
    }
  });
});
