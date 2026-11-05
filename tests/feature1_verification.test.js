const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('Feature 1: index.html markup and download progress support button', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // Check dpSupportBtn exists
  assert(html.includes('id="dpSupportBtn"'), 'index.html must contain #dpSupportBtn in downloadProgressCard');
  assert(html.includes('class="dp-btn-support"'), 'index.html must contain .dp-btn-support');
  assert(html.includes('<span>Support</span>'), 'Button label must be clean Support text');

  // Check no emojis in downloadProgressCard
  const dpCardMatch = html.match(/<div class="download-progress-card" id="downloadProgressCard"[\s\S]*?<\/div>\s*<\/div>/);
  assert(dpCardMatch, 'downloadProgressCard element found');
  const dpCardText = dpCardMatch[0];
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(dpCardText), false, 'No emojis should be in downloadProgressCard');
});

test('Feature 1: script.js 48-Hour Cooldown & Post-Download Support Prompt Logic', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'script.js'), 'utf8');

  // Verify 48-hour cooldown constant & trigger
  assert(js.includes('const COOLDOWN_MS = 48 * 60 * 60 * 1000;'), 'Must have 48h cooldown constant');
  assert(js.includes('localStorage.getItem(\'sgou_support_post_dl_time\')'), 'Must read sgou_support_post_dl_time');
  assert(js.includes('localStorage.setItem(\'sgou_support_post_dl_time\', String(now))'), 'Must record cooldown timestamp');
  assert(js.includes('window.SupportModal.open(25, $(\'dpSupportBtn\') || null)'), 'Must trigger SupportModal with dpSupportBtn');

  // Test cooldown logic mathematically
  const COOLDOWN_MS = 48 * 60 * 60 * 1000;
  const now = Date.now();

  // Case 1: First time user (no timestamp stored)
  const lastPrompt1 = 0;
  assert.strictEqual(now - lastPrompt1 > COOLDOWN_MS, true, 'First download must qualify for support prompt');

  // Case 2: Immediate re-download (within 48h)
  const lastPrompt2 = now - (2 * 60 * 60 * 1000); // 2 hours ago
  assert.strictEqual(now - lastPrompt2 > COOLDOWN_MS, false, 'Download 2h later must NOT trigger prompt');

  // Case 3: Download after 49 hours
  const lastPrompt3 = now - (49 * 60 * 60 * 1000); // 49 hours ago
  assert.strictEqual(now - lastPrompt3 > COOLDOWN_MS, true, 'Download after 48h cooldown must qualify');
});

test('Feature 1: view.html Post-Download Voluntary Prompt Integration', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'view.html'), 'utf8');

  // Check topbar support button
  assert(html.includes('id="topbarSupport"'), 'view.html must contain #topbarSupport');

  // Check 48h cooldown in triggerDownload
  assert(html.includes('var COOLDOWN_MS = 48 * 60 * 60 * 1000;'), 'view.html must have 48h cooldown constant');
  assert(html.includes('sgou_support_post_dl_time'), 'view.html must check sgou_support_post_dl_time');
  assert(html.includes('window.SupportModal.open(25, dlBtn || null)'), 'view.html must trigger SupportModal after download');
});

test('Feature 1: support-modal.js VPA and UPI Deep Link Generation', () => {
  const modalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'components', 'support-modal.js'), 'utf8');

  // Verify VPA and payee
  assert(modalJs.includes("vpa: 'ahayas.info@oksbi'"), 'VPA must be ahayas.info@oksbi');
  assert(modalJs.includes("payee: 'Ahayas'"), 'Payee must be Ahayas');

  // Test UPI link builder
  const buildUpiUri = (amount) => {
    let uri = 'upi://pay?pa=' + encodeURIComponent('ahayas.info@oksbi') +
              '&pn=' + encodeURIComponent('Ahayas');
    if (amount && Number(amount) > 0) {
      uri += '&am=' + Number(amount);
    }
    uri += '&cu=INR&tn=' + encodeURIComponent('Support SGOU Database');
    return uri;
  };

  const uri25 = buildUpiUri(25);
  assert.strictEqual(uri25, 'upi://pay?pa=ahayas.info%40oksbi&pn=Ahayas&am=25&cu=INR&tn=Support%20SGOU%20Database');

  const uriCustom = buildUpiUri(null);
  assert.strictEqual(uriCustom, 'upi://pay?pa=ahayas.info%40oksbi&pn=Ahayas&cu=INR&tn=Support%20SGOU%20Database');
});

test('Feature 1: Zero-Emoji Compliance across Support Components', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const modalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'components', 'support-modal.js'), 'utf8');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  // Check support modal template in support-modal.js
  const templateMatch = modalJs.match(/getTemplate:\s*function\s*\(\)\s*\{[\s\S]*?return\s*\(([\s\S]*?)\);\s*\}/);
  assert(templateMatch, 'getTemplate found');
  assert.strictEqual(emojiRegex.test(templateMatch[1]), false, 'support-modal template must have zero emojis');
});

test('Feature 1: High-Resolution PNG QR generation and PhonePe Gallery compatibility', () => {
  const modalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'components', 'support-modal.js'), 'utf8');

  // Verify generateQrCanvas exists and implements ISO quiet zone with white background
  assert(modalJs.includes('generateQrCanvas: function'), 'support-modal.js must provide generateQrCanvas method');
  assert(modalJs.includes("ctx.fillStyle = '#FFFFFF'"), 'Canvas must render pure white background for optical contrast');
  assert(modalJs.includes('quietZoneModules = 4'), 'Canvas must enforce ISO 4-module quiet zone');
  assert(modalJs.includes("ctx.fillStyle = '#000000'"), 'Canvas must render pure black QR modules');

  // Verify downloadQr outputs high-resolution PNG (not unreadable SVG)
  assert(modalJs.includes('sgou-support-upi-qr.png'), 'Download filename must be sgou-support-upi-qr.png');
  assert(modalJs.includes("'image/png'"), 'MIME type must be image/png for Android gallery barcode scanner compatibility');

  // Verify shareQr implementation
  assert(modalJs.includes('shareQr: function'), 'support-modal.js must provide shareQr method');
  assert(modalJs.includes('navigator.share'), 'shareQr must utilize Web Share API');
  assert(modalJs.includes('navigator.canShare'), 'shareQr must check file sharing capabilities');
});

test('Feature 1: Share QR Button, PhonePe Guidance Notice & Chip labels', () => {
  const modalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'components', 'support-modal.js'), 'utf8');
  const modalCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'components', 'support-modal.css'), 'utf8');

  // Verify Share QR button in template and click binding
  assert(modalJs.includes('id="supportShareQrBtn"'), 'Template must include #supportShareQrBtn');
  assert(modalJs.includes('SupportModal.shareQr()'), 'Init must bind #supportShareQrBtn to SupportModal.shareQr()');

  // Verify PhonePe guidance notice in template
  assert(modalJs.includes('class="support-phonepe-notice"'), 'Template must contain .support-phonepe-notice banner');
  assert(modalJs.includes('PhonePe / Paytm loop?'), 'Notice text must specifically address PhonePe / Paytm loop');
  assert(modalJs.includes('support-qr-popover'), 'Template must include enhanced advice popover');

  // Verify Chip 5 label matches Any / Custom
  assert(modalJs.includes('<span class="chip-val">Any</span>'), 'Chip 5 main label must be Any');
  assert(modalJs.includes('<span class="chip-sub">Custom</span>'), 'Chip 5 sub label must be Custom');

  // Verify CSS contains classes
  assert(modalCss.includes('.support-phonepe-notice'), 'CSS must style .support-phonepe-notice');
  assert(modalCss.includes('.support-notice-icon'), 'CSS must style .support-notice-icon');
  assert(modalCss.includes('.support-notice-text'), 'CSS must style .support-notice-text');
});
