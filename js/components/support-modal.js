/**
 * SGOU Academic Database — Reusable Support & Donation Modal Component
 * Universal component shared across index.html, view.html, reader.html
 * 
 * Features:
 * - Dynamic situation-aware messaging (Download completion, Document reading, Home exploration)
 * - 1-tap mobile native UPI intent execution
 * - Clean desktop QR code with corner icon controls (download + info popover) + caption
 * - Labeled amount contribution chips (Chai, Server/Popular, Hero, Patron, Custom)
 * - Zero scrolling: strictly compact geometry (<= 355px content height)
 * - Strict zero-emoji compliance with standard geometric SVGs
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./toast.js', '../utils/clipboard.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./toast.js'), require('../utils/clipboard.js'));
  } else {
    root.SupportModal = factory(root.Toast, root.ClipboardUtil);
  }
})(typeof self !== 'undefined' ? self : this, function (Toast, ClipboardUtil) {
  'use strict';

  var CONFIG = {
    vpa: 'ahayas.info@oksbi',
    payee: 'Ahayas',
    note: 'Support SGOU Database',
    defaultAmount: 25,
    amounts: [15, 25, 50, 100, 'custom']
  };

  /**
   * Situation-aware dynamic messages matched to the user's immediate action
   */
  var CONTEXT_MESSAGES = {
    // 1. Post-Download: Triggered after syllabus PDF download
    download: 'Downloaded! Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution directly funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.',
    // 2. Document Reader / Standalone Viewer: Triggered from reader topbar or canvas dwell
    reader: 'Preparing for exams? Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.',
    // 3. Home Page / Catalog / Header / Footer: Direct exploration
    home: 'Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.',
    // 4. Default fallback
    default: 'Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.'
  };

  function sendTelemetry(name, params) {
    try {
      if (typeof window !== 'undefined' && window.SGOU_TELEMETRY && typeof window.SGOU_TELEMETRY.log === 'function') {
        window.SGOU_TELEMETRY.log(name, params || {});
      }
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', name, params || {});
      }
    } catch (_) {}
  }

  var state = {
    activeAmount: CONFIG.defaultAmount,
    modalEl: null,
    introText: null,
    qrContainer: null,
    payBtn: null,
    payBtnText: null,
    qrSection: null,
    qrToggleBtn: null,
    qrToggleText: null,
    copyBtn: null,
    copyBtnText: null,
    qrPopover: null,
    lastFocusedElement: null,
    modalOpenTimestamp: 0,
    lastChipSelectTimestamp: 0,
    hasEngagedPayment: false
  };

  var SupportModal = {
    /**
     * Build standard UPI deep link URI
     * @param {number|null} amount
     * @returns {string}
     */
    buildUpiUri: function (amount) {
      var uri = 'upi://pay?pa=' + encodeURIComponent(CONFIG.vpa) +
                '&pn=' + encodeURIComponent(CONFIG.payee);
      if (amount && Number(amount) > 0) {
        uri += '&am=' + Number(amount);
      }
      uri += '&cu=INR&tn=' + encodeURIComponent(CONFIG.note);
      return uri;
    },

    /**
     * Launch UPI payment via native protocol
     * @param {string} [app='upi']
     * @param {number|null} [amount]
     */
    openUpi: function (app, amount) {
      var amt = typeof amount !== 'undefined' ? amount : state.activeAmount;
      var uri = SupportModal.buildUpiUri(amt);

      state.hasEngagedPayment = true;
      var dwellMs = state.modalOpenTimestamp ? Math.round(performance.now() - state.modalOpenTimestamp) : 0;
      sendTelemetry('support_upi_click', {
        app: app || 'upi',
        amount: amt !== null ? amt : 'custom',
        dwell_ms: dwellMs
      });

      // Direct window location navigation triggers the Android/iOS UPI app chooser without popup blocks
      window.location.href = uri;
    },

    /**
     * Download QR code as SVG image file
     */
    downloadQr: function () {
      if (!state.qrContainer) return;
      var svg = state.qrContainer.querySelector('svg');
      if (!svg) return;

      try {
        var svgData = new XMLSerializer().serializeToString(svg);
        var svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        var svgUrl = URL.createObjectURL(svgBlob);
        var link = document.createElement('a');
        link.href = svgUrl;
        link.download = 'sgou-support-upi-qr.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(svgUrl);

        state.hasEngagedPayment = true;
        sendTelemetry('support_qr_download', {
          amount: state.activeAmount !== null ? state.activeAmount : 'custom',
          format: 'svg'
        });

        if (Toast && typeof Toast.show === 'function') {
          Toast.show('QR code downloaded');
        }
      } catch (err) {
        console.warn('[SupportModal] Download QR failed:', err);
      }
    },

    /**
     * Generate modal HTML template
     * @returns {string}
     */
    getTemplate: function () {
      return (
        '<div class="support-modal" role="dialog" aria-modal="true" aria-labelledby="supportModalTitle">' +
          '<div class="support-modal-header">' +
            '<div class="support-header-left">' +
              '<div class="support-heart-badge" aria-hidden="true">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
                  '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' +
                '</svg>' +
              '</div>' +
              '<h3 id="supportModalTitle" class="support-title">Support SGOU Database</h3>' +
            '</div>' +
            '<button class="support-close-btn" id="supportModalCloseBtn" aria-label="Close dialog" title="Close" type="button">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +

          '<div class="support-modal-body">' +
            '<!-- Situation-aware highlighted impact card -->' +
            '<div class="support-intro-card">' +
              '<p class="support-intro-text" id="supportIntroText">' +
                'Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.' +
              '</p>' +
            '</div>' +

            '<!-- Contribution Amount Selection -->' +
            '<div class="support-amount-chips" role="radiogroup" aria-label="Contribution Amount">' +
              '<button type="button" class="amount-chip" data-amount="15">' +
                '<span class="chip-val">₹15</span>' +
                '<span class="chip-sub">Chai</span>' +
              '</button>' +
              '<button type="button" class="amount-chip popular active" data-amount="25">' +
                '<span class="chip-badge">Popular</span>' +
                '<span class="chip-val">₹25</span>' +
                '<span class="chip-sub">Server</span>' +
              '</button>' +
              '<button type="button" class="amount-chip" data-amount="50">' +
                '<span class="chip-val">₹50</span>' +
                '<span class="chip-sub">Hero</span>' +
              '</button>' +
              '<button type="button" class="amount-chip" data-amount="100">' +
                '<span class="chip-val">₹100</span>' +
                '<span class="chip-sub">Patron</span>' +
              '</button>' +
              '<button type="button" class="amount-chip chip-custom" data-amount="custom">' +
                '<span class="chip-val">Custom</span>' +
                '<span class="chip-sub">Any ₹</span>' +
              '</button>' +
            '</div>' +

            '<!-- Mobile 1-Tap Action Section (Primary on Mobile) -->' +
            '<div class="support-mobile-section" id="supportMobileSection">' +
              '<button type="button" id="supportDirectPayBtn" class="support-pay-primary-btn" data-app="upi">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
                  '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' +
                '</svg>' +
                '<span id="supportDirectPayBtnText">Pay ₹25</span>' +
              '</button>' +
              '<button type="button" class="support-toggle-qr-btn" id="supportToggleQrBtn">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="3" y="3" width="7" height="7"></rect>' +
                  '<rect x="14" y="3" width="7" height="7"></rect>' +
                  '<rect x="14" y="14" width="7" height="7"></rect>' +
                  '<rect x="3" y="14" width="7" height="7"></rect>' +
                '</svg>' +
                '<span id="supportToggleQrText">Show QR Code</span>' +
              '</button>' +
            '</div>' +

            '<!-- QR Code Display Box (Desktop always visible, Mobile toggled) -->' +
            '<div class="support-qr-section" id="supportQrSection">' +
              '<div class="support-qr-card">' +
                '<!-- Corner Controls: Download + Advice Popover -->' +
                '<div class="support-qr-corner-actions">' +
                  '<button type="button" class="support-qr-icon-btn" id="supportQrInfoBtn" title="Advice" aria-label="Advice">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                      '<circle cx="12" cy="12" r="10"></circle>' +
                      '<line x1="12" y1="16" x2="12" y2="12"></line>' +
                      '<line x1="12" y1="8" x2="12.01" y2="8"></line>' +
                    '</svg>' +
                  '</button>' +
                  '<button type="button" class="support-qr-icon-btn" id="supportSaveQrBtn" title="Download QR" aria-label="Download QR">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
                      '<polyline points="7 10 12 15 17 10"></polyline>' +
                      '<line x1="12" y1="15" x2="12" y2="3"></line>' +
                    '</svg>' +
                  '</button>' +
                '</div>' +
                '<div class="support-qr-popover" id="supportQrPopover" role="tooltip" aria-hidden="true">' +
                  '<span>In GPay / PhonePe gallery scan, tap <strong>Dismiss</strong> on notice to pay.</span>' +
                '</div>' +
                '<div class="support-qr-frame" id="supportQrContainer" aria-label="UPI Payment QR Code">' +
                  '<!-- SVG QR rendered dynamically -->' +
                '</div>' +
                '<div class="support-qr-caption">' +
                  '<span>Scan with any UPI app</span>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<!-- UPI ID Copy Section -->' +
            '<div class="support-vpa-box">' +
              '<code class="support-vpa-text" id="supportVpaText">' + CONFIG.vpa + '</code>' +
              '<button type="button" class="support-copy-btn" id="supportCopyVpaBtn" title="Copy UPI ID">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
                  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
                '</svg>' +
                '<span id="supportCopyBtnText">Copy</span>' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<div class="support-modal-footer">' +
            '<span class="support-security-note">' +
              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
                '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
              '</svg>' +
              '0% fee &middot; Direct UPI' +
            '</span>' +
            '<button type="button" class="support-done-btn" id="supportDoneBtn">Done</button>' +
          '</div>' +
        '</div>'
      );
    },

    /**
     * Ensure modal element exists and is mounted in DOM
     */
    ensureMounted: function () {
      var modal = document.getElementById('supportModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'supportModal';
        modal.className = 'support-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'supportModalTitle');
        modal.setAttribute('aria-hidden', 'true');
        if ('inert' in modal) modal.inert = true;
        modal.innerHTML = SupportModal.getTemplate();
        document.body.appendChild(modal);
      } else {
        modal.innerHTML = SupportModal.getTemplate();
        if (!modal.classList.contains('visible') && !modal.classList.contains('active')) {
          modal.setAttribute('aria-hidden', 'true');
          if ('inert' in modal) modal.inert = true;
        }
      }
      state.modalEl = modal;
      state.introText = document.getElementById('supportIntroText');
      state.qrContainer = document.getElementById('supportQrContainer');
      state.payBtn = document.getElementById('supportDirectPayBtn');
      state.payBtnText = document.getElementById('supportDirectPayBtnText');
      state.qrSection = document.getElementById('supportQrSection');
      state.qrToggleBtn = document.getElementById('supportToggleQrBtn');
      state.qrToggleText = document.getElementById('supportToggleQrText');
      state.copyBtn = document.getElementById('supportCopyVpaBtn');
      state.copyBtnText = document.getElementById('supportCopyBtnText');
      state.qrPopover = document.getElementById('supportQrPopover');
    },

    /**
     * Render QR code for specified amount
     * @param {number|null} amount
     */
    renderQr: function (amount) {
      var uri = SupportModal.buildUpiUri(amount);
      if (state.qrContainer && typeof window.qrcode === 'function') {
        try {
          var qr = window.qrcode(0, 'M');
          qr.addData(uri);
          qr.make();
          state.qrContainer.innerHTML = qr.createSvgTag(3.6, 1);
        } catch (err) {
          console.warn('[SupportModal] QR render failed:', err);
        }
      }

      if (state.payBtnText) {
        if (amount && Number(amount) > 0) {
          state.payBtnText.textContent = 'Pay ₹' + amount;
        } else {
          state.payBtnText.textContent = 'Pay via UPI';
        }
      }
    },

    /**
     * Set active amount chip
     * @param {number|string|null} amount
     */
    setAmount: function (amount) {
      var prevAmt = state.activeAmount;
      if (amount === 'custom' || amount === null) {
        state.activeAmount = null;
      } else {
        state.activeAmount = Number(amount);
      }

      if (state.modalEl) {
        var chips = state.modalEl.querySelectorAll('.amount-chip');
        for (var i = 0; i < chips.length; i++) {
          var chip = chips[i];
          var a = chip.getAttribute('data-amount');
          var isActive = (a === String(state.activeAmount)) || (state.activeAmount === null && a === 'custom');
          chip.classList.toggle('active', isActive);
        }
      }

      SupportModal.renderQr(state.activeAmount);
      var dwellMs = state.lastChipSelectTimestamp ? Math.round(performance.now() - state.lastChipSelectTimestamp) : 0;
      state.lastChipSelectTimestamp = performance.now();

      sendTelemetry('support_amount_select', {
        amount: state.activeAmount !== null ? state.activeAmount : 'custom',
        prior_amount: prevAmt !== null ? prevAmt : 'custom',
        dwell_ms: dwellMs
      });
    },

    /**
     * Copy VPA to clipboard with visual feedback
     */
    copyVpa: function () {
      var vpa = CONFIG.vpa;
      var doFeedback = function () {
        if (state.copyBtn) state.copyBtn.classList.add('copied');
        if (state.copyBtnText) state.copyBtnText.textContent = 'Copied';
        state.hasEngagedPayment = true;
        sendTelemetry('support_copy_upi', {
          vpa: vpa,
          amount: state.activeAmount !== null ? state.activeAmount : 'custom'
        });
        if (Toast && typeof Toast.show === 'function') {
          Toast.show('UPI ID copied: ' + vpa);
        }
        setTimeout(function () {
          if (state.copyBtn) state.copyBtn.classList.remove('copied');
          if (state.copyBtnText) state.copyBtnText.textContent = 'Copy';
        }, 2500);
      };

      if (ClipboardUtil && typeof ClipboardUtil.copy === 'function') {
        ClipboardUtil.copy(vpa).then(doFeedback).catch(doFeedback);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(vpa).then(doFeedback).catch(doFeedback);
      } else {
        doFeedback();
      }
    },

    /**
     * Open modal dialog
     * @param {number} [amount=25]
     * @param {HTMLElement} [triggerEl=null]
     * @param {string} [context=null]
     */
    open: function (amount, triggerEl, context) {
      SupportModal.ensureMounted();
      if (!state.modalEl) return;

      var targetAmount = typeof amount === 'number' ? amount : CONFIG.defaultAmount;
      SupportModal.setAmount(targetAmount);

      state.lastFocusedElement = triggerEl || (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);

      // Situation-aware dynamic context determination
      var situation = context;
      if (!situation && triggerEl) {
        var tid = triggerEl.id || '';
        if (tid === 'dpSupportBtn' || (triggerEl.closest && triggerEl.closest('#downloadProgressCard')) || triggerEl.hasAttribute('data-download-trigger')) {
          situation = 'download';
        } else if (tid === 'topbarSupport' || tid === 'readerSupportBtn' || (triggerEl.closest && (triggerEl.closest('#readerTopBar') || triggerEl.closest('.viewer-topbar')))) {
          situation = 'reader';
        } else if (tid === 'supportBtn' || tid === 'headerSupportBtn' || tid === 'footerSupportBtn' || tid === 'drawerSupportBtn') {
          situation = 'home';
        }
      }

      if (!situation) {
        if (typeof window !== 'undefined' && window.location) {
          var p = window.location.pathname || '';
          if (p.includes('reader') || p.includes('view')) {
            situation = 'reader';
          } else {
            situation = 'home';
          }
        } else {
          situation = 'home';
        }
      }

      var dynamicMsg = CONTEXT_MESSAGES[situation] || CONTEXT_MESSAGES.home || CONTEXT_MESSAGES.default;
      if (state.introText) {
        state.introText.innerHTML = dynamicMsg;
      }

      var modalRoot = state.modalEl || document.getElementById('supportModal');
      if (modalRoot) {
        modalRoot.classList.remove('mobile-qr-active');
      }
      if (state.qrSection) state.qrSection.classList.remove('show');
      if (state.qrToggleText) state.qrToggleText.textContent = 'Show QR Code';
      if (state.qrPopover) state.qrPopover.classList.remove('show');

      state.modalEl.classList.add('visible', 'active');
      state.modalEl.setAttribute('aria-hidden', 'false');
      if ('inert' in state.modalEl) {
        state.modalEl.inert = false;
      }

      state.modalOpenTimestamp = performance.now();
      state.lastChipSelectTimestamp = performance.now();
      state.hasEngagedPayment = false;

      sendTelemetry('support_modal_open', {
        amount: targetAmount,
        context: situation,
        source: triggerEl ? (triggerEl.id || triggerEl.getAttribute('aria-label') || 'trigger') : 'direct'
      });

      var activeChip = state.modalEl.querySelector('.amount-chip.active');
      if (activeChip) {
        try { activeChip.focus(); } catch (_) {}
      }
    },

    /**
     * Close modal dialog
     * @param {string} [reason='close_btn']
     */
    close: function (reason) {
      if (state.modalEl) {
        var totalDwellMs = state.modalOpenTimestamp ? Math.round(performance.now() - state.modalOpenTimestamp) : 0;
        sendTelemetry('support_modal_dismiss', {
          reason: reason || 'close_btn',
          dwell_ms: totalDwellMs,
          final_amount: state.activeAmount !== null ? state.activeAmount : 'custom',
          has_engaged_payment: state.hasEngagedPayment ? 1 : 0
        });

        if (state.modalEl.contains(document.activeElement)) {
          if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function' && document.body.contains(state.lastFocusedElement) && !state.modalEl.contains(state.lastFocusedElement)) {
            try {
              state.lastFocusedElement.focus();
            } catch (_) {}
          } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
            try {
              document.activeElement.blur();
            } catch (_) {}
          }
        }

        state.modalEl.classList.remove('visible', 'active');
        state.modalEl.setAttribute('aria-hidden', 'true');
        if ('inert' in state.modalEl) {
          state.modalEl.inert = true;
        }
        state.lastFocusedElement = null;
      }
    },

    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    isOpen: function () {
      return !!(state.modalEl && (state.modalEl.classList.contains('visible') || state.modalEl.classList.contains('active')));
    },

    /**
     * Initialize event bindings and triggers
     */
    init: function () {
      SupportModal.ensureMounted();

      // Delegate triggers across document
      document.addEventListener('click', function (e) {
        // Open Triggers
        var trigger = e.target.closest('#supportBtn, #footerSupportBtn, #topbarSupport, #readerSupportBtn, #headerSupportBtn, #drawerSupportBtn, #viewerPanelSupport, [data-action="support"], .support-trigger');
        if (trigger) {
          e.preventDefault();
          var rawAmt = trigger.getAttribute('data-support-amount');
          var amt = rawAmt ? Number(rawAmt) : CONFIG.defaultAmount;
          SupportModal.open(amt, trigger);
          return;
        }

        if (!state.modalEl) return;

        // Close button or Done button
        var closeTrigger = e.target.closest('#supportModalCloseBtn, #supportDoneBtn');
        if (closeTrigger) {
          e.preventDefault();
          SupportModal.close(closeTrigger.id === 'supportDoneBtn' ? 'done_btn' : 'close_btn');
          return;
        }

        // Backdrop click
        if (e.target === state.modalEl) {
          SupportModal.close('backdrop');
          return;
        }

        // Amount Chips click
        var chip = e.target.closest('.amount-chip');
        if (chip && state.modalEl.contains(chip)) {
          e.preventDefault();
          var val = chip.getAttribute('data-amount');
          SupportModal.setAmount(val);
          return;
        }

        // Direct Pay UPI Click
        var payBtn = e.target.closest('#supportDirectPayBtn');
        if (payBtn && state.modalEl.contains(payBtn)) {
          e.preventDefault();
          SupportModal.openUpi('upi');
          return;
        }

        // Download / Save QR Button Click
        var saveQrBtn = e.target.closest('#supportSaveQrBtn');
        if (saveQrBtn && state.modalEl.contains(saveQrBtn)) {
          e.preventDefault();
          SupportModal.downloadQr();
          return;
        }

        // Corner Info Popover Toggle
        var infoBtn = e.target.closest('#supportQrInfoBtn');
        if (infoBtn && state.modalEl.contains(infoBtn)) {
          e.preventDefault();
          var popover = document.getElementById('supportQrPopover');
          if (popover) {
            var isShow = popover.classList.toggle('show');
            popover.setAttribute('aria-hidden', isShow ? 'false' : 'true');
            sendTelemetry('support_advice_view', { is_shown: isShow });
          }
          return;
        } else if (!e.target.closest('#supportQrPopover')) {
          var popover = document.getElementById('supportQrPopover');
          if (popover && popover.classList.contains('show')) {
            popover.classList.remove('show');
            popover.setAttribute('aria-hidden', 'true');
          }
        }

        // Mobile QR Toggle
        if (e.target.closest('#supportToggleQrBtn')) {
          e.preventDefault();
          e.stopPropagation();
          var modalRoot = state.modalEl || document.getElementById('supportModal');
          if (modalRoot) {
            var isNowQrActive = modalRoot.classList.toggle('mobile-qr-active');
            if (state.qrSection) {
              state.qrSection.classList.toggle('show', isNowQrActive);
            }
            if (state.qrToggleText) {
              state.qrToggleText.textContent = isNowQrActive ? 'Hide QR Code' : 'Show QR Code';
            }
            sendTelemetry('support_qr_toggle', { is_shown: isNowQrActive });
          }
          return;
        }

        // Copy VPA Button
        if (e.target.closest('#supportCopyVpaBtn')) {
          e.preventDefault();
          SupportModal.copyVpa();
          return;
        }
      });

      // Keyboard trap and Escape key listener
      document.addEventListener('keydown', function (e) {
        var isModalOpen = state.modalEl && (state.modalEl.classList.contains('visible') || state.modalEl.classList.contains('active'));
        if (!isModalOpen) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          SupportModal.close('escape_key');
          return;
        }

        if (e.key === 'Tab') {
          var focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
          var focusable = Array.prototype.slice.call(state.modalEl.querySelectorAll(focusableSelector)).filter(function (el) {
            return el.offsetParent !== null;
          });
          if (!focusable.length) return;
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }
  };

  // Self-initialize on DOMContentLoaded or immediately if ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SupportModal.init);
  } else {
    SupportModal.init();
  }

  return SupportModal;
});
