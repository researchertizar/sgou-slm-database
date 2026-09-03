/**
 * ============================================================================
 *  SGOU SLM Browser — Production Application Core (S.O.L.I.D Architecture)
 * ============================================================================
 *  Author: Researcher Tizar
 *  Institution: Sree Narayana Guru Open University (SGOU)
 *  
 *  Architecture adheres to S.O.L.I.D principles:
 *   - S (Single Responsibility): Each service has one clear domain of concern.
 *   - O (Open/Closed): Strategy-based download & search handlers extendable without mutation.
 *   - L (Liskov Substitution): Polymorphic storage and fallback abstractions.
 *   - I (Interface Segregation): Discrete, minimal parameter passing between layers.
 *   - D (Dependency Inversion): UI controllers depend on abstract service layers.
 * ============================================================================
 */

'use strict';

// ============================================================================
//  1. UTILITIES & SECURITY SANITIZERS
// ============================================================================

/**
 * Fast document query selector shortcut.
 * @param {string} id - Element ID or selector
 * @returns {HTMLElement|null}
 */
const $ = (id) => document.getElementById(id) || document.querySelector(id);

/**
 * HTML entities escaper for safe DOM text injection (XSS Prevention).
 * @param {*} s - Value to escape
 * @returns {string} Safe HTML string
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Attribute escaper for safe attribute values (XSS Prevention).
 * @param {*} s - Value to escape
 * @returns {string} Safe attribute string
 */
function ea(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Regex special character escaper.
 * @param {string} s - Input string
 * @returns {string}
 */
function er(s) {
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights search keyword hits within text safely.
 * @param {string} text - Raw content
 * @param {string} query - Search term
 * @returns {string} HTML with <mark> tags
 */
function hl(text, query) {
  if (!query) return esc(text);
  const qClean = er(query.trim());
  if (!qClean) return esc(text);
  const regex = new RegExp('(' + qClean + ')', 'gi');
  return esc(text).replace(regex, '<mark>$1</mark>');
}

/**
 * Sanitizes filename string against path traversal and control characters.
 * @param {string} s - Raw filename
 * @returns {string} Clean alphanumeric filename
 */
function sanitize(s) {
  return String(s ?? '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

/**
 * Copies text safely to clipboard with fallback.
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Device & Environment detection
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';

// ============================================================================
//  2. STORAGE SERVICE (S.O.L.I.D: Single Responsibility)
// ============================================================================

/**
 * Resilient storage manager with in-memory fallback if quota is exceeded
 * or private browsing prevents disk access.
 */
class StorageService {
  constructor() {
    this._memoryStore = new Map();
  }

  get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      return this._memoryStore.has(key) ? this._memoryStore.get(key) : defaultValue;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      this._memoryStore.set(key, String(value));
    }
  }

  getJSON(key, defaultValue = null) {
    const raw = this.get(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  setJSON(key, value) {
    try {
      this.set(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      this._memoryStore.delete(key);
    }
  }

  // --- Specialized Domain Storage Helpers ---

  getTheme() {
    return this.get('sgou-theme', null);
  }

  setTheme(theme) {
    this.set('sgou-theme', theme);
  }

  getRecentSearches() {
    return this.getJSON('sgou-recent', []);
  }

  addRecentSearch(query) {
    if (!query || query.length < 2) return;
    const list = this.getRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase());
    list.unshift(query);
    this.setJSON('sgou-recent', list.slice(0, 5));
  }

  clearRecentSearches() {
    this.remove('sgou-recent');
  }

  getDownloadHistory() {
    return this.getJSON('sgou-dl-history', []);
  }

  addDownloadHistory(entry) {
    if (!entry || !entry.code) return;
    const history = this.getDownloadHistory().filter(h => h.code !== entry.code);
    history.unshift(entry);
    this.setJSON('sgou-dl-history', history.slice(0, 25));
  }

  clearDownloadHistory() {
    this.remove('sgou-dl-history');
  }

  getDownloadCount() {
    return parseInt(this.get('sgou-dl-count', '0'), 10) || 0;
  }

  incrementDownloadCount() {
    const next = this.getDownloadCount() + 1;
    this.set('sgou-dl-count', String(next));
    return next;
  }
}

const Storage = new StorageService();

// ============================================================================
//  3. TELEMETRY & ANALYTICS SERVICE
// ============================================================================

/**
 * Non-blocking Google Analytics 4 event dispatcher.
 */
class AnalyticsService {
  event(name, params = {}) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, params);
      }
    } catch {
      // Telemetry should never throw or break UI workflows
    }
  }

  trackSearch(term, resultCount) {
    this.event('search', { search_term: term, custom_result_count: resultCount });
  }

  trackDownload(courseCode, filename, method) {
    this.event('file_download', {
      file_name: filename,
      file_extension: 'pdf',
      custom_course_code: courseCode,
      download_method: method
    });
  }

  trackFilter(level) {
    this.event('filter_change', { filter_type: 'level', filter_value: level });
  }

  trackTheme(theme) {
    this.event('theme_change', { new_theme: theme });
  }

  trackShare(title, method) {
    this.event('share', { method, content_type: 'pdf_link', item_id: title });
  }

  trackEngagement(action) {
    this.event('engagement_action', { action });
  }
}

const Analytics = new AnalyticsService();

// ============================================================================
//  4. CATALOG SERVICE (S.O.L.I.D: Precomputed O(1) Indexing)
// ============================================================================

/**
 * Manages syllabus data retrieval, schema validation, and high-speed lookups.
 */
class CatalogService {
  constructor() {
    this.programmes = [];
    this.courseMap = new Map();     // O(1) code lookup
    this.searchIndex = [];          // Pre-flattened tokenized array
    this.levels = ['ALL'];
    this.isLoaded = false;
  }

  async load() {
    const sources = ['./sgou_slm_data.json', './data.json'];
    let raw = null;

    for (const url of sources) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          raw = json;
          break;
        }
      } catch {
        // Fallback to next source URL
      }
    }

    if (!raw) {
      throw new Error('Failed to load syllabus database from all endpoints');
    }

    this._process(raw);
    this.isLoaded = true;
    return this.programmes;
  }

  _process(raw) {
    this.programmes = [];
    this.courseMap.clear();
    this.searchIndex = [];
    const levelSet = new Set();

    // Sanitize and normalize
    raw.forEach(p => {
      if (!p || !p.programme_name || !Array.isArray(p.semesters)) return;

      const progName = String(p.programme_name || '').trim();
      const level = String(p.level || 'UG').trim().toUpperCase();
      levelSet.add(level);

      const sanitizedSemesters = (p.semesters || []).map(s => ({
        semester: String(s.semester || '').trim(),
        courses: Array.isArray(s.courses) ? s.courses.map(c => ({
          code: String(c.code || '').trim(),
          name: String(c.name || '').trim(),
          pdf_url: String(c.pdf_url || '').trim()
        })) : []
      }));

      const progRecord = {
        programme_name: progName,
        level,
        semesters: sanitizedSemesters
      };

      this.programmes.push(progRecord);

      // Pre-compute O(1) course map and search tokens
      sanitizedSemesters.forEach(sem => {
        sem.courses.forEach(course => {
          if (!course.code) return;

          const detail = {
            course,
            prog: progRecord,
            sem
          };

          // Map for fast deep-link lookups
          this.courseMap.set(course.code.toLowerCase(), detail);

          // Flattened search record
          this.searchIndex.push({
            code: course.code,
            name: course.name,
            pdf_url: course.pdf_url,
            progName: progRecord.programme_name,
            level: progRecord.level,
            semName: sem.semester,
            // Precomputed search tokens for sub-millisecond query evaluation
            tokens: `${course.code} ${course.name} ${progRecord.programme_name} ${progRecord.level} ${sem.semester}`.toLowerCase()
          });
        });
      });
    });

    // Sort programmes alphabetically
    this.programmes.sort((a, b) =>
      a.programme_name.localeCompare(b.programme_name, 'en', { sensitivity: 'base' })
    );

    this.levels = ['ALL', ...Array.from(levelSet).sort()];
  }

  getCourse(code) {
    if (!code) return null;
    return this.courseMap.get(code.toLowerCase().trim()) || null;
  }

  filterByLevel(level) {
    if (!level || level === 'ALL') return this.programmes;
    return this.programmes.filter(p => p.level === level);
  }

  getTotalCourses(programmesList = this.programmes) {
    return programmesList.reduce(
      (acc, p) => acc + p.semesters.reduce((sAcc, s) => sAcc + s.courses.length, 0),
      0
    );
  }
}

const Catalog = new CatalogService();

// ============================================================================
//  5. SEARCH ENGINE (S.O.L.I.D: Chunked Virtualization)
// ============================================================================

/**
 * Evaluates queries against precomputed search indices with chunked DOM rendering
 * to guarantee 60 FPS typing without layout freezes.
 */
class SearchEngine {
  constructor(catalog) {
    this.catalog = catalog;
    this.currentMatches = [];
    this.chunkSize = 25;
    this.renderedCount = 0;
  }

  /**
   * Fast multi-token matching over pre-indexed courses.
   * @param {string} query - Raw search query
   * @param {string} levelFilter - Active category ('ALL', 'UG', 'PG', etc.)
   * @returns {Array} Matching course records
   */
  search(query, levelFilter = 'ALL') {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    const results = [];
    const seenCodes = new Set();

    for (let i = 0; i < this.catalog.searchIndex.length; i++) {
      const item = this.catalog.searchIndex[i];

      // Category check
      if (levelFilter !== 'ALL' && item.level !== levelFilter) {
        continue;
      }

      // Check if all search tokens match
      let matchesAll = true;
      for (let j = 0; j < tokens.length; j++) {
        if (!item.tokens.includes(tokens[j])) {
          matchesAll = false;
          break;
        }
      }

      if (matchesAll && !seenCodes.has(item.code)) {
        seenCodes.add(item.code);
        results.push(item);
      }
    }

    // Sort by name
    results.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    this.currentMatches = results;
    this.renderedCount = 0;
    return results;
  }

  getNextChunk() {
    const chunk = this.currentMatches.slice(this.renderedCount, this.renderedCount + this.chunkSize);
    this.renderedCount += chunk.length;
    return {
      items: chunk,
      hasMore: this.renderedCount < this.currentMatches.length,
      total: this.currentMatches.length
    };
  }
}

const Search = new SearchEngine(Catalog);

// ============================================================================
//  6. DOWNLOAD & STREAMING MANAGER (S.O.L.I.D: Strategy Pattern)
// ============================================================================

/**
 * Handles Edge-streamed downloads, File System Access API folder selection,
 * live progress computation, and offline fallbacks.
 */
class DownloadManager {
  constructor() {
    this.activeItem = null;
    this.abortController = null;
    this.lastBlobUrl = null;
  }

  openModal(item) {
    if (!item || !item.url) return;
    this.activeItem = item;

    const modal = $('downloadModal');
    if (!modal) return;

    const codeEl = $('dlModalCode');
    const nameEl = $('dlModalName');
    const badgeEl = $('dlModalBadge');
    const inputEl = $('dlFilenameInput');
    const chooseBtn = $('dlChooseFolderBtn');
    const startBtn = $('dlStartBtn');
    const destTitle = $('dlDestTitle');
    const destDesc = $('dlDestDesc');
    const destIcon = $('dlDestIcon');

    const cleanDefault = (item.code ? item.code + '_' : '') + sanitize(item.name || 'document');
    if (codeEl) codeEl.textContent = item.code || 'Course SLM';
    if (nameEl) nameEl.textContent = item.name || 'Course Material';
    if (inputEl) inputEl.value = cleanDefault;

    if (badgeEl) {
      const lv = item.level || 'UG';
      badgeEl.textContent = lv === 'FYUG' ? 'FYUG' : lv;
      badgeEl.className = 'dl-badge ' + (lv === 'PG' ? 'pg' : lv === 'UG' ? 'ug' : 'fyug');
    }

    // OS-tailored storage instructions
    if (IS_IOS) {
      if (destTitle) destTitle.textContent = 'Where will this file go? (iPhone / iPad)';
      if (destDesc) destDesc.textContent = "Saves to 'Files' app > Downloads (or tap Share to pick any folder)";
      if (destIcon) destIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
      if (chooseBtn) chooseBtn.style.display = 'none';
      if (startBtn) startBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>Open &amp; Save PDF</span>';
    } else if (IS_ANDROID) {
      if (destTitle) destTitle.textContent = 'Where will this file go? (Android)';
      if (destDesc) destDesc.textContent = 'Internal Storage > Downloads folder';
      if (destIcon) destIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
      if (chooseBtn) chooseBtn.style.display = 'showSaveFilePicker' in window ? 'inline-flex' : 'none';
      if (startBtn) startBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Download PDF</span>';
    } else {
      if (destTitle) destTitle.textContent = 'Where will this file go? (PC / Mac)';
      if (destDesc) destDesc.textContent = 'System Downloads folder (or choose folder below)';
      if (destIcon) destIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
      if (chooseBtn) chooseBtn.style.display = 'showSaveFilePicker' in window ? 'inline-flex' : 'none';
      if (startBtn) startBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Download PDF</span>';
    }

    modal.classList.add('visible');
    if (inputEl) {
      setTimeout(() => { inputEl.focus(); inputEl.select(); }, 120);
    }
  }

  closeModal() {
    $('downloadModal')?.classList.remove('visible');
  }

  async startDownload(usePicker = false) {
    if (!this.activeItem) return;
    const item = this.activeItem;
    const inputEl = $('dlFilenameInput');
    let cleanName = sanitize((inputEl?.value || '').trim());
    if (!cleanName) cleanName = (item.code ? item.code + '_' : '') + sanitize(item.name || 'course');
    const fullFilename = cleanName + '.pdf';

    this.closeModal();

    if (!navigator.onLine) {
      UI.showToast('You are offline. Connect to internet to download course PDFs.');
      return;
    }

    copyToClipboard(fullFilename);

    // iOS strategy
    if (IS_IOS) {
      window.open(item.url, '_blank', 'noopener');
      UI.showToast("iPhone: Tap Share icon (\u2191) at bottom & choose 'Save to Files'", 4500);
      Storage.addDownloadHistory({
        code: item.code || '',
        name: item.name || 'Course Material',
        prog: item.prog || '',
        filename: fullFilename,
        size: '',
        url: item.url,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      Storage.incrementDownloadCount();
      UI.updateDownloadStats();
      Analytics.trackDownload(item.code || 'unknown', fullFilename, 'ios_safari');
      return;
    }

    // Modern File System Access API strategy (Desktop Chromium)
    let writable = null;
    if (usePicker && 'showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fullFilename,
          types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
        });
        writable = await fileHandle.createWritable();
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled dialog
        UI.showToast('Could not access folder, saving to default Downloads.');
      }
    }

    // Launch progress card
    this._showProgressCard(fullFilename);

    this.abortController = new AbortController();
    const startTime = Date.now();
    let receivedBytes = 0;
    const chunks = [];

    try {
      const fetchUrl = '/api/download?url=' + encodeURIComponent(item.url) + '&filename=' + encodeURIComponent(fullFilename);
      const response = await fetch(fetchUrl, { signal: this.abortController.signal });

      if (!response.ok) throw new Error('HTTP ' + response.status);

      const contentLength = +response.headers.get('content-length') || 0;
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (writable) {
          await writable.write(value);
        } else {
          chunks.push(value);
        }

        receivedBytes += value.length;
        this._updateProgressMetrics(receivedBytes, contentLength, startTime);
      }

      if (writable) {
        await writable.close();
        this.lastBlobUrl = null;
      } else {
        const blob = new Blob(chunks, { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        this.lastBlobUrl = blobUrl;
        this._triggerSave(blobUrl, fullFilename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      }

      this._showSuccessState(fullFilename, receivedBytes, writable);

      Storage.addDownloadHistory({
        code: item.code || '',
        name: item.name || 'Course PDF',
        prog: item.prog || '',
        filename: fullFilename,
        size: (receivedBytes / (1024 * 1024)).toFixed(1) + ' MB',
        url: item.url,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      Storage.incrementDownloadCount();
      UI.updateDownloadStats();
      Analytics.trackDownload(item.code || 'unknown', fullFilename, writable ? 'save_picker' : 'tracked_edge');

    } catch (err) {
      if (err.name === 'AbortError') {
        UI.showToast('Download cancelled.');
        $('downloadProgressCard')?.classList.remove('visible');
      } else {
        // Direct stream fallback
        this._triggerSave(item.url, fullFilename);
        if (IS_LOCAL) {
          UI.showToast('Local dev notice: Run node dev_server.js to test Edge proxy locally. Direct file opened.', 4000);
        } else {
          UI.showToast('Direct download initiated.');
        }
        $('downloadProgressCard')?.classList.remove('visible');
      }
    } finally {
      this.abortController = null;
    }
  }

  cancelDownload() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  _showProgressCard(filename) {
    const card = $('downloadProgressCard');
    if (!card) return;

    $('dpFilename').textContent = filename;
    $('dpStatus').textContent = 'Downloading PDF\u2026';
    $('dpBarFill').style.width = '0%';
    $('dpNumbers').textContent = 'Connecting\u2026';
    $('dpPercent').textContent = '0%';
    $('dpSuccessActions').style.display = 'none';
    $('dpCancelBtn').style.display = 'flex';
    $('dpIcon').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10" opacity=".2"/><path d="M12 2a10 10 0 0 1 10 10" class="spin-path"/></svg>`;

    card.classList.add('visible');
  }

  _updateProgressMetrics(receivedBytes, contentLength, startTime) {
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speedMB = elapsedSec > 0 ? (receivedBytes / (1024 * 1024) / elapsedSec).toFixed(1) : '0';
    const dpBarFill = $('dpBarFill');
    const dpPercent = $('dpPercent');
    const dpNumbers = $('dpNumbers');

    if (contentLength > 0) {
      const pct = Math.min(Math.round((receivedBytes / contentLength) * 100), 100);
      if (dpBarFill) dpBarFill.style.width = pct + '%';
      if (dpPercent) dpPercent.textContent = pct + '%';
      if (dpNumbers) {
        dpNumbers.textContent = `${(receivedBytes / (1024 * 1024)).toFixed(1)} MB / ${(contentLength / (1024 * 1024)).toFixed(1)} MB (${speedMB} MB/s)`;
      }
    } else {
      if (dpBarFill) dpBarFill.style.width = '100%';
      if (dpPercent) dpPercent.textContent = 'Streaming';
      if (dpNumbers) {
        dpNumbers.textContent = `${(receivedBytes / (1024 * 1024)).toFixed(1)} MB downloaded (${speedMB} MB/s)`;
      }
    }
  }

  _showSuccessState(filename, receivedBytes, usedPicker) {
    $('dpBarFill').style.width = '100%';
    $('dpPercent').textContent = '100%';
    $('dpStatus').textContent = usedPicker ? 'Saved to chosen folder!' : 'Download Complete!';
    $('dpNumbers').textContent = `${(receivedBytes / (1024 * 1024)).toFixed(1)} MB saved`;
    $('dpIcon').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    $('dpCancelBtn').style.display = 'none';
    $('dpSuccessActions').style.display = 'flex';
    UI.showToast(`Saved: ${filename}`);
  }

  _triggerSave(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { if (a.parentNode) a.remove(); }, 200);
  }
}

const Downloader = new DownloadManager();

// ============================================================================
//  7. ROUTER SERVICE (S.O.L.I.D: Pure URL-Driven State)
// ============================================================================

/**
 * Hash-based URL Router managing deep-links, browser history, and view states.
 */
class RouterService {
  constructor() {
    this.isResolving = false;
  }

  init() {
    window.addEventListener('popstate', () => this.resolve());

    const hash = window.location.hash.slice(1);
    if (!hash || hash === '/') return;

    // Standard SPA routes (#/view/CODE, #/search?q=...)
    if (hash.startsWith('/')) {
      history.replaceState({ path: '/' }, '', '#/');
      history.pushState({ path: hash }, '', '#' + hash);
      return;
    }

    // Bare course code deep link (#B21EG01LC)
    if (/^[A-Z]/.test(hash)) {
      history.replaceState({ path: '/' }, '', '#/');
      history.pushState({ path: hash }, '', '#' + hash);
    }
  }

  navigate(path) {
    const fullHash = '#' + path;
    if (window.location.hash === fullHash) return;
    history.pushState({ path }, '', fullHash);
    this.resolve();
  }

  updateUrlSilently(path) {
    const fullHash = '#' + path;
    if (window.location.hash === fullHash) return;
    history.replaceState({ path }, '', fullHash);
  }

  resolve() {
    if (!Catalog.isLoaded) return;
    this.isResolving = true;

    const raw = window.location.hash.slice(1);

    if (!raw || raw === '/') {
      UI.hideViewerPanel();
      UI.restoreState('', 'ALL');
      this.isResolving = false;
      return;
    }

    const qIndex = raw.indexOf('?');
    const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    const params = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '');

    // Course Viewer Route: #/view/CODE
    if (path.startsWith('/view/')) {
      const code = decodeURIComponent(path.split('/')[2] || '');
      const item = Catalog.getCourse(code);
      if (item) {
        UI.showViewerPanel(item.course.pdf_url, item.course.name, item.course.code, item.prog.programme_name, item.prog.level);
      } else {
        UI.showViewerPanel(params.get('url') || '', params.get('name') || 'Course PDF', code, params.get('prog') || '', params.get('level') || 'UG');
      }
      this.isResolving = false;
      return;
    }

    UI.hideViewerPanel();

    if (path === '/search') {
      UI.restoreState(params.get('q') || '', params.get('level') || UI.activeLevel);
    } else if (path.startsWith('/filter/')) {
      const level = decodeURIComponent(path.split('/')[2] || 'ALL');
      UI.restoreState($('searchInput')?.value || '', level);
    } else if (/^[A-Z]/.test(path) && !path.includes('/')) {
      // Bare course code support
      const code = decodeURIComponent(path);
      const item = Catalog.getCourse(code);
      if (item) {
        UI.showViewerPanel(item.course.pdf_url, item.course.name, item.course.code, item.prog.programme_name, item.prog.level);
        this.isResolving = false;
        return;
      }
      UI.restoreState('', 'ALL');
    } else {
      UI.restoreState('', 'ALL');
    }

    this.isResolving = false;
  }
}

const Router = new RouterService();

// ============================================================================
//  8. UI CONTROLLER (S.O.L.I.D: DOM & Interaction Orchestration)
// ============================================================================

/**
 * Manages view rendering, modal lifecycle, theme switching, and DOM delegation.
 */
class UIController {
  constructor() {
    this.activeLevel = 'ALL';
    this.toastTimer = null;
    this.navLock = false;
    this.revealObserver = null;
    this.searchTimer = null;
    this.analyticsTimer = null;
  }

  init() {
    this.initTheme();
    this.showSkeletons();
    this.initDelegation();
    this.initKeyboard();
    this.initSearch();
    this.initStickyShadow();
    this.initBackToTop();
    this.initOfflineDetection();
    this.initInstallPrompt();
    this.updateDownloadStats();
  }

  // --- Theme Management ---

  initTheme() {
    const saved = Storage.getTheme();
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    this.syncMeta();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!Storage.getTheme()) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        this.syncMeta();
      }
    });
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.setTheme(next);
    this.syncMeta();
    Analytics.trackTheme(next);
  }

  syncMeta() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const meta = $('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#13110f' : '#181512');
    }
  }

  // --- Feedback & Notifications ---

  showToast(message, durationMs = 2400) {
    const toast = $('toast');
    if (!toast) return;
    clearTimeout(this.toastTimer);
    toast.textContent = message;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('visible'));
    });
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), durationMs);
  }

  showSkeletons() {
    const grid = $('grid');
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="programme-card skeleton-card">
        <div class="card-header">
          <div class="skel skel-tag"></div>
          <div class="skel skel-title"></div>
          <div class="skel skel-meta"></div>
        </div>
      </div>
    `).join('');
  }

  // --- Search & Filtering ---

  initSearch() {
    const input = $('searchInput');
    const clear = $('searchClear');
    if (!input) return;

    input.addEventListener('input', () => {
      this.hideRecentSearches();
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.executeSearch();
        this.syncUrlFromState();
      }, 120);

      clearTimeout(this.analyticsTimer);
      const q = input.value.trim().toLowerCase();
      if (q.length >= 2) {
        this.analyticsTimer = setTimeout(() => {
          Analytics.trackSearch(q, document.querySelectorAll('.search-result-item').length);
        }, 1500);
      }
      if (clear) clear.classList.toggle('visible', q.length > 0);
    });

    input.addEventListener('focus', () => {
      if (!input.value.trim()) this.showRecentSearches();
    });

    input.addEventListener('blur', () => {
      setTimeout(() => this.hideRecentSearches(), 200);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q.length >= 2) {
          Storage.addRecentSearch(q);
          input.blur();
        }
      }
    });

    clear?.addEventListener('click', () => {
      input.value = '';
      clear.classList.remove('visible');
      this.executeSearch();
      this.syncUrlFromState();
      input.focus();
    });
  }

  executeSearch() {
    const input = $('searchInput');
    const q = (input?.value || '').trim();
    const grid = $('grid');
    const results = $('searchResults');
    const viewControls = $('viewControls');

    if (q.length > 0) {
      if (grid) grid.style.display = 'none';
      if (viewControls) viewControls.style.display = 'none';
      if (!results) return;
      results.classList.add('active');

      const matches = Search.search(q, this.activeLevel);

      if (!matches.length) {
        results.innerHTML = `
          <div class="search-results-header">No results</div>
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            No courses match &ldquo;${esc(q)}&rdquo;
          </div>`;
      } else {
        const chunk = Search.getNextChunk();
        results.innerHTML = `
          <div class="search-results-header">${matches.length} course${matches.length !== 1 ? 's' : ''} found</div>
          <div id="searchItemsContainer">
            ${this._renderSearchItemsHTML(chunk.items, q)}
          </div>
          ${chunk.hasMore ? `<button id="loadMoreSearchBtn" class="pill" style="margin:1rem auto;display:flex">Show more results (${matches.length - chunk.items.length} remaining)</button>` : ''}
        `;
        this.animateSearchResults();
      }

      const stats = $('stats');
      if (stats) {
        stats.textContent = matches.length ? `${matches.length} matching course${matches.length !== 1 ? 's' : ''}` : 'No matches';
      }
    } else {
      if (results) {
        results.classList.remove('active');
        results.innerHTML = '';
      }
      if (viewControls) viewControls.style.display = '';
      const filteredProgrammes = Catalog.filterByLevel(this.activeLevel);
      if (grid) {
        grid.style.display = '';
        this.renderProgrammes(filteredProgrammes);
      }
      this.updateStats(filteredProgrammes);
    }
  }

  _renderSearchItemsHTML(items, query) {
    return items.map((item, idx) => {
      const cls = item.level === 'PG' ? 'pg' : item.level === 'UG' ? 'ug' : 'fyug';
      const label = item.level;
      const fn = sanitize(item.code + '_' + item.name) + '.pdf';
      const vh = '/view/' + encodeURIComponent(item.code || item.name);

      return `
        <div class="search-result-item" data-idx="${idx}">
          <span class="search-result-level ${cls}">${label}</span>
          <div class="search-result-body">
            <div class="search-result-programme">${hl(item.progName, query)} &middot; ${esc(item.semName)}</div>
            <div class="search-result-course-name">${hl(item.name, query)}</div>
            <span class="search-result-code" title="Click to copy code" data-code="${ea(item.code)}">${hl(item.code, query)}</span>
          </div>
          <div class="search-result-actions">
            <button class="btn-share" data-url="${ea(item.pdf_url)}" data-name="${ea(item.name)}" aria-label="Share">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <a class="btn-view" href="#${ea(vh)}" title="View PDF">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </a>
            <a class="btn-download" href="${ea(item.pdf_url)}" data-fname="${ea(fn)}" data-code="${ea(item.code)}" data-name="${ea(item.name)}" data-prog="${ea(item.progName)}" data-level="${ea(item.level)}" target="_blank" rel="noopener noreferrer">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  loadRemainingSearchResults() {
    const chunk = Search.getNextChunk();
    const container = $('searchItemsContainer');
    const loadBtn = $('loadMoreSearchBtn');
    if (!container) return;

    const query = $('searchInput')?.value?.trim() || '';
    container.insertAdjacentHTML('beforeend', this._renderSearchItemsHTML(chunk.items, query));

    if (!chunk.hasMore && loadBtn) {
      loadBtn.remove();
    } else if (loadBtn) {
      loadBtn.textContent = `Show more results (${chunk.total - Search.renderedCount} remaining)`;
    }

    this.animateSearchResults();
  }

  animateSearchResults() {
    const items = document.querySelectorAll('.search-result-item:not(.animate-in)');
    if (!items.length) return;

    if ('IntersectionObserver' in window) {
      let delay = 0;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            requestAnimationFrame(() => {
              el.style.transitionDelay = delay + 'ms';
              el.classList.add('animate-in');
            });
            delay = Math.min(delay + 25, 200);
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.05 });
      items.forEach(el => observer.observe(el));
    } else {
      items.forEach(el => el.classList.add('animate-in'));
    }
  }

  // --- Recent Searches ---

  showRecentSearches() {
    const container = $('recentSearches');
    if (!container) return;
    const items = Storage.getRecentSearches();
    if (!items.length) {
      container.classList.remove('visible');
      return;
    }
    container.innerHTML = '<span class="recent-label">Recent:</span>' +
      items.map(q => `<button class="recent-pill" data-q="${ea(q)}">${esc(q)}</button>`).join('') +
      '<button class="recent-clear-btn" id="clearRecentBtn" title="Clear recent searches">&times; Clear</button>';
    container.classList.add('visible');
  }

  hideRecentSearches() {
    $('recentSearches')?.classList.remove('visible');
  }

  // --- Filter Category Pills ---

  buildFilters() {
    const container = $('filters');
    if (!container) return;
    container.innerHTML = '';

    Catalog.levels.forEach(lv => {
      const count = lv === 'ALL'
        ? Catalog.programmes.length
        : Catalog.programmes.filter(p => p.level === lv).length;

      const pill = document.createElement('button');
      pill.className = 'pill' + (this.activeLevel === lv ? ' active' : '');
      pill.dataset.level = lv;
      pill.innerHTML = `${lv === 'ALL' ? 'All' : lv} <span class="pill-count">${count}</span>`;
      container.appendChild(pill);
    });
  }

  // --- Programme Cards Rendering ---

  renderProgrammes(programmesList, query = '') {
    const grid = $('grid');
    if (!grid) return;

    if (!programmesList.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          No programmes found matching category.
        </div>`;
      return;
    }

    grid.innerHTML = programmesList.map((prog, idx) => {
      const sems = prog.semesters;
      const totalCourses = sems.reduce((sum, s) => sum + s.courses.length, 0);

      return `
        <div class="programme-card" data-level="${ea(prog.level)}" data-idx="${idx}" role="listitem">
          <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
            <span class="level-tag">${esc(prog.level)}</span>
            <h2>${hl(prog.programme_name, query)}</h2>
            <div class="meta">${sems.length} sem &middot; ${totalCourses} courses</div>
            <span class="toggle-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div class="card-body" id="cb-${idx}" aria-hidden="true">
            <div class="semester-tabs" role="tablist">
              ${sems.map((s, si) => `
                <button class="sem-tab${si === 0 ? ' active' : ''}" data-content="p${idx}s${si}" role="tab" aria-selected="${si === 0}">
                  ${esc(s.semester)} <span class="tab-count">${s.courses.length}</span>
                </button>
              `).join('')}
            </div>
            ${sems.map((s, si) => `
              <div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
                ${s.courses.map(course => {
        const fn = sanitize(course.code + '_' + course.name) + '.pdf';
        const vh = '/view/' + encodeURIComponent(course.code || course.name);
        return `
                    <div class="course-item">
                      <span class="course-code">${esc(course.code)}</span>
                      <div class="course-info">
                        <div class="course-name">${hl(course.name, query)}</div>
                        <div class="course-actions">
                          <a class="btn-view" href="#${ea(vh)}" title="View PDF">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View
                          </a>
                          <a class="course-link" href="${ea(course.pdf_url)}" data-fname="${ea(fn)}" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  `;
      }).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    this.initScrollReveal();
  }

  initScrollReveal() {
    if (this.revealObserver) {
      this.revealObserver.disconnect();
      this.revealObserver = null;
    }
    document.body.classList.add('js-reveal');

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.programme-card').forEach(c => c.classList.add('revealed'));
      return;
    }

    this.revealObserver = new IntersectionObserver((entries) => {
      let delay = 0;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          requestAnimationFrame(() => {
            card.style.transitionDelay = delay + 'ms';
            card.classList.add('revealed');
            const onEnd = () => {
              card.style.transitionDelay = '0ms';
              card.classList.add('reveal-done');
              card.removeEventListener('transitionend', onEnd);
            };
            card.addEventListener('transitionend', onEnd);
          });
          delay = Math.min(delay + 40, 240);
          this.revealObserver.unobserve(card);
        }
      });
    }, { threshold: 0.03, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.programme-card:not(.revealed)').forEach(el => this.revealObserver.observe(el));
  }

  toggleCard(card) {
    const body = card.querySelector('.card-body');
    if (!body) return;

    if (card.classList.contains('open')) {
      body.style.maxHeight = body.scrollHeight + 'px';
      void body.offsetHeight; // force reflow
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

      requestAnimationFrame(() => {
        setTimeout(() => {
          const rect = card.getBoundingClientRect();
          if (rect.bottom > window.innerHeight + 40) {
            window.scrollTo({ top: window.scrollY + rect.top - 72, behavior: 'smooth' });
          }
        }, 320);
      });
    }
  }

  expandAll() {
    Analytics.trackEngagement('expand_all');
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
      }, i * 40);
    });
  }

  collapseAll() {
    Analytics.trackEngagement('collapse_all');
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

  // --- Fullscreen In-App PDF Preview Panel ---

  showViewerPanel(pdfUrl, name, code, prog, level) {
    const panel = $('viewerPanel');
    if (!panel) return;

    $('viewerPanelTitle').textContent = name || 'Course PDF';
    $('viewerProgName').textContent = prog || '';
    $('viewerCourseCode').textContent = code ? 'Code: ' + code : '';

    const badge = $('viewerLevelTag');
    if (badge) {
      badge.textContent = level === 'FYUG' ? 'FYUG' : (level || 'UG');
      badge.className = 'viewer-meta-tag ' + (level === 'PG' ? 'pg' : level === 'UG' ? 'ug' : 'fyug');
    }

    panel._data = { url: pdfUrl, name, code, prog, level };
    panel.classList.add('visible');
    document.body.classList.add('viewer-panel-open');

    // Hardware-accelerated direct PDF preview (NO Google Docs gview download bug!)
    const frame = $('viewerPanelFrame');
    const ld = $('viewerPanelLoading');
    if (frame) {
      if (ld) {
        ld.classList.remove('hidden');
        ld.innerHTML = '<div class="loading-spinner"></div><span>Loading PDF preview&hellip;</span>';
      }
      let loaded = false;
      const onReady = () => {
        if (loaded) return;
        loaded = true;
        if (ld) ld.classList.add('hidden');
      };
      frame.onload = onReady;
      frame.src = pdfUrl + '#toolbar=1&navpanes=0';
      setTimeout(onReady, 3500);
    }
  }

  hideViewerPanel() {
    const panel = $('viewerPanel');
    if (!panel) return;
    panel.classList.remove('visible');
    document.body.classList.remove('viewer-panel-open');
    const frame = $('viewerPanelFrame');
    if (frame) frame.src = 'about:blank';
  }

  // --- My Downloads Library Drawer ---

  renderMyDownloads() {
    const list = $('myDownloadsList');
    if (!list) return;
    const history = Storage.getDownloadHistory();

    if (!history.length) {
      list.innerHTML = `
        <div class="my-dl-empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <div>No downloads recorded yet.</div>
          <div style="font-size:11px;color:var(--ink-muted)">Downloaded materials will be cataloged here for quick retrieval.</div>
        </div>`;
      return;
    }

    list.innerHTML = history.map(h => `
      <div class="my-dl-item">
        <div class="my-dl-item-top">
          <span class="my-dl-code">${esc(h.code)}</span>
          <span class="my-dl-time">${esc(h.date)} &middot; ${esc(h.time)}</span>
        </div>
        <div class="my-dl-name">${esc(h.name)}</div>
        <div class="my-dl-actions">
          <span class="my-dl-filename" title="${esc(h.filename)}">${esc(h.filename)}${h.size ? ' (' + esc(h.size) + ')' : ''}</span>
          <a class="my-dl-btn" href="${ea(h.url)}" target="_blank" rel="noopener noreferrer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Open
          </a>
        </div>
      </div>
    `).join('');
  }

  updateDownloadStats() {
    const badge = $('downloadsBadge');
    const countEl = $('downloadCount');
    const history = Storage.getDownloadHistory();
    const totalCount = Storage.getDownloadCount();

    if (badge) {
      if (history.length > 0) {
        badge.textContent = history.length;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (countEl) {
      countEl.textContent = totalCount > 0 ? `${totalCount} download${totalCount !== 1 ? 's' : ''} on this device` : '';
    }
  }

  // --- Share Management ---

  async shareContent(name, url) {
    const item = Catalog.courseMap.get((name || '').toLowerCase()) || null;
    const code = item?.course?.code || '';
    const prog = item?.prog?.programme_name || 'SGOU SLM';
    const siteUrl = location.origin + '/';
    const viewUrl = siteUrl + 'view.html#' + encodeURIComponent(code || name);

    const text = `${prog}\n${name}${code ? ' (' + code + ')' : ''}\n${viewUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: name + ' — SGOU SLM', text });
        Analytics.trackShare(name, 'web_share');
      } catch {
        // User cancelled share dialog
      }
    } else {
      const ok = await copyToClipboard(text);
      this.showToast(ok ? 'Link copied to clipboard!' : 'Could not copy link');
      Analytics.trackShare(name, 'clipboard');
    }
  }

  // --- State Synchronization ---

  syncUrlFromState() {
    const q = ($('searchInput')?.value || '').trim();
    let path;
    if (q) {
      path = '/search?q=' + encodeURIComponent(q) + '&level=' + encodeURIComponent(this.activeLevel);
    } else if (this.activeLevel !== 'ALL') {
      path = '/filter/' + encodeURIComponent(this.activeLevel);
    } else {
      path = '/';
    }
    Router.updateUrlSilently(path);
  }

  restoreState(query, level) {
    const input = $('searchInput');
    if (!input) return;

    const curQ = input.value.trim();
    const qChanged = curQ !== query;
    const lChanged = this.activeLevel !== level;

    if (!qChanged && !lChanged) return;

    if (qChanged) input.value = query;
    $('searchClear')?.classList.toggle('visible', query.length > 0);

    if (lChanged) {
      this.activeLevel = level;
      document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.level === this.activeLevel));
    }

    this.executeSearch();
  }

  updateStats(programmesList = Catalog.programmes) {
    const el = $('stats');
    if (!el) return;
    const p = programmesList.length;
    const c = Catalog.getTotalCourses(programmesList);
    el.textContent = `${p} programme${p !== 1 ? 's' : ''} \u00b7 ${c} course${c !== 1 ? 's' : ''}`;
  }

  // --- Peripheral Helpers & Event Listeners ---

  initStickyShadow() {
    const sticky = $('stickyControls');
    if (!sticky) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:1px;margin:0;padding:0';
    sentinel.setAttribute('aria-hidden', 'true');
    sticky.before(sentinel);
    new IntersectionObserver(
      ([entry]) => sticky.classList.toggle('scrolled', !entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    ).observe(sentinel);
  }

  initBackToTop() {
    const btn = $('backToTop');
    if (!btn) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          btn.classList.toggle('visible', window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      Analytics.trackEngagement('back_to_top');
    });
  }

  initOfflineDetection() {
    const bar = $('offlineBar');
    if (!bar) return;
    const update = () => bar.classList.toggle('visible', !navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  initInstallPrompt() {
    const banner = $('installBanner');
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (banner && !Storage.get('sgou-install-dismissed')) {
        setTimeout(() => banner.classList.add('visible'), 2500);
      }
    });

    $('installBtn')?.addEventListener('click', async () => {
      if (!deferredPrompt) {
        this.showToast("Use your browser's install option");
        return;
      }
      banner?.classList.remove('visible');
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });

    $('installDismiss')?.addEventListener('click', () => {
      banner?.classList.remove('visible');
      Storage.set('sgou-install-dismissed', '1');
    });
  }

  initKeyboard() {
    document.addEventListener('keydown', e => {
      // Toggle card on Enter/Space
      const hdr = e.target.closest?.('.card-header');
      if (hdr && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const card = hdr.closest('.programme-card');
        if (card) this.toggleCard(card);
        return;
      }

      // Quick Search shortcut (/ or Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        $('searchInput')?.focus();
        Analytics.trackEngagement('keyboard_search_shortcut');
        return;
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        $('searchInput')?.focus();
        Analytics.trackEngagement('keyboard_slash_shortcut');
        return;
      }

      // Escape dismissal
      if (e.key === 'Escape') {
        if ($('downloadModal')?.classList.contains('visible')) {
          Downloader.closeModal();
          return;
        }
        if ($('myDownloadsDrawer')?.classList.contains('visible')) {
          $('myDownloadsDrawer')?.classList.remove('visible');
          return;
        }
        if ($('storageHelpModal')?.classList.contains('visible')) {
          $('storageHelpModal')?.classList.remove('visible');
          return;
        }
        if ($('viewerPanel')?.classList.contains('visible')) {
          history.back();
          return;
        }
        const input = $('searchInput');
        if (document.activeElement === input) {
          if (input.value) {
            input.value = '';
            $('searchClear')?.classList.remove('visible');
            this.executeSearch();
            this.syncUrlFromState();
          } else {
            input.blur();
          }
        } else {
          this.collapseAll();
        }
      }
    });
  }

  // --- Central Event Delegation ---

  initDelegation() {
    document.addEventListener('click', e => {
      // Theme Toggle
      if (e.target.closest('#themeToggle')) {
        this.toggleTheme();
        return;
      }

      // Viewer Back
      if (e.target.closest('#viewerBack')) {
        if (this.navLock) return;
        this.navLock = true;
        history.back();
        setTimeout(() => { this.navLock = false; }, 400);
        return;
      }

      // Viewer External Open
      if (e.target.closest('#viewerPanelExternal')) {
        const panel = $('viewerPanel');
        if (panel?._data?.url) {
          window.open(panel._data.url, '_blank', 'noopener noreferrer');
          Analytics.trackEngagement('viewer_external');
        }
        return;
      }

      // Viewer Download
      if (e.target.closest('#viewerPanelDownload')) {
        const panel = $('viewerPanel');
        if (panel?._data) {
          Downloader.openModal(panel._data);
        }
        return;
      }

      // Viewer Share
      if (e.target.closest('#viewerPanelShare')) {
        const panel = $('viewerPanel');
        if (panel?._data) {
          this.shareContent(panel._data.name, panel._data.url);
        }
        return;
      }

      // My Downloads Drawer Trigger
      if (e.target.closest('#myDownloadsBtn')) {
        this.renderMyDownloads();
        $('myDownloadsDrawer')?.classList.add('visible');
        return;
      }
      if (e.target.closest('#myDownloadsClose')) {
        $('myDownloadsDrawer')?.classList.remove('visible');
        return;
      }
      if (e.target.closest('#myDownloadsClearBtn')) {
        Storage.clearDownloadHistory();
        this.updateDownloadStats();
        this.renderMyDownloads();
        this.showToast('Download history cleared');
        return;
      }

      // Storage Help Modal
      if (e.target.closest('#storageHelpBtn')) {
        $('storageHelpModal')?.classList.add('visible');
        return;
      }
      if (e.target.closest('#storageHelpClose') || e.target.closest('#storageHelpDoneBtn')) {
        $('storageHelpModal')?.classList.remove('visible');
        return;
      }
      const guideTab = e.target.closest('.guide-tab');
      if (guideTab) {
        document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.guide-content').forEach(c => c.classList.remove('active'));
        guideTab.classList.add('active');
        const target = document.getElementById(guideTab.dataset.tab);
        if (target) target.classList.add('active');
        return;
      }

      // Download Modal Actions
      if (e.target.closest('#dlModalClose')) {
        Downloader.closeModal();
        return;
      }
      if (e.target.closest('#dlChooseFolderBtn')) {
        Downloader.startDownload(true);
        return;
      }
      if (e.target.closest('#dlStartBtn')) {
        Downloader.startDownload(false);
        return;
      }

      // Progress Card Actions
      if (e.target.closest('#dpCancelBtn')) {
        Downloader.cancelDownload();
        return;
      }
      if (e.target.closest('#dpDismissBtn')) {
        $('downloadProgressCard')?.classList.remove('visible');
        return;
      }
      if (e.target.closest('#dpOpenBtn')) {
        const u = Downloader.lastBlobUrl || Downloader.activeItem?.url;
        if (u) window.open(u, '_blank', 'noopener noreferrer');
        return;
      }

      // Backdrop Dismissal
      if (e.target === $('downloadModal')) { Downloader.closeModal(); return; }
      if (e.target === $('storageHelpModal')) { $('storageHelpModal')?.classList.remove('visible'); return; }
      if (e.target === $('myDownloadsDrawer')) { $('myDownloadsDrawer')?.classList.remove('visible'); return; }

      // Hash Navigation
      const navLink = e.target.closest('a[href^="#/"]');
      if (navLink) {
        e.preventDefault();
        Router.navigate(navLink.getAttribute('href').slice(1));
        return;
      }

      // Card Header Expansion
      const cardHeader = e.target.closest('.card-header');
      if (cardHeader && cardHeader.closest('.programme-card')) {
        const card = cardHeader.closest('.programme-card');
        this.toggleCard(card);
        return;
      }

      // Semester Tab Switching
      const semTab = e.target.closest('.sem-tab');
      if (semTab) {
        const card = semTab.closest('.programme-card');
        if (!card) return;
        card.querySelectorAll('.sem-tab').forEach(t => t.classList.remove('active'));
        card.querySelectorAll('.semester-content').forEach(c => c.classList.remove('active'));
        semTab.classList.add('active');
        const content = document.getElementById(semTab.dataset.content);
        if (content) content.classList.add('active');
        return;
      }

      // Download Buttons (Card or Search item)
      const dlBtn = e.target.closest('.btn-download, .course-link');
      if (dlBtn) {
        e.preventDefault();
        const code = dlBtn.dataset.code || '';
        const item = Catalog.getCourse(code);
        if (item) {
          Downloader.openModal({
            url: item.course.pdf_url,
            name: item.course.name,
            code: item.course.code,
            prog: item.prog.programme_name,
            level: item.prog.level
          });
        } else {
          Downloader.openModal({
            url: dlBtn.href,
            name: dlBtn.dataset.name || 'Course PDF',
            code: dlBtn.dataset.code || '',
            prog: dlBtn.dataset.prog || 'SGOU Programme',
            level: dlBtn.dataset.level || 'UG'
          });
        }
        return;
      }

      // Share Buttons
      const shareBtn = e.target.closest('.btn-share');
      if (shareBtn) {
        e.preventDefault();
        this.shareContent(shareBtn.dataset.name, shareBtn.dataset.url);
        return;
      }

      // Code Copy Trigger
      const codeChip = e.target.closest('.search-result-code[data-code]');
      if (codeChip) {
        copyToClipboard(codeChip.dataset.code);
        this.showToast('Code copied: ' + codeChip.dataset.code);
        return;
      }

      // Recent Search Chip Click
      const recentPill = e.target.closest('.recent-pill');
      if (recentPill) {
        const input = $('searchInput');
        if (input) {
          input.value = recentPill.dataset.q;
          this.executeSearch();
          this.syncUrlFromState();
        }
        return;
      }

      // Clear Recent Searches
      if (e.target.closest('#clearRecentBtn')) {
        Storage.clearRecentSearches();
        this.hideRecentSearches();
        this.showToast('Search history cleared');
        return;
      }

      // Category Pill Click
      const filterPill = e.target.closest('.pill');
      if (filterPill && filterPill.dataset.level) {
        this.activeLevel = filterPill.dataset.level;
        document.querySelectorAll('.pill').forEach(p =>
          p.classList.toggle('active', p.dataset.level === this.activeLevel));
        Analytics.trackFilter(this.activeLevel);
        this.executeSearch();
        this.syncUrlFromState();
        return;
      }

      // Load more search results
      if (e.target.closest('#loadMoreSearchBtn')) {
        this.loadRemainingSearchResults();
        return;
      }

      // Global Expand / Collapse All
      if (e.target.closest('#expandAll')) { this.expandAll(); return; }
      if (e.target.closest('#collapseAll')) { this.collapseAll(); return; }
    });
  }
}

const UI = new UIController();

// ============================================================================
//  9. APPLICATION BOOTSTRAPPER (Service Worker & Life Cycle)
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  UI.init();
  Router.init();

  // Register PWA Service Worker with auto-update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', function () {
          if (this.state === 'activated') {
            UI.showToast('App updated — refresh for latest version', 3500);
          }
        });
      });
    }).catch(() => { });
  }

  // Load syllabus catalog data
  try {
    await Catalog.load();
    UI.buildFilters();
    UI.renderProgrammes(Catalog.programmes);
    UI.updateStats();

    // Resolve initial URL route now that catalog is indexed
    Router.resolve();
  } catch (err) {
    const grid = $('grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>Could not load syllabus database.</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:6px">Ensure <code>sgou_slm_data.json</code> is accessible or check internet connection.</div>
        </div>`;
    }
  }
});
