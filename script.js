// ===============================
//  SGOU Programme Browser — URL-Driven SPA
// ===============================

let allData = [];
let activeLevel = 'ALL';
let isSearching = false;
let deferredInstallPrompt = null;
let currentAbort = null;
let revealObserver = null;
let searchObserver = null;
let hidePanelTimer = null;
let viewerNavLock = false;

// ===============================
//  ANALYTICS
// ===============================
const GA = {
  event(name, params) {
    try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (_) { }
  },
  trackSearch(q, n) { this.event('search', { search_term: q, custom_result_count: n }); },
  trackDownload(c, n, m) { this.event('file_download', { file_name: c + '.pdf', file_extension: 'pdf', link_text: n, link_url: m, custom_course_code: c }); },
  trackFilter(lv) { this.event('filter_change', { filter_type: 'level', filter_value: lv }); },
  trackTheme(t) { this.event('theme_change', { new_theme: t }); },
  trackShare(n, m) { this.event('share', { method: m, content_type: 'pdf_link', item_id: n }); },
  trackCardOpen(n) { this.event('select_content', { content_type: 'programme_card', item_id: n }); },
  trackInstall(o) { this.event('app_install', { method: 'beforeinstallprompt', outcome: o }); },
  trackEngagement(a) { this.event('engagement_action', { action: a }); }
};

// ===============================
//  ROUTER
// ===============================
const Router = {
  init() {
    window.addEventListener('popstate', () => this.resolve());

    // If loaded with a deep-link hash, place a home entry behind it
    // so pressing Back from the viewer always returns to home
    const h = window.location.hash;
    if (h && h.length > 2 && h !== '#/') {
      const current = h.slice(1);
      history.replaceState({ path: '/' }, '', '#/');
      history.pushState({ path: current }, '', '#' + current);
    }
  },

  navigate(path) {
    const hash = '#' + path;
    if (window.location.hash === hash) return;
    history.pushState({ path }, '', hash);
    this.resolve();
  },

  // Update URL bar only (no resolve, no re-render)
  updateUrl(path) {
    const hash = '#' + path;
    if (window.location.hash === hash) return;
    history.replaceState({ path }, '', hash);
  },

  resolve() {
    if (!allData.length) return;

    const raw = window.location.hash.slice(1);

    if (!raw || raw === '/') {
      hideViewerPanel();
      restoreState('', 'ALL');
      return;
    }

    const qIdx = raw.indexOf('?');
    const path = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');

    if (path.startsWith('/view/')) {
      const code = decodeURIComponent(path.split('/')[2] || '');
      if (code) {
        // Look up full course info from data
        let found = null;
        for (const prog of allData) {
          for (const sem of prog.semesters) {
            const c = sem.courses.find(c => c.code === code || c.name === code);
            if (c) {
              found = {
                url: c.pdf_url,
                name: c.name,
                code: c.code,
                prog: prog.programme_name,
                level: prog.level
              };
              break;
            }
          }
          if (found) break;
        }
        if (found) {
          showViewerPanel(new URLSearchParams(found));
          return;
        }
      }
      // Fallback: try legacy query params
      showViewerPanel(params);
      return;
    }

    hideViewerPanel();

    if (path === '/search') {
      restoreState(params.get('q') || '', params.get('level') || activeLevel);
    } else if (path.startsWith('/filter/')) {
      restoreState($('searchInput')?.value || '', decodeURIComponent(path.split('/')[2] || 'ALL'));
    } else {
      restoreState('', 'ALL');
    }
  }

};

// ===============================
//  VIEWER PANEL
// ===============================
function showViewerPanel(params) {
  const panel = $('viewerPanel');
  if (!panel) return;

  clearTimeout(hidePanelTimer);

  const pdfUrl = params.get('url') || '';
  const name = params.get('name') || 'Course PDF';
  const code = params.get('code') || '';
  const prog = params.get('prog') || '';
  const level = params.get('level') || '';

  // Populate UI
  const tEl = $('viewerPanelTitle');
  const pEl = $('viewerProgName');
  const lEl = $('viewerLevelTag');
  const cEl = $('viewerCourseCode');

  if (tEl) tEl.textContent = name + (code ? ' \u2014 ' + code : '');
  if (pEl) pEl.textContent = prog || '\u2014';
  if (cEl) cEl.textContent = code;

  if (lEl) {
    if (level) {
      lEl.textContent = level === 'FYUG' ? 'FYUG' : level;
      lEl.className = 'viewer-level-tag ' + (level === 'PG' ? 'pg' : level === 'UG' ? 'ug' : 'fyug');
      lEl.style.display = '';
    } else {
      lEl.style.display = 'none';
    }
  }

  // Store for download / share
  panel._data = { url: pdfUrl, name, code, prog, level };

  document.title = name + (code ? ' (' + code + ')' : '') + ' \u2014 SGOU SLM';
  document.body.style.overflow = 'hidden';
  panel.classList.add('visible');

  if (pdfUrl) loadPdfInViewer(pdfUrl);
}

function hideViewerPanel() {
  const panel = $('viewerPanel');
  if (!panel || !panel.classList.contains('visible')) return;

  clearTimeout(hidePanelTimer);
  panel.classList.remove('visible');
  document.body.style.overflow = '';
  document.title = 'SGOU SLM Browser - By Researcher Tizar';

  hidePanelTimer = setTimeout(() => {
    const frame = $('viewerPanelFrame');
    if (frame) frame.removeAttribute('src');
    const ld = $('viewerPanelLoading');
    if (ld) ld.classList.remove('hidden');
  }, 400);
}

function loadPdfInViewer(pdfUrl) {
  const frame = $('viewerPanelFrame');
  const ld = $('viewerPanelLoading');
  if (!frame) return;

  if (ld) ld.classList.remove('hidden');
  let done = false;

  function ready() {
    if (done) return;
    done = true;
    if (ld) ld.classList.add('hidden');
  }

  frame.onload = ready;

  // Best mobile support: Google Docs Viewer
  const gview = 'https://docs.google.com/gview?url=' + encodeURIComponent(pdfUrl) + '&embedded=true';
  frame.src = gview;

  // Fallback after 5s: direct URL
  setTimeout(() => { if (!done) frame.src = pdfUrl; }, 5000);

  // Force-show after 9s
  setTimeout(ready, 9000);
}

async function viewerDownload() {
  const panel = $('viewerPanel');
  if (!panel?._data?.url) return;

  const { url, name, code } = panel._data;
  const btn = $('viewerPanelDownload');
  if (btn) btn.classList.add('downloading');
  showToast('Preparing download\u2026');

  const fn = (code ? code + '_' : '') + sanitize(name) + '.pdf';
  let blob = null;

  // Try direct fetch
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) blob = await r.blob();
  } catch (_) { }

  // Try proxy
  if (!blob) {
    try {
      const r = await fetch('/api/download?url=' + encodeURIComponent(url));
      if (r.ok) blob = await r.blob();
    } catch (_) { }
  }

  if (blob && blob.size > 0) {
    const u = URL.createObjectURL(blob);
    triggerDownload(u, fn);
    setTimeout(() => URL.revokeObjectURL(u), 15000);
    showToast('Download started');
    incrementDownloadCount();
  } else {
    window.open(url, '_blank', 'noopener');
    showToast('PDF opened \u2014 save from your browser');
  }

  GA.trackDownload(code || 'unknown', fn, blob ? 'fetch' : 'new_tab');
  if (btn) setTimeout(() => btn.classList.remove('downloading'), 1200);
}

async function viewerShare() {
  const panel = $('viewerPanel');
  if (!panel?._data) return;

  const { code, name, prog, level } = panel._data;
  const base = location.origin + location.pathname.replace(/\/[^\/]*$/, '/');
  const extUrl = base + 'view.html#' + encodeURIComponent(code || name);

  const text =
    (prog ? prog + ' - ' + (level === 'FYUG' ? 'FYUG' : level) + '\n' : '') +
    name + (code ? ' - ' + code : '') + '\n' +
    extUrl + '\n\n' +
    'Shared via SLM Browser\n' + base;

  if (navigator.share) {
    try { await navigator.share({ title: name + ' \u2014 SGOU SLM', text, url: extUrl }); } catch (_) { }
  } else if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); } catch (_) { showToast('Could not copy'); }
  }
}


// ===============================
//  STATE SYNC
// ===============================
function syncUrlFromState() {
  const q = ($('searchInput')?.value || '').trim();
  let path;
  if (q) {
    path = '/search?q=' + encodeURIComponent(q) + '&level=' + encodeURIComponent(activeLevel);
  } else if (activeLevel !== 'ALL') {
    path = '/filter/' + encodeURIComponent(activeLevel);
  } else {
    path = '/';
  }
  Router.updateUrl(path);
}

function restoreState(query, level) {
  const input = $('searchInput');
  if (!input) return;

  const curQ = input.value.trim();
  const qChanged = curQ !== query;
  const lChanged = activeLevel !== level;

  // Nothing to change and UI already correct → skip
  if (!qChanged && !lChanged) return;

  if (qChanged) input.value = query;
  const cl = $('searchClear');
  if (cl) cl.classList.toggle('visible', query.length > 0);

  if (lChanged) {
    activeLevel = level;
    document.querySelectorAll('.pill').forEach(p =>
      p.classList.toggle('active', p.dataset.level === activeLevel));
  }

  handleSearch();
}

// ===============================
//  BOOT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  showSkeletons();
  initTheme();
  Router.init();
  loadData();
  initSearch();
  initDelegation();
  initKeyboard();
  initStickyShadow();
  initBackToTop();
  registerServiceWorker();
  initInstallPrompt();
  initOfflineDetection();
  updateDownloadCount();
});

// ===============================
//  SKELETONS
// ===============================
function showSkeletons() {
  const g = $('grid');
  if (!g) return;
  g.innerHTML = Array.from({ length: 6 }, () =>
    `<div class="programme-card skeleton-card"><div class="card-header">
      <div class="skel skel-tag"></div><div class="skel skel-title"></div><div class="skel skel-meta"></div>
    </div></div>`
  ).join('');
}

// ===============================
//  DATA LOADING
// ===============================
async function loadData() {
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  for (const u of ['./sgou_slm_data.json', './data.json']) {
    try {
      const r = await fetch(u, { signal: currentAbort.signal });
      if (!r.ok) continue;
      const raw = await r.json();
      if (!Array.isArray(raw)) throw new Error('Not an array');

      allData = raw
        .filter(p => p && p.programme_name && Array.isArray(p.semesters))
        .map(p => ({
          ...p,
          programme_name: String(p.programme_name || '').trim(),
          level: String(p.level || 'UG').trim(),
          semesters: (p.semesters || []).map(s => ({
            ...s,
            semester: String(s.semester || '').trim(),
            courses: Array.isArray(s.courses) ? s.courses : []
          }))
        }));

      allData.sort((a, b) =>
        a.programme_name.localeCompare(b.programme_name, 'en', { sensitivity: 'base' })
      );

      buildFilters();
      renderProgrammes(allData);
      updateStats(allData);

      // Now that data exists, resolve whatever the URL says
      Router.resolve();

      currentAbort = null;
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const g = $('grid');
  if (g) g.innerHTML = `<div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Could not load data. Place <code>sgou_slm_data.json</code> alongside this file.</div>`;
}

// ===============================
//  THEME
// ===============================
function initTheme() {
  const saved = safeGet('sgou-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme:dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
  syncMeta();

  $('themeToggle')?.addEventListener('click', () => {
    const next = docTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    safeSet('sgou-theme', next);
    syncMeta();
    GA.trackTheme(next);
  });

  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!safeGet('sgou-theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      syncMeta();
    }
  });
}

function docTheme() { return document.documentElement.getAttribute('data-theme'); }

function syncMeta() {
  const m = $('meta[name="theme-color"]');
  if (m) m.setAttribute('content', docTheme() === 'dark' ? '#080706' : '#1a1714');
}

// ===============================
//  SEARCH
// ===============================
function initSearch() {
  const input = $('searchInput');
  const clear = $('searchClear');
  if (!input) return;

  let searchTimer, analyticsTimer;

  input.addEventListener('input', () => {
    hideRecent();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      handleSearch();
      syncUrlFromState();
    }, 120);

    clearTimeout(analyticsTimer);
    const q = input.value.toLowerCase().trim();
    if (q.length >= 2) {
      analyticsTimer = setTimeout(() => {
        GA.trackSearch(q, document.querySelectorAll('.search-result-item').length);
      }, 1500);
    }
    if (clear) clear.classList.toggle('visible', q.length > 0);
  });

  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); });
  input.addEventListener('blur', () => setTimeout(hideRecent, 200));

  clear?.addEventListener('click', () => {
    input.value = '';
    clear.classList.remove('visible');
    handleSearch();
    syncUrlFromState();
    input.focus();
  });
}

function handleSearch() {
  const input = $('searchInput');
  const clear = $('searchClear');
  const q = (input?.value || '').toLowerCase().trim();
  if (clear) clear.classList.toggle('visible', q.length > 0);

  let filtered = allData;
  if (activeLevel !== 'ALL') filtered = filtered.filter(p => p.level === activeLevel);

  const grid = $('grid');
  const results = $('searchResults');

  if (q.length > 0) {
    isSearching = true;
    if (grid) grid.style.display = 'none';
    const vc = $('viewControls');
    if (vc) vc.style.display = 'none';
    if (!results) return;
    results.classList.add('active');

    const matches = [];
    const seen = new Set();
    filtered.forEach(prog => {
      const pHit = prog.programme_name.toLowerCase().includes(q);
      prog.semesters.forEach(sem => {
        sem.courses.forEach(c => {
          const hit = pHit || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
          if (hit && !seen.has(c.code)) {
            seen.add(c.code);
            matches.push({ prog, sem, course: c });
          }
        });
      });
    });

    matches.sort((a, b) =>
      a.course.name.localeCompare(b.course.name, 'en', { sensitivity: 'base' })
    );

    if (!matches.length) {
      results.innerHTML = `<div class="search-results-header">No results</div>
        <div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        No courses match &ldquo;${esc(q)}&rdquo;</div>`;
    } else {
      saveRecent(q);
      results.innerHTML =
        `<div class="search-results-header">${matches.length} course${matches.length !== 1 ? 's' : ''} found</div>` +
        matches.map((m, i) => {
          const lv = m.prog.level;
          const cls = lv === 'PG' ? 'pg' : lv === 'UG' ? 'ug' : 'fyug';
          const label = lv === 'FYUG' ? 'FYUG' : lv;
          const fn = sanitize(m.course.code + '_' + m.course.name) + '.pdf';
          const vh = buildViewerHash(m.course.pdf_url, m.course.name, m.course.code, m.prog.programme_name, m.prog.level);
          return `<div class="search-result-item" data-idx="${i}">
  <span class="search-result-level ${cls}">${label}</span>
  <div class="search-result-body">
    <div class="search-result-programme">${hl(m.prog.programme_name, q)} &middot; ${m.sem.semester}</div>
    <div class="search-result-course-name">${hl(m.course.name, q)}</div>
    <span class="search-result-code" title="Click to copy code" data-code="${ea(m.course.code)}">${hl(m.course.code, q)}</span>
  </div>
  <div class="search-result-actions">
    <button class="btn-share" data-url="${ea(m.course.pdf_url)}" data-name="${ea(m.course.name)}" aria-label="Share">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
    </button>
    <a class="btn-view" href="#${ea(vh)}" title="View PDF">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      View</a>
    <a class="btn-download" href="${ea(m.course.pdf_url)}" data-fname="${ea(fn)}" target="_blank" rel="noopener">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      PDF</a>
  </div>
</div>`;
        }).join('');

      animateSearchResults();
    }

    const st = $('stats');
    if (st) st.textContent = matches.length
      ? `${matches.length} matching course${matches.length !== 1 ? 's' : ''}`
      : 'No matches';
  } else {
    isSearching = false;
    if (results) { results.classList.remove('active'); results.innerHTML = ''; }
    const vc = $('viewControls');
    if (vc) vc.style.display = '';
    if (grid) { grid.style.display = ''; renderProgrammes(filtered); }
    updateStats(filtered);
  }
}

// ===============================
//  SEARCH RESULTS ANIMATION
// ===============================
function animateSearchResults() {
  if (searchObserver) { searchObserver.disconnect(); searchObserver = null; }
  const items = document.querySelectorAll('.search-result-item');
  if (!items.length) return;

  if ('IntersectionObserver' in window) {
    let stagger = 0;
    searchObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const d = stagger;
          stagger = Math.min(stagger + 35, 250);
          requestAnimationFrame(() => { el.style.transitionDelay = d + 'ms'; el.classList.add('animate-in'); });
          searchObserver.unobserve(el);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -10px 0px' });
    items.forEach(item => searchObserver.observe(item));
  } else {
    items.forEach(item => item.classList.add('animate-in'));
  }
}

// ===============================
//  RECENT SEARCHES
// ===============================
function saveRecent(q) {
  if (!q || q.length < 2) return;
  try {
    let r = JSON.parse(localStorage.getItem('sgou-recent') || '[]');
    r = r.filter(x => x !== q); r.unshift(q);
    localStorage.setItem('sgou-recent', JSON.stringify(r.slice(0, 5)));
  } catch (_) { }
}

function showRecent() {
  const el = $('recentSearches');
  if (!el) return;
  try {
    const items = JSON.parse(localStorage.getItem('sgou-recent') || '[]');
    if (!items.length) { el.classList.remove('visible'); return; }
    el.innerHTML = '<span class="recent-label">Recent:</span>' +
      items.map(q => `<button class="recent-pill" data-q="${ea(q)}">${esc(q)}</button>`).join('');
    el.classList.add('visible');
  } catch (_) { }
}

function hideRecent() { $('recentSearches')?.classList.remove('visible'); }

// ===============================
//  FILTERS
// ===============================
function buildFilters() {
  const levels = [...new Set(allData.map(p => p.level))].sort();
  const el = $('filters');
  if (!el) return;
  el.innerHTML = '';
  el.appendChild(mkPill('All', 'ALL', activeLevel === 'ALL', allData.length));
  levels.forEach(lv => {
    el.appendChild(mkPill(lv, lv, activeLevel === lv, allData.filter(p => p.level === lv).length));
  });
}

function mkPill(label, level, active, count) {
  const b = document.createElement('button');
  b.className = 'pill' + (active ? ' active' : '');
  b.dataset.level = level;
  b.innerHTML = `${label} <span class="pill-count">${count}</span>`;
  return b;
}

// ===============================
//  EVENT DELEGATION
// ===============================
function initDelegation() {
  document.addEventListener('click', e => {

    // ---- Viewer panel buttons (check FIRST, before anything else) ----
    if (e.target.closest('#viewerBack')) {
      if (viewerNavLock) return;
      viewerNavLock = true;
      history.back();                    // popstate → resolve → hideViewerPanel
      setTimeout(() => { viewerNavLock = false; }, 600);
      return;
    }
    if (e.target.closest('#viewerPanelDownload')) { viewerDownload(); return; }
    if (e.target.closest('#viewerPanelShare')) { viewerShare(); return; }

    // ---- Hash-based nav links ----
    const navLink = e.target.closest('a[href^="#/"]');
    if (navLink) {
      e.preventDefault();
      Router.navigate(navLink.getAttribute('href').slice(1));
      return;
    }

    // ---- Card header toggle ----
    const hdr = e.target.closest('.card-header');
    if (hdr?.closest('.programme-card')) {
      const card = hdr.closest('.programme-card');
      if (!card.classList.contains('open'))
        GA.trackCardOpen((card.querySelector('h2')?.textContent || '').trim());
      toggleCard(card);
      return;
    }

    // ---- Semester tab ----
    const tab = e.target.closest('.sem-tab');
    if (tab) {
      const card = tab.closest('.programme-card');
      if (!card) return;
      card.querySelectorAll('.sem-tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.semester-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const t = document.getElementById(tab.dataset.content);
      if (t) t.classList.add('active');
      return;
    }

    // ---- Download ----
    const dl = e.target.closest('.btn-download');
    if (dl) { e.preventDefault(); downloadPDF(dl.href, dl.dataset.fname, dl); return; }

    // ---- Share ----
    const sh = e.target.closest('.btn-share');
    if (sh) { e.preventDefault(); shareContent(sh.dataset.name, sh.dataset.url); return; }

    // ---- Course link (in card) ----
    const cl = e.target.closest('.course-link');
    if (cl) { e.preventDefault(); downloadPDF(cl.href, cl.dataset.fname, null); return; }

    // ---- Copy course code ----
    const code = e.target.closest('.search-result-code[data-code]');
    if (code) { copyToClipboard(code.dataset.code); showToast('Code copied: ' + code.dataset.code); return; }

    // ---- Recent pill ----
    const rp = e.target.closest('.recent-pill');
    if (rp) {
      const inp = $('searchInput');
      if (inp) { inp.value = rp.dataset.q; handleSearch(); syncUrlFromState(); }
      return;
    }

    // ---- Filter pill ----
    const fp = e.target.closest('.pill');
    if (fp) {
      activeLevel = fp.dataset.level;
      document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.level === activeLevel));
      GA.trackFilter(activeLevel);
      handleSearch();
      syncUrlFromState();
      return;
    }

    // ---- Expand / Collapse ----
    if (e.target.closest('#expandAll')) { expandAll(); return; }
    if (e.target.closest('#collapseAll')) { collapseAll(); return; }
  });
}

// ===============================
//  CARD TOGGLE
// ===============================
function toggleCard(card) {
  const body = card.querySelector('.card-body');
  if (!body) return;

  if (card.classList.contains('open')) {
    body.style.maxHeight = body.scrollHeight + 'px';
    void body.offsetHeight;
    body.style.maxHeight = '0px';
    card.classList.remove('open');
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'false');
    body.setAttribute('aria-hidden', 'true');
  } else {
    card.classList.add('open');
    body.setAttribute('aria-hidden', 'false');
    body.style.maxHeight = body.scrollHeight + 'px';
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');
    const onEnd = () => {
      if (card.classList.contains('open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);
    requestAnimationFrame(() => setTimeout(() => {
      const r = card.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 40)
        window.scrollTo({ top: window.scrollY + r.top - 72, behavior: 'smooth' });
    }, 350));
  }
}

function expandAll() {
  GA.trackEngagement('expand_all');
  document.querySelectorAll('.programme-card:not(.open)').forEach((card, i) => {
    const body = card.querySelector('.card-body');
    if (!body) return;
    setTimeout(() => {
      card.classList.add('open');
      body.setAttribute('aria-hidden', 'false');
      body.style.maxHeight = body.scrollHeight + 'px';
      card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');
      const onEnd = () => {
        if (card.classList.contains('open')) body.style.maxHeight = 'none';
        body.removeEventListener('transitionend', onEnd);
      };
      body.addEventListener('transitionend', onEnd);
    }, i * 50);
  });
}

function collapseAll() {
  GA.trackEngagement('collapse_all');
  document.querySelectorAll('.programme-card.open').forEach(card => {
    const body = card.querySelector('.card-body');
    if (!body) return;
    body.style.maxHeight = body.scrollHeight + 'px';
    void body.offsetHeight;
    body.style.maxHeight = '0px';
    card.classList.remove('open');
    body.setAttribute('aria-hidden', 'true');
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'false');
  });
}

// ===============================
//  KEYBOARD
// ===============================
function initKeyboard() {
  document.addEventListener('keydown', e => {
    const hdr = e.target.closest?.('.card-header');
    if (hdr && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const card = hdr.closest('.programme-card');
      if (card) toggleCard(card);
      return;
    }

    const st = e.target.closest?.('.sem-tab');
    if (st && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const tabs = [...st.closest('.semester-tabs').querySelectorAll('.sem-tab')];
      const i = tabs.indexOf(st);
      const next = e.key === 'ArrowRight' ? i + 1 : i - 1;
      if (next >= 0 && next < tabs.length) {
        e.preventDefault(); tabs[next].focus(); tabs[next].click();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault(); $('searchInput')?.focus();
      GA.trackEngagement('keyboard_shortcut'); return;
    }

    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); $('searchInput')?.focus();
      GA.trackEngagement('keyboard_shortcut'); return;
    }

    if (e.key === 'Escape') {
      const panel = $('viewerPanel');
      if (panel?.classList.contains('visible')) { history.back(); return; }
      const inp = $('searchInput');
      if (document.activeElement === inp) {
        if (inp.value) { inp.value = ''; $('searchClear')?.classList.remove('visible'); handleSearch(); syncUrlFromState(); }
        else inp.blur();
      } else collapseAll();
    }
  });
}

// ===============================
//  SCROLL REVEAL
// ===============================
function initScrollReveal() {
  if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
  document.body.classList.add('js-reveal');

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.programme-card').forEach(c => c.classList.add('revealed'));
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    let d = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        requestAnimationFrame(() => {
          card.style.transitionDelay = d + 'ms';
          card.classList.add('revealed');
          const clean = () => { card.style.transitionDelay = '0ms'; card.classList.add('reveal-done'); card.removeEventListener('transitionend', clean); };
          card.addEventListener('transitionend', clean);
        });
        d = Math.min(d + 50, 300);
        revealObserver.unobserve(card);
      }
    });
  }, { threshold: 0.03, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.programme-card:not(.revealed)').forEach(el => revealObserver.observe(el));
}

// ===============================
//  STICKY SHADOW
// ===============================
function initStickyShadow() {
  const sticky = $('stickyControls');
  if (!sticky) return;
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;margin:0;padding:0';
  sentinel.setAttribute('aria-hidden', 'true');
  sticky.before(sentinel);
  new IntersectionObserver(
    ([e]) => sticky.classList.toggle('scrolled', !e.isIntersecting),
    { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
  ).observe(sentinel);
}

// ===============================
//  BACK TO TOP
// ===============================
function initBackToTop() {
  const btn = $('backToTop');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { btn.classList.toggle('visible', window.scrollY > 500); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    GA.trackEngagement('back_to_top');
  });
}

// ===============================
//  RENDER CARDS
// ===============================
function renderProgrammes(data, query) {
  const grid = $('grid');
  if (!grid) return;

  if (!data.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      No programmes match your search.</div>`;
    return;
  }

  grid.innerHTML = data.map((prog, idx) => {
    const sems = prog.semesters;
    const total = sems.reduce((a, s) => a + s.courses.length, 0);

    return `<div class="programme-card" data-level="${prog.level === 'FYUG' ? 'FYUG' : prog.level}" data-idx="${idx}" role="listitem">
      <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
        <span class="level-tag">${prog.level === 'FYUG' ? 'FYUG' : prog.level}</span>
        <h2>${hl(prog.programme_name, query)}</h2>
        <div class="meta">${sems.length} sem &middot; ${total} courses</div>
        <span class="toggle-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="card-body" id="cb-${idx}" aria-hidden="true">
        <div class="semester-tabs" role="tablist">
          ${sems.map((s, si) => `<button class="sem-tab${si === 0 ? ' active' : ''}" data-content="p${idx}s${si}" role="tab" aria-selected="${si === 0}">${s.semester} <span class="tab-count">${s.courses.length}</span></button>`).join('')}
        </div>
        ${sems.map((s, si) => `<div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
          ${s.courses.map(c => {
      const fn = sanitize(c.code + '_' + c.name) + '.pdf';
      const vh = buildViewerHash(c.pdf_url, c.name, c.code, prog.programme_name, prog.level);
      return `<div class="course-item">
  <span class="course-code">${c.code}</span>
  <div class="course-info">
    <div class="course-name">${hl(c.name, query)}</div>
    <div class="course-actions">
      <a class="btn-view" href="#${ea(vh)}" title="View PDF">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View</a>
      <a class="course-link" href="${ea(c.pdf_url)}" data-fname="${ea(fn)}" target="_blank" rel="noopener">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download</a>
    </div>
  </div>
</div>`;
    }).join('')}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  initScrollReveal();
}

// ===============================
//  PDF DOWNLOAD
// ===============================
async function downloadPDF(url, filename, btnEl) {
  if (!url) return;
  const origHTML = btnEl?.innerHTML;

  if (btnEl) {
    btnEl.classList.add('downloading');
    btnEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" opacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" class="spin-path"/></svg> Wait`;
  }

  showToast('Preparing download\u2026');
  let blob = null;
  let method = 'new_tab';

  try {
    const origin = new URL(url, location.href).origin;
    if (origin !== location.origin) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 18000);
        const r = await fetch('/api/download?url=' + encodeURIComponent(url), { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) { blob = await r.blob(); method = 'proxy'; }
      } catch (_) { }
      if (!blob) {
        try { const r = await fetch(url); if (r.ok) { blob = await r.blob(); method = 'fetch'; } } catch (_) { }
      }
    } else {
      const r = await fetch(url);
      if (r.ok) { blob = await r.blob(); method = 'fetch'; }
    }
  } catch (_) { }

  if (blob && blob.size > 0) {
    const u = URL.createObjectURL(blob);
    triggerDownload(u, filename);
    setTimeout(() => URL.revokeObjectURL(u), 10000);
    showToast('Download started');
    incrementDownloadCount();
  } else {
    triggerDownload(url, filename);
    showToast('PDF opened \u2014 save from your browser');
  }

  GA.trackDownload(filename?.replace(/\.pdf$/i, '') || 'unknown', filename, method);
  if (btnEl) setTimeout(() => { btnEl.classList.remove('downloading'); if (origHTML) btnEl.innerHTML = origHTML; }, 1500);
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'document.pdf';
  a.target = '_blank'; a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { if (a.parentNode) a.remove(); }, 200);
}

// ===============================
//  DOWNLOAD COUNTER
// ===============================
function incrementDownloadCount() {
  try {
    const n = parseInt(localStorage.getItem('sgou-dl-count') || '0', 10) + 1;
    localStorage.setItem('sgou-dl-count', String(n));
    updateDownloadCount();
  } catch (_) { }
}

function updateDownloadCount() {
  try {
    const el = $('downloadCount');
    if (!el) return;
    const n = parseInt(localStorage.getItem('sgou-dl-count') || '0', 10);
    el.textContent = n > 0 ? `${n} download${n !== 1 ? 's' : ''} on this device` : '';
  } catch (_) { }
}

// ===============================
//  SHARE
// ===============================
async function shareContent(name, url) {
  let info = { programme: '', level: '', code: '', courseName: name, pdfUrl: url };
  for (const prog of allData) {
    for (const sem of prog.semesters) {
      const found = sem.courses.find(c => c.pdf_url === url || c.name === name);
      if (found) {
        info = {
          programme: prog.programme_name,
          level: prog.level === 'FYUG' ? 'FYUG' : prog.level,
          code: found.code,
          courseName: found.name,
          pdfUrl: found.pdf_url
        };
        break;
      }
    }
  }

  // Clean share URL — just the course code
  const base = location.origin + location.pathname.replace(/\/[^\/]*$/, '/');
  const extUrl = base + 'view.html#' + encodeURIComponent(info.code || info.courseName);

  const text =
    `${info.programme} - ${info.level}\n` +
    `${info.courseName} - ${info.code}\n` +
    `${extUrl}\n\n` +
    `Shared via SLM Browser\n` + base;

  if (navigator.share) {
    try { await navigator.share({ title: info.courseName + ' \u2014 SGOU SLM', text, url: extUrl }); GA.trackShare(name, 'web_share'); } catch (_) { }
  } else if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); GA.trackShare(name, 'clipboard'); } catch (_) { showToast('Could not copy'); }
  }
}


// ===============================
//  COPY TO CLIPBOARD
// ===============================
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
  } catch (_) { }
}

// ===============================
//  STATS
// ===============================
function updateStats(data) {
  const el = $('stats');
  if (!el) return;
  const p = data.length;
  const c = data.reduce((a, pr) => a + pr.semesters.reduce((b, s) => b + s.courses.length, 0), 0);
  el.textContent = `${p} programme${p !== 1 ? 's' : ''} \u00b7 ${c} course${c !== 1 ? 's' : ''}`;
}

// ===============================
//  TOAST
// ===============================
let toastTimer;
function showToast(msg, ms = 2200) {
  const el = $('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// ===============================
//  PWA: SERVICE WORKER
// ===============================
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', function () {
        if (this.state === 'activated') showToast('App updated \u2014 refresh for latest', 3500);
      });
    });
  }).catch(() => { });
}

// ===============================
//  PWA: INSTALL
// ===============================
function initInstallPrompt() {
  const banner = $('installBanner');
  const isStandalone = window.matchMedia('(display-mode:standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');

  if (isStandalone) { safeSet('sgou-pwa-installed', '1'); banner?.classList.remove('visible'); return; }
  if (safeGet('sgou-pwa-installed') || safeGet('sgou-install-dismissed')) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredInstallPrompt = e;
    if (banner) setTimeout(() => banner.classList.add('visible'), 2500);
  });

  window.addEventListener('appinstalled', () => {
    safeSet('sgou-pwa-installed', '1'); banner?.classList.remove('visible');
    deferredInstallPrompt = null; showToast('App installed!'); GA.trackInstall('accepted');
  });

  $('installBtn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) { showToast('Use your browser\'s install option'); return; }
    banner?.classList.remove('visible');
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') safeSet('sgou-pwa-installed', '1');
    GA.trackInstall(outcome); deferredInstallPrompt = null;
  });

  $('installDismiss')?.addEventListener('click', () => {
    banner?.classList.remove('visible'); safeSet('sgou-install-dismissed', '1'); GA.trackInstall('dismissed');
  });

  window.matchMedia('(display-mode:standalone)').addEventListener('change', (e) => {
    if (e.matches) { safeSet('sgou-pwa-installed', '1'); banner?.classList.remove('visible'); showToast('App installed!'); }
  });
}

// ===============================
//  PWA: OFFLINE
// ===============================
function initOfflineDetection() {
  const bar = $('offlineBar');
  if (!bar) return;
  const update = () => bar.classList.toggle('visible', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ===============================
//  UTILITIES
// ===============================
function $(sel) { return document.getElementById(sel) || document.querySelector(sel); }

function hl(t, q) {
  if (!q) return t;
  return t.replace(new RegExp('(' + er(q.trim()) + ')', 'gi'), '<mark>$1</mark>');
}
function er(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ea(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 80); }

function buildViewerHash(pdfUrl, name, code, prog, level) {
  // Only use course code — it's unique, URL stays clean
  return '/view/' + encodeURIComponent(code || name);
}


function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { } }
