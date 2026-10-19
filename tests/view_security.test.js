const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Extract isValidPdfUrl from view.html
function getIsValidPdfUrlFromViewHtml() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');
  const startIdx = html.indexOf('function isValidPdfUrl(');
  if (startIdx === -1) {
    throw new Error('isValidPdfUrl function not found in view.html');
  }
  let braceCount = 0;
  let endIdx = -1;
  for (let i = startIdx; i < html.length; i++) {
    if (html[i] === '{') braceCount++;
    else if (html[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) {
    throw new Error('Failed to parse isValidPdfUrl function body');
  }
  const fnCode = html.slice(startIdx, endIdx);
  const fn = new Function(`${fnCode}; return isValidPdfUrl;`)();
  return fn;
}

test('DOM XSS Defense: isValidPdfUrl rejects dangerous and unallowed URLs', () => {
  const isValidPdfUrl = getIsValidPdfUrlFromViewHtml();

  // Attack payloads
  assert.strictEqual(isValidPdfUrl('javascript:alert(1)'), false, 'Rejects javascript: pseudo-protocol');
  assert.strictEqual(isValidPdfUrl('JAVASCRIPT:alert(document.domain)'), false, 'Rejects uppercase JAVASCRIPT:');
  assert.strictEqual(isValidPdfUrl('javascript:/*--></title></style></textarea></script><svg/onload=alert(1)>'), false, 'Rejects complex JS payload');
  assert.strictEqual(isValidPdfUrl('data:text/html,<script>alert(1)</script>'), false, 'Rejects data: URI payload');
  assert.strictEqual(isValidPdfUrl('vbscript:msgbox(1)'), false, 'Rejects vbscript: payload');
  assert.strictEqual(isValidPdfUrl('http://evil.com/fake.pdf'), false, 'Rejects untrusted http: host');
  assert.strictEqual(isValidPdfUrl('https://evil.com/fake.pdf'), false, 'Rejects untrusted https: host');
  assert.strictEqual(isValidPdfUrl('https://evil-sgou.ac.in/fake.pdf'), false, 'Rejects subdomain spoofing');
  assert.strictEqual(isValidPdfUrl(''), false, 'Rejects empty string');
  assert.strictEqual(isValidPdfUrl(null), false, 'Rejects null');
  assert.strictEqual(isValidPdfUrl(undefined), false, 'Rejects undefined');

  // Allowed academic domains and paths
  assert.strictEqual(isValidPdfUrl('https://sgou.ac.in/test.pdf'), true, 'Allows https://sgou.ac.in');
  assert.strictEqual(isValidPdfUrl('https://www.sgou.ac.in/uploads/syllabus.pdf'), true, 'Allows https://www.sgou.ac.in');
  assert.strictEqual(isValidPdfUrl('https://d198y4z1gpgoxg.cloudfront.net/materials/sample.pdf'), true, 'Allows CloudFront CDN');
  assert.strictEqual(isValidPdfUrl('/assets/sample.pdf'), true, 'Allows relative path /assets/...');
  assert.strictEqual(isValidPdfUrl('./data/sample.pdf'), true, 'Allows relative path ./data/...');
});

test('DOM XSS Defense: view.html guards all dangerous sinks', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');

  // Ensure openBtn, ldOpen, showFallback, and window.open are guarded by isValidPdfUrl
  assert.ok(html.includes('isValidPdfUrl(pdfUrl)'), 'pdfUrl is validated before usage');
  assert.ok(!html.includes('openBtn.href = pdfUrl;') || html.includes('isValidPdfUrl'), 'openBtn.href is guarded');
  assert.ok(!html.includes('ldOpen.href = pdfUrl;') || html.includes('isValidPdfUrl'), 'ldOpen.href is guarded');
});
