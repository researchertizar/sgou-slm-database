/**
 * SGOU Academic Database — AI Study Companion
 * Modularized Client Component for reader.html
 * 
 * Features:
 * - 4 Modes: Explain in Malayalam, Simple English, Exam Questions, Revision / Recap.
 * - Zero-Token Multi-Tier Caching: Device localStorage + Edge D1 SQLite.
 * - 15-Day Server TTL Invalidation.
 * - Client-Side HTML5 Canvas Screenshot Compression (<40KB) for Free Gemini Flash Verification.
 * - 5 Queries/Day Free Quota with Support Modal Monetization Bridge.
 */

(function (window, document) {
  'use strict';

  var CONFIG = {
    cachePrefix: 'sgou_ai_cache_v2_',
    supporterKey: 'sgou_supporter_pass_v1',
    dailyQuotaKey: 'sgou_ai_daily_quota_v1',
    dailyFreeLimit: 5,
    ttlMs: 15 * 86400 * 1000 // 15 Days in milliseconds
  };

  var state = {
    isOpen: false,
    activeMode: null, // 'malayalam' | 'english' | 'questions' | 'revision'
    courseCode: '',
    courseTitle: '',
    unitNumber: 1,
    pageNumber: 1,
    selectedText: '',
    isSupporter: false,
    supporterPlan: null,
    sheetEl: null,
    backdropEl: null,
    contentEl: null,
    blankStateEl: null,
    quotaCardEl: null,
    quotaBadgeEl: null,
    pillBtns: [],
    fileInputEl: null
  };

  /**
   * Helper: Generate SHA-256 Hex Hash
   */
  async function sha256(str) {
    if (window.crypto && window.crypto.subtle) {
      try {
        var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (_) {}
    }
    // Fallback simple hash string
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash);
  }

  /**
   * Helper: Get Daily Quota Usage
   */
  function getDailyQuota() {
    var todayStr = new Date().toISOString().slice(0, 10);
    try {
      var raw = localStorage.getItem(CONFIG.dailyQuotaKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.date === todayStr) {
          return parsed.count || 0;
        }
      }
    } catch (_) {}
    return 0;
  }

  /**
   * Helper: Increment Daily Quota
   */
  function incrementDailyQuota() {
    var todayStr = new Date().toISOString().slice(0, 10);
    var count = getDailyQuota() + 1;
    try {
      localStorage.setItem(CONFIG.dailyQuotaKey, JSON.stringify({ date: todayStr, count: count }));
    } catch (_) {}
    updateQuotaBadge();
    return count;
  }

  /**
   * Helper: Check Supporter Status
   */
  function checkSupporterStatus() {
    try {
      var raw = localStorage.getItem(CONFIG.supporterKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.expires_at && new Date(parsed.expires_at).getTime() > Date.now()) {
          state.isSupporter = true;
          state.supporterPlan = parsed;
          return true;
        }
      }
    } catch (_) {}
    state.isSupporter = false;
    state.supporterPlan = null;
    return false;
  }

  /**
   * Update Quota Badge Text in Header
   */
  function updateQuotaBadge() {
    if (!state.quotaBadgeEl) return;
    if (checkSupporterStatus()) {
      state.quotaBadgeEl.textContent = '✨ ' + (state.supporterPlan.plan || 'Pass Active');
      state.quotaBadgeEl.classList.add('supporter-active');
    } else {
      var used = getDailyQuota();
      var remaining = Math.max(0, CONFIG.dailyFreeLimit - used);
      state.quotaBadgeEl.textContent = remaining + '/' + CONFIG.dailyFreeLimit + ' free today';
      state.quotaBadgeEl.classList.remove('supporter-active');
    }
  }

  /**
   * Simple Safe Markdown to HTML Parser
   */
  function renderMarkdown(md) {
    if (!md) return '';
    var esc = function (s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    var lines = md.split('\n');
    var html = [];
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        if (inList) { html.push('</ul>'); inList = false; }
        continue;
      }

      if (line.startsWith('#### ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<h4>' + esc(line.slice(5)) + '</h4>');
      } else if (line.startsWith('### ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<h3>' + esc(line.slice(4)) + '</h3>');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { html.push('<ul>'); inList = true; }
        var itemContent = line.slice(2);
        itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        itemContent = itemContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        html.push('<li>' + itemContent + '</li>');
      } else if (/^\d+\.\s/.test(line)) {
        var numContent = line.replace(/^\d+\.\s*/, '');
        numContent = numContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        numContent = numContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        html.push('<p><strong>' + line.match(/^\d+\./)[0] + '</strong> ' + numContent + '</p>');
      } else {
        if (inList) { html.push('</ul>'); inList = false; }
        var pContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        pContent = pContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        html.push('<p>' + pContent + '</p>');
      }
    }
    if (inList) html.push('</ul>');
    return html.join('');
  }

  /**
   * Extract Text from Current Rendered PDF Page
   */
  function extractCurrentUnitText() {
    if (state.selectedText && state.selectedText.trim()) {
      return state.selectedText.trim();
    }
    var pageNum = state.pageNumber || 1;
    var wrap = document.getElementById('pageWrap-' + pageNum);
    if (!wrap) return '';
    var spans = wrap.querySelectorAll('.textLayer span');
    var text = Array.from(spans).map(function (s) { return s.textContent; }).join(' ');
    return text.slice(0, 4500).trim();
  }

  var AiCompanion = {
    /**
     * Initialize AI Companion UI and Event Listeners
     */
    init: function (options) {
      options = options || {};
      state.courseCode = options.courseCode || '';
      state.courseTitle = options.courseTitle || '';

      state.sheetEl = document.getElementById('aiCompanionSheet');
      state.backdropEl = document.getElementById('aiSheetBackdrop');
      state.contentEl = document.getElementById('aiSheetContent');
      state.blankStateEl = document.getElementById('aiSheetBlankState');
      state.quotaCardEl = document.getElementById('aiSheetQuotaCard');
      state.quotaBadgeEl = document.getElementById('aiQuotaBadge');
      state.fileInputEl = document.getElementById('aiReceiptUploadInput');
      state.pillBtns = document.querySelectorAll('.ai-pill-btn');

      checkSupporterStatus();
      updateQuotaBadge();

      // Close handlers
      var closeBtn = document.getElementById('aiSheetCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', AiCompanion.close);
      if (state.backdropEl) state.backdropEl.addEventListener('click', AiCompanion.close);

      // Pill Click Handlers
      state.pillBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mode = btn.getAttribute('data-mode');
          AiCompanion.selectMode(mode);
        });
      });

      // Bottom bar open button
      var openBtn = document.getElementById('aiCompanionBtn');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          AiCompanion.open();
        });
      }

      // Selection pill trigger
      var explainSelectionBtn = document.getElementById('aiExplainSelectionBtn');
      if (explainSelectionBtn) {
        explainSelectionBtn.addEventListener('click', function () {
          var sel = window.getSelection ? window.getSelection().toString() : '';
          AiCompanion.open('malayalam', sel);
        });
      }

      // Quota Support Modal Bridge
      var quotaSupportBtn = document.getElementById('aiQuotaSupportBtn');
      if (quotaSupportBtn) {
        quotaSupportBtn.addEventListener('click', function () {
          if (window.SupportModal && typeof window.SupportModal.open === 'function') {
            window.SupportModal.open(25, quotaSupportBtn, 'ai_limit');
          }
        });
      }

      // Receipt Upload Handler (Canvas Compression)
      var uploadReceiptBtn = document.getElementById('aiUploadReceiptBtn');
      if (uploadReceiptBtn && state.fileInputEl) {
        uploadReceiptBtn.addEventListener('click', function () {
          state.fileInputEl.click();
        });

        state.fileInputEl.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (file) {
            AiCompanion.verifyScreenshot(file);
          }
        });
      }

      // Keyboard shortcut (Escape to close, Alt+A to toggle)
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.isOpen) {
          AiCompanion.close();
        } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          if (state.isOpen) AiCompanion.close();
          else AiCompanion.open();
        }
      });
    },

    /**
     * Set Current Document Page and Course Context
     */
    setContext: function (courseCode, courseTitle, pageNumber, unitNumber) {
      if (courseCode) state.courseCode = courseCode;
      if (courseTitle) state.courseTitle = courseTitle;
      if (pageNumber) state.pageNumber = pageNumber;
      if (unitNumber) state.unitNumber = unitNumber;
    },

    /**
     * Open Slide-up Bottom Sheet
     */
    open: function (initialMode, customText) {
      if (!state.sheetEl) return;
      state.isOpen = true;
      state.selectedText = customText || '';
      state.sheetEl.classList.add('visible', 'active');
      state.sheetEl.setAttribute('aria-hidden', 'false');

      updateQuotaBadge();

      if (initialMode) {
        AiCompanion.selectMode(initialMode);
      } else {
        // Initial state is completely blank
        AiCompanion.resetToBlankState();
      }

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'ai_sheet_open', { course: state.courseCode, page: state.pageNumber });
      }
    },

    /**
     * Close Slide-up Bottom Sheet
     */
    close: function () {
      if (!state.sheetEl) return;
      state.isOpen = false;
      state.sheetEl.classList.remove('visible', 'active');
      state.sheetEl.setAttribute('aria-hidden', 'true');
    },

    /**
     * Reset Content View to Minimal Blank State
     */
    resetToBlankState: function () {
      state.activeMode = null;
      state.pillBtns.forEach(function (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      if (state.blankStateEl) state.blankStateEl.style.display = 'flex';
      if (state.contentEl) {
        state.contentEl.style.display = 'none';
        state.contentEl.innerHTML = '';
      }
      if (state.quotaCardEl) state.quotaCardEl.style.display = 'none';
    },

    /**
     * Select One of the 4 Modes (Malayalam, English, Questions, Revision)
     */
    selectMode: async function (mode) {
      state.activeMode = mode;

      state.pillBtns.forEach(function (btn) {
        var isActive = btn.getAttribute('data-mode') === mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (state.blankStateEl) state.blankStateEl.style.display = 'none';
      if (state.quotaCardEl) state.quotaCardEl.style.display = 'none';
      if (state.contentEl) {
        state.contentEl.style.display = 'block';
        state.contentEl.innerHTML = (
          '<div class="ai-shimmer-wrap">' +
            '<div class="ai-shimmer-line" style="width: 45%;"></div>' +
            '<div class="ai-shimmer-line" style="width: 90%;"></div>' +
            '<div class="ai-shimmer-line" style="width: 78%;"></div>' +
            '<div class="ai-shimmer-line" style="width: 60%;"></div>' +
          '</div>'
        );
      }

      await AiCompanion.fetchOrGenerate(mode);
    },

    /**
     * Core Fetch or Generate Engine (Multi-Tier Zero-Token Caching)
     */
    fetchOrGenerate: async function (mode) {
      var course = state.courseCode || 'SGOU';
      var unit = state.unitNumber || 1;
      var textSnippet = extractCurrentUnitText();
      var rawKey = course + ':' + unit + ':' + mode + (state.selectedText ? ':' + state.selectedText.slice(0, 60) : '');
      var cacheKey = await sha256(rawKey);
      var localKey = CONFIG.cachePrefix + cacheKey;

      // 1. Tier 1: Device localStorage Check (<15 Days)
      try {
        var localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          var localItem = JSON.parse(localRaw);
          var age = Date.now() - (localItem.cached_at || 0);
          if (age < CONFIG.ttlMs && localItem.markdown) {
            AiCompanion.displayContent(localItem.markdown, false);
            return;
          }
        }
      } catch (_) {}

      // 2. Tier 2: Edge D1 Cache Passive Lookup (Zero-compute)
      try {
        var edgeResp = await fetch('/api/ai-tutor?key=' + encodeURIComponent(cacheKey));
        if (edgeResp.ok) {
          var edgeData = await edgeResp.json();
          if (edgeData.hit && edgeData.content_markdown) {
            var edgeAge = Date.now() - (edgeData.cached_at || 0);
            if (edgeAge < CONFIG.ttlMs) {
              // Valid edge cache: save locally and render (0 tokens burned!)
              try {
                localStorage.setItem(localKey, JSON.stringify({ markdown: edgeData.content_markdown, cached_at: edgeData.cached_at }));
              } catch (_) {}
              AiCompanion.displayContent(edgeData.content_markdown, false);
              return;
            }
          }
        }
      } catch (_) {}

      // 3. Cache MISS or EXPIRED (>15 days): Check Quota Before Calling AI
      var isSupporter = checkSupporterStatus();
      if (!isSupporter && getDailyQuota() >= CONFIG.dailyFreeLimit) {
        AiCompanion.showQuotaCard();
        return;
      }

      // 4. Generate Fresh Response via Gemini Flash
      try {
        var genResp = await fetch('/api/ai-tutor/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_code: course,
            course_title: state.courseTitle,
            unit_number: unit,
            prompt_type: mode,
            unit_text: textSnippet,
            passkey: state.supporterPlan ? state.supporterPlan.passkey : ''
          })
        });

        if (!genResp.ok) {
          if (genResp.status === 429) {
            AiCompanion.showQuotaCard();
            return;
          }
          throw new Error('AI generation request failed (' + genResp.status + ')');
        }

        var genData = await genResp.json();
        if (genData.success && genData.content_markdown) {
          if (!isSupporter) {
            incrementDailyQuota();
          }

          try {
            localStorage.setItem(localKey, JSON.stringify({
              markdown: genData.content_markdown,
              cached_at: genData.cached_at || Date.now()
            }));
          } catch (_) {}

          AiCompanion.displayContent(genData.content_markdown, true);
        } else {
          throw new Error(genData.error || 'Empty response');
        }
      } catch (err) {
        if (state.contentEl) {
          state.contentEl.innerHTML = (
            '<div style="color:var(--ai-sheet-accent);padding:12px 0;">' +
              '<strong>Notice:</strong> Could not load study breakdown. Please check your connection and try again.' +
            '</div>'
          );
        }
      }
    },

    /**
     * Display Rendered Markdown Content with Action Buttons
     */
    displayContent: function (markdown, isFresh) {
      if (!state.contentEl) return;
      var html = renderMarkdown(markdown);
      html += (
        '<div class="ai-content-toolbar">' +
          '<button type="button" class="ai-action-btn" id="aiCopyContentBtn" title="Copy breakdown">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
            '<span id="aiCopyBtnText">Copy</span>' +
          '</button>' +
        '</div>'
      );

      state.contentEl.innerHTML = html;

      var copyBtn = document.getElementById('aiCopyContentBtn');
      var copyText = document.getElementById('aiCopyBtnText');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(markdown).then(function () {
              if (copyText) copyText.textContent = 'Copied!';
              setTimeout(function () { if (copyText) copyText.textContent = 'Copy'; }, 2000);
            });
          }
        });
      }
    },

    /**
     * Show Quota Limit Card with Support Modal Bridge
     */
    showQuotaCard: function () {
      if (state.contentEl) state.contentEl.style.display = 'none';
      if (state.blankStateEl) state.blankStateEl.style.display = 'none';
      if (state.quotaCardEl) state.quotaCardEl.style.display = 'block';
    },

    /**
     * Client-Side HTML5 Canvas Compression (<40KB) & Gemini Flash Receipt Verification
     */
    verifyScreenshot: function (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          // Downscale to max 700px width on offscreen canvas
          var maxW = 700;
          var scale = Math.min(1, maxW / img.width);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to lightweight JPEG (typically 25KB to 40KB)
          var compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);

          if (state.contentEl) {
            state.contentEl.style.display = 'block';
            state.contentEl.innerHTML = (
              '<div style="text-align:center;padding:20px 0;">' +
                '<div class="spinner" style="margin:0 auto 10px;"></div>' +
                '<div>Verifying payment receipt via AI Vision&hellip;</div>' +
              '</div>'
            );
          }
          if (state.quotaCardEl) state.quotaCardEl.style.display = 'none';

          fetch('/api/support/verify-screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              screenshot_base64: compressedBase64,
              user_id: 'user_' + (navigator.userAgent.slice(0, 15).replace(/\W/g, ''))
            })
          })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res.success) {
              // Store supporter token in localStorage
              localStorage.setItem(CONFIG.supporterKey, JSON.stringify({
                plan: res.plan,
                plan_type: res.plan_type,
                passkey: res.passkey,
                expires_at: res.expires_at,
                utr: res.utr_number
              }));

              state.isSupporter = true;
              state.supporterPlan = res;
              updateQuotaBadge();

              if (window.Toast && typeof window.Toast.show === 'function') {
                window.Toast.show('🎉 ' + res.plan + ' Unlocked! Thank you for supporting.');
              }

              // Auto-run previous selected mode
              if (state.activeMode) {
                AiCompanion.selectMode(state.activeMode);
              } else {
                AiCompanion.selectMode('malayalam');
              }
            } else {
              alert('Verification issue: ' + (res.error || 'Please ensure receipt is from PhonePe/GPay to ahayas.info@oksbi'));
              AiCompanion.showQuotaCard();
            }
          })
          .catch(function (err) {
            alert('Verification request failed. Please check your internet connection.');
            AiCompanion.showQuotaCard();
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  window.AiCompanion = AiCompanion;

})(window, document);
