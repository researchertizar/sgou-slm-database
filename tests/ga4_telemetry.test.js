// ============================================================================
// Google Analytics 4 (GA4) Deep Telemetry Automated Test Suite
// Verifies gtag tags, parameter structures, and interaction event coverage
// ============================================================================

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('GA4 Tag Initialization: index.html, view.html, reader.html', () => {
  const files = ['index.html', 'view.html', 'reader.html'];
  const expectedMeasurementId = 'G-E2N7NJNRQB';

  files.forEach(f => {
    const filePath = path.join(REPO_ROOT, f);
    assert.ok(fs.existsSync(filePath), `${f} must exist`);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Script tag for gtag
    assert.ok(
      content.includes(`https://www.googletagmanager.com/gtag/js?id=${expectedMeasurementId}`),
      `${f} must include async gtag script tag for ${expectedMeasurementId}`
    );

    // 2. dataLayer and gtag initialization
    assert.ok(
      content.includes('window.dataLayer = window.dataLayer || [];') || content.includes('window.dataLayer = window.dataLayer || []'),
      `${f} must initialize dataLayer`
    );
    assert.ok(
      content.includes(`gtag('config', '${expectedMeasurementId}'`),
      `${f} must configure ${expectedMeasurementId}`
    );

    // 3. analytics-core.js sensor inclusion
    assert.ok(
      content.includes('analytics-core.js'),
      `${f} must include analytics-core.js sensor`
    );
  });
});

test('GA4 Telemetry Coverage: js/script.js UI interactions', () => {
  const scriptPath = path.join(REPO_ROOT, 'js', 'script.js');
  assert.ok(fs.existsSync(scriptPath), 'js/script.js must exist');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verify AnalyticsService mirrors to window.gtag
  assert.ok(content.includes("window.gtag('event', name, params)"), 'AnalyticsService must dispatch to window.gtag');

  // Verify critical event calls
  const requiredEvents = [
    'search',
    'clear_search',
    'quick_search_pill_click',
    'clear_recent_searches',
    'load_more_search_results',
    'reset_filter',
    'search_category_switch',
    'toggle_pyq_drawer',
    'select_content',
    'pin_programme',
    'copy_course_code',
    'viewer_close',
    'drawer_open',
    'drawer_close',
    'clear_download_history',
    'modal_open',
    'modal_close',
    'guide_tab_switch',
    'support_amount_select',
    'support_qr_toggle',
    'support_copy_upi',
    'manual_check_update',
    'force_hard_update'
  ];

  requiredEvents.forEach(evt => {
    assert.ok(
      content.includes(`'${evt}'`) || content.includes(`"${evt}"`),
      `js/script.js must track event '${evt}'`
    );
  });
});

test('GA4 Telemetry Coverage: view.html document viewer actions', () => {
  const viewPath = path.join(REPO_ROOT, 'view.html');
  assert.ok(fs.existsSync(viewPath), 'view.html must exist');
  const content = fs.readFileSync(viewPath, 'utf8');

  const requiredViewEvents = [
    'page_view',
    'view_item',
    'file_download',
    'share',
    'theme_change',
    'report_modal_open',
    'report_document_issue',
    'details_drawer_toggle',
    'outbound_pdf_open',
    'copy_course_code'
  ];

  requiredViewEvents.forEach(evt => {
    assert.ok(
      content.includes(`'${evt}'`) || content.includes(`"${evt}"`),
      `view.html must track event '${evt}'`
    );
  });
});

test('GA4 Telemetry Coverage: reader.html canvas reading experience', () => {
  const readerPath = path.join(REPO_ROOT, 'reader.html');
  assert.ok(fs.existsSync(readerPath), 'reader.html must exist');
  const content = fs.readFileSync(readerPath, 'utf8');

  const requiredReaderEvents = [
    'reader_open',
    'view_item',
    'reader_fullscreen',
    'reader_load_error',
    'reader_progress_milestone',
    'theme_change',
    'report_modal_open',
    'report_document_issue',
    'reader_zoom_change',
    'reader_page_nav',
    'reader_error_retry'
  ];

  requiredReaderEvents.forEach(evt => {
    assert.ok(
      content.includes(`'${evt}'`) || content.includes(`"${evt}"`),
      `reader.html must track event '${evt}'`
    );
  });
});

test('GA4 Telemetry Coverage: analytics-core.js passive & micro-interaction sensor', () => {
  const sensorPath = path.join(REPO_ROOT, 'js', 'telemetry', 'analytics-core.js');
  assert.ok(fs.existsSync(sensorPath), 'analytics-core.js must exist');
  const content = fs.readFileSync(sensorPath, 'utf8');

  // Verify gtag mirroring inside central log()
  assert.ok(content.includes("window.gtag('event', eventType, gaPayload)"), 'analytics-core.js must mirror all log() events to window.gtag');

  // Verify passive and micro-interaction events
  assert.ok(content.includes('rage_click'), 'Must track rage clicks');
  assert.ok(content.includes('dead_click'), 'Must track dead clicks');
  assert.ok(content.includes('search_hesitation'), 'Must track search hesitation');
  assert.ok(content.includes('text_selected'), 'Must track text selection');
  assert.ok(content.includes('reader_page_dwell'), 'Must track reader page dwell');
  assert.ok(content.includes('cwv_lcp'), 'Must track Core Web Vitals LCP');
  assert.ok(content.includes('cwv_cls'), 'Must track Core Web Vitals CLS');
  assert.ok(content.includes('recordZeroSearch'), 'Must expose recordZeroSearch with view_search_results');
  assert.ok(content.includes('recordDownload'), 'Must expose recordDownload with file_download');
  assert.ok(content.includes('recordConsumptionChoice'), 'Must expose recordConsumptionChoice with select_content');
});

test('GA4 Telemetry Coverage: Reusable components (support-modal.js & theme.js)', () => {
  const supportPath = path.join(REPO_ROOT, 'js', 'components', 'support-modal.js');
  const themePath = path.join(REPO_ROOT, 'js', 'components', 'theme.js');

  const supportContent = fs.readFileSync(supportPath, 'utf8');
  assert.ok(supportContent.includes('support_modal_open'), 'support-modal.js must track support_modal_open');
  assert.ok(supportContent.includes('support_amount_select'), 'support-modal.js must track support_amount_select');
  assert.ok(supportContent.includes('support_upi_click'), 'support-modal.js must track support_upi_click');
  assert.ok(supportContent.includes('support_qr_toggle'), 'support-modal.js must track support_qr_toggle');
  assert.ok(supportContent.includes('support_copy_upi'), 'support-modal.js must track support_copy_upi');

  const themeContent = fs.readFileSync(themePath, 'utf8');
  assert.ok(themeContent.includes('theme_change'), 'theme.js must track theme_change to window.gtag');
});
