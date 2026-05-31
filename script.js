// ===============================
//  SGOU SLM Browser
// ===============================

let allData = [];
let activeLevel = 'ALL';
let isSearching = false;
let deferredInstallPrompt = null;

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
});

// ===============================
//  SKELETONS
// ===============================
function showSkeletons() {
  const g = document.getElementById('grid');
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
  for (const u of ['./sgou_slm_data.json', './data.json']) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      allData = await r.json();
      buildFilters();
      renderProgrammes(allData);
      updateStats(allData);
      return;
    } catch (_) { }
  }
  const g = document.getElementById('grid');
  if (g) g.innerHTML = `<div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Could not load data. Place <code>sgou_slm_data.json</code> alongside this file.</div>`;
}

// ===============================
//  THEME
// ===============================
function initTheme() {
  const saved = localStorage.getItem('sgou-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme:dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
  syncMeta();

  qs('#themeToggle')?.addEventListener('click', () => {
    const next = docTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sgou-theme', next);
    syncMeta();
  });

  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!localStorage.getItem('sgou-theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      syncMeta();
    }
  });
}

function docTheme() { return document.documentElement.getAttribute('data-theme'); }

function syncMeta() {
  const m = qs('meta[name="theme-color"]');
  if (m) m.setAttribute('content', docTheme() === 'dark' ? '#080706' : '#1a1714');
}

// ===============================
//  SEARCH
// ===============================
function initSearch() {
  const input = qs('#searchInput');
  const clear = qs('#searchClear');
  if (!input) return;

  input.addEventListener('input', debounce(() => { hideRecent(); handleSearch(); }, 150));
  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); });
  input.addEventListener('blur', () => setTimeout(hideRecent, 200));

  clear?.addEventListener('click', () => {
    input.value = ''; clear.classList.remove('visible');
    handleSearch(); input.focus();
  });
}

function handleSearch() {
  const input = qs('#searchInput');
  const clear = qs('#searchClear');
  const q = (input?.value || '').toLowerCase().trim();

  if (clear) clear.classList.toggle('visible', q.length > 0);

  let filtered = allData;
  if (activeLevel !== 'ALL') filtered = filtered.filter(p => p.level === activeLevel);

  const grid = qs('#grid');
  const results = qs('#searchResults');

  if (q.length > 0) {
    isSearching = true;
    if (grid) grid.style.display = 'none';
    if (qs('#viewControls')) qs('#viewControls').style.display = 'none';
    if (!results) return;
    results.classList.add('active');

    const matches = [];
    const seen = new Set();
    filtered.forEach(prog => {
      const pHit = prog.programme_name.toLowerCase().includes(q);
      prog.semesters.forEach(sem => {
        sem.courses.forEach(c => {
          const hit = c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || pHit;
          if (hit && !seen.has(c.code)) { seen.add(c.code); matches.push({ prog, sem, course: c }); }
        });
      });
    });

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
          const label = (lv === 'FYUGP' || lv === 'FYUG') ? '4-Year UG' : lv;
          const fn = sanitize(m.course.code + '_' + m.course.name) + '.pdf';
          return `<div class="search-result-item" style="animation-delay:${Math.min(i * .03, .3)}s">
            <span class="search-result-level ${cls}">${label}</span>
            <div class="search-result-body">
              <div class="search-result-programme">${hl(m.prog.programme_name, q)} &middot; ${m.sem.semester}</div>
              <div class="search-result-course-name">${hl(m.course.name, q)}</div>
              <span class="search-result-code">${hl(m.course.code, q)}</span>
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

    const st = qs('#stats');
    if (st) st.textContent = matches.length ? `${matches.length} matching course${matches.length !== 1 ? 's' : ''}` : 'No matches';
  } else {
    isSearching = false;
    if (results) { results.classList.remove('active'); results.innerHTML = ''; }
    if (qs('#viewControls')) qs('#viewControls').style.display = '';
    if (grid) { grid.style.display = ''; renderProgrammes(filtered); }
    updateStats(filtered);
  }
}

// ===============================
//  RECENT SEARCHES
// ===============================
function saveRecent(q) {
  if (!q || q.length < 2) return;
  let r = JSON.parse(localStorage.getItem('sgou-recent') || '[]');
  r = r.filter(x => x !== q);
  r.unshift(q);
  localStorage.setItem('sgou-recent', JSON.stringify(r.slice(0, 5)));
}
function showRecent() {
  const el = qs('#recentSearches');
  if (!el) return;
  const items = JSON.parse(localStorage.getItem('sgou-recent') || '[]');
  if (!items.length) { el.classList.remove('visible'); return; }
  el.innerHTML = '<span class="recent-label">Recent:</span>' +
    items.map(q => `<button class="recent-pill" data-q="${ea(q)}">${esc(q)}</button>`).join('');
  el.classList.add('visible');
}
function hideRecent() { qs('#recentSearches')?.classList.remove('visible'); }

// ===============================
//  FILTERS
// ===============================
function buildFilters() {
  const levels = [...new Set(allData.map(p => p.level))];
  const el = qs('#filters');
  if (!el) return;
  el.innerHTML = '';
  el.appendChild(mkPill('All', 'ALL', true));
  levels.forEach(lv => el.appendChild(mkPill(lv === 'FYUG' ? 'FYUGP (4-yr)' : lv, lv, false)));
}
function mkPill(label, level, active) {
  const b = document.createElement('button');
  b.className = 'pill' + (active ? ' active' : '');
  b.textContent = label;
  b.dataset.level = level;
  return b;
}

// ===============================
//  EVENT DELEGATION
// ===============================
function initDelegation() {
  document.addEventListener('click', e => {
    // Card header
    const hdr = e.target.closest('.card-header');
    if (hdr?.closest('.programme-card')) { toggleCard(hdr.closest('.programme-card')); return; }

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

    // Course link in card
    const cl = e.target.closest('.course-link');
    if (cl) { e.preventDefault(); downloadPDF(cl.href, cl.dataset.fname, null); return; }

    // Recent pill
    const rp = e.target.closest('.recent-pill');
    if (rp) { const inp = qs('#searchInput'); if (inp) { inp.value = rp.dataset.q; handleSearch(); } return; }

    // Filter pill
    const fp = e.target.closest('.pill');
    if (fp) {
      activeLevel = fp.dataset.level;
      document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.level === activeLevel));
      handleSearch();
    }
  });
}

// ===============================
//  CARD TOGGLE
//  Only the clicked card is affected.
//  align-items:start on grid prevents
//  other cards in the row from stretching.
// ===============================
function toggleCard(card) {
  const body = card.querySelector('.card-body');
  if (!body) return;

  if (card.classList.contains('open')) {
    // CLOSE: set explicit height, reflow, animate to 0
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight; // force reflow
    body.style.maxHeight = '0px';
    card.classList.remove('open');
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'false');
  } else {
    // OPEN: animate to measured height
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');

    const onEnd = () => {
      if (card.classList.contains('open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);

    // Auto-scroll if card extends below viewport
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
  document.querySelectorAll('.programme-card:not(.open)').forEach(card => {
    const body = card.querySelector('.card-body');
    if (!body) return;
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    const onEnd = () => { if (card.classList.contains('open')) body.style.maxHeight = 'none'; body.removeEventListener('transitionend', onEnd); };
    body.addEventListener('transitionend', onEnd);
    card.querySelector('.card-header')?.setAttribute('aria-expanded', 'true');
  });
}
function collapseAll() {
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
      if (next >= 0 && next < tabs.length) { e.preventDefault(); tabs[next].focus(); tabs[next].click(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); qs('#searchInput')?.focus(); return; }
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); qs('#searchInput')?.focus(); return;
    }
    if (e.key === 'Escape') {
      const inp = qs('#searchInput');
      if (document.activeElement === inp) {
        if (inp.value) { inp.value = ''; qs('#searchClear')?.classList.remove('visible'); handleSearch(); }
        else inp.blur();
      }
    }
  });

  qs('#expandAll')?.addEventListener('click', expandAll);
  qs('#collapseAll')?.addEventListener('click', collapseAll);
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
  const sticky = qs('#stickyControls');
  if (!sticky) return;
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;margin:0;padding:0';
  sentinel.setAttribute('aria-hidden', 'true');
  sticky.before(sentinel);
  new IntersectionObserver(([e]) => sticky.classList.toggle('scrolled', !e.isIntersecting),
    { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
  ).observe(sentinel);
}

// ===============================
//  BACK TO TOP
// ===============================
function initBackToTop() {
  const btn = qs('#backToTop');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { btn.classList.toggle('visible', window.scrollY > 500); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===============================
//  RENDER CARDS
// ===============================
function renderProgrammes(data, query) {
  const grid = qs('#grid');
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
    const lv = prog.level === 'FYUGP' ? 'FYUG' : prog.level;

    return `<div class="programme-card" data-level="${lv}" data-idx="${idx}" role="listitem">
      <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
        <span class="level-tag">${prog.level === 'FYUGP' ? '4-Year UG' : prog.level}</span>
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
//  Flow:
//  1. Cross-origin → try /api/download proxy
//  2. Same-origin → direct fetch
//  3. Fallback → open in new tab
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

  try {
    const origin = new URL(url, location.href).origin;
    const isCross = origin !== location.origin;

    if (isCross) {
      // 1. Try Vercel proxy
      try {
        const ctrl = new AbortController();
        const tmr = setTimeout(() => ctrl.abort(), 18000);
        const resp = await fetch(`/api/download?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
        clearTimeout(tmr);
        if (resp.ok) blob = await resp.blob();
      } catch (_) { }

      // 2. Try direct fetch (will fail for CORS, but try)
      if (!blob) {
        try {
          const resp = await fetch(url);
          if (resp.ok) blob = await resp.blob();
        } catch (_) { }
      }
    } else {
      // Same-origin: direct fetch
      const resp = await fetch(url);
      if (resp.ok) blob = await resp.blob();
    }
  } catch (_) { }

  if (blob && blob.size > 0) {
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    showToast('Download started');
  } else {
    triggerDownload(url, filename);
    showToast('PDF opened — save from your browser');
  }

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
//  SHARE
// ===============================
async function shareContent(name, url) {
  if (navigator.share) {
    try { await navigator.share({ title: name + ' — SGOU', url }); } catch (_) { }
  } else if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(url); showToast('Link copied'); } catch (_) { showToast('Could not copy'); }
  }
}

// ===============================
//  STATS
// ===============================
function updateStats(data) {
  const el = qs('#stats');
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
  const el = qs('#toast');
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
  const banner = qs('#installBanner');
  const standalone = window.matchMedia('(display-mode:standalone)').matches;
  const dismissed = localStorage.getItem('sgou-install-dismissed');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!standalone && !dismissed && banner) setTimeout(() => banner.classList.add('visible'), 2500);
  });

  qs('#installBtn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    banner?.classList.remove('visible');
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') showToast('App installed!');
    deferredInstallPrompt = null;
  });

  qs('#installDismiss')?.addEventListener('click', () => {
    banner?.classList.remove('visible');
    localStorage.setItem('sgou-install-dismissed', '1');
  });
}

// ===============================
//  PWA: OFFLINE
// ===============================
function initOfflineDetection() {
  const bar = qs('#offlineBar');
  if (!bar) return;
  const update = () => bar.classList.toggle('visible', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ===============================
//  UTILITIES
// ===============================
function qs(s) { return document.querySelector(s); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function hl(t, q) { return q ? t.replace(new RegExp(`(${er(q.trim())})`, 'gi'), '<mark>$1</mark>') : t; }
function er(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ea(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 80); }
