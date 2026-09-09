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
            title: cleanT || `${sKey.title()} Assignment Booklet`,
            clean_title: cleanT || `${sKey.title()} Assignment Booklet`,
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

    let cleanDefault;
    if (itemType === 'PYQ') {
      cleanDefault = (item.code ? item.code + '_' : '') + sanitize(item.name || 'exam_paper') + '_PYQ' + (item.examDate ? '_' + sanitize(item.examDate) : '');
      if (titleEl) titleEl.textContent = 'Download Question Paper';
      if (subtitleEl) subtitleEl.textContent = 'Previous Year Exam Paper';
    } else if (itemType === 'ASSIGNMENT') {
      cleanDefault = sanitize(item.prog || 'SGOU') + '_' + sanitize(item.semester || 'Semester') + '_Assignment';
      if (titleEl) titleEl.textContent = 'Download Assignment';
      if (subtitleEl) subtitleEl.textContent = 'Official Semester Assignment Questions';
    } else {
      cleanDefault = (item.code ? item.code + '_' : '') + sanitize(item.name || 'document') + '_SLM';
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
    history.pushState({ url: target }, '', target);
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
    } else if (/^[A-Z0-9_-]+$/i.test(path) && !path.includes('/')) {
      newParams.set('course', decodeURIComponent(path));
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
      const cleanUrl = this._convertHashToCleanUrl(rawHash);
      history.replaceState(null, '', cleanUrl);
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

      Analytics.trackPageView(window.location.pathname + window.location.search, `${docName} (${courseCode}) — SGOU Academic Database`);
      Analytics.trackViewItem({
        code: courseCode,
        name: docName,
        type: qType,
        prog: docProg,
        level: docLevel
      });

      let pdfUrl = params.get('url') || '';
      if (!pdfUrl && item) {
        if (qType === 'PYQ' && item.course.pyqs && item.course.pyqs.length > 0) {
          const matchedPyq = (qExam ? item.course.pyqs.find(p => p.exam_date === qExam) : null) || item.course.pyqs[0];
          pdfUrl = matchedPyq?.pdf_url || item.course.pdf_url;
        } else {
          pdfUrl = item.course.pdf_url;
        }
      }

      UI.showViewerPanel(pdfUrl, docName, item ? item.course.code : courseCode, docProg, docLevel, qType, qExam);
      this.isResolving = false;
      return;
    }

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
      meta.setAttribute('content', isDark ? '#13110f' : '#1a1714');
    }
    const toggleBtn = $('themeToggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggleBtn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) {
      ogImg.setAttribute('content', isDark
        ? 'https://sgou-slm-database.vercel.app/og-image-dark.png?v=20260909'
        : 'https://sgou-slm-database.vercel.app/og-image.png?v=20260909');
    }
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg) {
      twitterImg.setAttribute('content', isDark
        ? 'https://sgou-slm-database.vercel.app/og-image-dark.png?v=20260909'
        : 'https://sgou-slm-database.vercel.app/og-image.png?v=20260909');
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

      const matches = Search.search(q, this.activeLevel, this.activeType);

      if (!matches.length) {
        const typeWord = this.activeType === 'PYQ' ? 'question papers' : this.activeType === 'ASSIGNMENT' ? 'assignments' : this.activeType === 'SLM' ? 'course textbooks' : 'materials';
        results.innerHTML = `
          <div class="search-results-header">No results</div>
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            No ${typeWord} match &ldquo;${esc(q)}&rdquo;
          </div>`;
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

      const vUrl = `/?course=${encodeURIComponent(item.code || item.name)}${type && type !== 'SLM' ? '&type=' + encodeURIComponent(type.toLowerCase()) : ''}${item.examDate ? '&examdate=' + encodeURIComponent(item.examDate) : ''}`;

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

    grid.innerHTML = programmesList.map((prog, idx) => {
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

      return `
        <div class="programme-card" data-level="${ea(prog.level)}" data-idx="${idx}" role="listitem">
          <div class="card-header" role="button" tabindex="0" aria-expanded="false" aria-controls="cb-${idx}">
            <div class="card-header-main">
              <div class="card-badge-row">
                <span class="level-tag level-${ea(prog.level.toLowerCase())}">${esc(prog.level)}</span>
                <span class="card-meta-text">${metaParts.join(' &middot; ')}</span>
              </div>
              <h2 class="programme-title">${hl(formatProgName(prog.programme_name), query)}</h2>
            </div>
            <div class="card-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="card-body" id="cb-${idx}" aria-hidden="true">
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
                      const vUrlAsgn = `/?course=${encodeURIComponent(prog.programme_name + '_' + s.semester)}&type=assignment`;
                      return `
                        <div class="course-item asgn-mode">
                          <div class="course-main-row">
                            <div class="course-header-group">
                              <span class="course-code asgn-code">BOOKLET</span>
                              <span class="course-name">${esc(s.semester)} Assignment Booklet</span>
                            </div>
                            <span class="asgn-count-chip">1 Booklet</span>
                          </div>
                          <div class="course-pyq-drawer open">
                            <div class="pyq-paper-item asgn-paper-item">
                              <div class="pyq-paper-info">
                                <span class="asgn-pill">CIA QUESTIONS</span>
                                <span class="pyq-batch-tag">Continuous Internal Assessment</span>
                              </div>
                              <div class="pyq-paper-actions">
                                <a class="btn-view" href="${ea(vUrlAsgn)}" title="View Assignment Booklet PDF" data-type="ASSIGNMENT" data-code="${ea(prog.programme_name + '_' + s.semester)}" data-name="${ea(asgn.title)}" data-prog="${ea(prog.programme_name)}" data-level="${ea(prog.level)}" data-url="${ea(asgn.pdf_url)}">
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
                            const vUrlPyq = `/?course=${encodeURIComponent(course.code || course.name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}`;
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
                          const vUrlG = `/?course=${encodeURIComponent(py.code || py.clean_name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}`;
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
                      const vUrl = `/?course=${encodeURIComponent(course.code || course.name)}`;
                      return `
                        <div class="course-item">
                          <div class="course-main-row">
                            <div class="course-header-group">
                              <span class="course-code">${esc(course.code)}</span>
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
                    const vUrlAsgn = `/?course=${encodeURIComponent(prog.programme_name + '_' + s.semester)}&type=assignment`;
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
                    const vUrl = `/?course=${encodeURIComponent(course.code || course.name)}`;
                    const hasPyqs = course.pyqs && course.pyqs.length > 0;

                    return `
                      <div class="course-item">
                        <div class="course-main-row">
                          <div class="course-header-group">
                            <span class="course-code">${esc(course.code)}</span>
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
                                const vUrlPyq = `/?course=${encodeURIComponent(course.code || course.name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}`;
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
                        const vUrlG = `/?course=${encodeURIComponent(py.code || py.clean_name)}&type=pyq${py.exam_date ? '&examdate=' + encodeURIComponent(py.exam_date) : ''}`;
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

    panel._data = { url: pdfUrl, name, code, prog, level, type, examDate };
    panel.classList.add('visible');
    document.body.classList.add('viewer-panel-open');

    // Sync clean course URL without hash or path prefix
    const viewParams = new URLSearchParams();
    if (code) viewParams.set('course', code);
    else if (name) viewParams.set('course', name);
    if (type && type !== 'SLM' && type !== 'ALL') viewParams.set('type', type.toLowerCase());
    if (examDate) viewParams.set('examdate', examDate);
    Router.updateUrlSilently(`/?${viewParams.toString()}`);

    // Hardware-accelerated direct PDF preview without creating secondary iframe history entry
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
      const fullUrl = pdfUrl + '#toolbar=1&navpanes=0';
      try {
        if (frame.contentWindow) {
          frame.contentWindow.location.replace(fullUrl);
        } else {
          frame.src = fullUrl;
        }
      } catch (e) {
        frame.src = fullUrl;
      }
      setTimeout(onReady, 3500);
    }
  }

  hideViewerPanel(syncUrl = true) {
    const panel = $('viewerPanel');
    if (!panel) return;
    panel.classList.remove('visible');
    document.body.classList.remove('viewer-panel-open');
    const frame = $('viewerPanelFrame');
    if (frame) {
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
    if (syncUrl) this.syncUrlFromState(false);
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
            <a class="my-dl-btn" href="${ea(h.url)}" target="_blank" rel="noopener noreferrer">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Open
            </a>
          </div>
        </div>
      `;
    }).join('');
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

    // Polished, authoritative academic share card
    const text = `${name}${cleanCode ? ' (' + cleanCode + ')' : ''} — ${typeLabel}\n${cleanProg} · SNGOU\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} — SGOU Database`, text });
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
    $('searchClear')?.classList.toggle('visible', query.length > 0);

    if (lChanged) {
      this.activeLevel = level;
      document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.level === this.activeLevel));
    }

    if (tChanged) {
      this.activeType = type;
      document.querySelectorAll('.material-type-switcher .type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.type === this.activeType));
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

    if (isInstalled) {
      banner.style.display = 'none';
      return;
    }

    // Capture beforeinstallprompt event if available
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      Analytics.trackPWA('prompt_available');
      banner.classList.add('visible');
    });

    // Appear on every reload until it gets installed
    setTimeout(() => {
      banner.classList.add('visible');
    }, 600);

    window.addEventListener('appinstalled', () => {
      Analytics.trackPWA('installed');
      banner.classList.remove('visible');
      banner.style.display = 'none';
      Storage.set('sgou-app-installed', '1');
      this.showToast('SGOU Database successfully installed!');
    });

    $('installBtn')?.addEventListener('click', async () => {
      const promptEvent = window.deferredInstallPrompt;
      if (promptEvent) {
        banner.classList.remove('visible');
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
      banner.classList.remove('visible');
      Analytics.trackPWA('prompt_dismissed');
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

      // Material Type Switcher (Tier 1 filter)
      const typeBtn = e.target.closest('.material-type-switcher .type-btn');
      if (typeBtn && typeBtn.dataset.type) {
        this.activeType = typeBtn.dataset.type;
        document.querySelectorAll('.material-type-switcher .type-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.type === this.activeType));
        Analytics.trackFilter('type_' + this.activeType);
        this.executeSearch();
        this.syncUrlFromState();
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

      // Viewer Back
      if (e.target.closest('#viewerBack')) {
        if (this.navLock) return;
        this.navLock = true;
        if (window.history.length > 1) {
          history.back();
        } else {
          Router.navigate('/');
        }
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
          this.shareContent(panel._data.name, panel._data.url, panel._data.type, panel._data.code);
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

      // In-App Viewer Button Click
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

        if (url) {
          Router.navigate(href);
          this.showViewerPanel(url, name, code, prog, level, type, examDate);
        } else if (href) {
          Router.navigate(href);
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

      // Download Buttons (Card, Drawer, or Search item)
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

        Downloader.openModal({
          url,
          name,
          code,
          prog,
          level,
          type,
          examDate,
          admissionBatch: batch,
          semester
        });
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
  }
}

const UI = new UIController();

// ============================================================================
//  8B. PWA SERVICE (Lifecycle, Zero-Data-Loss Updates & WebAPK Sync)
// ============================================================================

const PWAService = {
  APP_VERSION: 'v2026.09.04',
  BUILD_ID: '20260904_10',
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

  init() {
    this.bindUI();

    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
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
        })
        .catch(err => {
          console.warn('[PWA] Service worker registration failed:', err);
        });

      // 7. Reload exactly once when a new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          window.location.reload();
        }
      });
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

    try {
      const probeTime = Date.now();
      await Promise.all([
        fetch(`./sw.js?probe=${probeTime}`, { cache: 'no-store' }).catch(() => {}),
        fetch(`./manifest.json?probe=${probeTime}`, { cache: 'no-store' }).catch(() => {})
      ]);

      if (this.registration && typeof this.registration.update === 'function') {
        await this.registration.update();
      }

      if (this.registration?.waiting) {
        if (statusBox) statusBox.className = 'update-status-row has-update';
        if (statusText) statusText.textContent = 'Updating app...';
        this.notifyUpdate(this.registration.waiting);
        setTimeout(() => {
          this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }, 600);
        return;
      }

      await new Promise(r => setTimeout(r, 1000));

      if (this.registration?.waiting) {
        if (statusBox) statusBox.className = 'update-status-row has-update';
        if (statusText) statusText.textContent = 'Reloading app...';
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (statusBox) statusBox.className = 'update-status-row';
      if (statusText) statusText.textContent = `Up to date (${nowStr})`;
      $('updateBadgeDot')?.style.setProperty('display', 'none');
    } catch (err) {
      if (statusBox) statusBox.className = 'update-status-row';
      if (statusText) statusText.textContent = 'Offline / check failed';
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
      }

      // 4. Verify LocalStorage safety snapshot
      this.restoreUserData(backup);

      if (statusText) statusText.textContent = 'Cache cleared! Reloading fresh application...';

      // 5. Force fresh reload from server
      setTimeout(() => {
        window.location.replace('/?updated=' + Date.now());
      }, 500);
    } catch (err) {
      this.restoreUserData(backup);
      window.location.reload();
    }
  },

  notifyUpdate(worker) {
    // Reveal pulsing badge on header update button
    const dot = $('updateBadgeDot');
    if (dot) dot.style.display = 'block';

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

// ============================================================================
//  10. GLOBAL RESILIENCE & ERROR BOUNDARIES
// ============================================================================
window.addEventListener('error', (e) => {
  console.warn('[SGOU Resilient Boundary] Recovered from runtime error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.warn('[SGOU Resilient Boundary] Handled unhandled rejection:', e.reason);
});

