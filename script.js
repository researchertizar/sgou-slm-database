// ===============================
//  SGOU Programme Browser
// ===============================

let allData = [];
let activeLevel = 'ALL';
let isSearching = false;
let deferredInstallPrompt = null;
let currentAbort = null;

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
//  BOOT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  showSkeletons();
  initTheme();
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
//  DATA LOADING (with sorting)
// ===============================
async function loadData() {
  // Abort any stale fetch
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  for (const u of ['./sgou_slm_data.json', './data.json']) {
    try {
      const r = await fetch(u, { signal: currentAbort.signal });
      if (!r.ok) continue;

      const raw = await r.json();

      // Validate & sanitize data
      if (!Array.isArray(raw)) throw new Error('Data is not an array');

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

      // SORT ALPHABETICALLY by programme_name
      allData.sort((a, b) =>
        a.programme_name.localeCompare(b.programme_name, 'en', { sensitivity: 'base' })
      );

      buildFilters();
      renderProgrammes(allData);
      updateStats(allData);
      currentAbort = null;
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // try next URL
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

  let searchTimer;
  input.addEventListener('input', () => {
    hideRecent();
    handleSearch();
    clearTimeout(searchTimer);
    const q = input.value.toLowerCase().trim();
    if (q.length >= 2) {
      searchTimer = setTimeout(() => {
        GA.trackSearch(q, document.querySelectorAll('.search-result-item').length);
      }, 1500);
    }
  });

  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); });
  input.addEventListener('blur', () => setTimeout(hideRecent, 200));

  clear?.addEventListener('click', () => {
    input.value = ''; clear.classList.remove('visible');
    handleSearch(); input.focus();
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
    if ($('viewControls')) $('viewControls').style.display = 'none';
    if (!results) return;
    results.classList.add('active');

    const matches = [];
    const seen = new Set();
    filtered.forEach(prog => {
      const pHit = prog.programme_name.toLowerCase().includes(q);
      prog.semesters.forEach(sem => {
        sem.courses.forEach(c => {
          const hit = c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || pHit;
          if (hit && !seen.has(c.code)) {
            seen.add(c.code);
            matches.push({ prog, sem, course: c });
          }
        });
      });
    });

    // Sort search results alphabetically
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
          const label = (lv === 'FYUG' || lv === 'FYUG') ? '4-Year UG' : lv;
          const fn = sanitize(m.course.code + '_' + m.course.name) + '.pdf';
          return `<div class="search-result-item" style="animation-delay:${Math.min(i * .03, .3)}s">
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
              <a class="btn-download" href="${ea(m.course.pdf_url)}" data-fname="${ea(fn)}" target="_blank" rel="noopener">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                PDF</a>
            </div>
          </div>`;
        }).join('');
    }

    const st = $('stats');
    if (st) st.textContent = matches.length
      ? `${matches.length} matching course${matches.length !== 1 ? 's' : ''}`
      : 'No matches';
  } else {
    isSearching = false;
    if (results) { results.classList.remove('active'); results.innerHTML = ''; }
    if ($('viewControls')) $('viewControls').style.display = '';
    if (grid) { grid.style.display = ''; renderProgrammes(filtered); }
    updateStats(filtered);
  }
}

// ===============================
//  RECENT SEARCHES
// ===============================
function saveRecent(q) {
  if (!q || q.length < 2) return;
  try {
    let r = JSON.parse(localStorage.getItem('sgou-recent') || '[]');
    r = r.filter(x => x !== q);
    r.unshift(q);
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
//  FILTERS (with programme counts)
// ===============================
function buildFilters() {
  const levels = [...new Set(allData.map(p => p.level))].sort();
  const el = $('filters');
  if (!el) return;
  el.innerHTML = '';
  el.appendChild(mkPill('All', 'ALL', true, allData.length));
  levels.forEach(lv => {
    const count = allData.filter(p => p.level === lv).length;
    const label = lv === 'FYUG' ? 'FYUG' : lv;
    el.appendChild(mkPill(label, lv, false, count));
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
    // Card header
    const hdr = e.target.closest('.card-header');
    if (hdr?.closest('.programme-card')) {
      const card = hdr.closest('.programme-card');
      if (!card.classList.contains('open')) {
        GA.trackCardOpen((card.querySelector('h2')?.textContent || '').trim());
      }
      toggleCard(card);
      return;
    }

    // Semester tab
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

    // Download
    const dl = e.target.closest('.btn-download');
    if (dl) { e.preventDefault(); downloadPDF(dl.href, dl.dataset.fname, dl); return; }

    // Share
    const sh = e.target.closest('.btn-share');
    if (sh) { e.preventDefault(); shareContent(sh.dataset.name, sh.dataset.url); return; }

    // Course link
    const cl = e.target.closest('.course-link');
    if (cl) { e.preventDefault(); downloadPDF(cl.href, cl.dataset.fname, null); return; }

    // Copy course code on click
    const code = e.target.closest('.search-result-code[data-code]');
    if (code) {
      copyToClipboard(code.dataset.code);
      showToast('Code copied: ' + code.dataset.code);
      return;
    }

    // Recent pill
    const rp = e.target.closest('.recent-pill');
    if (rp) {
      const inp = $('searchInput');
      if (inp) { inp.value = rp.dataset.q; handleSearch(); }
      return;
    }

    // Filter pill
    const fp = e.target.closest('.pill');
    if (fp) {
      activeLevel = fp.dataset.level;
      document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.level === activeLevel));
      GA.trackFilter(activeLevel);
      handleSearch();
    }
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
    body.offsetHeight;
    body.style.maxHeight = '0px';
    card.classList.remove('open');
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'false');
  } else {
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');

    const onEnd = () => {
      if (card.classList.contains('open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);

    setTimeout(() => {
      const r = card.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 40) {
        window.scrollTo({ top: window.scrollY + r.top - 72, behavior: 'smooth' });
      }
    }, 350);
  }
}

// ===============================
//  EXPAND / COLLAPSE ALL
// ===============================
function expandAll() {
  GA.trackEngagement('expand_all');
  document.querySelectorAll('.programme-card:not(.open)').forEach(card => {
    const body = card.querySelector('.card-body');
    if (!body) return;
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');
    const onEnd = () => {
      if (card.classList.contains('open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);
  });
}

function collapseAll() {
  GA.trackEngagement('collapse_all');
  document.querySelectorAll('.programme-card.open').forEach(card => {
    const body = card.querySelector('.card-body');
    if (!body) return;
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight;
    body.style.maxHeight = '0px';
    card.classList.remove('open');
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
      const inp = $('searchInput');
      if (document.activeElement === inp) {
        if (inp.value) { inp.value = ''; $('searchClear')?.classList.remove('visible'); handleSearch(); }
        else inp.blur();
      } else {
        // Close all open cards on Escape
        collapseAll();
      }
    }
  });

  $('expandAll')?.addEventListener('click', expandAll);
  $('collapseAll')?.addEventListener('click', collapseAll);
}

// ===============================
//  SCROLL REVEAL
// ===============================
let revealObserver = null;
function initScrollReveal() {
  if (revealObserver) revealObserver.disconnect();
  document.body.classList.add('js-reveal');

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.programme-card').forEach(c => c.classList.add('revealed'));
    return;
  }

  let stagger = 0;
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('revealed'), stagger);
        stagger = Math.min(stagger + 55, 300);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.03, rootMargin: '0px 0px -20px 0px' });

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
      requestAnimationFrame(() => {
        btn.classList.toggle('visible', window.scrollY > 500);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    GA.trackEngagement('back_to_top');
  });
}

// ===============================
//  RENDER CARDS (sorted)
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
    const lv = prog.level === 'FYUG' ? 'FYUG' : prog.level;

    return `<div class="programme-card" data-level="${lv}" data-idx="${idx}" role="listitem">
      <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
        <span class="level-tag">${prog.level === 'FYUG' ? '4-Year UG' : prog.level}</span>
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
      return `<div class="course-item">
              <span class="course-code">${c.code}</span>
              <div class="course-info">
                <div class="course-name">${hl(c.name, query)}</div>
                <a class="course-link" href="${ea(c.pdf_url)}" data-fname="${ea(fn)}" target="_blank" rel="noopener">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download PDF</a>
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

  showToast('Preparing download…');
  let blob = null;
  let method = 'new_tab';

  try {
    const origin = new URL(url, location.href).origin;
    if (origin !== location.origin) {
      // Cross-origin: try proxy, then direct
      try {
        const ctrl = new AbortController();
        const tmr = setTimeout(() => ctrl.abort(), 18000);
        const resp = await fetch(`/api/download?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
        clearTimeout(tmr);
        if (resp.ok) { blob = await resp.blob(); method = 'proxy'; }
      } catch (_) { }

      if (!blob) {
        try {
          const resp = await fetch(url);
          if (resp.ok) { blob = await resp.blob(); method = 'fetch'; }
        } catch (_) { }
      }
    } else {
      const resp = await fetch(url);
      if (resp.ok) { blob = await resp.blob(); method = 'fetch'; }
    }
  } catch (_) { }

  if (blob && blob.size > 0) {
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    showToast('Download started');
    incrementDownloadCount();
  } else {
    triggerDownload(url, filename);
    showToast('PDF opened — save from your browser');
  }

  const code = filename?.replace(/\.pdf$/i, '') || 'unknown';
  GA.trackDownload(code, filename, method);

  if (btnEl) {
    setTimeout(() => { btnEl.classList.remove('downloading'); if (origHTML) btnEl.innerHTML = origHTML; }, 1500);
  }
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
//  DOWNLOAD COUNTER (localStorage)
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
  if (navigator.share) {
    try { await navigator.share({ title: name + ' — SGOU', url }); GA.trackShare(name, 'web_share'); } catch (_) { }
  } else if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(url); showToast('Link copied'); GA.trackShare(name, 'clipboard'); } catch (_) { showToast('Could not copy'); }
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
      document.execCommand('copy');
      document.body.removeChild(ta);
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
        if (this.state === 'activated') showToast('App updated — refresh for latest', 3500);
      });
    });
  }).catch(() => { });
}

// ===============================
//  PWA: INSTALL PROMPT
// ===============================
function initInstallPrompt() {
  const banner = $('installBanner');
  const standalone = window.matchMedia('(display-mode:standalone)').matches;
  const dismissed = safeGet('sgou-install-dismissed');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!standalone && !dismissed && banner) {
      setTimeout(() => banner.classList.add('visible'), 2500);
    }
  });

  $('installBtn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    banner?.classList.remove('visible');
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') showToast('App installed!');
    GA.trackInstall(outcome);
    deferredInstallPrompt = null;
  });

  $('installDismiss')?.addEventListener('click', () => {
    banner?.classList.remove('visible');
    safeSet('sgou-install-dismissed', '1');
    GA.trackInstall('dismissed');
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
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function hl(t, q) { return q ? t.replace(new RegExp(`(${er(q.trim())})`, 'gi'), '<mark>$1</mark>') : t; }
function er(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ea(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 80); }

// Safe localStorage wrappers
function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { } }
