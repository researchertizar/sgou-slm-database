/**
 * ============================================================================
 *  SGOU SLM Browser — Production Application Core (S.O.L.I.D Architecture)
 * ============================================================================
 *  Author: Ahayas
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
 * Safely highlights multi-token search keyword hits within text without entity corruption or XSS vulnerabilities.
 * Splits on unescaped text first and escapes individual segments, ensuring HTML entities (&amp;, &lt;, etc.)
 * cannot be broken or matched internally.
 * @param {string} text - Raw unescaped text content
 * @param {string} query - Raw search query or multi-token phrase
 * @returns {string} Safe HTML string with <mark> tags wrapping matched tokens
 */
function hl(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return esc(text);

  const tokens = query.trim().split(/\s+/).filter(Boolean).map(er);
  if (!tokens.length) return esc(text);

  try {
    const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = String(text).split(pattern);

    return parts.map(part => {
      if (!part) return '';
      return pattern.test(part) ? `<mark>${esc(part)}</mark>` : esc(part);
    }).join('');
  } catch (_) {
    return esc(text);
  }
}

/**
 * Converts shouty uppercase programme names to polished Title Case,
 * preserving acronyms like UG, PG, FYUG, BA, MA, B.Com, MCA, etc.
 * @param {string} name - Raw programme name
 * @returns {string} Clean Title Case programme name
 */
function formatProgName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\b([a-z])/g, m => m.toUpperCase())
    .replace(/\b(Of|In|And|For|A|An|The|To|On)\b/g, m => m.toLowerCase())
    .replace(/\b(Ug|Pg|Fyug|Fyugp|Ba|Ma|Bcom|Mcom|Bba|Mba|Bca|Mca|Blis|Mlis|Msw|Bsc|Msc|Sgou|Cbcs|Slm|Pyq)\b/gi, m => m.toUpperCase())
    .replace(/^([a-z])/, m => m.toUpperCase());
}

/**
 * Formats assignment question titles into clean academic Title Case
 * without smashed words (e.g. "LanguageandLiterature").
 * @param {string} title
 * @returns {string}
 */
function formatAssignmentTitle(title) {
  if (!title) return 'Semester Assignment Booklet';
  let t = String(title)
    .replace(/LanguageandLiterature/gi, 'Language & Literature')
    .replace(/ASSIGNMENT\s+QUESTIONS\s*/gi, '')
    .replace(/B\.A\./gi, 'B.A. ')
    .replace(/M\.A\./gi, 'M.A. ')
    .replace(/B\.Com/gi, 'B.Com ')
    .replace(/\s+/g, ' ')
    .trim();
  return formatProgName(t) + ' — Assignment Booklet';
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

/**
 * Normalizes semester strings (e.g., 'SEMESTER 1', 'Semester-1', 'S1' -> 'S1').
 * @param {string} s - Raw semester string
 * @returns {string} Normalized semester key (e.g., 'S1')
 */
function normSem(s) {
  if (!s) return 'S1';
  const str = String(s).trim().toUpperCase();
  const m = str.match(/(?:SEMESTER|SEM|S)\s*[-_]?\s*(\d+)/i) || str.match(/(\d+)/);
  if (m) return 'S' + m[1];
  return str;
}

const SGOU_CODE_REGEX = /\b(SG[BM]\d{2}[A-Z]{2}\d{3}[A-Z]{2}|[BM]\d{2}[A-Z]{2}\d{2}[A-Z]{2})\b/i;
const NOT_COURSE_CODES = new Set(['SEMESTER', 'FEBRUARY', 'GRADUATE', 'EXAMINATIONS', 'UNDER', 'MASTER', 'BACHELOR', 'PROGRAMME']);

/**
 * Extracts normalized SGOU course code from PYQ subject string or course_code field.
 * @param {Object} py - Raw PYQ object
 * @returns {string} Course code or empty string
 */
function extractCourseCode(py) {
  if (!py) return '';
  const rawCode = String(py.course_code || '').trim().toUpperCase();
  if (rawCode && /^[A-Z0-9]{8,13}$/.test(rawCode) && !NOT_COURSE_CODES.has(rawCode)) {
    return rawCode;
  }
  const m = String(py.subject_name || '').match(SGOU_CODE_REGEX);
  if (m) return m[1].toUpperCase();
  return '';
}

/**
 * Extracts clean course subject title from noisy PYQ subject string.
 * @param {string} raw - Raw subject string
 * @returns {string} Clean course name
 */
function cleanSubjectName(raw) {
  if (!raw) return 'Exam Question Paper';
  const parts = String(raw).split(/[–\-—]/);
  if (parts.length > 1) {
    const afterHyphen = parts.slice(1).join(' ').trim();
    if (afterHyphen.length > 3) return afterHyphen;
  }
  return String(raw).replace(/^(B\.?[A-Z/.]+\s+(?:DEGREE\s+)?EXAMINATIONS?,?\s*(?:[A-Za-z0-9]+\s+Semester\s+[^–\-—]+)?)/i, '').trim() || String(raw);
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
    this._isStorageAvailable = this._checkStorageAvailability();
  }

  /**
   * Probes localStorage availability to gracefully support private/incognito browsing
   * without incurring exception overhead on every subsequent read/write.
   * @private
   * @returns {boolean}
   */
  _checkStorageAvailability() {
    try {
      const testKey = '__sgou_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Retrieves string value from storage with memory fallback.
   * @param {string} key
   * @param {string|null} defaultValue
   * @returns {string|null}
   */
  get(key, defaultValue = null) {
    if (!this._isStorageAvailable) {
      return this._memoryStore.has(key) ? this._memoryStore.get(key) : defaultValue;
    }
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      return this._memoryStore.has(key) ? this._memoryStore.get(key) : defaultValue;
    }
  }

  /**
   * Sets string value into storage with memory fallback if quota is exceeded.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    const strVal = String(value);
    if (!this._isStorageAvailable) {
      this._memoryStore.set(key, strVal);
      return;
    }
    try {
      localStorage.setItem(key, strVal);
    } catch {
      // Handles QuotaExceededError or security restrictions gracefully
      this._memoryStore.set(key, strVal);
    }
  }

  /**
   * Deserializes JSON value from storage with safe fallback.
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  getJSON(key, defaultValue = null) {
    const raw = this.get(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Serializes JSON value to storage.
   * @param {string} key
   * @param {*} value
   * @returns {boolean}
   */
  setJSON(key, value) {
    try {
      this.set(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes key from both localStorage and in-memory store.
   * @param {string} key
   */
  remove(key) {
    if (this._isStorageAvailable) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }
    this._memoryStore.delete(key);
  }

  // --- Specialized Domain Storage Helpers ---

  getTheme() {
    return this.get('sgou-theme-v2', null);
  }

  setTheme(theme) {
    this.set('sgou-theme-v2', theme);
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
    this.clearOfflineDocs();
  }

  // --- CacheStorage Offline Documents Store ---
  async saveOfflineDoc(url, blob) {
    if (!('caches' in window) || !url || !blob) return false;
    try {
      const cache = await caches.open('sgou-offline-docs');
      const headers = new Headers({
        'Content-Type': 'application/pdf',
        'Content-Length': blob.size.toString(),
        'Accept-Ranges': 'bytes'
      });
      await cache.put(url, new Response(blob, { headers }));
      return true;
    } catch (e) {
      console.warn('[OfflineDocs] Cache put error:', e);
      return false;
    }
  }

  async getOfflineDoc(url) {
    if (!('caches' in window) || !url) return null;
    try {
      const cache = await caches.open('sgou-offline-docs');
      const match = await cache.match(url);
      if (match) {
        return await match.blob();
      }
    } catch (e) {
      console.warn('[OfflineDocs] Cache get error:', e);
    }
    return null;
  }

  async hasOfflineDoc(url) {
    if (!('caches' in window) || !url) return false;
    try {
      const cache = await caches.open('sgou-offline-docs');
      const match = await cache.match(url);
      return !!match;
    } catch (_) {
      return false;
    }
  }

  async clearOfflineDocs() {
    if (!('caches' in window)) return;
    try {
      await caches.delete('sgou-offline-docs');
    } catch (_) {}
  }

  getDownloadCount() {
    return parseInt(this.get('sgou-dl-count', '0'), 10) || 0;
  }

  incrementDownloadCount() {
    const next = this.getDownloadCount() + 1;
    this.set('sgou-dl-count', String(next));
    return next;
  }

  getPinnedProgrammes() {
    return this.getJSON('sgou-pinned-progs', []);
  }

  isProgrammePinned(progName) {
    if (!progName) return false;
    return this.getPinnedProgrammes().includes(progName);
  }

  togglePinProgramme(progName) {
    if (!progName) return false;
    let list = this.getPinnedProgrammes();
    const isPinned = list.includes(progName);
    if (isPinned) {
      list = list.filter(p => p !== progName);
    } else {
      list.push(progName);
    }
    this.setJSON('sgou-pinned-progs', list);
    return !isPinned;
  }
}

const Storage = new StorageService();

// ============================================================================
//  3. TELEMETRY & ANALYTICS SERVICE (Enhanced GA4 Integration)
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

  trackPageView(pagePath, pageTitle) {
    this.event('page_view', {
      page_path: pagePath || (window.location.pathname || '/') + window.location.search,
      page_title: pageTitle || document.title,
      page_location: window.location.href
    });
  }

  trackViewItem(item) {
    if (!item) return;
    this.event('view_item', {
      item_id: item.code || item.id || 'unknown',
      item_name: item.name || item.title || '',
      item_category: item.type || 'SLM',
      item_brand: 'SGOU',
      programme: item.prog || '',
      level: item.level || ''
    });
  }

  trackSearch(term, resultCount) {
    this.event('search', {
      search_term: term,
      custom_result_count: resultCount
    });
  }

  trackDownload(courseCode, filename, method, itemType = 'SLM') {
    this.event('file_download', {
      file_name: filename,
      file_extension: 'pdf',
      custom_course_code: courseCode,
      item_category: itemType,
      download_method: method
    });
  }

  trackFilter(filterVal, filterType = 'level') {
    this.event('filter_change', {
      filter_type: filterType,
      filter_value: filterVal
    });
  }

  trackTheme(theme) {
    this.event('theme_change', { new_theme: theme });
  }

  trackShare(title, method, courseCode = '') {
    this.event('share', {
      method,
      content_type: 'pdf_link',
      item_id: courseCode || title,
      item_name: title
    });
  }

  trackEngagement(action, extra = {}) {
    this.event('engagement_action', { action, ...extra });
  }

  trackPWA(status) {
    this.event('pwa_lifecycle', { status });
  }

  trackNetwork(isOnline) {
    this.event('network_status', { online: isOnline ? 'online' : 'offline' });
  }

  trackException(description, fatal = false) {
    this.event('exception', { description, fatal });
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
    this.totalCourses = 0;          // Total SLM
    this.totalPyq = 0;              // Total PYQs
    this.totalAsgn = 0;             // Total Assignments
    this.totalAll = 0;
    this.isLoaded = false;
  }

  async load() {
    const slmSources = ['./data/sgou_slm_data.json', './sgou_slm_data.json'];
    const qSources = ['./data/sgou_questions_cleaned.json', './sgou_questions_cleaned.json'];

    const fetchFirstValid = async (urls) => {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) return json;
        } catch (_) {}
      }
      return null;
    };

    const [slmRaw, qRaw] = await Promise.all([
      fetchFirstValid(slmSources),
      fetchFirstValid(qSources)
    ]);

    if (!slmRaw && !qRaw) {
      throw new Error('Failed to load syllabus database from all endpoints');
    }

    if (!qRaw) {
      console.warn('[CatalogService] Questions dataset was unavailable; running in SLM-only mode.');
    }
    if (!slmRaw) {
      console.warn('[CatalogService] SLM dataset was unavailable; running in Questions-only mode.');
    }

    this._process(slmRaw || [], qRaw || []);
    this.isLoaded = true;
    return this.programmes;
  }

  _process(slmRaw, qRaw) {
    this.programmes = [];
    this.courseMap.clear();
    this.searchIndex = [];
    this.totalCourses = 0;
    this.totalPyq = 0;
    this.totalAsgn = 0;
    const levelSet = new Set();

    // Index Questions dataset by programme title
    const qMap = new Map();
    (qRaw || []).forEach(q => {
      if (!q || !q.course_title) return;
      qMap.set(q.course_title.trim().toUpperCase(), q);
    });

    slmRaw.forEach(p => {
      if (!p || !p.programme_name || !Array.isArray(p.semesters)) return;

      const progName = String(p.programme_name || '').trim();
      const level = String(p.level || 'UG').trim().toUpperCase();
      levelSet.add(level);

      const qProg = qMap.get(progName.toUpperCase());

      // Group assignments by normalized semester
      const asgnBySem = new Map();
      if (qProg && Array.isArray(qProg.assignments)) {
        qProg.assignments.forEach(a => {
          const sKey = normSem(a.semester);
          if (!asgnBySem.has(sKey)) asgnBySem.set(sKey, []);
          const cleanT = String(a.clean_title || a.title || '').trim();
          asgnBySem.get(sKey).push({
            title: cleanT || `${sKey} Assignment Booklet`,
            clean_title: cleanT || `${sKey} Assignment Booklet`,
            raw_title: String(a.raw_title || a.title || '').trim(),
            semester: sKey,
            academic_year: String(a.academic_year || '').trim(),
            admission_batch: String(a.admission_batch || 'Continuous Internal Assessment').trim(),
            category: String(a.category || 'Continuous Internal Assessment').trim(),
            pdf_url: String(a.pdf_url || '').trim()
          });
          this.totalAsgn++;
        });
      }

      // Group PYQs by normalized semester and course code
      const pyqBySemAndCode = new Map();
      const pyqBySemGeneral = new Map();
      if (qProg && Array.isArray(qProg.previous_year_questions)) {
        qProg.previous_year_questions.forEach(py => {
          const sKey = normSem(py.semester);
          const cCode = extractCourseCode(py);
          const cleanSubject = cleanSubjectName(py.subject_name);
          const pyRecord = {
            subject_name: String(py.subject_name || '').trim(),
            clean_name: cleanSubject,
            code: cCode,
            exam_date: String(py.exam_date || '').trim(),
            admission_batch: String(py.admission_batch || '').trim(),
            semester: sKey,
            pdf_url: String(py.pdf_url || '').trim()
          };
          this.totalPyq++;

          if (cCode) {
            if (!pyqBySemAndCode.has(sKey)) pyqBySemAndCode.set(sKey, new Map());
            const semCodeMap = pyqBySemAndCode.get(sKey);
            if (!semCodeMap.has(cCode)) semCodeMap.set(cCode, []);
            semCodeMap.get(cCode).push(pyRecord);
          } else {
            if (!pyqBySemGeneral.has(sKey)) pyqBySemGeneral.set(sKey, []);
            pyqBySemGeneral.get(sKey).push(pyRecord);
          }
        });
      }

      let progSlmCount = 0;
      let progPyqCount = 0;
      let progAsgnCount = 0;

      const sanitizedSemesters = (p.semesters || []).map(s => {
        const sKey = normSem(s.semester);
        const semAssignments = asgnBySem.get(sKey) || [];
        progAsgnCount += semAssignments.length;

        const semCodeMap = pyqBySemAndCode.get(sKey);
        const semGeneralPyqs = pyqBySemGeneral.get(sKey) || [];
        progPyqCount += semGeneralPyqs.length;

        const courses = Array.isArray(s.courses) ? s.courses.map(c => {
          const cCode = String(c.code || '').trim();
          const cName = String(c.name || '').trim();
          const cUrl = String(c.pdf_url || '').trim();
          const cPyqs = semCodeMap ? (semCodeMap.get(cCode.toUpperCase()) || []) : [];
          progPyqCount += cPyqs.length;
          progSlmCount++;
          this.totalCourses++;

          return {
            code: cCode,
            name: cName,
            pdf_url: cUrl,
            pyqs: cPyqs
          };
        }) : [];

        return {
          semester: String(s.semester || sKey).trim(),
          semKey: sKey,
          assignments: semAssignments,
          generalPyqs: semGeneralPyqs,
          courses
        };
      });

      const progRecord = {
        programme_name: progName,
        level,
        semesters: sanitizedSemesters,
        totalSlm: progSlmCount,
        totalPyq: progPyqCount,
        totalAsgn: progAsgnCount
      };

      this.programmes.push(progRecord);

      // Pre-compute O(1) course lookup map (instantaneous)
      sanitizedSemesters.forEach(sem => {
        sem.courses.forEach(course => {
          if (!course.code) return;
          this.courseMap.set(course.code.toLowerCase(), {
            course,
            prog: progRecord,
            sem
          });
        });
      });
    });

    this.totalAll = this.totalCourses + this.totalPyq + this.totalAsgn;

    // Sort programmes alphabetically
    this.programmes.sort((a, b) =>
      a.programme_name.localeCompare(b.programme_name, 'en', { sensitivity: 'base' })
    );

    this.levels = ['ALL', ...Array.from(levelSet).sort()];

    // Schedule background token indexing during idle time (Progressive Two-Stage Startup)
    this._scheduleSearchIndexing();
  }

  /**
   * Schedules deep search token indexing during browser idle cycles.
   */
  _scheduleSearchIndexing() {
    if (this._indexingScheduled) return;
    this._indexingScheduled = true;

    const build = () => {
      if (!this.searchIndex.length) {
        this.buildSearchIndex();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(build, { timeout: 1500 });
    } else {
      setTimeout(build, 80);
    }
  }

  /**
   * Builds the flattened search token array across courses, pyqs, and assignments.
   * Can be called on demand if the user initiates a search before idle callback triggers.
   */
  buildSearchIndex() {
    if (this.searchIndex.length > 0) return;

    const idx = [];
    this.programmes.forEach(progRecord => {
      progRecord.semesters.forEach(sem => {
        // 1. Index SLM courses
        sem.courses.forEach(course => {
          if (!course.code) return;

          idx.push({
            type: 'SLM',
            code: course.code,
            name: course.name,
            pdf_url: course.pdf_url,
            progName: progRecord.programme_name,
            level: progRecord.level,
            semName: sem.semester,
            tokens: `${course.code} ${course.name} ${progRecord.programme_name} ${progRecord.level} ${sem.semester} slm textbook book material`.toLowerCase()
          });

          // 2. Index associated PYQs
          course.pyqs.forEach(py => {
            idx.push({
              type: 'PYQ',
              code: course.code,
              name: py.clean_name || course.name,
              subject_name: py.subject_name,
              examDate: py.exam_date,
              admissionBatch: py.admission_batch,
              pdf_url: py.pdf_url,
              progName: progRecord.programme_name,
              level: progRecord.level,
              semName: sem.semester,
              tokens: `${course.code} ${py.clean_name} ${py.subject_name} ${py.exam_date} ${py.admission_batch} ${progRecord.programme_name} ${progRecord.level} ${sem.semester} pyq previous question paper exam`.toLowerCase()
            });
          });
        });

        // 3. Index Semester General PYQs
        sem.generalPyqs.forEach(py => {
          idx.push({
            type: 'PYQ',
            code: py.code || '',
            name: py.clean_name || py.subject_name,
            subject_name: py.subject_name,
            examDate: py.exam_date,
            admissionBatch: py.admission_batch,
            pdf_url: py.pdf_url,
            progName: progRecord.programme_name,
            level: progRecord.level,
            semName: sem.semester,
            tokens: `${py.code} ${py.clean_name} ${py.subject_name} ${py.exam_date} ${py.admission_batch} ${progRecord.programme_name} ${progRecord.level} ${sem.semester} pyq previous question paper exam`.toLowerCase()
          });
        });

        // 4. Index Assignments
        sem.assignments.forEach(asgn => {
          idx.push({
            type: 'ASSIGNMENT',
            code: 'BOOKLET',
            name: asgn.clean_title || asgn.title,
            clean_title: asgn.clean_title || asgn.title,
            admission_batch: asgn.admission_batch || 'Continuous Internal Assessment',
            academic_year: asgn.academic_year || '',
            category: asgn.category || 'Continuous Internal Assessment',
            pdf_url: asgn.pdf_url,
            progName: progRecord.programme_name,
            level: progRecord.level,
            semName: sem.semester,
            tokens: `${asgn.title} ${asgn.clean_title} ${asgn.admission_batch} ${asgn.academic_year} ${progRecord.programme_name} ${progRecord.level} ${sem.semester} assignment booklet cia continuous assessment questions`.toLowerCase()
          });
        });
      });
    });

    this.searchIndex = idx;
  }

  getCourse(code) {
    if (!code) return null;
    return this.courseMap.get(code.toLowerCase().trim()) || null;
  }

  filterByLevel(level) {
    if (!level || level === 'ALL') return this.programmes;
    return this.programmes.filter(p => p.level === level);
  }

  filter(level = 'ALL', type = 'ALL') {
    let list = this.filterByLevel(level);
    if (type === 'SLM') {
      return list.filter(p => (p.totalSlm || 0) > 0);
    } else if (type === 'PYQ') {
      return list.filter(p => (p.totalPyq || 0) > 0);
    } else if (type === 'ASSIGNMENT') {
      return list.filter(p => (p.totalAsgn || 0) > 0);
    }
    return list;
  }

  getLevelCounts(type = 'ALL') {
    const counts = {};
    this.levels.forEach(lv => {
      const list = this.filter(lv, type);
      counts[lv] = list.length;
    });
    return counts;
  }

  getTotalCourses(programmesList = this.programmes) {
    return programmesList.reduce((acc, p) => acc + (p.totalSlm || 0), 0);
  }

  getTotalPyq(programmesList = this.programmes) {
    return programmesList.reduce((acc, p) => acc + (p.totalPyq || 0), 0);
  }

  getTotalAsgn(programmesList = this.programmes) {
    return programmesList.reduce((acc, p) => acc + (p.totalAsgn || 0), 0);
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
    this._memoCache = new Map();
  }

  /**
   * Fast multi-token matching over pre-indexed courses, question papers & assignments.
   * Leverages LRU memoization cache for instantaneous O(1) response on repeated/backspaced queries.
   * @param {string} query - Raw search query
   * @param {string} levelFilter - Active level ('ALL', 'UG', 'PG', etc.)
   * @param {string} typeFilter - Active material type ('ALL', 'SLM', 'PYQ', 'ASSIGNMENT')
   * @returns {Array} Matching records
   */
  search(query, levelFilter = 'ALL', typeFilter = 'ALL') {
    const q = (query || '').toLowerCase().trim();
    if (!q && typeFilter === 'ALL' && levelFilter === 'ALL') return [];

    const cacheKey = `${q}::${levelFilter}::${typeFilter}`;
    if (this._memoCache.has(cacheKey)) {
      this.currentMatches = this._memoCache.get(cacheKey);
      this.renderedCount = 0;
      return this.currentMatches;
    }

    // Ensure search tokens are compiled if user searches prior to background idle callback
    if (!this.catalog.searchIndex.length && this.catalog.isLoaded) {
      this.catalog.buildSearchIndex();
    }

    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const results = [];
    const seenUrls = new Set();

    for (let i = 0; i < this.catalog.searchIndex.length; i++) {
      const item = this.catalog.searchIndex[i];

      // Level category check
      if (levelFilter !== 'ALL' && item.level !== levelFilter) {
        continue;
      }

      // Material type check
      if (typeFilter !== 'ALL' && item.type !== typeFilter) {
        continue;
      }

      // Search tokens check
      let matchesAll = true;
      for (let j = 0; j < tokens.length; j++) {
        if (!item.tokens.includes(tokens[j])) {
          matchesAll = false;
          break;
        }
      }

      if (matchesAll && !seenUrls.has(item.pdf_url)) {
        seenUrls.add(item.pdf_url);
        results.push(item);
      }
    }

    // Sort order: SLM, PYQ, Assignment, then alphabetically
    const typeOrder = { 'SLM': 1, 'PYQ': 2, 'ASSIGNMENT': 3 };
    results.sort((a, b) => {
      const tA = typeOrder[a.type] || 99;
      const tB = typeOrder[b.type] || 99;
      if (tA !== tB) return tA - tB;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });

    // Maintain max 60 LRU memoized queries
    if (this._memoCache.size >= 60) {
      const firstKey = this._memoCache.keys().next().value;
      this._memoCache.delete(firstKey);
    }
    this._memoCache.set(cacheKey, results);

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

  getCleanFilename(item) {
    if (!item) return 'course_material';
    const itemType = (item.type || 'SLM').toUpperCase();
    if (itemType === 'PYQ') {
      return (item.code ? item.code + '_' : '') + sanitize(item.name || 'exam_paper') + '_PYQ' + (item.examDate ? '_' + sanitize(item.examDate) : '');
    } else if (itemType === 'ASSIGNMENT') {
      return sanitize(item.prog || 'SGOU') + '_' + sanitize(item.semester || 'Semester') + '_Assignment';
    } else {
      return (item.code ? item.code + '_' : '') + sanitize(item.name || 'document') + '_SLM';
    }
  }

  startDirectDownload(item) {
    if (!item || !item.url) return;
    this.activeItem = item;
    const cleanDefault = this.getCleanFilename(item);
    const inputEl = $('dlFilenameInput');
    if (inputEl) inputEl.value = cleanDefault;
    this.startDownload(false);
  }

  openModal(item) {
    if (!item || !item.url) return;
    this.activeItem = item;

    const modal = $('downloadModal');
    if (!modal) return;

    const codeEl = $('dlModalCode');
    const nameEl = $('dlModalName');
    const badgeEl = $('dlModalBadge');
    const typeBadgeEl = $('dlModalTypeBadge');
    const extraEl = $('dlModalExtra');
    const titleEl = $('dlModalTitle');
    const subtitleEl = $('dlModalSubtitle');
    const inputEl = $('dlFilenameInput');
    const chooseBtn = $('dlChooseFolderBtn');
    const startBtn = $('dlStartBtn');
    const destTitle = $('dlDestTitle');
    const destDesc = $('dlDestDesc');
    const destIcon = $('dlDestIcon');

    const itemType = (item.type || 'SLM').toUpperCase();
    const cleanDefault = this.getCleanFilename(item);

    if (itemType === 'PYQ') {
      if (titleEl) titleEl.textContent = 'Download Question Paper';
      if (subtitleEl) subtitleEl.textContent = 'Previous Year Exam Paper';
    } else if (itemType === 'ASSIGNMENT') {
      if (titleEl) titleEl.textContent = 'Download Assignment';
      if (subtitleEl) subtitleEl.textContent = 'Official Semester Assignment Questions';
    } else {
      if (titleEl) titleEl.textContent = 'Download Course SLM';
      if (subtitleEl) subtitleEl.textContent = 'Official Self-Learning Material';
    }

    if (codeEl) codeEl.textContent = item.code || (itemType === 'ASSIGNMENT' ? (item.semester || 'Assignment') : 'SGOU Material');
    if (nameEl) nameEl.textContent = item.name || 'Course Material';
    if (inputEl) inputEl.value = cleanDefault;

    if (badgeEl) {
      const lv = item.level || 'UG';
      badgeEl.textContent = lv === 'FYUG' ? 'FYUG' : lv;
      badgeEl.className = 'dl-badge ' + (lv === 'PG' ? 'pg' : lv === 'UG' ? 'ug' : 'fyug');
    }

    if (typeBadgeEl) {
      typeBadgeEl.textContent = itemType;
      typeBadgeEl.className = 'dl-type-badge ' + (itemType === 'PYQ' ? 'pyq' : itemType === 'ASSIGNMENT' ? 'asgn' : 'slm');
    }

    if (extraEl) {
      if (item.examDate) {
        extraEl.textContent = `Exam: ${item.examDate}${item.admissionBatch ? ' (' + item.admissionBatch + ')' : ''}`;
        extraEl.style.display = 'block';
      } else {
        extraEl.style.display = 'none';
      }
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

  /**
   * Revokes any allocated Object URL to avoid memory accumulation.
   */
  cleanup() {
    if (this.lastBlobUrl) {
      try { URL.revokeObjectURL(this.lastBlobUrl); } catch (_) {}
      this.lastBlobUrl = null;
    }
  }

  async startDownload(usePicker = false) {
    if (!this.activeItem) return;
    this.cleanup();
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
        }
        chunks.push(value);

        receivedBytes += value.length;
        this._updateProgressMetrics(receivedBytes, contentLength, startTime);
      }

      const blob = new Blob(chunks, { type: 'application/pdf' });
      // Persist in CacheStorage for instant offline retrieval
      Storage.saveOfflineDoc(item.url, blob).catch(() => {});

      if (writable) {
        await writable.close();
        this.lastBlobUrl = null;
      } else {
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

    // Auto-dismiss floating download card after 6 seconds to prevent blocking UI
    if (this._dismissTimeout) clearTimeout(this._dismissTimeout);
    this._dismissTimeout = setTimeout(() => {
      $('downloadProgressCard')?.classList.remove('visible');
    }, 6000);
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
//  7. ROUTER SERVICE (S.O.L.I.D: Professional Clean URL Architecture)
// ============================================================================

/**
 * Modern HTML5 History API Router managing deep-links, browser history,
 * clean query parameters (?type=pyq, ?level=ug, ?q=...), and backward-compatible
 * migration from legacy hash routes.
 */
class RouterService {
  constructor() {
    this.isResolving = false;
  }

  init() {
    window.addEventListener('popstate', () => this.resolve());
    this.resolve();
  }

  navigate(url) {
    const target = this._normalizeUrl(url);
    const current = (window.location.pathname || '/') + window.location.search;
    if (current === target && !window.location.hash) return;
    const isViewer = target.includes('course=') || target.includes('view=') || target.includes('code=');
    history.pushState({ url: target, viewerOpen: isViewer }, '', target);
    this.resolve();
  }

  updateUrlSilently(url) {
    const target = this._normalizeUrl(url);
    const current = (window.location.pathname || '/') + window.location.search;
    if (current === target && !window.location.hash) return;
    history.replaceState({ url: target }, '', target);
  }

  _normalizeUrl(url) {
    if (!url) return window.location.pathname || '/';
    if (url.startsWith('#')) return this._convertHashToCleanUrl(url.slice(1));
    return url;
  }

  _convertHashToCleanUrl(rawHash) {
    const base = '/';
    if (!rawHash || rawHash === '/') return base;
    const qIndex = rawHash.indexOf('?');
    const path = qIndex >= 0 ? rawHash.slice(0, qIndex) : rawHash;
    const params = new URLSearchParams(qIndex >= 0 ? rawHash.slice(qIndex + 1) : '');

    const newParams = new URLSearchParams();
    if (path.startsWith('/type/')) {
      const t = decodeURIComponent(path.split('/')[2] || '').toLowerCase();
      if (t && t !== 'slm' && t !== 'all') newParams.set('type', t);
    } else if (path.startsWith('/filter/')) {
      const l = decodeURIComponent(path.split('/')[2] || '').toLowerCase();
      if (l && l !== 'all') newParams.set('level', l);
    } else if (path === '/search') {
      const q = params.get('q');
      const t = (params.get('type') || '').toLowerCase();
      const l = (params.get('level') || '').toLowerCase();
      if (q) newParams.set('q', q);
      if (t && t !== 'slm' && t !== 'all') newParams.set('type', t);
      if (l && l !== 'all') newParams.set('level', l);
    } else if (path.startsWith('/view/')) {
      const code = decodeURIComponent(path.split('/')[2] || '');
      if (code) newParams.set('course', code);
      const t = (params.get('type') || '').toLowerCase();
      if (t && t !== 'slm' && t !== 'all') newParams.set('type', t);
      const ex = params.get('examdate') || '';
      if (ex) newParams.set('examdate', ex);
    } else if (!path.includes('/')) {
      const candidate = decodeURIComponent(path).trim();
      // Guard: Never treat in-page DOM element IDs (e.g. searchInput, main, content) as course codes
      const isDomElement = typeof document !== 'undefined' && !!document.getElementById(candidate);
      const isKnownCourse = Catalog.courseMap && Catalog.courseMap.has(candidate.toLowerCase());
      const isCoursePattern = /^[BM][0-9]{2}[A-Z]{2}[0-9]{2}[A-Z0-9]*$/i.test(candidate);
      if (!isDomElement && (isKnownCourse || isCoursePattern)) {
        newParams.set('course', candidate);
      }
    }

    const qs = newParams.toString();
    return qs ? `${base}?${qs}` : base;
  }

  resolve() {
    if (!Catalog.isLoaded) return;
    this.isResolving = true;

    // --- Step 1: Backward-Compatible Legacy Hash Migration ---
    const rawHash = window.location.hash.slice(1);
    if (rawHash && rawHash !== '/') {
      // If hash points to an existing in-page element (e.g. #searchInput), jump focus and do not pollute query string
      const anchorEl = document.getElementById(rawHash);
      if (anchorEl) {
        anchorEl.focus?.({ preventScroll: false });
        anchorEl.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        history.replaceState(null, '', window.location.pathname || '/');
      } else {
        const cleanUrl = this._convertHashToCleanUrl(rawHash);
        history.replaceState(null, '', cleanUrl);
      }
    }

    // --- Step 2: Parse Modern Clean Query Parameters ---
    const params = new URLSearchParams(window.location.search);

    // Direct Course Viewer Deep-Link (?course=B21CA01 or ?view=B21CA01 or ?code=B21CA01)
    const courseCode = params.get('course') || params.get('view') || params.get('code');
    if (courseCode) {
      const item = Catalog.getCourse(courseCode);
      const qType = (params.get('type') || (params.get('examdate') ? 'PYQ' : (params.get('semester') && !item ? 'ASSIGNMENT' : 'SLM'))).toUpperCase();
      const qExam = params.get('examdate') || '';
      const docName = params.get('name') || (item ? item.course.name : courseCode);
      const docProg = params.get('prog') || (item ? item.prog.programme_name : '');
      const docLevel = params.get('level') || (item ? item.prog.level : 'UG');

      let pdfUrl = params.get('url') || '';
      if (!pdfUrl && item) {
        if (qType === 'PYQ' && item.course.pyqs && item.course.pyqs.length > 0) {
          const matchedPyq = (qExam ? item.course.pyqs.find(p => p.exam_date === qExam) : null) || item.course.pyqs[0];
          pdfUrl = matchedPyq?.pdf_url || item.course.pdf_url;
        } else {
          pdfUrl = item.course.pdf_url;
        }
      }

      // Defensive Guard: If course does not exist in the catalogue and has no direct PDF URL,
      // never open an empty/broken viewer modal! Clean URL and show search results instead.
      if (!item && !pdfUrl) {
        console.warn(`[Router] Course "${courseCode}" not found in catalogue. Diverting to search.`);
        history.replaceState(null, '', window.location.pathname || '/');
        UI.hideViewerPanel(false);
        if (courseCode !== 'searchInput') {
          UI.restoreState(courseCode, 'ALL', 'ALL');
          UI.showToast(`Course "${courseCode}" not found in database. Showing search results.`, 3500);
        } else {
          UI.restoreState('', 'ALL', 'ALL');
          const searchInput = $('searchInput');
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        this.isResolving = false;
        return;
      }

      Analytics.trackPageView(window.location.pathname + window.location.search, `${docName} (${courseCode}) — SGOU Academic Database`);
      Analytics.trackViewItem({
        code: courseCode,
        name: docName,
        type: qType,
        prog: docProg,
        level: docLevel
      });

      UI.showViewerPanel(pdfUrl, docName, item ? item.course.code : courseCode, docProg, docLevel, qType, qExam);
      this.isResolving = false;
      return;
    }

    // Dismiss any open drawers or modals when navigating via browser history
    $('myDownloadsDrawer')?.classList.remove('visible');
    $('shortcutsModal')?.classList.remove('visible');
    $('storageHelpModal')?.classList.remove('visible');
    $('downloadModal')?.classList.remove('visible');

    // Hide viewer panel if closing or navigating away
    UI.hideViewerPanel(false);

    // Material Type (?type=pyq, ?type=assignment, ?type=slm, ?type=all)
    const rawType = (params.get('type') || '').toUpperCase();
    const type = (rawType === 'PYQ' || rawType === 'PYQS') ? 'PYQ' :
                 (rawType === 'ASSIGNMENT' || rawType === 'ASSIGNMENTS' || rawType === 'ASGN') ? 'ASSIGNMENT' :
                 (rawType === 'ALL') ? 'ALL' : 'SLM';

    // Degree Level (?level=ug, ?level=pg, ?level=fyug, ?level=all)
    const rawLevel = (params.get('level') || '').toUpperCase();
    const level = (rawLevel === 'UG' || rawLevel === 'PG' || rawLevel === 'FYUG') ? rawLevel : 'ALL';

    // Search Query (?q=english or ?search=english)
    const query = params.get('q') || params.get('search') || '';

    if (type === 'SLM') {
      UI._pushedTabState = false;
    }

    UI.restoreState(query, level, type);
    Analytics.trackPageView(window.location.pathname + window.location.search, document.title);
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
    this.activeType = 'SLM';
    this.toastTimer = null;
    this.navLock = false;
    this.revealObserver = null;
    this.searchTimer = null;
    this.analyticsTimer = null;
    this._viewerOpenedInSession = false;
  }

  init() {
    this.initTheme();
    this.showSkeletons();
    this.initSwitcher();
    this.initDelegation();
    this.initKeyboard();
    this.initSearch();
    this.initStickyShadow();
    this.initBackToTop();
    this.initOfflineDetection();
    this.initInstallPrompt();
    this.updateDownloadStats();
  }

  initSwitcher() {
    const switcher = $('materialTypeSwitcher');
    if (switcher) {
      switcher.setAttribute('data-active', this.activeType || 'SLM');
    }
  }

  // --- Theme Management ---

  initTheme() {
    // 1. Honor theme pre-established by zero-FOUC head script
    let theme = document.documentElement.getAttribute('data-theme');
    if (theme !== 'dark' && theme !== 'light') {
      const urlTheme = new URLSearchParams(window.location.search).get('theme');
      if (urlTheme === 'dark' || urlTheme === 'light') {
        theme = urlTheme;
      } else {
        const saved = Storage.getTheme();
        theme = saved === 'dark' ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', theme);
    }
    this.syncMeta();
  }

  toggleTheme() {
    const doc = document.documentElement;
    const current = doc.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    // 60fps instantaneous theme switching: suppress cascade transitions
    doc.classList.add('theme-switching');
    doc.setAttribute('data-theme', next);
    Storage.setTheme(next);
    this.syncMeta();
    Analytics.trackTheme(next);

    // Sync active reader filter to match the new theme seamlessly
    const curFilter = localStorage.getItem('sgou-pdf-filter') || 'normal';
    let targetFilter = curFilter;
    if (next === 'dark' && curFilter === 'normal') {
      targetFilter = 'dark';
    } else if (next === 'light' && curFilter === 'dark') {
      targetFilter = 'normal';
    }
    try { localStorage.setItem('sgou-pdf-filter', targetFilter); } catch (_) {}
    this.applyReaderFilter(targetFilter, false);

    const frame = $('viewerPanelFrame');
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: 'sgou-theme-change', theme: next, filter: targetFilter }, '*');
      } catch (_) {}
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        doc.classList.remove('theme-switching');
      });
    });
  }

  syncMeta() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const meta = $('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#13110f' : '#1a1714');
    }
    const toggleBtn = $('themeToggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggleBtn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const viewerToggleBtn = $('viewerThemeToggle');
    if (viewerToggleBtn) {
      viewerToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      viewerToggleBtn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) {
      ogImg.setAttribute('content', 'https://sgou-slm-database.vercel.app/assets/images/og-image.png?v=20261007_05');
    }
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg) {
      twitterImg.setAttribute('content', 'https://sgou-slm-database.vercel.app/assets/images/og-image.png?v=20261007_05');
    }
  }

  // --- Feedback & Notifications ---

  showToast(message, durationMs = 2400) {
    const toast = $('toast');
    if (!toast) return;
    clearTimeout(this.toastTimer);
    toast.classList.remove('has-action');
    toast.textContent = message;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('visible'));
    });
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), durationMs);
  }

  showUpdateToast(onUpdate) {
    const toast = $('toast');
    if (!toast) return;
    clearTimeout(this.toastTimer);
    toast.classList.add('has-action');
    toast.innerHTML = `<span style="font-size:12px;font-weight:500">New version available!</span> <button class="toast-refresh-btn" id="toastRefreshBtn" title="Update now"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Update Now</button>`;

    const btn = $('toastRefreshBtn');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = 'Updating...';
        if (typeof onUpdate === 'function') {
          onUpdate();
        } else {
          window.location.reload();
        }
      };
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('visible'));
    });
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.remove('has-action');
    }, 30000);
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
      const hasQuery = q.length > 0;
      if (clear) clear.classList.toggle('visible', hasQuery);
      const kbdHint = $('searchKbdHint');
      if (kbdHint) kbdHint.style.display = hasQuery ? 'none' : '';
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
      const kbdHint = $('searchKbdHint');
      if (kbdHint) kbdHint.style.display = '';
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

      const matches = Search.search(q, this.activeLevel, this.activeType);

      if (!matches.length) {
        const typeWord = this.activeType === 'PYQ' ? 'question papers' : this.activeType === 'ASSIGNMENT' ? 'assignments' : this.activeType === 'SLM' ? 'course textbooks' : 'materials';

        let altSuggestion = null;
        if (this.activeType && this.activeType !== 'ALL') {
          const altTypes = ['SLM', 'PYQ', 'ASSIGNMENT'].filter(t => t !== this.activeType);
          for (const altType of altTypes) {
            const altMatches = Search.search(q, this.activeLevel, altType);
            if (altMatches.length > 0) {
              const altName = altType === 'SLM' ? 'SLM Books' : altType === 'PYQ' ? 'PYQs' : 'Assignments';
              const altNoun = altType === 'SLM' ? 'textbook' : altType === 'PYQ' ? 'question paper' : 'assignment';
              altSuggestion = {
                type: altType,
                name: altName,
                noun: altNoun,
                count: altMatches.length
              };
              break;
            }
          }
          Search.currentMatches = [];
          Search.renderedCount = 0;
        }

        results.innerHTML = `
          <div class="search-results-header">No results</div>
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <div class="empty-state-text">No ${typeWord} match &ldquo;${esc(q)}&rdquo;</div>
            ${altSuggestion ? `
              <div class="search-fallback-banner">
                <div class="sf-msg">
                  Found <strong>${altSuggestion.count} ${altSuggestion.noun}${altSuggestion.count !== 1 ? 's' : ''}</strong> available under <strong>${altSuggestion.name}</strong>!
                </div>
                <button class="sf-btn" id="searchFallbackBtn" data-target="${altSuggestion.type}">
                  Switch to ${altSuggestion.name} &rarr;
                </button>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        const chunk = Search.getNextChunk();
        const typeNoun = this.activeType === 'PYQ' ? 'question paper' : this.activeType === 'ASSIGNMENT' ? 'assignment' : this.activeType === 'SLM' ? 'textbook' : 'material';
        results.innerHTML = `
          <div class="search-results-header">${matches.length} ${typeNoun}${matches.length !== 1 ? 's' : ''} found</div>
          <div id="searchItemsContainer">
            ${this._renderSearchItemsHTML(chunk.items, q)}
          </div>
          ${chunk.hasMore ? `<button id="loadMoreSearchBtn" class="pill" style="margin:1rem auto;display:flex">Show more results (${matches.length - chunk.items.length} remaining)</button>` : ''}
        `;
        this.animateSearchResults();
      }

      const stats = $('stats');
      if (stats) {
        stats.textContent = matches.length ? `${matches.length} matching material${matches.length !== 1 ? 's' : ''}` : 'No matches';
      }
    } else {
      if (results) {
        results.classList.remove('active');
        results.innerHTML = '';
      }
      if (viewControls) viewControls.style.display = '';
      const filteredProgrammes = Catalog.filter(this.activeLevel, this.activeType);
      if (grid) {
        grid.style.display = '';
        this.renderProgrammes(filteredProgrammes, '', this.activeType);
      }
      this.updateStats(filteredProgrammes);
      this.buildFilters();
    }
  }

  _renderSearchItemsHTML(items, query) {
    return items.map((item, idx) => {
      const cls = item.level === 'PG' ? 'pg' : item.level === 'UG' ? 'ug' : 'fyug';
      const label = item.level;
      const type = item.type || 'SLM';
      const typeCls = type === 'PYQ' ? 'pyq' : type === 'ASSIGNMENT' ? 'asgn' : 'slm';

      let fn;
      if (type === 'PYQ') {
        fn = (item.code ? item.code + '_' : '') + sanitize(item.name) + '_PYQ' + (item.examDate ? '_' + sanitize(item.examDate) : '') + '.pdf';
      } else if (type === 'ASSIGNMENT') {
        fn = sanitize(item.progName) + '_' + sanitize(item.semName) + '_Assignment.pdf';
      } else {
        fn = (item.code ? item.code + '_' : '') + sanitize(item.name) + '_SLM.pdf';
      }

      const vUrl = `/?course=${encodeURIComponent(item.code || item.name)}${type && type !== 'SLM' ? '&type=' + encodeURIComponent(type.toLowerCase()) : ''}${item.examDate ? '&examdate=' + encodeURIComponent(item.examDate) : ''}${item.pdf_url ? '&url=' + encodeURIComponent(item.pdf_url) : ''}${item.name ? '&name=' + encodeURIComponent(item.name) : ''}${item.progName ? '&prog=' + encodeURIComponent(item.progName) : ''}&level=${encodeURIComponent(item.level || '')}`;

      return `
        <div class="search-result-item" data-idx="${idx}">
          <div class="search-result-badges">
            <span class="search-result-level ${cls}">${label}</span>
            <span class="search-result-type ${typeCls}">${type}</span>
          </div>
          <div class="search-result-body">
            <div class="search-result-programme">${hl(item.progName, query)} &middot; ${esc(item.semName)}</div>
            <div class="search-result-course-name">${hl(item.name, query)}</div>
            ${item.code ? `<span class="search-result-code" title="Click to copy code" data-code="${ea(item.code)}">${hl(item.code, query)}</span>` : ''}
            ${type === 'PYQ' ? `
              <div class="search-result-extra">
                <span class="pyq-date-pill">${esc(item.examDate || 'Exam Paper')}</span>
                ${item.admissionBatch ? `<span class="pyq-batch-text">${esc(item.admissionBatch)}</span>` : ''}
              </div>
            ` : ''}
            ${type === 'ASSIGNMENT' ? `
              <div class="search-result-extra">
                <span class="asgn-pill">CIA QUESTIONS</span>
                <span class="pyq-batch-text">${esc(item.admission_batch || 'Continuous Internal Assessment')}</span>
              </div>
            ` : ''}
          </div>
          <div class="search-result-actions">
            <a class="btn-view" href="${ea(vUrl)}" title="View PDF" data-type="${ea(type)}" data-code="${ea(item.code || '')}" data-name="${ea(item.name)}" data-prog="${ea(item.progName)}" data-level="${ea(item.level)}" data-examdate="${ea(item.examDate || '')}" data-url="${ea(item.pdf_url)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>View</span>
            </a>
            <a class="btn-download" href="${ea(item.pdf_url)}" data-type="${ea(type)}" data-fname="${ea(fn)}" data-code="${ea(item.code || '')}" data-name="${ea(item.name)}" data-prog="${ea(item.progName)}" data-level="${ea(item.level)}" data-examdate="${ea(item.examDate || '')}" data-batch="${ea(item.admissionBatch || '')}" data-semester="${ea(item.semName || '')}" target="_blank" rel="noopener noreferrer">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>PDF</span>
            </a>
            <button class="btn-share" data-url="${ea(item.pdf_url)}" data-name="${ea(item.name)}" data-type="${ea(type)}" data-code="${ea(item.code || '')}" aria-label="Share" title="Share link">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
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

  /**
   * Applies smooth staggered scroll entrance to search result cards,
   * reusing a persistent IntersectionObserver instance to prevent GC churn.
   */
  animateSearchResults() {
    const items = document.querySelectorAll('.search-result-item:not(.animate-in)');
    if (!items.length) return;

    if ('IntersectionObserver' in window) {
      if (!this._searchRevealObserver) {
        this._searchRevealObserver = new IntersectionObserver((entries) => {
          let delay = 0;
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const el = entry.target;
              requestAnimationFrame(() => {
                el.style.transitionDelay = delay + 'ms';
                el.classList.add('animate-in');
              });
              delay = Math.min(delay + 25, 200);
              this._searchRevealObserver.unobserve(el);
            }
          });
        }, { threshold: 0.05 });
      }
      items.forEach(el => this._searchRevealObserver.observe(el));
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

    const counts = Catalog.getLevelCounts(this.activeType);

    Catalog.levels.forEach(lv => {
      const count = counts[lv] || 0;

      const pill = document.createElement('button');
      pill.className = 'pill' + (this.activeLevel === lv ? ' active' : '');
      pill.dataset.level = lv;
      pill.innerHTML = `${lv === 'ALL' ? 'All' : lv} <span class="pill-count">${count}</span>`;
      container.appendChild(pill);
    });
  }

  // --- Programme Cards Rendering ---

  /**
   * Compiles the full inner HTML for a single programme card's body
   * (semester tabs, course items, PYQs, and assignment booklets).
   * @param {Object} prog
   * @param {number} idx
   * @param {string} [query='']
   * @param {string} [activeType=this.activeType]
   * @returns {string}
   */
  _renderCardBodyHTML(prog, idx, query = '', activeType = this.activeType) {
    let sems;
    if (activeType === 'ASSIGNMENT') {
      sems = prog.semesters.filter(s => s.assignments && s.assignments.length > 0);
    } else if (activeType === 'PYQ') {
      sems = prog.semesters.filter(s => (s.courses && s.courses.some(c => c.pyqs && c.pyqs.length > 0)) || (s.generalPyqs && s.generalPyqs.length > 0));
    } else if (activeType === 'SLM') {
      sems = prog.semesters.filter(s => s.courses && s.courses.length > 0);
    } else {
      sems = prog.semesters;
    }

    if (!sems || !sems.length) {
      return '<div class="empty-category-notice" style="padding:1.5rem">No matching materials found in this programme for the selected filter.</div>';
    }

    return `
      <div class="semester-tabs" role="tablist">
        ${sems.map((s, si) => {
          let count;
          if (activeType === 'PYQ') {
            count = (s.courses ? s.courses.reduce((sum, c) => sum + (c.pyqs ? c.pyqs.length : 0), 0) : 0) + (s.generalPyqs ? s.generalPyqs.length : 0);
          } else if (activeType === 'ASSIGNMENT') {
            count = s.assignments ? s.assignments.length : 0;
          } else if (activeType === 'SLM') {
            count = s.courses ? s.courses.length : 0;
          } else {
            count = (s.courses ? s.courses.length : 0) + (s.assignments ? s.assignments.length : 0) + (s.generalPyqs ? s.generalPyqs.length : 0);
          }
          return `
            <button class="sem-tab${si === 0 ? ' active' : ''}" data-content="p${idx}s${si}" role="tab" aria-selected="${si === 0}">
              ${esc(s.semester)} <span class="tab-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
      ${sems.map((s, si) => {
        // --- 1. ASSIGNMENT MODE ---
        if (activeType === 'ASSIGNMENT') {
          return `
            <div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
              ${s.assignments && s.assignments.length > 0 ? s.assignments.map(asgn => {
                const fnAsgn = sanitize(prog.programme_name) + '_' + sanitize(s.semester) + '_Assignment.pdf';
                const vUrlAsgn = `/?course=${encodeURIComponent(prog.programme_name + '_' + s.semester)}&type=assignment&url=${encodeURIComponent(asgn.pdf_url)}&name=${encodeURIComponent(asgn.title)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                return `
                  <div class="course-item asgn-mode">
                    <div class="course-main-row">
                      <div class="course-header-group">
                        <span class="course-code asgn-code">BOOKLET</span>
                        <span class="course-name">${esc(s.semester)} Assignment Booklet</span>
                      </div>
                      <div class="course-actions">
                        <a class="btn-view" href="${ea(vUrlAsgn)}" title="View Assignment Booklet PDF" data-type="ASSIGNMENT" data-code="${ea(prog.programme_name + '_' + s.semester)}" data-name="${ea(asgn.title)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-url="${ea(asgn.pdf_url)}">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>View</span>
                        </a>
                        <a class="btn-download" href="${ea(asgn.pdf_url)}" data-type="ASSIGNMENT" data-fname="${ea(fnAsgn)}" data-name="${ea(asgn.title)}" data-prog="${ea(prog.programme_name)}" data-semester="${ea(s.semester)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          <span>PDF</span>
                        </a>
                        <button class="btn-share" data-url="${ea(asgn.pdf_url)}" data-name="${ea(asgn.title)}" data-type="ASSIGNMENT" data-code="${ea(prog.programme_name + '_' + s.semester)}" aria-label="Share" title="Share link">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('') : '<div class="empty-category-notice">No assignments cataloged for this semester</div>'}
            </div>
          `;
        }

        // --- 2. PYQ MODE ---
        if (activeType === 'PYQ') {
          const coursesWithPyq = (s.courses || []).filter(c => c.pyqs && c.pyqs.length > 0);
          return `
            <div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
              ${coursesWithPyq.map(course => `
                <div class="course-item pyq-mode">
                  <div class="course-main-row">
                    <div class="course-header-group">
                      <span class="course-code">${esc(course.code)}</span>
                      <span class="course-name">${hl(course.name, query)}</span>
                    </div>
                    <span class="pyq-count-chip">${course.pyqs.length} Paper${course.pyqs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div class="course-pyq-drawer open">
                    ${course.pyqs.map(py => {
                      const fnPyq = sanitize(course.code + '_' + course.name) + '_PYQ_' + sanitize(py.exam_date || '') + '.pdf';
                      const vUrlPyq = `/?course=${encodeURIComponent(course.code || course.name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}&url=${encodeURIComponent(py.pdf_url)}&name=${encodeURIComponent(course.name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                      return `
                        <div class="pyq-paper-item">
                          <div class="pyq-paper-info">
                            <span class="pyq-date-pill">${esc(py.exam_date || 'Question Paper')}</span>
                            ${py.admission_batch ? `<span class="pyq-batch-tag">${esc(py.admission_batch)}</span>` : ''}
                          </div>
                          <div class="pyq-paper-actions">
                            <a class="btn-view" href="${ea(vUrlPyq)}" title="View Exam Paper PDF" data-type="PYQ" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-examdate="${ea(py.exam_date || '')}" data-url="${ea(py.pdf_url)}">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              <span>View</span>
                            </a>
                            <a class="btn-download" href="${ea(py.pdf_url)}" data-type="PYQ" data-fname="${ea(fnPyq)}" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-examdate="${ea(py.exam_date)}" data-batch="${ea(py.admission_batch)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              <span>PDF</span>
                            </a>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}

              ${s.generalPyqs && s.generalPyqs.length > 0 ? `
                <div class="semester-pyq-archive" style="border-top:none;margin-top:.4rem">
                  <div class="semester-pyq-archive-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>General Examination Papers (${s.generalPyqs.length})</span>
                  </div>
                  ${s.generalPyqs.map(py => {
                    const fnG = sanitize(prog.programme_name) + '_' + sanitize(py.clean_name || py.subject_name) + '_PYQ_' + sanitize(py.exam_date || '') + '.pdf';
                    const vUrlG = `/?course=${encodeURIComponent(py.code || py.clean_name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}&url=${encodeURIComponent(py.pdf_url)}&name=${encodeURIComponent(py.clean_name || py.subject_name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                    return `
                      <div class="pyq-paper-item">
                        <div class="pyq-paper-info">
                          <span class="pyq-date-pill">${esc(py.exam_date || 'Question Paper')}</span>
                          <strong style="font-size:12px;margin-left:4px">${esc(py.clean_name || py.subject_name)}</strong>
                          ${py.admission_batch ? `<span class="pyq-batch-tag">${esc(py.admission_batch)}</span>` : ''}
                        </div>
                        <div class="pyq-paper-actions">
                          <a class="btn-view" href="${ea(vUrlG)}" title="View PYQ PDF" data-type="PYQ" data-code="${ea(py.code || '')}" data-name="${ea(py.clean_name || py.subject_name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-examdate="${ea(py.exam_date || '')}" data-url="${ea(py.pdf_url)}">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>View</span>
                          </a>
                          <a class="btn-download" href="${ea(py.pdf_url)}" data-type="PYQ" data-fname="${ea(fnG)}" data-code="${ea(py.code || '')}" data-name="${ea(py.clean_name || py.subject_name)}" data-prog="${ea(prog.programme_name)}" data-examdate="${ea(py.exam_date)}" data-batch="${ea(py.admission_batch)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>PDF</span>
                          </a>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }

        // --- 3. SLM MODE ---
        if (activeType === 'SLM') {
          return `
            <div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
              ${s.courses.map(course => {
                const fn = sanitize(course.code + '_' + course.name) + '_SLM.pdf';
                const vUrl = `/?course=${encodeURIComponent(course.code || course.name)}&type=slm&url=${encodeURIComponent(course.pdf_url)}&name=${encodeURIComponent(course.name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                return `
                  <div class="course-item slm-mode">
                    <div class="course-main-row">
                      <div class="course-header-group">
                        <span class="course-code slm-code">${esc(course.code)}</span>
                        <span class="course-name">${hl(course.name, query)}</span>
                      </div>
                      <div class="course-actions">
                        <a class="btn-view" href="${ea(vUrl)}" title="View SLM PDF" data-type="SLM" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-url="${ea(course.pdf_url)}">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>View</span>
                        </a>
                        <a class="btn-download" href="${ea(course.pdf_url)}" data-type="SLM" data-fname="${ea(fn)}" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          <span>PDF</span>
                        </a>
                        <button class="btn-share" data-url="${ea(course.pdf_url)}" data-name="${ea(course.name)}" data-type="SLM" data-code="${ea(course.code)}" aria-label="Share" title="Share link">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        // --- 4. ALL MATERIALS MODE (Default Integrated) ---
        return `
          <div class="semester-content${si === 0 ? ' active' : ''}" id="p${idx}s${si}" role="tabpanel">
            ${s.assignments && s.assignments.length > 0 ? s.assignments.map(asgn => {
              const fnAsgn = sanitize(prog.programme_name) + '_' + sanitize(s.semester) + '_Assignment.pdf';
              const vUrlAsgn = `/?course=${encodeURIComponent(prog.programme_name + '_' + s.semester)}&type=assignment&url=${encodeURIComponent(asgn.pdf_url)}&name=${encodeURIComponent(asgn.title)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
              return `
                <div class="course-item asgn-mode">
                  <div class="course-main-row">
                    <div class="course-header-group">
                      <span class="course-code asgn-code">ASSIGNMENT</span>
                      <span class="course-name">${esc(s.semester)} Assignment Booklet</span>
                    </div>
                    <span class="asgn-count-chip">Booklet</span>
                  </div>
                  <div class="course-pyq-drawer open">
                    <div class="pyq-paper-item asgn-paper-item">
                      <div class="pyq-paper-info">
                        <span class="asgn-pill">CIA QUESTIONS</span>
                        <span class="pyq-batch-tag">Continuous Internal Assessment</span>
                      </div>
                      <div class="pyq-paper-actions">
                        <a class="btn-view" href="${ea(vUrlAsgn)}" title="View Assignment PDF" data-type="ASSIGNMENT" data-code="${ea(prog.programme_name + '_' + s.semester)}" data-name="${ea(asgn.title)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-url="${ea(asgn.pdf_url)}">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>View</span>
                        </a>
                        <a class="btn-download" href="${ea(asgn.pdf_url)}" data-type="ASSIGNMENT" data-fname="${ea(fnAsgn)}" data-name="${ea(asgn.title)}" data-prog="${ea(prog.programme_name)}" data-semester="${ea(s.semester)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('') : ''}

            ${s.courses.map(course => {
              const fn = sanitize(course.code + '_' + course.name) + '_SLM.pdf';
              const vUrl = `/?course=${encodeURIComponent(course.code || course.name)}&type=slm&url=${encodeURIComponent(course.pdf_url)}&name=${encodeURIComponent(course.name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
              const hasPyqs = course.pyqs && course.pyqs.length > 0;

              return `
                <div class="course-item slm-mode">
                  <div class="course-main-row">
                    <div class="course-header-group">
                      <span class="course-code slm-code">${esc(course.code)}</span>
                      <span class="course-name">${hl(course.name, query)}</span>
                    </div>
                    <div class="course-actions">
                      <a class="btn-view" href="${ea(vUrl)}" title="View SLM PDF" data-type="SLM" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-url="${ea(course.pdf_url)}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span>View</span>
                      </a>
                      <a class="btn-download" href="${ea(course.pdf_url)}" data-type="SLM" data-fname="${ea(fn)}" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>PDF</span>
                      </a>
                      <button class="btn-share" data-url="${ea(course.pdf_url)}" data-name="${ea(course.name)}" data-type="SLM" data-code="${ea(course.code)}" aria-label="Share" title="Share link">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                    </div>
                  </div>

                  ${hasPyqs ? `
                    <div class="course-sub-row">
                      <button class="course-pyq-toggle" type="button" aria-expanded="false">
                        <svg class="toggle-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        <svg class="toggle-paper" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <span>${course.pyqs.length} Question Paper${course.pyqs.length > 1 ? 's' : ''}</span>
                      </button>
                      <div class="course-pyq-drawer">
                        ${course.pyqs.map(py => {
                          const fnPyq = sanitize(course.code + '_' + course.name) + '_PYQ_' + sanitize(py.exam_date || '') + '.pdf';
                          const vUrlPyq = `/?course=${encodeURIComponent(course.code || course.name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}&url=${encodeURIComponent(py.pdf_url)}&name=${encodeURIComponent(course.name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                          return `
                            <div class="pyq-paper-item">
                              <div class="pyq-paper-info">
                                <span class="pyq-date-pill">${esc(py.exam_date || 'Question Paper')}</span>
                                ${py.admission_batch ? `<span class="pyq-batch-tag">${esc(py.admission_batch)}</span>` : ''}
                              </div>
                              <div class="pyq-paper-actions">
                                <a class="btn-view" href="${ea(vUrlPyq)}" title="View PYQ PDF" data-type="PYQ" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-examdate="${ea(py.exam_date || '')}" data-url="${ea(py.pdf_url)}">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                  <span>View</span>
                                </a>
                                <a class="btn-download" href="${ea(py.pdf_url)}" data-type="PYQ" data-fname="${ea(fnPyq)}" data-code="${ea(course.code)}" data-name="${ea(course.name)}" data-prog="${ea(prog.programme_name)}" data-examdate="${ea(py.exam_date)}" data-batch="${ea(py.admission_batch)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  <span>PDF</span>
                                </a>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}

            ${s.generalPyqs && s.generalPyqs.length > 0 ? `
              <div class="semester-pyq-archive">
                <div class="semester-pyq-archive-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Additional Question Papers (${s.generalPyqs.length})</span>
                </div>
                ${s.generalPyqs.map(py => {
                  const fnG = sanitize(prog.programme_name) + '_' + sanitize(py.clean_name || py.subject_name) + '_PYQ_' + sanitize(py.exam_date || '') + '.pdf';
                  const vUrlG = `/?course=${encodeURIComponent(py.code || py.clean_name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}&url=${encodeURIComponent(py.pdf_url)}&name=${encodeURIComponent(py.clean_name || py.subject_name)}&prog=${encodeURIComponent(prog.programme_name)}&level=${encodeURIComponent(prog.level)}`;
                  return `
                    <div class="pyq-paper-item">
                      <div class="pyq-paper-info">
                        <span class="pyq-date-pill">${esc(py.exam_date || 'Question Paper')}</span>
                        <strong style="font-size:12px;margin-left:4px">${esc(py.clean_name || py.subject_name)}</strong>
                        ${py.admission_batch ? `<span class="pyq-batch-tag">${esc(py.admission_batch)}</span>` : ''}
                      </div>
                      <div class="pyq-paper-actions">
                        <a class="btn-view" href="${ea(vUrlG)}" title="View PYQ PDF" data-type="PYQ" data-code="${ea(py.code || '')}" data-name="${ea(py.clean_name || py.subject_name)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-examdate="${ea(py.exam_date || '')}" data-url="${ea(py.pdf_url)}">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>View</span>
                        </a>
                        <a class="btn-download" href="${ea(py.pdf_url)}" data-type="PYQ" data-fname="${ea(fnG)}" data-code="${ea(py.code || '')}" data-name="${ea(py.clean_name || py.subject_name)}" data-prog="${ea(prog.programme_name)}" data-examdate="${ea(py.exam_date)}" data-batch="${ea(py.admission_batch)}" data-level="${ea(prog.level)}" target="_blank" rel="noopener noreferrer">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    `;
  }

  /**
   * Lazily compiles and populates a card's body HTML on demand.
   * Defers rendering from initial catalog load (~12,480 DOM nodes down to ~320 nodes),
   * ensuring instant 60/120fps mobile frame rates and sub-15ms initial paint.
   * @param {HTMLElement} card
   * @returns {HTMLElement|null}
   */
  ensureCardBodyRendered(card) {
    if (!card) return null;
    const body = card.querySelector('.card-body');
    if (!body) return null;
    if (body.dataset.rendered === 'true') return body;

    const idx = parseInt(card.dataset.idx, 10);
    const progName = card.dataset.prog;
    const prog = (this._renderedProgrammes && this._renderedProgrammes[idx] && this._renderedProgrammes[idx].programme_name === progName)
      ? this._renderedProgrammes[idx]
      : (Catalog.programmes ? Catalog.programmes.find(p => p.programme_name === progName) : null);

    if (prog) {
      body.innerHTML = this._renderCardBodyHTML(prog, idx, '', this.activeType);
      body.dataset.rendered = 'true';
    }
    return body;
  }

  /**
   * Renders programme cards in a streamlined, deferred-body architecture.
   * Only header metadata and container shells are rendered upfront.
   * @param {Array<Object>} programmesList
   * @param {string} [query='']
   * @param {string} [activeType=this.activeType]
   */
  renderProgrammes(programmesList, query = '', activeType = this.activeType) {
    const grid = $('grid');
    if (!grid) return;

    if (!programmesList.length) {
      const typeWord = activeType === 'PYQ' ? 'question papers' : activeType === 'ASSIGNMENT' ? 'assignment booklets' : activeType === 'SLM' ? 'course textbooks' : 'materials';
      grid.innerHTML = `
        <div class="empty-category-notice">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>No ${typeWord} found matching <strong>${esc(this.activeLevel)}</strong> programmes.</div>
          <button class="empty-category-btn" id="resetCategoryFilterBtn">Show All Programmes</button>
        </div>`;
      return;
    }

    const pinnedList = Storage.getPinnedProgrammes();
    const sortedList = [...programmesList].sort((a, b) => {
      const aPin = pinnedList.includes(a.programme_name);
      const bPin = pinnedList.includes(b.programme_name);
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      return 0;
    });

    this._renderedProgrammes = sortedList;

    grid.innerHTML = sortedList.map((prog, idx) => {
      let sems;
      if (activeType === 'ASSIGNMENT') {
        sems = prog.semesters.filter(s => s.assignments && s.assignments.length > 0);
      } else if (activeType === 'PYQ') {
        sems = prog.semesters.filter(s => (s.courses && s.courses.some(c => c.pyqs && c.pyqs.length > 0)) || (s.generalPyqs && s.generalPyqs.length > 0));
      } else if (activeType === 'SLM') {
        sems = prog.semesters.filter(s => s.courses && s.courses.length > 0);
      } else {
        sems = prog.semesters;
      }

      if (!sems.length) return '';

      let metaParts = [`${sems.length} sem`];
      if (activeType === 'PYQ') {
        metaParts.push(`${prog.totalPyq} Question Papers`);
      } else if (activeType === 'ASSIGNMENT') {
        metaParts.push(`${prog.totalAsgn} Assignment Booklets`);
      } else if (activeType === 'SLM') {
        metaParts.push(`${prog.totalSlm} Course Textbooks`);
      } else {
        if (prog.totalSlm > 0) metaParts.push(`${prog.totalSlm} SLM`);
        if (prog.totalPyq > 0) metaParts.push(`${prog.totalPyq} PYQ`);
        if (prog.totalAsgn > 0) metaParts.push(`${prog.totalAsgn} Asgn`);
      }

      const isPinned = pinnedList.includes(prog.programme_name);

      return `
        <div class="programme-card${isPinned ? ' pinned' : ''}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-idx="${idx}" role="listitem">
          <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
            <div class="card-header-main">
              <div class="card-badge-row">
                <span class="level-tag level-${ea(prog.level.toLowerCase())}">${esc(prog.level)}</span>
                <span class="card-meta-text">${metaParts.join(' &middot; ')}</span>
              </div>
              <h2 class="programme-title">${hl(formatProgName(prog.programme_name), query)}</h2>
            </div>
            <button class="btn-pin-programme${isPinned ? ' active' : ''}" type="button" aria-label="${isPinned ? 'Unpin programme' : 'Pin to top of catalog'}" title="${isPinned ? 'Unpin programme' : 'Pin to top of catalog'}" data-prog="${ea(prog.programme_name)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${isPinned ? '#f59e0b' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
            <div class="card-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="card-body" id="cb-${idx}" aria-hidden="true" data-rendered="false"></div>
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
    document.body.classList.remove('js-reveal');
    document.querySelectorAll('.programme-card').forEach(c => c.classList.add('revealed'));
  }

  toggleCard(card) {
    const body = this.ensureCardBodyRendered(card);
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
          const stickyEl = document.querySelector('.sticky-controls');
          const stickyH = (stickyEl ? stickyEl.offsetHeight : 0) + 16;
          if (rect.top < stickyH || rect.bottom > window.innerHeight + 40) {
            window.scrollTo({
              top: Math.max(0, window.scrollY + rect.top - stickyH),
              behavior: 'smooth'
            });
          }
        }, 320);
      });
    }
  }

  expandAll() {
    Analytics.trackEngagement('expand_all');
    document.querySelectorAll('.programme-card:not(.open)').forEach((card, i) => {
      const body = this.ensureCardBodyRendered(card);
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

  toggleAll() {
    const openCards = document.querySelectorAll('.programme-card.open');
    if (openCards.length > 0) {
      this.collapseAll();
      this.updateToggleBtn(false);
    } else {
      this.expandAll();
      this.updateToggleBtn(true);
    }
  }

  updateToggleBtn(isExpanded) {
    const btn = $('toggleAll');
    if (!btn) return;
    btn.dataset.state = isExpanded ? 'expanded' : 'collapsed';
    const text = btn.querySelector('.toggle-text');
    const icon = btn.querySelector('.toggle-icon');
    if (text) text.textContent = isExpanded ? 'Collapse' : 'Expand';
    if (icon) {
      icon.innerHTML = isExpanded
        ? '<polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" />'
        : '<polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" />';
    }
  }

  // --- Fullscreen In-App PDF Preview Panel ---

  showViewerPanel(pdfUrl, name, code, prog, level, type = 'SLM', examDate = '') {
    const panel = $('viewerPanel');
    if (!panel) return;

    $('viewerPanelTitle').textContent = name || 'Academic PDF';
    $('viewerProgName').textContent = prog || '';
    $('viewerCourseCode').textContent = code ? 'Code: ' + code : (examDate ? 'Exam: ' + examDate : '');

    const badge = $('viewerLevelTag');
    if (badge) {
      badge.textContent = level === 'FYUG' ? 'FYUG' : (level || 'UG');
      badge.className = 'viewer-meta-tag ' + (level === 'PG' ? 'pg' : level === 'UG' ? 'ug' : 'fyug');
    }

    const typeTag = $('viewerTypeTag');
    if (typeTag) {
      const t = (type || 'SLM').toUpperCase();
      typeTag.textContent = t === 'PYQ' ? 'PYQ' : t === 'ASSIGNMENT' ? 'ASGN' : 'SLM';
      typeTag.className = 'viewer-type-tag ' + (t === 'PYQ' ? 'pyq' : t === 'ASSIGNMENT' ? 'asgn' : 'slm');
    }

    // Dismiss any active floating download progress card
    $('downloadProgressCard')?.classList.remove('visible');

    // Avoid reloading if the exact same document is already displayed in the viewer
    const isAlreadyOpen = panel.classList.contains('visible') &&
      panel._data?.url === pdfUrl &&
      panel._data?.code === code &&
      panel._data?.type === type;
    if (isAlreadyOpen) return;

    panel._data = { url: pdfUrl, name, code, prog, level, type, examDate };
    panel.classList.add('visible');
    document.documentElement.classList.add('viewer-panel-open');
    document.body.classList.add('viewer-panel-open');
    // Silently apply eye-comfort filter mode on document load without popping toast notifications
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const savedFilter = localStorage.getItem('sgou-pdf-filter');
    if (!savedFilter || (activeTheme === 'dark' && savedFilter === 'normal') || (activeTheme === 'light' && savedFilter === 'dark')) {
      try { localStorage.setItem('sgou-pdf-filter', activeTheme === 'dark' ? 'dark' : 'normal'); } catch (_) {}
    }
    this.applyReaderFilter(localStorage.getItem('sgou-pdf-filter') || 'normal', false);

    // Sync clean course URL on current history frame without duplicate pushState
    const viewParams = new URLSearchParams();
    if (code) viewParams.set('course', code);
    else if (name) viewParams.set('course', name);
    if (type && type !== 'SLM' && type !== 'ALL') viewParams.set('type', type.toLowerCase());
    if (examDate) viewParams.set('examdate', examDate);
    const targetUrl = `/?${viewParams.toString()}`;
    try {
      const curSearch = window.location.search;
      const isAlreadyOnTarget = curSearch === `?${viewParams.toString()}` || curSearch.includes(code || name || '');
      if (!isAlreadyOnTarget && !history.state?.viewerOpen) {
        this._viewerOpenedInSession = true;
        history.pushState({ viewerOpen: true, code: code || name }, '', targetUrl);
      } else {
        history.replaceState({ ...(history.state || {}), viewerOpen: true, code: code || name }, '', targetUrl);
      }
    } catch (_) {}

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || window.innerWidth <= 768;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const frame = $('viewerPanelFrame');
    const ld = $('viewerPanelLoading');

    if (this._viewerTimeout) {
      clearTimeout(this._viewerTimeout);
      this._viewerTimeout = null;
    }
    if (this._fallbackTimeout) {
      clearTimeout(this._fallbackTimeout);
      this._fallbackTimeout = null;
    }

    if (this._activeBlobUrl) {
      try { URL.revokeObjectURL(this._activeBlobUrl); } catch (_) {}
      this._activeBlobUrl = null;
    }

    if (frame) {
      frame.style.display = 'block';
      frame.style.opacity = '1';

      if (ld) {
        ld.style.display = 'flex';
        ld.classList.remove('hidden');
        ld.innerHTML = '<div class="loading-spinner"></div><span>Loading PDF preview&hellip;</span>';
      }

      let loaded = false;
      const onReady = () => {
        if (loaded) return;
        loaded = true;
        if (this._fallbackTimeout) {
          clearTimeout(this._fallbackTimeout);
          this._fallbackTimeout = null;
        }
        if (ld) {
          ld.classList.add('hidden');
          ld.style.display = 'none';
        }
      };
      frame.onload = onReady;

      // Universal in-app HTML5 canvas reader (reader.html) across all devices for consistent themes, high-DPI, and offline caching.
      const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
      let fullUrl = '';
      if (pdfUrl) {
        fullUrl = './reader.html?file=' + encodeURIComponent(pdfUrl) + '&name=' + encodeURIComponent(name || 'Academic PDF') + '&theme=' + encodeURIComponent(curTheme);
      }

      try {
        if (frame.contentWindow) {
          frame.contentWindow.location.replace(fullUrl || 'about:blank');
        } else {
          frame.src = fullUrl || 'about:blank';
        }
      } catch (e) {
        frame.src = fullUrl || 'about:blank';
      }

      // If document loading takes longer than 5 seconds (e.g. slow network), provide an inline fallback helper
      this._fallbackTimeout = setTimeout(() => {
        if (!loaded && ld) {
          ld.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Rendering document&hellip;</span>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center">
              <button type="button" id="vpTryDirectBtn" class="vp-fallback-btn">Try Direct Stream</button>
              <button type="button" id="vpTryDlBtn" class="vp-fallback-btn primary">Download PDF</button>
            </div>
          `;
          $('vpTryDirectBtn')?.addEventListener('click', () => {
            try {
              if (frame.contentWindow) frame.contentWindow.location.replace(pdfUrl + '#toolbar=1&navpanes=0');
              else frame.src = pdfUrl + '#toolbar=1&navpanes=0';
            } catch (_) {
              frame.src = pdfUrl + '#toolbar=1&navpanes=0';
            }
          });
          $('vpTryDlBtn')?.addEventListener('click', () => {
            Downloader.startDirectDownload(panel._data);
          });
        }
      }, 5000);

      this._viewerTimeout = setTimeout(onReady, isMobile ? 6500 : 3500);
    }
  }

  hideViewerPanel(syncUrl = true) {
    if (this._activeBlobUrl) {
      try { URL.revokeObjectURL(this._activeBlobUrl); } catch (_) {}
      this._activeBlobUrl = null;
    }
    if (this._viewerTimeout) {
      clearTimeout(this._viewerTimeout);
      this._viewerTimeout = null;
    }
    if (this._fallbackTimeout) {
      clearTimeout(this._fallbackTimeout);
      this._fallbackTimeout = null;
    }
    const ld = $('viewerPanelLoading');
    if (ld) {
      ld.classList.add('hidden');
      ld.style.display = 'none';
      ld.innerHTML = '<div class="loading-spinner"></div><span>Loading PDF preview&hellip;</span>';
    }
    const panel = $('viewerPanel');
    if (!panel) return;
    const wasVisible = panel.classList.contains('visible');
    panel.classList.remove('visible');
    document.documentElement.classList.remove('viewer-panel-open');
    document.body.classList.remove('viewer-panel-open');
    const frame = $('viewerPanelFrame');
    if (frame) {
      frame.style.display = '';
      try {
        if (frame.contentWindow) {
          frame.contentWindow.location.replace('about:blank');
        } else {
          frame.src = 'about:blank';
        }
      } catch (e) {
        frame.src = 'about:blank';
      }
    }
    if (syncUrl && wasVisible) {
      if (this._viewerOpenedInSession && history.state?.viewerOpen) {
        this._viewerOpenedInSession = false;
        history.back();
      } else {
        this._viewerOpenedInSession = false;
        this.syncUrlFromState(false);
      }
    } else {
      this._viewerOpenedInSession = false;
    }
  }

  // --- PDF Reader Eye-Comfort Filter ---

  toggleReaderFilter() {
    const frame = $('viewerPanelFrame');
    if (!frame) return;
    const modes = ['normal', 'sepia', 'dark'];
    let current = 'normal';
    try { current = localStorage.getItem('sgou-pdf-filter') || 'normal'; } catch (_) {}
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    const next = modes[nextIdx];
    try { localStorage.setItem('sgou-pdf-filter', next); } catch (_) {}
    this.applyReaderFilter(next, true);
  }

  applyReaderFilter(mode, showFeedback = false) {
    const frame = $('viewerPanelFrame');
    const btn = $('viewerPanelFilter');
    if (btn) {
      btn.classList.remove('filter-active');
      if (mode === 'sepia') {
        btn.classList.add('filter-active');
        btn.setAttribute('title', 'Eye Comfort: Warm Sepia (Click to change)');
        if (showFeedback) this.showToast('Reader Mode: Warm Sepia');
      } else if (mode === 'dark') {
        btn.classList.add('filter-active');
        btn.setAttribute('title', 'Eye Comfort: Dark Invert (Click to change)');
        if (showFeedback) this.showToast('Reader Mode: Dark Invert');
      } else {
        btn.setAttribute('title', 'Eye Comfort: Normal (Click to change)');
        if (showFeedback) this.showToast('Reader Mode: Standard');
      }
    }
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: 'sgou-filter-change', filter: mode }, '*');
      } catch (_) {}
    }
  }

  // --- My Downloads Library Drawer ---

  toggleMyDownloads() {
    $('downloadProgressCard')?.classList.remove('visible');
    const drawer = $('myDownloadsDrawer');
    if (!drawer) return;
    if (drawer.classList.contains('visible')) {
      drawer.classList.remove('visible');
    } else {
      this.renderMyDownloads();
      drawer.classList.add('visible');
    }
  }

  openShortcutsModal() {
    const modal = $('shortcutsModal');
    if (modal) {
      this._lastFocusBeforeShortcuts = document.activeElement;
      modal.classList.add('visible');
      Analytics.trackEngagement('shortcuts_modal_open');
      const closeBtn = $('shortcutsModalClose') || $('shortcutsModalDoneBtn');
      setTimeout(() => closeBtn?.focus(), 50);
    }
  }

  closeShortcutsModal() {
    const modal = $('shortcutsModal');
    if (modal) {
      modal.classList.remove('visible');
      if (this._lastFocusBeforeShortcuts && typeof this._lastFocusBeforeShortcuts.focus === 'function') {
        this._lastFocusBeforeShortcuts.focus();
        this._lastFocusBeforeShortcuts = null;
      }
    }
  }

  setMaterialType(type) {
    const targetType = (type || 'SLM').toUpperCase();
    if (this.activeType === targetType) return;
    const prevType = this.activeType;
    this.activeType = targetType;
    const switcher = $('materialTypeSwitcher');
    if (switcher) {
      switcher.setAttribute('data-active', this.activeType);
    }
    document.querySelectorAll('.material-type-switcher .type-btn').forEach(b => {
      const isActive = b.dataset.type === this.activeType;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    Analytics.trackFilter('type_' + this.activeType);
    this.executeSearch();

    // Primary Tab Hierarchy:
    // SLM is the primary root tab. Switching from SLM to a secondary tab (PYQ/ASSIGNMENT)
    // pushes exactly 1 history state so pressing Android Back returns cleanly to SLM.
    // Switching between secondary tabs replaces state silently to prevent history loops.
    // Tapping SLM directly pops the state via history.back() to keep the root frame clean.
    if (this.activeType === 'SLM') {
      if (this._pushedTabState) {
        this._pushedTabState = false;
        history.back();
      } else {
        this.syncUrlFromState(false);
      }
    } else {
      if (prevType === 'SLM' && !this._pushedTabState) {
        this._pushedTabState = true;
        this.syncUrlFromState(true);
      } else {
        this.syncUrlFromState(false);
      }
    }
  }

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

    list.innerHTML = history.map(h => {
      const type = (h.type || 'SLM').toUpperCase();
      const typeCls = type === 'PYQ' ? 'pyq' : type === 'ASSIGNMENT' ? 'asgn' : 'slm';
      return `
        <div class="my-dl-item">
          <div class="my-dl-item-top">
            <span class="my-dl-code">${esc(h.code || type)}</span>
            <span class="mat-badge ${typeCls}" style="font-size:9px;padding:1px 4px">${type}</span>
            <span class="my-dl-time">${esc(h.date)} &middot; ${esc(h.time)}</span>
          </div>
          <div class="my-dl-name">${esc(h.name)}</div>
          <div class="my-dl-actions">
            <span class="my-dl-filename" title="${esc(h.filename)}">${esc(h.filename)}${h.size ? ' (' + esc(h.size) + ')' : ''}</span>
            <div class="my-dl-btns">
              <button class="my-dl-btn my-dl-view-btn" data-url="${ea(h.url)}" data-name="${ea(h.name)}" data-code="${ea(h.code || '')}" data-type="${ea(type)}" type="button" aria-label="View document" title="View in document viewer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <a class="my-dl-btn" href="${ea(h.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open original PDF in browser" title="Open PDF in new tab">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Asynchronously check CacheStorage for offline cached items
    if ('caches' in window) {
      caches.open('sgou-offline-docs').then(cache => {
        history.forEach((h, i) => {
          if (!h.url) return;
          cache.match(h.url).then(match => {
            if (match) {
              const itemEl = list.children[i];
              const topEl = itemEl ? itemEl.querySelector('.my-dl-item-top') : null;
              if (topEl && !topEl.querySelector('.my-dl-cached')) {
                const badge = document.createElement('span');
                badge.className = 'my-dl-cached';
                badge.textContent = 'Saved Offline';
                badge.title = 'Saved to device storage — loads instantly with 0 data';
                topEl.appendChild(badge);
              }
            }
          }).catch(() => {});
        });
      }).catch(() => {});
    }
  }

  updateDownloadStats() {
    const badge = $('downloadsBadge');
    const history = Storage.getDownloadHistory();

    if (badge) {
      if (history.length > 0) {
        badge.textContent = history.length;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  async shareContent(name, url, type = 'SLM', code = '') {
    const item = Catalog.courseMap.get((code || name || '').toLowerCase()) || null;
    const prog = item?.prog?.programme_name || '';
    const siteUrl = location.origin + '/';
    const cleanCode = code || item?.course?.code || '';
    const cleanProg = prog ? formatProgName(prog) : 'SGOU Distance Education';

    // Canonical clean URL without raw CloudFront bucket hashes or ugly percent-encoded query bloat
    const typeParam = type === 'PYQ' ? '&type=pyq' : type === 'ASSIGNMENT' ? '&type=assignment' : '';
    const shareUrl = cleanCode
      ? `${siteUrl}?course=${encodeURIComponent(cleanCode)}${typeParam}`
      : `${siteUrl}?q=${encodeURIComponent(name)}${typeParam}`;

    const typeLabel = type === 'PYQ' ? 'Previous Year Exam Paper' : type === 'ASSIGNMENT' ? 'Assignment Booklet' : 'Course SLM';

    // Polished, authoritative academic share card formatted for instant student messaging
    const text = `📚 *SGOU Academic Database*\n*${name}*${cleanCode ? ' (' + cleanCode + ')' : ''} — ${typeLabel}\n${cleanProg} · SNGOU\n\nDownload & read free:\n👉 ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} — SGOU Database`, text, url: shareUrl });
        Analytics.trackShare(name, 'web_share');
      } catch {
        // User cancelled share dialog
      }
    } else {
      const ok = await copyToClipboard(shareUrl);
      this.showToast(ok ? 'Link copied! Ready to share in WhatsApp/Telegram study groups.' : 'Could not copy link', 3500);
      Analytics.trackShare(name, 'clipboard');
    }
  }

  shareWhatsApp(name, code = '', type = 'SLM') {
    const item = Catalog.courseMap.get((code || name || '').toLowerCase()) || null;
    const prog = item?.prog?.programme_name ? formatProgName(item.prog.programme_name) : 'SGOU Distance Education';
    const cleanCode = code || item?.course?.code || '';
    const typeLabel = type === 'PYQ' ? 'Previous Year Exam Paper' : type === 'ASSIGNMENT' ? 'Assignment Booklet' : 'Course SLM';
    const typeParam = type === 'PYQ' ? '&type=pyq' : type === 'ASSIGNMENT' ? '&type=assignment' : '';
    const shareUrl = cleanCode
      ? `${location.origin}/?course=${encodeURIComponent(cleanCode)}${typeParam}`
      : `${location.origin}/?q=${encodeURIComponent(name)}${typeParam}`;
    const text = `📚 *SGOU Academic Database*\n*${name}*${cleanCode ? ' (' + cleanCode + ')' : ''} — ${typeLabel}\n${prog} · SNGOU\n\nDownload & read free:\n👉 ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    Analytics.trackShare(name, 'whatsapp');
  }

  shareTelegram(name, code = '', type = 'SLM') {
    const cleanCode = code || '';
    const typeParam = type === 'PYQ' ? '&type=pyq' : type === 'ASSIGNMENT' ? '&type=assignment' : '';
    const shareUrl = cleanCode
      ? `${location.origin}/?course=${encodeURIComponent(cleanCode)}${typeParam}`
      : `${location.origin}/?q=${encodeURIComponent(name)}${typeParam}`;
    const text = `SGOU Academic Database: ${name} (${cleanCode || type})`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    Analytics.trackShare(name, 'telegram');
  }

  // --- State Synchronization ---

  syncUrlFromState(push = false) {
    const q = ($('searchInput')?.value || '').trim();
    const params = new URLSearchParams();

    if (q) {
      params.set('q', q);
    }
    if (this.activeType && this.activeType !== 'SLM' && this.activeType !== 'ALL') {
      params.set('type', this.activeType.toLowerCase());
    }
    if (this.activeLevel && this.activeLevel !== 'ALL') {
      params.set('level', this.activeLevel.toLowerCase());
    }

    const qs = params.toString();
    const base = window.location.pathname || '/';
    const cleanUrl = qs ? `${base}?${qs}` : base;

    if (push) {
      Router.navigate(cleanUrl);
    } else {
      Router.updateUrlSilently(cleanUrl);
    }
  }

  restoreState(query, level, type = 'SLM') {
    const input = $('searchInput');
    if (!input) return;

    const curQ = input.value.trim();
    const qChanged = curQ !== query;
    const lChanged = this.activeLevel !== level;
    const tChanged = this.activeType !== type;

    if (!qChanged && !lChanged && !tChanged) return;

    if (qChanged) input.value = query;
    const hasQuery = query.length > 0;
    $('searchClear')?.classList.toggle('visible', hasQuery);
    const kbdHint = $('searchKbdHint');
    if (kbdHint) kbdHint.style.display = hasQuery ? 'none' : '';

    if (lChanged) {
      this.activeLevel = level;
      document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.level === this.activeLevel));
    }

    if (tChanged) {
      this.activeType = type;
      const switcher = $('materialTypeSwitcher');
      if (switcher) {
        switcher.setAttribute('data-active', this.activeType);
      }
      document.querySelectorAll('.material-type-switcher .type-btn').forEach(b => {
        const isActive = b.dataset.type === this.activeType;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    this.executeSearch();
  }

  updateStats(programmesList = Catalog.programmes) {
    const el = $('stats');
    const p = programmesList.length;
    const slm = Catalog.getTotalCourses(programmesList);
    const pyq = Catalog.getTotalPyq(programmesList);
    const asgn = Catalog.getTotalAsgn(programmesList);

    if (el) {
      const lvl = this.activeLevel !== 'ALL' ? `${this.activeLevel} ` : '';
      if (this.activeType === 'PYQ') {
        el.textContent = `${p} ${lvl}programme${p !== 1 ? 's' : ''} \u00b7 ${pyq} Question Papers`;
      } else if (this.activeType === 'ASSIGNMENT') {
        el.textContent = `${p} ${lvl}programme${p !== 1 ? 's' : ''} \u00b7 ${asgn} Assignment Booklets`;
      } else if (this.activeType === 'SLM') {
        el.textContent = `${p} ${lvl}programme${p !== 1 ? 's' : ''} \u00b7 ${slm} SLM Textbooks`;
      } else {
        el.textContent = `${p} ${lvl}programme${p !== 1 ? 's' : ''} \u00b7 ${slm} SLM \u00b7 ${pyq} PYQs \u00b7 ${asgn} Asgn`;
      }
    }

    // Update switcher counts
    const cSlm = $('countSlm');
    const cPyq = $('countPyq');
    const cAsgn = $('countAsgn');
    if (cSlm) cSlm.textContent = (Catalog.totalCourses || 1205).toLocaleString();
    if (cPyq) cPyq.textContent = (Catalog.totalPyq || 959).toLocaleString();
    if (cAsgn) cAsgn.textContent = (Catalog.totalAsgn || 77).toLocaleString();
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

    // Mobile compact-on-scroll with hysteresis & requestAnimationFrame
    let isCompact = false;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY || window.pageYOffset || 0;
          if (!isCompact && y > 120) {
            isCompact = true;
            sticky.classList.add('compact');
          } else if (isCompact && y < 80) {
            isCompact = false;
            sticky.classList.remove('compact');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
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
    const update = () => {
      const isOnline = navigator.onLine;
      if (bar) bar.classList.toggle('visible', !isOnline);
      Analytics.trackNetwork(isOnline);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (bar) bar.classList.toggle('visible', !navigator.onLine);
  }

  initInstallPrompt() {
    const banner = $('installBanner');
    if (!banner) return;

    // If already running as installed PWA (standalone mode or confirmed installed), hide banner
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isInstalled = isStandalone || Storage.get('sgou-app-installed') === '1';
    const isDismissed = Storage.get('sgou-install-dismissed') === '1';

    if (isInstalled || isDismissed) {
      banner.style.display = 'none';
      return;
    }

    const showBanner = () => {
      if (document.documentElement.classList.contains('viewer-panel-open')) return;
      banner.classList.add('visible');
      document.body.classList.add('has-install-banner');
    };

    const hideBanner = () => {
      banner.classList.remove('visible');
      document.body.classList.remove('has-install-banner');
    };

    // Capture beforeinstallprompt event if available
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      Analytics.trackPWA('prompt_available');
      if (!isDismissed && !isInstalled) {
        showBanner();
      }
    });

    window.addEventListener('appinstalled', () => {
      Analytics.trackPWA('installed');
      hideBanner();
      banner.style.display = 'none';
      Storage.set('sgou-app-installed', '1');
      this.showToast('SGOU Database successfully installed!');
    });

    $('installBtn')?.addEventListener('click', async () => {
      const promptEvent = window.deferredInstallPrompt;
      if (promptEvent) {
        hideBanner();
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        Analytics.trackPWA(choice?.outcome === 'accepted' ? 'prompt_accepted' : 'prompt_declined');
        if (choice?.outcome === 'accepted') {
          Storage.set('sgou-app-installed', '1');
          banner.style.display = 'none';
        }
        window.deferredInstallPrompt = null;
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          this.showToast('Tap Share (\u2191) & select "Add to Home Screen"');
        } else {
          this.showToast("Click the install icon in your address bar or browser menu (\u22ee) to install");
        }
      }
    });

    $('installDismiss')?.addEventListener('click', () => {
      hideBanner();
      Storage.set('sgou-install-dismissed', '1');
      Analytics.trackPWA('prompt_dismissed');
    });
  }

  initKeyboard() {
    document.addEventListener('keydown', e => {
      const activeEl = document.activeElement;
      const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      const isSearchInput = activeEl === $('searchInput');
      const isViewerOpen = $('viewerPanel')?.classList.contains('visible');
      const isShortcutsOpen = $('shortcutsModal')?.classList.contains('visible');
      const isDownloadsOpen = $('myDownloadsDrawer')?.classList.contains('visible');
      const isStorageHelpOpen = $('storageHelpModal')?.classList.contains('visible');
      const isUpdateOpen = $('updateModal')?.classList.contains('visible');
      const isDownloadModalOpen = $('downloadModal')?.classList.contains('visible');

      // 1. GLOBAL SHORTCUT: Search Focus (/ or Ctrl+K / Cmd+K)
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !isInput)) {
        e.preventDefault();
        $('searchInput')?.focus();
        $('searchInput')?.select();
        Analytics.trackEngagement('keyboard_search_shortcut');
        return;
      }

      // 2. GLOBAL SHORTCUT: Shortcuts Cheat Sheet Dialog (?)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        if (isShortcutsOpen) {
          this.closeShortcutsModal();
        } else {
          this.openShortcutsModal();
        }
        return;
      }

      // 3. ESCAPE HANDLING (Top-priority dismissal in reverse stack order)
      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          this.closeShortcutsModal();
          return;
        }
        if (isDownloadModalOpen) {
          Downloader.closeModal();
          return;
        }
        if (isDownloadsOpen) {
          $('myDownloadsDrawer')?.classList.remove('visible');
          return;
        }
        if (isStorageHelpOpen) {
          $('storageHelpModal')?.classList.remove('visible');
          return;
        }
        if (isUpdateOpen) {
          $('updateModal')?.classList.remove('visible');
          return;
        }
        if (isViewerOpen) {
          e.preventDefault();
          this.hideViewerPanel(true);
          return;
        }
        if (isSearchInput) {
          if (activeEl.value) {
            activeEl.value = '';
            $('searchClear')?.classList.remove('visible');
            const kbdHint = $('searchKbdHint');
            if (kbdHint) kbdHint.style.display = '';
            this.executeSearch();
            this.syncUrlFromState();
          } else {
            activeEl.blur();
          }
          return;
        }
        this.collapseAll();
        return;
      }

      // 4. SEARCH SPOTLIGHT NAVIGATION (when focused in search input)
      if (isSearchInput && $('searchResults')?.classList.contains('active')) {
        const items = Array.from(document.querySelectorAll('.search-result-item'));
        if (items.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            let cur = items.findIndex(el => el.classList.contains('keyboard-selected'));
            if (cur !== -1) items[cur].classList.remove('keyboard-selected');
            cur = (cur + 1) % items.length;
            items[cur].classList.add('keyboard-selected');
            items[cur].scrollIntoView({ block: 'nearest' });
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            let cur = items.findIndex(el => el.classList.contains('keyboard-selected'));
            if (cur !== -1) items[cur].classList.remove('keyboard-selected');
            cur = cur <= 0 ? items.length - 1 : cur - 1;
            items[cur].classList.add('keyboard-selected');
            items[cur].scrollIntoView({ block: 'nearest' });
            return;
          }
          if (e.key === 'Enter') {
            const selected = document.querySelector('.search-result-item.keyboard-selected');
            if (selected) {
              e.preventDefault();
              const actionBtn = selected.querySelector('.btn-view') || selected.querySelector('.btn-download');
              actionBtn?.click();
              return;
            }
          }
        }
      }

      // 5. IF USER IS TYPING IN ANY INPUT (and not search nav/escape): ignore single-key shortcuts
      if (isInput) return;

      // 6. READER VIEW SHORTCUTS (Active only when in-app viewer panel is open)
      if (isViewerOpen) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          this.hideViewerPanel(true);
          return;
        }
        const keyLow = e.key.toLowerCase();
        if (keyLow === 't') {
          e.preventDefault();
          this.toggleTheme(e);
          return;
        }
        if (keyLow === 'f' || keyLow === 'c') {
          e.preventDefault();
          this.toggleReaderFilter();
          return;
        }
        if (keyLow === 'd') {
          e.preventDefault();
          const panel = $('viewerPanel');
          if (panel?._data) Downloader.startDirectDownload(panel._data);
          return;
        }
        if (keyLow === 's') {
          e.preventDefault();
          const panel = $('viewerPanel');
          if (panel?._data) this.shareContent(panel._data.name, panel._data.url, panel._data.type, panel._data.code);
          return;
        }
        if (keyLow === 'o') {
          e.preventDefault();
          const panel = $('viewerPanel');
          if (panel?._data?.url) window.open(panel._data.url, '_blank', 'noopener noreferrer');
          return;
        }
        return; // Don't fall through to catalog shortcuts while viewer is active
      }

      // 7. CATALOG BROWSING SHORTCUTS (When viewing catalog)
      const k = e.key.toLowerCase();

      // Theme toggle (T)
      if (k === 't') {
        e.preventDefault();
        this.toggleTheme(e);
        return;
      }

      // My Saved Downloads drawer (D)
      if (k === 'd') {
        e.preventDefault();
        this.toggleMyDownloads();
        return;
      }

      // Expand / Collapse all programmes (E / C)
      if (k === 'e') {
        e.preventDefault();
        this.expandAll();
        return;
      }
      if (k === 'c') {
        e.preventDefault();
        this.collapseAll();
        return;
      }

      // Quick material filter (1 = SLM, 2 = PYQ, 3 = Assignment, 0 = All)
      if (e.key === '1') {
        e.preventDefault();
        this.setMaterialType('SLM');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        this.setMaterialType('PYQ');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        this.setMaterialType('ASSIGNMENT');
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        this.setMaterialType('ALL');
        return;
      }

      // Card navigation (J = Next programme, K = Previous programme)
      if (k === 'j' || k === 'k') {
        const cards = Array.from(document.querySelectorAll('.programme-card'));
        if (cards.length > 0) {
          e.preventDefault();
          let idx = cards.findIndex(c => c.contains(activeEl) || c === activeEl);
          if (k === 'j') {
            idx = (idx + 1) % cards.length;
          } else {
            idx = idx <= 0 ? cards.length - 1 : idx - 1;
          }
          const targetHdr = cards[idx].querySelector('.card-header');
          targetHdr?.focus();
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
      }

      // Toggle card on Enter/Space
      const hdr = e.target.closest?.('.card-header');
      if (hdr && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const card = hdr.closest('.programme-card');
        if (card) this.toggleCard(card);
        return;
      }
    });
  }

  // --- Central Event Delegation ---

  initDelegation() {
    document.addEventListener('click', e => {
      // Keyboard Shortcuts Dialog
      if (e.target.closest('#shortcutsBtn')) {
        this.openShortcutsModal();
        return;
      }
      if (e.target.closest('#shortcutsModalClose') || e.target.closest('#shortcutsModalDoneBtn')) {
        this.closeShortcutsModal();
        return;
      }
      const shortcutsModal = $('shortcutsModal');
      if (shortcutsModal && e.target === shortcutsModal) {
        this.closeShortcutsModal();
        return;
      }

      // Theme Toggle (both main header and reader view)
      if (e.target.closest('#themeToggle') || e.target.closest('#viewerThemeToggle')) {
        this.toggleTheme(e);
        return;
      }

      // Material Type Switcher (Tier 1 filter)
      const typeBtn = e.target.closest('.material-type-switcher .type-btn');
      if (typeBtn && typeBtn.dataset.type) {
        this.setMaterialType(typeBtn.dataset.type);
        return;
      }

      // Reset Category Filter from Empty Notice
      if (e.target.closest('#resetCategoryFilterBtn')) {
        this.activeLevel = 'ALL';
        this.executeSearch();
        this.syncUrlFromState();
        return;
      }

      // Course PYQ Expandable Toggle
      const pyqToggle = e.target.closest('.course-pyq-toggle');
      if (pyqToggle) {
        e.preventDefault();
        pyqToggle.classList.toggle('open');
        const drawer = pyqToggle.nextElementSibling;
        if (drawer && drawer.classList.contains('course-pyq-drawer')) {
          drawer.classList.toggle('open');
        }
        return;
      }

      // Viewer Back: reliably closes viewer panel without exiting the application
      if (e.target.closest('#viewerBack')) {
        this.hideViewerPanel(true);
        return;
      }

      // Viewer Eye-Comfort Filter Toggle
      if (e.target.closest('#viewerPanelFilter')) {
        this.toggleReaderFilter();
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

      // Viewer Download (Direct 1-Click Streaming)
      if (e.target.closest('#viewerPanelDownload')) {
        const panel = $('viewerPanel');
        if (panel?._data) {
          Downloader.startDirectDownload(panel._data);
        }
        return;
      }

      // Viewer Share
      if (e.target.closest('#viewerPanelShare')) {
        const panel = $('viewerPanel');
        if (panel?._data) {
          this.shareContent(panel._data.name, panel._data.url, panel._data.type, panel._data.code);
        }
        return;
      }

      // My Downloads Drawer Trigger
      if (e.target.closest('#myDownloadsBtn')) {
        $('downloadProgressCard')?.classList.remove('visible');
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

      // View document directly from My Downloads drawer
      const myDlViewBtn = e.target.closest('.my-dl-view-btn');
      if (myDlViewBtn) {
        const url = myDlViewBtn.dataset.url;
        const name = myDlViewBtn.dataset.name;
        const code = myDlViewBtn.dataset.code;
        const type = myDlViewBtn.dataset.type || 'SLM';
        $('myDownloadsDrawer')?.classList.remove('visible');
        this._viewerOpenedInSession = true;
        const vParams = new URLSearchParams();
        if (code) vParams.set('course', code);
        else if (name) vParams.set('course', name);
        if (type && type !== 'SLM' && type !== 'ALL') vParams.set('type', type.toLowerCase());
        if (url) vParams.set('url', url);
        if (name) vParams.set('name', name);
        Router.navigate(`/?${vParams.toString()}`);
        return;
      }

      // Storage Help Modal (Triggerable from drawer tip or header)
      if (e.target.closest('#storageHelpBtn') || e.target.closest('#drawerStorageHelpBtn')) {
        $('myDownloadsDrawer')?.classList.remove('visible');
        $('storageHelpModal')?.classList.add('visible');
        return;
      }
      if (e.target.closest('#storageHelpClose') || e.target.closest('#storageHelpDoneBtn')) {
        $('storageHelpModal')?.classList.remove('visible');
        return;
      }

      // App Update Modal (Triggerable from drawer footer or header)
      if (e.target.closest('#appUpdateBtn') || e.target.closest('#drawerUpdateBtn')) {
        $('myDownloadsDrawer')?.classList.remove('visible');
        PWAService.openUpdateModal();
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

      // In-App Viewer Button Click: Route cleanly via history without duplicate execution
      const viewBtn = e.target.closest('.btn-view');
      if (viewBtn) {
        e.preventDefault();
        const href = viewBtn.getAttribute('href');
        const code = viewBtn.dataset.code || '';
        const name = viewBtn.dataset.name || '';
        const prog = viewBtn.dataset.prog || '';
        const level = viewBtn.dataset.level || 'UG';
        const type = viewBtn.dataset.type || 'SLM';
        const examDate = viewBtn.dataset.examdate || '';
        const url = viewBtn.dataset.url || '';

        this._viewerOpenedInSession = true;
        if (href) {
          Router.navigate(href);
        } else {
          const vParams = new URLSearchParams();
          if (code) vParams.set('course', code);
          else if (name) vParams.set('course', name);
          if (type && type !== 'SLM' && type !== 'ALL') vParams.set('type', type.toLowerCase());
          if (url) vParams.set('url', url);
          if (name) vParams.set('name', name);
          if (prog) vParams.set('prog', prog);
          if (level) vParams.set('level', level);
          if (examDate) vParams.set('examdate', examDate);
          Router.navigate(`/?${vParams.toString()}`);
        }
        return;
      }

      // Hash Navigation
      const navLink = e.target.closest('a[href^="#/"]');
      if (navLink) {
        e.preventDefault();
        Router.navigate(navLink.getAttribute('href').slice(1));
        return;
      }

      // Pin / Unpin Programme Star Click with Smooth Animated FLIP Reordering
      const pinBtn = e.target.closest('.btn-pin-programme');
      if (pinBtn && pinBtn.dataset.prog) {
        e.preventDefault();
        e.stopPropagation();
        const progName = pinBtn.dataset.prog;
        const card = pinBtn.closest('.programme-card');
        const grid = $('grid') || card.parentElement;
        if (!card || !grid) return;

        const isNowPinned = Storage.togglePinProgramme(progName);
        this.showToast(isNowPinned ? `★ Pinned ${formatProgName(progName)} to top` : `Unpinned ${formatProgName(progName)}`);

        // Update star state and card styling immediately
        const svg = pinBtn.querySelector('svg');
        if (isNowPinned) {
          pinBtn.classList.add('active');
          pinBtn.setAttribute('aria-label', 'Unpin programme');
          pinBtn.setAttribute('title', 'Unpin programme');
          if (svg) svg.setAttribute('fill', '#f59e0b');
          card.classList.add('pinned');
        } else {
          pinBtn.classList.remove('active');
          pinBtn.setAttribute('aria-label', 'Pin to top of catalog');
          pinBtn.setAttribute('title', 'Pin to top of catalog');
          if (svg) svg.setAttribute('fill', 'none');
          card.classList.remove('pinned');
        }

        // FLIP Animation: Record first positions of all sibling cards
        const allCards = Array.from(grid.querySelectorAll('.programme-card'));
        const firstPositions = new Map();
        allCards.forEach(c => firstPositions.set(c, c.getBoundingClientRect().top));

        // Reorder DOM in place without destroying DOM nodes or closing open accordions
        if (isNowPinned) {
          const existingPinned = allCards.filter(c => c !== card && c.classList.contains('pinned'));
          if (existingPinned.length > 0) {
            existingPinned[existingPinned.length - 1].after(card);
          } else {
            grid.prepend(card);
          }
        } else {
          // Return card to its natural alphabetical order among unpinned cards
          const unpinned = allCards.filter(c => c !== card && !c.classList.contains('pinned'));
          const targetNext = unpinned.find(c => (c.dataset.prog || '').localeCompare(progName) > 0);
          if (targetNext) {
            targetNext.before(card);
          } else {
            grid.append(card);
          }
        }

        // Calculate deltas and apply inverse transform
        allCards.forEach(c => {
          const first = firstPositions.get(c);
          const last = c.getBoundingClientRect().top;
          const deltaY = first - last;
          if (Math.abs(deltaY) > 1) {
            c.style.transform = `translate3d(0, ${deltaY}px, 0)`;
            c.style.transition = 'none';
          }
        });

        // Force reflow
        void grid.offsetHeight;

        // Play smooth GPU-accelerated transition back to 0
        requestAnimationFrame(() => {
          allCards.forEach(c => {
            c.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
            c.style.transform = 'translate3d(0, 0, 0)';
            const onEnd = () => {
              c.style.transition = '';
              c.style.transform = '';
              c.removeEventListener('transitionend', onEnd);
            };
            c.addEventListener('transitionend', onEnd);
          });
        });

        return;
      }

      // Cross-Category Search Fallback Switcher
      const sfBtn = e.target.closest('#searchFallbackBtn');
      if (sfBtn && sfBtn.dataset.target) {
        e.preventDefault();
        const nextType = sfBtn.dataset.target;
        this.setMaterialType(nextType);
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

      // Download Buttons (Card, Drawer, or Search item) - 1-Click Fast Stream
      const dlBtn = e.target.closest('.btn-download, .course-link');
      if (dlBtn) {
        e.preventDefault();
        const type = dlBtn.dataset.type || 'SLM';
        const code = dlBtn.dataset.code || '';
        const name = dlBtn.dataset.name || '';
        const prog = dlBtn.dataset.prog || '';
        const level = dlBtn.dataset.level || 'UG';
        const examDate = dlBtn.dataset.examdate || '';
        const batch = dlBtn.dataset.batch || '';
        const semester = dlBtn.dataset.semester || '';
        const url = dlBtn.href;

        const itemData = {
          url,
          name,
          code,
          prog,
          level,
          type,
          examDate,
          admissionBatch: batch,
          semester
        };

        // Shift-click opens custom rename/folder modal; standard click downloads directly
        if (e.shiftKey) {
          Downloader.openModal(itemData);
        } else {
          Downloader.startDirectDownload(itemData);
        }
        return;
      }

      // Share Buttons
      const shareBtn = e.target.closest('.btn-share');
      if (shareBtn) {
        e.preventDefault();
        this.shareContent(shareBtn.dataset.name, shareBtn.dataset.url, shareBtn.dataset.type || 'SLM', shareBtn.dataset.code || '');
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

      // Category Pill Click (Level filter)
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

      // Global Expand / Collapse All (Single Minimal Button)
      if (e.target.closest('#toggleAll')) { this.toggleAll(); return; }
    });

    // Prevent Ctrl + wheel or multi-touch pinch on viewer panel from zooming the parent platform window
    const viewerPanel = $('viewerPanel');
    if (viewerPanel) {
      viewerPanel.addEventListener('wheel', e => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        }
      }, { passive: false });
      viewerPanel.addEventListener('touchstart', e => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
      viewerPanel.addEventListener('touchmove', e => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    // Coordinate safe reader back navigation and filter sync from embedded iframe
    window.addEventListener('message', e => {
      if (!e.data) return;
      if (e.data.type === 'READER_BACK') {
        this.hideViewerPanel(true);
      } else if (e.data.type === 'sgou-reader-filter-sync') {
        const mode = e.data.filter;
        const btn = $('viewerPanelFilter');
        if (btn) {
          btn.classList.remove('filter-active');
          if (mode === 'sepia' || mode === 'dark') btn.classList.add('filter-active');
        }
      }
    });
  }
}

const UI = new UIController();

// ============================================================================
//  8B. PWA SERVICE (Lifecycle, Zero-Data-Loss Updates & WebAPK Sync)
// ============================================================================

const PWAService = {
  APP_VERSION: 'v2026.10.07',
  BUILD_ID: '20261007_03',
  registration: null,
  isRefreshing: false,
  _checkingUpdate: false,

  /**
   * Safeguards and backs up all student data from localStorage.
   * Ensures personal downloads history and settings can never be lost.
   * @returns {Object} Backup snapshot of student data
   */
  backupUserData() {
    const backup = {};
    const keys = ['sgou-theme-v2', 'sgou-theme', 'sgou-recent', 'sgou-dl-history', 'sgou-dl-count', 'sgou-saved-dir', 'sgou-install-dismissed'];
    try {
      keys.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) backup[k] = v;
      });
    } catch (_) {}
    return backup;
  },

  /**
   * Verifies and restores student data from backup if ever needed.
   * @param {Object} backup - Backup snapshot
   */
  restoreUserData(backup) {
    if (!backup || typeof backup !== 'object') return;
    try {
      Object.entries(backup).forEach(([k, v]) => {
        if (localStorage.getItem(k) === null && v !== null) {
          localStorage.setItem(k, v);
        }
      });
    } catch (_) {}
  },

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      this.registration = reg;

      // 1. Proactive update check on startup
      this.checkForUpdate();

      // 2. Check for update when app returns to foreground (vital for mobile PWA / WebAPK)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkForUpdate();
        }
      });

      // 3. Check for update when device regains network
      window.addEventListener('online', () => {
        this.checkForUpdate();
      });

      // 4. Periodic background check every 30 minutes
      setInterval(() => {
        this.checkForUpdate();
      }, 30 * 60 * 1000);

      // 5. If a new worker is already waiting to take over
      if (reg.waiting) {
        this.notifyUpdate(reg.waiting);
      }

      // 6. Listen for incoming updates
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            this.notifyUpdate(installing);
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] Service worker registration failed:', err);
    }
  },

  init() {
    this.bindUI();

    if (!('serviceWorker' in navigator)) return;

    if (document.readyState === 'complete') {
      this.registerServiceWorker();
    } else {
      window.addEventListener('load', () => this.registerServiceWorker());
    }

    // 7. Reload exactly once when a new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        window.location.reload();
      }
    });
  },

  bindUI() {
    // Header update button
    const updateBtn = $('appUpdateBtn');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => this.openUpdateModal());
    }

    // Modal Close buttons
    $('updateModalClose')?.addEventListener('click', () => this.closeUpdateModal());
    $('updateModalDoneBtn')?.addEventListener('click', () => this.closeUpdateModal());

    // Backdrop click close
    const modal = $('updateModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeUpdateModal();
      });
    }

    // Manual check button
    $('btnCheckUpdate')?.addEventListener('click', () => this.checkManualUpdate());

    // Force hard update button
    $('btnForceUpdate')?.addEventListener('click', () => this.forceHardUpdate());

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.classList.contains('visible')) {
        this.closeUpdateModal();
      }
    });
  },

  openUpdateModal() {
    const modal = $('updateModal');
    if (!modal) return;

    const versionLabel = $('appVersionLabel');
    if (versionLabel) {
      versionLabel.textContent = this.APP_VERSION;
    }

    const statusBox = $('updateStatusBox');
    const statusText = $('updateStatusText');
    if (this.registration?.waiting) {
      if (statusBox) statusBox.className = 'update-status-row has-update';
      if (statusText) statusText.textContent = 'Update available! Tap below to install.';
    } else if (statusBox && statusText && !statusBox.classList.contains('has-update') && !statusBox.classList.contains('checking')) {
      statusBox.className = 'update-status-row';
      statusText.textContent = 'Ready to check for updates';
    }

    modal.classList.add('visible');
  },

  closeUpdateModal() {
    const modal = $('updateModal');
    if (modal) modal.classList.remove('visible');
  },

  checkForUpdate() {
    if (this.registration && typeof this.registration.update === 'function') {
      this.registration.update().catch(() => {});
    }
  },

  async checkManualUpdate() {
    if (this._checkingUpdate) return;
    this._checkingUpdate = true;

    const btn = $('btnCheckUpdate');
    const btnText = $('btnCheckUpdateText');
    const statusBox = $('updateStatusBox');
    const statusText = $('updateStatusText');

    if (btn) {
      btn.disabled = true;
      btn.classList.add('spin');
    }
    if (btnText) btnText.textContent = 'Checking...';

    if (statusBox) statusBox.className = 'update-status-row checking';
    if (statusText) statusText.textContent = 'Checking for updates...';

    if (!navigator.onLine) {
      if (statusBox) statusBox.className = 'update-status-row';
      if (statusText) statusText.textContent = 'Device is offline';
      this._checkingUpdate = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('spin');
      }
      if (btnText) btnText.textContent = 'Check for Updates';
      return;
    }

    try {
      // 1. Ensure active registration
      let reg = this.registration;
      if (!reg && 'serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg) this.registration = reg;
      }

      // 2. Network cache-busting probes to ensure fresh responses
      const probeTime = Date.now();
      await Promise.all([
        fetch(`./sw.js?probe=${probeTime}`, { cache: 'no-store' }).catch(() => {}),
        fetch(`./manifest.json?probe=${probeTime}`, { cache: 'no-store' }).catch(() => {})
      ]);

      // 3. If an update is ALREADY waiting to take over
      if (reg?.waiting) {
        if (statusBox) statusBox.className = 'update-status-row has-update';
        if (statusText) statusText.textContent = 'Applying update...';
        this.notifyUpdate(reg.waiting);
        setTimeout(() => {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }, 500);
        return;
      }

      // 4. Trigger SW update check
      if (reg && typeof reg.update === 'function') {
        await reg.update();
      }

      // 5. If a new worker was detected and is currently installing (downloading shell assets)
      const installingWorker = reg?.installing;
      if (installingWorker) {
        if (statusBox) statusBox.className = 'update-status-row checking';
        if (statusText) statusText.textContent = 'Downloading update package...';

        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 8000);
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' || installingWorker.state === 'redundant') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }

      // 6. Check again if a new worker is waiting after update check/install
      if (reg?.waiting) {
        if (statusBox) statusBox.className = 'update-status-row has-update';
        if (statusText) statusText.textContent = 'New update ready! Reloading...';
        this.notifyUpdate(reg.waiting);
        setTimeout(() => {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }, 500);
        return;
      }

      // 7. Genuinely up to date
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (statusBox) statusBox.className = 'update-status-row';
      if (statusText) statusText.textContent = `Up to date (${nowStr})`;
      $('updateBadgeDot')?.style.setProperty('display', 'none');
    } catch (err) {
      if (statusBox) statusBox.className = 'update-status-row';
      if (statusText) statusText.textContent = 'Check failed. Retry later.';
    } finally {
      this._checkingUpdate = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('spin');
      }
      if (btnText) btnText.textContent = 'Check for Updates';
    }
  },

  /**
   * Forces a complete application re-sync:
   * Wipes ONLY CacheStorage, leaves student LocalStorage 100% untouched.
   */
  async forceHardUpdate() {
    const btn = $('btnForceUpdate');
    const statusText = $('updateStatusText');
    const statusBox = $('updateStatusBox');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Clearing cache...';
    }

    if (statusBox) statusBox.className = 'update-status-row checking';
    if (statusText) statusText.textContent = 'Clearing cache & reloading...';

    // 1. Create safety snapshot of student data
    const backup = this.backupUserData();

    try {
      // 2. Clear all CacheStorage entries strictly (Service Worker HTTP assets)
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 3. Unregister existing service worker to force fresh registration
      if (this.registration) {
        await this.registration.unregister().catch(() => {});
      } else if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => {});
        if (reg) await reg.unregister().catch(() => {});
      }

      // 4. Verify LocalStorage safety snapshot
      this.restoreUserData(backup);

      if (statusText) statusText.textContent = 'Cache cleared! Reloading fresh application...';

      // 5. Force fresh reload cleanly from origin path
      setTimeout(() => {
        window.location.replace(window.location.pathname);
      }, 500);
    } catch (err) {
      this.restoreUserData(backup);
      window.location.replace(window.location.pathname);
    }
  },

  notifyUpdate(worker) {
    // Reveal pulsing badge on drawer update button
    const dot = $('updateBadgeDot');
    if (dot) dot.style.display = 'inline-block';

    const statusBox = $('updateStatusBox');
    const statusText = $('updateStatusText');
    if (statusBox) statusBox.className = 'update-status-row has-update';
    if (statusText) statusText.textContent = 'New update is ready to install!';

    UI.showUpdateToast(() => {
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      } else if (this.registration?.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }
};

// ============================================================================
//  9. APPLICATION BOOTSTRAPPER (Service Worker & Life Cycle)
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  UI.init();
  Router.init();
  PWAService.init();

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
      const isOff = !navigator.onLine;
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>Could not load syllabus database.</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:6px">${isOff ? 'Your device appears to be offline. Reconnect and tap retry below.' : 'Ensure network connection is stable or refresh to reconnect.'}</div>
          <button class="empty-category-btn" style="margin-top:1.25rem;display:inline-flex;align-items:center;gap:6px" onclick="window.location.reload()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Retry Connection</span>
          </button>
        </div>`;
    }
  }
});

// ============================================================================
//  10. GLOBAL RESILIENCE & ERROR BOUNDARIES
// ============================================================================
window.addEventListener('error', (e) => {
  console.warn('[SGOU Resilient Boundary] Recovered from runtime error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.warn('[SGOU Resilient Boundary] Handled unhandled rejection:', e.reason);
});

