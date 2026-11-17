const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('H-05: Fuzzy Search, Levenshtein Distance & "Did You Mean?" Suggestions', async (t) => {
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');

  await t.test('script.js implements fuzzy search or levenshtein distance algorithm', () => {
    assert.match(
      scriptJs,
      /levenshtein|fuzzyMatch|fuzzySearch|didYouMean/i,
      'script.js must contain fuzzy matching or distance calculation algorithm'
    );
  });

  await t.test('script.js provides "Did you mean?" suggestions when exact search finds 0 results', () => {
    assert.match(
      scriptJs,
      /Did you mean/i,
      'script.js must offer Did you mean suggestions for typo tolerance'
    );
  });

  await t.test('Zero emojis in search suggestions or did-you-mean prompts', () => {
    const dymMatches = scriptJs.match(/Did you mean[\s\S]*?<\/div>/gi) || [];
    dymMatches.forEach(block => {
      assert.doesNotMatch(
        block,
        /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u,
        'No emojis allowed in search suggestion blocks'
      );
    });
  });
});
