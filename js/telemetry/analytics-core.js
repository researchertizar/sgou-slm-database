/**
 * ============================================================================
 * SGOU Academic Database — Universal UX & Telemetry Sensor (analytics-core.js)
 * High-Precision, Zero-Bloat Interaction & Environmental Profiling Engine
 * Pure Vanilla ES6 | < 3.5 KB | 0 Dependencies | Sub-0.2ms Overhead | 100% Free
 * ============================================================================
 */
(function () {
  'use strict';

  // Prevent multiple sensor initialization
  if (window.__SGOU_TELEMETRY_INITIALIZED__) return;
  window.__SGOU_TELEMETRY_INITIALIZED__ = true;

  function getTelemetryEndpoint() {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) return '/api/telemetry';
      const proxyBase = (window.SGOU_CONFIG && window.SGOU_CONFIG.PDF_PROXY_URL) ? window.SGOU_CONFIG.PDF_PROXY_URL : '';
      if (proxyBase) return `${proxyBase.replace(/\/+$/, '')}/api/telemetry`;
    } catch (_) {}
    return '/api/telemetry';
  }

  const BATCH_INTERVAL_MS = 45000; // Optimized micro-batch: flush every 45s (prevents CF/Vercel rate limit saturation)
  const MAX_QUEUE_SIZE = 25;
  const eventQueue = [];

  // 1. Session ID (Anonymous, per-tab session lifetime)
  let sessionId = '';
  try {
    sessionId = sessionStorage.getItem('sgou_telemetry_sid');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      sessionStorage.setItem('sgou_telemetry_sid', sessionId);
    }
  } catch (_) {
    sessionId = 's_incognito_' + Math.random().toString(36).substring(2, 10);
  }

  // 2. Hardware, Screen & Environmental Profiling
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
  function getEnvironmentProfile() {
    return {
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      ram_gb: navigator.deviceMemory || null,
      cores: navigator.hardwareConcurrency || null,
      touch: (navigator.maxTouchPoints || 0) > 0,
      pwa: window.matchMedia('(display-mode: standalone)').matches,
      net_type: conn.effectiveType || (navigator.onLine ? 'online' : 'offline'),
      downlink: conn.downlink || null,
      rtt: conn.rtt || null,
      save_data: conn.saveData || false,
      theme: document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    };
  }

  // 3. Central Event Logger (Dual Telemetry: SQLite/D1 + Google Analytics)
  function log(eventType, details = {}) {
    eventQueue.push({
      t: eventType,
      ts: Math.round(performance.now()),
      url: window.location.pathname + window.location.search,
      d: details
    });

    // Mirror to Google Analytics (gtag) if loaded
    try {
      if (typeof window.gtag === 'function') {
        const gaPayload = {
          event_category: 'telemetry',
          page_location: window.location.href,
          ...details
        };
        window.gtag('event', eventType, gaPayload);
      }
    } catch (_) {}

    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      flush();
    }
  }

  // 4. Transmission Engine (Batched sendBeacon with fetch keepalive fallback)
  let isFlushing = false;
  function flush() {
    if (eventQueue.length === 0 || isFlushing) return;
    isFlushing = true;

    const eventsToDeliver = eventQueue.splice(0, eventQueue.length);
    const payload = JSON.stringify({
      sid: sessionId,
      profile: getEnvironmentProfile(),
      events: eventsToDeliver
    });

    try {
      const endpoint = getTelemetryEndpoint();
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(endpoint, payload);
        if (!sent) {
          fetch(endpoint, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
        }
      } else {
        fetch(endpoint, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
      }
    } catch (_) {
      // Offline fallback: preserve events if delivery throws
      if (eventQueue.length < 100) {
        eventQueue.unshift(...eventsToDeliver);
      }
    } finally {
      isFlushing = false;
    }
  }

  // Idle Schedule & Unload Triggers
  setInterval(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(flush);
    } else {
      flush();
    }
  }, BATCH_INTERVAL_MS);

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  // Resume when network comes back online
  window.addEventListener('online', () => {
    log('network_status', { online: true });
    flush();
  });
  window.addEventListener('offline', () => {
    log('network_status', { online: false });
  });

  // 5. Granular Click Observer (Rage Clicks, Dead Clicks, Action Intent)
  let lastClickTarget = null;
  let clickCounter = 0;
  let lastClickTimestamp = 0;

  function deriveSelector(el) {
    if (!el || el === document.body) return 'body';
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass) s += '.' + firstClass;
    }
    const role = el.getAttribute('role');
    if (role) s += `[role="${role}"]`;
    const action = el.getAttribute('data-action');
    if (action) s += `[data-action="${action}"]`;
    return s;
  }

  document.addEventListener('click', (e) => {
    const now = performance.now();
    const target = e.target.closest('button, a, input, select, [role="button"], summary, [data-action], .programme-card, .search-result-item') || e.target;
    const isInteractive = target.matches('button, a, input, select, [role="button"], summary, [data-action], input[type="text"]');
    const selector = deriveSelector(target);
    const textSnippet = (target.innerText || target.value || target.getAttribute('title') || '').trim().substring(0, 35);

    // Rage Click Detection: >= 3 rapid clicks on same element within 700ms
    if (target === lastClickTarget && (now - lastClickTimestamp < 700)) {
      clickCounter++;
      if (clickCounter >= 3) {
        log('rage_click', { selector, text: textSnippet, count: clickCounter });
        clickCounter = 0;
      }
    } else {
      clickCounter = 1;
      lastClickTarget = target;

      if (isInteractive) {
        log('click', { selector, text: textSnippet });
      } else if (['DIV', 'SPAN', 'P', 'H2', 'H3', 'SECTION'].includes(target.tagName)) {
        // Dead click detection on non-interactive elements with readable text
        if (textSnippet.length > 3) {
          log('dead_click', { tag: target.tagName, text: textSnippet });
        }
      }
    }
    lastClickTimestamp = now;
  }, { passive: true });

  // 6. Focus, Keystroke Dwell & Search Hesitation
  let searchFocusStart = 0;
  let searchFirstInputFired = false;
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.id === 'searchInput') {
      searchFocusStart = performance.now();
      searchFirstInputFired = false;
      log('search_focused');
    }
  }, { passive: true });

  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'searchInput') {
      if (!searchFirstInputFired && searchFocusStart > 0) {
        const hesitationMs = Math.round(performance.now() - searchFocusStart);
        log('search_hesitation', { ms: hesitationMs });
        searchFirstInputFired = true;
      }
    }
  }, { passive: true });

  // 7. Text Selection Observer
  let selectionDebounce = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionDebounce);
    selectionDebounce = setTimeout(() => {
      try {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const text = sel.toString().trim();
          if (text.length >= 4 && text.length <= 80) {
            log('text_selected', { text });
          }
        }
      } catch (_) {}
    }, 600);
  });

  // 8. Section Viewport Visibility (IntersectionObserver)
  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id || entry.target.className || entry.target.tagName;
          log('section_in_view', { section: sectionId });
        }
      });
    }, { threshold: 0.5 });

    window.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('header, section, .programme-grid, .search-container, #viewerPanel, footer').forEach(el => {
        visibilityObserver.observe(el);
      });
    });
  }

  // 9. Document Reader Dwell & Velocity Observer
  let lastReaderPage = 1;
  let lastReaderPageEnter = performance.now();
  window.addEventListener('sgou:reader_page_rendered', (e) => {
    const newPage = e.detail?.page || 1;
    const courseCode = e.detail?.courseCode || 'unknown';
    const dwellMs = Math.round(performance.now() - lastReaderPageEnter);

    log('reader_page_dwell', {
      course_code: courseCode,
      page: lastReaderPage,
      dwell_seconds: Math.round(dwellMs / 1000)
    });

    lastReaderPage = newPage;
    lastReaderPageEnter = performance.now();
  });

  // 10. Runtime Stability & Performance Telemetry
  window.addEventListener('error', (err) => {
    log('js_error', {
      msg: (err.message || '').substring(0, 150),
      file: (err.filename || '').split('/').pop(),
      line: err.lineno,
      col: err.colno
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    log('promise_rejection', {
      reason: String(e.reason || '').substring(0, 150)
    });
  });

  // Core Web Vitals (LCP, CLS, INP) via PerformanceObserver
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          log('cwv_lcp', { ms: Math.round(lastEntry.startTime) });
          lcpObserver.disconnect();
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}

    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          log('cwv_cls', { score: Math.round(clsValue * 1000) / 1000 });
        }
      });
    } catch (_) {}
  }

  // Initial Session Entry Event
  log('session_start', { referrer: document.referrer ? new URL(document.referrer, location.href).hostname : 'direct' });

  // Expose global telemetry API (with native Google Analytics GA4 integration)
  window.SGOU_TELEMETRY = {
    log,
    flush,
    recordZeroSearch: (query, activeTab, activeLevel) => {
      log('zero_search', { q: query, tab: activeTab, lvl: activeLevel });
      if (typeof window.gtag === 'function') {
        try {
          window.gtag('event', 'view_search_results', {
            search_term: query,
            results_count: 0,
            category: activeTab,
            level: activeLevel
          });
        } catch (_) {}
      }
      flush();
    },
    recordDownload: (code, filename, method, itemType) => {
      log('document_download', { code, filename, method, type: itemType });
      if (typeof window.gtag === 'function') {
        try {
          window.gtag('event', 'file_download', {
            file_name: filename,
            file_extension: 'pdf',
            item_id: code,
            item_type: itemType,
            download_method: method
          });
        } catch (_) {}
      }
    },
    recordConsumptionChoice: (code, choice) => {
      log('consumption_choice', { code, choice }); // 'canvas_reader' | 'modal_preview' | 'direct_download'
      if (typeof window.gtag === 'function') {
        try {
          window.gtag('event', 'select_content', {
            content_type: choice,
            item_id: code
          });
        } catch (_) {}
      }
    }
  };
})();
