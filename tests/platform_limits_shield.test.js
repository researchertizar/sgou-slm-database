const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Platform Limit Shield & Zero-Overrun Protection', async (t) => {
  const swJs = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const vercelIgnore = fs.readFileSync(path.join(__dirname, '..', '.vercelignore'), 'utf8');

  await t.test('sw.js pre-caches core datasets in SHELL for 0-bandwidth repeat visits', () => {
    assert.match(
      swJs,
      /sgou_slm_data\.json/,
      'sw.js must include sgou_slm_data.json in offline cache shell'
    );
    assert.match(
      swJs,
      /sgou_questions_cleaned\.json/,
      'sw.js must include sgou_questions_cleaned.json in offline cache shell'
    );
  });

  await t.test('sw.js handles json data requests via Stale-While-Revalidate caching', () => {
    assert.match(
      swJs,
      /\.json.*swr\(e\.request\)/s,
      'sw.js must serve JSON requests through Stale-While-Revalidate caching'
    );
  });

  await t.test('.vercelignore excludes test suites and scratch files while preserving sr folder', () => {
    assert.match(vercelIgnore, /tests\//, '.vercelignore must exclude tests/');
    assert.match(vercelIgnore, /scratch\//, '.vercelignore must exclude scratch/');
    assert.doesNotMatch(vercelIgnore, /^sr\/|[\r\n]sr\//, '.vercelignore must NOT exclude sr/ review directory');
    if (!__dirname.includes('Github')) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'sr')), 'sr directory must exist untouched');
    }
  });

  await t.test('sw.js contains zero emojis', () => {
    assert.doesNotMatch(
      swJs,
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
      'sw.js must contain zero emojis'
    );
  });
});
