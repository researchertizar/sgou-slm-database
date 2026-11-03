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
});

test('Database Schema: Cloudflare D1 SQL schema completeness', () => {
  const schemaPath = path.join(REPO_ROOT, 'cloudflare-worker', 'schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');

  const content = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS telemetry_sessions'), 'Must define telemetry_sessions table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS telemetry_events'), 'Must define telemetry_events table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS zero_search_ledger'), 'Must define zero_search_ledger table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS rage_click_ledger'), 'Must define rage_click_ledger table');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reading_dwell_ledger'), 'Must define reading_dwell_ledger table');
});

test('Management Dashboard: admin/dashboard.html interface integrity', () => {
  const dashPath = path.join(REPO_ROOT, 'admin', 'dashboard.html');
  assert.ok(fs.existsSync(dashPath), 'admin/dashboard.html must exist');

  const content = fs.readFileSync(dashPath, 'utf8');
  assert.ok(content.includes('id="kpiTotalSessions"'), 'Must have total sessions KPI');
  assert.ok(content.includes('id="kpiZeroSearches"'), 'Must have zero searches KPI');
  assert.ok(content.includes('id="kpiRageClicks"'), 'Must have rage clicks KPI');
  assert.ok(content.includes('id="zeroSearchTableBody"'), 'Must have zero search demand table');
  assert.ok(content.includes('id="rageClickTableBody"'), 'Must have rage click table');
  assert.ok(content.includes('id="geoBars"'), 'Must have geographic visualizer');
  assert.ok(content.includes('id="adminTokenInput"'), 'Must have token authentication input');
});

test('Local Dev Server: Telemetry Ingestion & Query APIs', async () => {
  const devServer = require('../dev_server.js');
  const port = 3039;

  await new Promise(resolve => devServer.listen(port, resolve));

  try {
    // 1. Test POST /api/telemetry
    const postPayload = JSON.stringify({
      sid: 'test_session_123',
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

    // 2. Test GET /api/analytics/query
    const getRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/analytics/query?action=overview`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });

    assert.strictEqual(getRes.status, 200, 'GET /api/analytics/query should return 200');
    assert.ok(getRes.data.overview, 'Should return overview object');
    assert.ok(getRes.data.overview.zero_searches_count >= 1, 'Should reflect zero searches');
  } finally {
    await new Promise(resolve => devServer.close(resolve));
  }
});
