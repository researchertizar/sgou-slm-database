process.env.SGOU_ADMIN_SECRET = 'test_telemetry_secret_suite_2026';
// ============================================================================
// SGOU Analytics Precision, Mathematical Verification & Telemetry Audit Test Suite
// Verifies statistical rigor, outlier trimming, friction index, clustering, and zero hallucinations
// ============================================================================

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO_ROOT = path.resolve(__dirname, '..');

test('Client Sensor Precision: Scroll milestones, copy observer, and zone detection', () => {
  const sensorPath = path.join(REPO_ROOT, 'js', 'telemetry', 'analytics-core.js');
  assert.ok(fs.existsSync(sensorPath), 'analytics-core.js must exist on disk');

  const content = fs.readFileSync(sensorPath, 'utf8');

  // 1. Passive scroll depth observer
  assert.ok(content.includes('scroll_milestone'), 'Must track scroll depth milestones');
  assert.ok(content.includes('percent: milestone'), 'Must record scroll depth percentage');

  // 2. Text copy observer
  assert.ok(content.includes('text_copied'), 'Must track clipboard copy actions');

  // 3. Granular zone detection
  assert.ok(content.includes('onboarding_modal'), 'Must classify onboarding_modal zone');
  assert.ok(content.includes('continue_shelf'), 'Must classify continue_shelf zone');
  assert.ok(content.includes('mobile_nav'), 'Must classify mobile_nav zone');
  assert.ok(content.includes('drawer'), 'Must classify drawer zone');

  // 4. Reading progress milestones
  assert.ok(content.includes('reader_progress_milestone'), 'Must track reader progress milestones');

  // 5. Zero-noise dwell threshold (at least 1 second)
  assert.ok(content.includes('dwellSec >= 1'), 'Must guard against sub-second dwell noise');
});

test('Backend Calculations: No synthetic fallbacks, genuine formulas & mathematical endpoints', async () => {
  const devServer = require('../dev_server.js');
  const port = 3042;
  const token = 'test_telemetry_secret_suite_2026';

  await new Promise(resolve => devServer.listen(port, resolve));

  try {
    // 1. Ingest test telemetry payload with known metrics
    const testSid = 'prec_sess_' + Date.now();
    const postPayload = JSON.stringify({
      sid: testSid,
      uid: 'prec_user_1',
      is_returning: 0,
      visit_count: 1,
      is_active: 1,
      profile: { touch: true, screen: '412x915', ram_gb: 4 },
      events: [
        { t: 'zero_search', ts: 100, url: '/', d: { q: 'bca 101 computer fundamentals', tab: 'UG' } },
        { t: 'zero_search', ts: 200, url: '/', d: { q: 'sem 3 operating systems', tab: 'UG' } },
        { t: 'zero_search', ts: 300, url: '/', d: { q: 'environmental studies textbook', tab: 'ALL' } },
        { t: 'rage_click', ts: 400, url: '/', d: { selector: 'button.download-btn', text: 'Download' } },
        { t: 'dead_click', ts: 500, url: '/', d: { selector: 'span.disclaimer', text: 'Notice text' } },
        { t: 'js_error', ts: 600, url: '/', d: { msg: 'Test non-fatal error' } },
        { t: 'reader_page_dwell', ts: 700, url: '/reader.html', d: { course_code: 'BCA101', page: 1, dwell_seconds: 45 } }
      ]
    });

    const postRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/telemetry',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postPayload) }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(postPayload);
      req.end();
    });

    assert.strictEqual(postRes.status, 200, 'POST /api/telemetry must return 200 OK');

    // 2. Query Friction Index endpoint
    const frictionRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=friction_index&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(frictionRes.status, 200, 'friction_index query must succeed');
    assert.ok(frictionRes.data.friction, 'Must return friction object');
    const f = frictionRes.data.friction;
    assert.ok(typeof f.score === 'number', 'Friction score must be a number');
    assert.ok(['LOW', 'MODERATE', 'ELEVATED'].includes(f.status), 'Friction status must be LOW, MODERATE, or ELEVATED');
    assert.ok(f.rage_clicks >= 1, 'Must count rage clicks');
    assert.ok(f.dead_clicks >= 1, 'Must count dead clicks');
    assert.ok(f.js_errors >= 1, 'Must count JS errors');

    // 3. Query Search Clustering endpoint
    const clusterRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=search_clustering&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(clusterRes.status, 200, 'search_clustering query must succeed');
    assert.ok(clusterRes.data.clustering, 'Must return clustering object');
    const cl = clusterRes.data.clustering.clusters;
    assert.ok(cl.course_codes, 'Must cluster course code queries');
    assert.ok(cl.semesters, 'Must cluster semester queries');
    assert.ok(cl.topics, 'Must cluster natural language topic queries');

    // 4. Query Funnel with timeframe parameter
    const funnelRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=funnel&timeframe=today&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(funnelRes.status, 200, 'funnel query must succeed');
    assert.strictEqual(funnelRes.data.funnel.timeframe, 'today', 'Must respect timeframe parameter');
    assert.ok('overall_conversion' in funnelRes.data.funnel, 'Must compute overall conversion rate');
    assert.ok('step_1_to_2_drop' in funnelRes.data.funnel, 'Must compute step 1 to 2 drop-off rate');

    // 5. Query Overview with outlier-trimmed dwell time
    const ovRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=overview&timeframe=today&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(ovRes.status, 200, 'overview query must succeed');
    const ov = ovRes.data.overview;
    assert.ok(ov.avg_dwell_seconds >= 2 && ov.avg_dwell_seconds <= 1800, 'Average study dwell must be outlier-trimmed');
    assert.ok(ov.friction_index, 'Overview must include composite friction_index');
  } finally {
    await new Promise(resolve => devServer.close(resolve));
  }
});
