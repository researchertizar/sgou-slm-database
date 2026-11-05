process.env.SGOU_ADMIN_SECRET = 'test_telemetry_secret_suite_2026';
// ============================================================================
// SGOU Telemetry & Dashboard Automated Test Suite
// Verifies client sensor integrity, worker endpoints, and dashboard markup
// ============================================================================

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO_ROOT = path.resolve(__dirname, '..');

test('Client Sensor: analytics-core.js integrity & capabilities', () => {
  const sensorPath = path.join(REPO_ROOT, 'js', 'telemetry', 'analytics-core.js');
  assert.ok(fs.existsSync(sensorPath), 'analytics-core.js must exist on disk');

  const content = fs.readFileSync(sensorPath, 'utf8');
  assert.ok(content.includes('rage_click'), 'Must implement rage click detection');
  assert.ok(content.includes('dead_click'), 'Must implement dead click detection');
  assert.ok(content.includes('search_hesitation'), 'Must implement search hesitation tracking');
  assert.ok(content.includes('reader_page_dwell'), 'Must implement reader page dwell observer');
  assert.ok(content.includes('recordZeroSearch'), 'Must expose recordZeroSearch API');
  assert.ok(content.includes('sendBeacon'), 'Must use navigator.sendBeacon for zero-bloat delivery');
  assert.ok(content.includes('sgou_telemetry_uid'), 'Must generate and store persistent user ID');
  assert.ok(content.includes('isReturningUser'), 'Must track returning learner identification');
  assert.ok(content.includes('isActiveSession'), 'Must track active interaction state');
});

test('Edge Worker: Cloudflare Worker telemetry and query endpoints', () => {
  const workerPath = path.join(REPO_ROOT, 'cloudflare-worker', 'worker.js');
  assert.ok(fs.existsSync(workerPath), 'worker.js must exist');

  const content = fs.readFileSync(workerPath, 'utf8');
  assert.ok(content.includes('/api/telemetry'), 'Must handle /api/telemetry POST route');
  assert.ok(content.includes('/api/analytics/query'), 'Must handle /api/analytics/query route');
  assert.ok(content.includes('zero_search_ledger'), 'Must update zero_search_ledger in D1');
  assert.ok(content.includes('rage_click_ledger'), 'Must update rage_click_ledger in D1');
  assert.ok(content.includes('cf.city'), 'Must extract Cloudflare edge geolocation');
  assert.ok(content.includes('telemetry_users'), 'Must update telemetry_users in D1');
});

test('Database Schema: Cloudflare D1 SQL schema completeness', () => {
  const schemaPath = path.join(REPO_ROOT, 'cloudflare-worker', 'schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');

  const content = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS telemetry_sessions'), 'Must define telemetry_sessions table');
  assert.ok(content.includes('user_id TEXT'), 'Must include user_id in telemetry_sessions');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS telemetry_users'), 'Must define telemetry_users table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS telemetry_events'), 'Must define telemetry_events table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS zero_search_ledger'), 'Must define zero_search_ledger table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS rage_click_ledger'), 'Must define rage_click_ledger table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reading_dwell_ledger'), 'Must define reading_dwell_ledger table');
});

test('Management Dashboard: admin/dashboard.html interface integrity', () => {
  const dashPath = path.join(REPO_ROOT, 'admin', 'dashboard.html');
  assert.ok(fs.existsSync(dashPath), 'admin/dashboard.html must exist');

  const content = fs.readFileSync(dashPath, 'utf8');
  assert.ok(content.includes('id="kpiLiveSessions"'), 'Must have live sessions KPI');
  assert.ok(content.includes('id="kpiActiveSessions"'), 'Must have active sessions KPI');
  assert.ok(content.includes('id="kpiReturningUsers"'), 'Must have returning users KPI');
  assert.ok(content.includes('id="kpiTotalSessions"'), 'Must have total sessions KPI');
  assert.ok(content.includes('id="kpiZeroSearches"'), 'Must have zero searches KPI');
  assert.ok(content.includes('id="zeroSearchTableBody"'), 'Must have zero search demand table');
  assert.ok(content.includes('id="rageClickTableBody"'), 'Must have rage click table');
  assert.ok(content.includes('id="geoBars"'), 'Must have geographic visualizer');
  assert.ok(content.includes('id="adminTokenInput"'), 'Must have token authentication input');
  assert.ok(content.includes('id="possibilitiesContainer"'), 'Must have AI possibilities radar container');
  assert.ok(content.includes('id="exportDropdown"'), 'Must have export center dropdown');
  assert.ok(content.includes('id="btnPeriodToday"'), 'Must have comparative period controls');
  assert.ok(content.includes('data-tab="tabMonetization"'), 'Must have Monetization Cockpit tab');
  assert.ok(content.includes('id="kpiModalImpressions"'), 'Must have modal impressions KPI');
  assert.ok(content.includes('id="kpiConversionRate"'), 'Must have intent conversion rate KPI');
  assert.ok(content.includes('id="kpiGrossIntent"'), 'Must have gross intent value KPI');
  assert.ok(content.includes('id="chipDistributionContainer"'), 'Must have contribution chip matrix');
  assert.ok(content.includes('id="programmeSponsorshipTableBody"'), 'Must have programme readership & sponsorship table');
  assert.ok(content.includes('id="uiAttentionTableBody"'), 'Must have UI attention table');
  assert.ok(content.includes('id="monetizationHeuristicsContainer"'), 'Must have monetization heuristics container');
});

test('Local Dev Server: Telemetry Ingestion & Query APIs', async () => {
  const devServer = require('../dev_server.js');
  const port = 3039;

  await new Promise(resolve => devServer.listen(port, resolve));

  try {
    // 1. Test POST /api/telemetry with User Identification
    const postPayload = JSON.stringify({
      sid: 'test_session_123',
      uid: 'test_user_789',
      is_returning: 1,
      visit_count: 3,
      is_active: 1,
      profile: { touch: true, screen: '390x844' },
      events: [
        { t: 'zero_search', ts: 1200, url: '/', d: { q: 'bca cloud security', tab: 'UG' } },
        { t: 'rage_click', ts: 2400, url: '/', d: { selector: 'button#testBtn', text: 'Test' } }
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

    assert.strictEqual(postRes.status, 200, 'POST /api/telemetry should return 200');
    assert.strictEqual(postRes.data.ok, true, 'Telemetry response should indicate ok: true');

    // 2. Test GET /api/analytics/query without token (should be 401 Unauthorized)
    const unauthRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=overview`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(unauthRes.status, 401, 'GET /api/analytics/query without token should return 401 Unauthorized');

    // 3. Test GET /api/analytics/query with valid token (should be 200 OK)
    const token = 'test_telemetry_secret_suite_2026';
    const getRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=overview&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(getRes.status, 200, 'GET /api/analytics/query should return 200');
    assert.ok(getRes.data.overview, 'Should return overview object');
    assert.ok('live_sessions' in getRes.data.overview, 'Should return live_sessions in overview');
    assert.ok('active_sessions' in getRes.data.overview, 'Should return active_sessions in overview');
    assert.ok('total_users' in getRes.data.overview, 'Should return total_users in overview');
    assert.ok('returning_users' in getRes.data.overview, 'Should return returning_users in overview');
    assert.ok(getRes.data.overview.zero_searches_count >= 1, 'Should reflect zero searches');

    // 4. Test GET /api/analytics/query?action=funnel with token
    const funnelRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=funnel&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(funnelRes.status, 200, 'GET /api/analytics/query?action=funnel should return 200');
    assert.ok(funnelRes.data.funnel, 'Should return funnel object');
    assert.strictEqual(funnelRes.data.funnel.landing >= 1, true, 'Funnel should record landing session');

    // 5. Test GET /api/analytics/query?action=comparison
    const compRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=comparison&period=today&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(compRes.status, 200, 'GET /api/analytics/query?action=comparison should return 200');
    assert.ok(compRes.data.metrics, 'Should return comparison metrics');

    // 6. Test GET /api/analytics/query?action=possibilities
    const possRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=possibilities&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(possRes.status, 200, 'GET /api/analytics/query?action=possibilities should return 200');
    assert.ok(Array.isArray(possRes.data.possibilities), 'Should return possibilities array');

    // 7. Test GET /api/analytics/query?action=monetization
    const monRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=monetization&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(monRes.status, 200, 'GET /api/analytics/query?action=monetization should return 200');
    assert.ok(monRes.data.monetization, 'Should return monetization object');
    assert.ok('impressions' in monRes.data.monetization, 'Should have impressions');
    assert.ok('conversion_rate' in monRes.data.monetization, 'Should have conversion_rate');
    assert.ok('chip_breakdown' in monRes.data.monetization, 'Should have chip_breakdown');

    // 8. Test GET /api/analytics/query?action=ui_attention
    const attRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=ui_attention&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(attRes.status, 200, 'GET /api/analytics/query?action=ui_attention should return 200');
    assert.ok(attRes.data.ui_attention, 'Should return ui_attention object');
    assert.ok(Array.isArray(attRes.data.ui_attention.top_clicked_elements), 'Should have top_clicked_elements');

    // 9. Test GET /api/analytics/query?action=ui_heuristics
    const heurRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=ui_heuristics&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(heurRes.status, 200, 'GET /api/analytics/query?action=ui_heuristics should return 200');
    assert.ok(Array.isArray(heurRes.data.ui_heuristics), 'Should return ui_heuristics array');

    // 10. Test Export formats: JSON, CSV, and AI Prompt
    const exportJsonRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=export&format=json&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) }));
      }).on('error', reject);
    });
    assert.strictEqual(exportJsonRes.status, 200, 'Export JSON should return 200');
    assert.ok(exportJsonRes.data.data.sessions, 'Export JSON should contain sessions');

    const exportAiRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=export&format=ai_prompt&token=${encodeURIComponent(token)}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      }).on('error', reject);
    });
    assert.strictEqual(exportAiRes.status, 200, 'Export AI prompt should return 200');
    assert.ok(exportAiRes.data.includes('AI UX Optimization Brief'), 'Export AI prompt should contain markdown header');
  } finally {
    await new Promise(resolve => devServer.close(resolve));
  }
});
