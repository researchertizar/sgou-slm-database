/**
 * SGOU Academic Database — Reusable Support & Donation Modal Component
 * Universal component shared across index.html, view.html, reader.html
 * 
 * Features:
 * - High-trust, conversion-optimized student community support messaging
 * - 1-tap mobile native UPI app launchers (GPay, PhonePe, Paytm, BHIM)
 * - Safe direct intent navigation (no target="_blank" popup blockage)
 * - Dynamic SVG QR generation + 1-tap SVG QR image saving
 * - Micro-guidance addressing Google Pay/PhonePe gallery scan advisory notice
 * - Verified State Bank of India (SBI) payee transparency
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
    registeredName: 'AHAMMAD YASEEN S',
    bankName: 'SBI',
    note: 'Support SGOU Database',
    defaultAmount: 25,
    amounts: [
      { val: 15, label: '₹15', sub: 'Chai' },
      { val: 25, label: '₹25', sub: 'Popular', popular: true },
      { val: 50, label: '₹50', sub: 'Supporter' },
      { val: 100, label: '₹100', sub: 'Patron' },
      { val: 'custom', label: 'Any', sub: 'Custom' }
    ]
  };

  function sendTelemetry(name, params) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, params || {});
      }
    } catch (_) {}
  }

  var state = {
    activeAmount: CONFIG.defaultAmount,
    modalEl: null,
    qrContainer: null,
    payBtn: null,
    payBtnText: null,
    qrSection: null,
    qrToggleBtn: null,
    qrToggleText: null,
    copyBtn: null,
    copyBtnText: null,
    lastFocusedElement: null
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
     * Build specific UPI app URI
     * @param {string} app
     * @param {number|null} amount
     * @returns {string}
     */
    buildAppUri: function (app, amount) {
      var baseUri = SupportModal.buildUpiUri(amount);
      var query = baseUri.replace('upi://pay?', '');
      switch (app) {
        case 'gpay':
          return 'tez://upi/pay?' + query;
        case 'phonepe':
          return 'phonepe://pay?' + query;
        case 'paytm':
          return 'paytmmp://pay?' + query;
        case 'bhim':
          return 'bhim://pay?' + query;
        default:
          return baseUri;
      }
    },

    /**
     * Launch UPI payment via native protocol
     * @param {string} app
     * @param {number|null} [amount]
     */
    openUpi: function (app, amount) {
      var amt = typeof amount !== 'undefined' ? amount : state.activeAmount;
      var specificUri = SupportModal.buildAppUri(app, amt);
      var fallbackUri = SupportModal.buildUpiUri(amt);

      sendTelemetry('support_upi_click', {
        app: app || 'upi',
        amount: amt !== null ? amt : 'custom'
      });

      if (!app || app === 'upi') {
        window.location.href = fallbackUri;
      } else {
        var start = Date.now();
        window.location.href = specificUri;
        setTimeout(function () {
          // If app was not installed or failed to intercept within 850ms, fallback to universal UPI chooser
          if (Date.now() - start < 1600) {
            window.location.href = fallbackUri;
          }
        }, 850);
      }
    },

    /**
     * Download QR code as SVG
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

        sendTelemetry('support_qr_download', {
          amount: state.activeAmount !== null ? state.activeAmount : 'custom'
        });

        if (Toast && typeof Toast.show === 'function') {
          Toast.show('QR code image saved');
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
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
                  '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' +
                '</svg>' +
              '</div>' +
              '<div>' +
                '<h3 id="supportModalTitle" class="support-title">Support SGOU Database</h3>' +
                '<p class="support-subtitle">Keep SGOU Study Materials 100% Free</p>' +
              '</div>' +
            '</div>' +
            '<button class="support-close-btn" id="supportModalCloseBtn" aria-label="Close dialog" title="Close (Esc)" type="button">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +

          '<div class="support-modal-body">' +
            '<!-- Community Impact & Value Proposition -->' +
            '<div class="support-intro-card">' +
              '<div class="support-intro-header">' +
                '<div class="support-intro-icon" aria-hidden="true">' +
                  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
                  '</svg>' +
                '</div>' +
                '<span class="support-intro-heading">Community Funded for 40,000+ Students</span>' +
              '</div>' +
              '<p class="support-intro-text">' +
                'Maintained by <strong>' + CONFIG.payee + '</strong> as a free public utility. Your voluntary contribution funds high-speed cloud bandwidth, domain renewal, and regular syllabus updates.' +
              '</p>' +
              '<div class="support-trust-pills">' +
                '<span class="trust-pill">' +
                  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
                  'Zero Ads' +
                '</span>' +
                '<span class="trust-pill">' +
                  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
                  'Direct SBI Account' +
                '</span>' +
                '<span class="trust-pill">' +
                  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
                  '0% Platform Fee' +
                '</span>' +
              '</div>' +
            '</div>' +

            '<!-- Contribution Amount Selection -->' +
            '<div class="support-section-label">Select Contribution</div>' +
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
              '<button type="button" class="amount-chip" data-amount="custom">' +
                '<span class="chip-val">Any</span>' +
                '<span class="chip-sub">Custom</span>' +
              '</button>' +
            '</div>' +

            '<!-- Mobile 1-Tap Action Section (Primary on Mobile) -->' +
            '<div class="support-mobile-section">' +
              '<button type="button" id="supportDirectPayBtn" class="support-pay-primary-btn" data-app="upi">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
                  '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' +
                '</svg>' +
                '<span id="supportDirectPayBtnText">Pay ₹25 via Any UPI App</span>' +
              '</button>' +

              '<!-- Dedicated 1-Tap Quick App Launchers -->' +
              '<div class="support-apps-row" aria-label="Quick launch UPI app">' +
                '<button type="button" class="support-app-pill" data-app="gpay" title="Open Google Pay">' +
                  '<span class="app-pill-mark gpay-mark">G</span>' +
                  '<span>GPay</span>' +
                '</button>' +
                '<button type="button" class="support-app-pill" data-app="phonepe" title="Open PhonePe">' +
                  '<span class="app-pill-mark phonepe-mark">Pe</span>' +
                  '<span>PhonePe</span>' +
                '</button>' +
                '<button type="button" class="support-app-pill" data-app="paytm" title="Open Paytm">' +
                  '<span class="app-pill-mark paytm-mark">Pt</span>' +
                  '<span>Paytm</span>' +
                '</button>' +
                '<button type="button" class="support-app-pill" data-app="bhim" title="Open BHIM UPI">' +
                  '<span class="app-pill-mark bhim-mark">B</span>' +
                  '<span>BHIM</span>' +
                '</button>' +
              '</div>' +

              '<button type="button" class="support-toggle-qr-btn" id="supportToggleQrBtn">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="3" y="3" width="7" height="7"></rect>' +
                  '<rect x="14" y="3" width="7" height="7"></rect>' +
                  '<rect x="14" y="14" width="7" height="7"></rect>' +
                  '<rect x="3" y="14" width="7" height="7"></rect>' +
                '</svg>' +
                '<span id="supportToggleQrText">Show QR Code</span>' +
              '</button>' +
            '</div>' +

            '<!-- QR Code Display Box (Expandable on Mobile, Primary on Desktop) -->' +
            '<div class="support-qr-section" id="supportQrSection">' +
              '<div class="support-qr-card">' +
                '<div class="support-qr-frame" id="supportQrContainer" aria-label="UPI Payment QR Code">' +
                  '<!-- SVG QR code rendered dynamically -->' +
                '</div>' +
                '<div class="support-qr-caption">' +
                  '<span>Scan with camera or any UPI app</span>' +
                '</div>' +
                '<div class="support-gallery-tip">' +
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<circle cx="12" cy="12" r="10"></circle>' +
                    '<line x1="12" y1="16" x2="12" y2="12"></line>' +
                    '<line x1="12" y1="8" x2="12.01" y2="8"></line>' +
                  '</svg>' +
                  '<span>If scanning via GPay / PhonePe gallery, tap <strong>Dismiss</strong> on their security notice to pay.</span>' +
                '</div>' +
                '<button type="button" class="support-save-qr-btn" id="supportSaveQrBtn">' +
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
                    '<polyline points="7 10 12 15 17 10"></polyline>' +
                    '<line x1="12" y1="15" x2="12" y2="3"></line>' +
                  '</svg>' +
                  '<span>Save QR Image</span>' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<!-- UPI ID Copy Section -->' +
            '<div class="support-vpa-box">' +
              '<div class="support-vpa-left">' +
                '<span class="support-vpa-label">UPI ID</span>' +
                '<code class="support-vpa-text" id="supportVpaText">' + CONFIG.vpa + '</code>' +
              '</div>' +
              '<button type="button" class="support-copy-btn" id="supportCopyVpaBtn" title="Copy UPI ID to clipboard">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
                  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
                '</svg>' +
                '<span id="supportCopyBtnText">Copy</span>' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<div class="support-modal-footer">' +
            '<span class="support-security-note">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
                '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
              '</svg>' +
              'Direct to ' + CONFIG.bankName + ' &middot; 0% fee' +
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
      state.qrContainer = document.getElementById('supportQrContainer');
      state.payBtn = document.getElementById('supportDirectPayBtn');
      state.payBtnText = document.getElementById('supportDirectPayBtnText');
      state.qrSection = document.getElementById('supportQrSection');
      state.qrToggleBtn = document.getElementById('supportToggleQrBtn');
      state.qrToggleText = document.getElementById('supportToggleQrText');
      state.copyBtn = document.getElementById('supportCopyVpaBtn');
      state.copyBtnText = document.getElementById('supportCopyBtnText');
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
          state.qrContainer.innerHTML = qr.createSvgTag(4.5, 2);
        } catch (err) {
          console.warn('[SupportModal] QR render failed:', err);
        }
      }

      if (state.payBtnText) {
        if (amount && Number(amount) > 0) {
          state.payBtnText.textContent = 'Pay ₹' + amount + ' via Any UPI App';
        } else {
          state.payBtnText.textContent = 'Pay via Any UPI App (Custom Amount)';
        }
      }
    },

    /**
     * Set active amount chip
     * @param {number|string|null} amount
     */
    setAmount: function (amount) {
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
      sendTelemetry('support_amount_select', {
        amount: state.activeAmount !== null ? state.activeAmount : 'custom'
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
        sendTelemetry('support_copy_upi', {
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
     */
    open: function (amount, triggerEl) {
      SupportModal.ensureMounted();
      if (!state.modalEl) return;

      var targetAmount = typeof amount === 'number' ? amount : CONFIG.defaultAmount;
      SupportModal.setAmount(targetAmount);

      state.lastFocusedElement = triggerEl || (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);

      if (state.qrSection) state.qrSection.classList.remove('show');
      if (state.qrToggleText) state.qrToggleText.textContent = 'Show QR Code';

      state.modalEl.classList.add('visible', 'active');
      state.modalEl.setAttribute('aria-hidden', 'false');
      if ('inert' in state.modalEl) {
        state.modalEl.inert = false;
      }

      sendTelemetry('support_modal_open', {
        amount: targetAmount,
        source: triggerEl ? (triggerEl.id || triggerEl.getAttribute('aria-label') || 'trigger') : 'direct'
      });

      var activeChip = state.modalEl.querySelector('.amount-chip.active');
      if (activeChip) {
        try { activeChip.focus(); } catch (_) {}
      }
    },

    /**
     * Close modal dialog
     */
    close: function () {
      if (state.modalEl) {
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
        if (e.target.closest('#supportModalCloseBtn, #supportDoneBtn')) {
          e.preventDefault();
          SupportModal.close();
          return;
        }

        // Backdrop click
        if (e.target === state.modalEl) {
          SupportModal.close();
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

        // 1-Tap App Pill Click (GPay, PhonePe, Paytm, BHIM)
        var appPill = e.target.closest('.support-app-pill');
        if (appPill && state.modalEl.contains(appPill)) {
          e.preventDefault();
          var app = appPill.getAttribute('data-app');
          SupportModal.openUpi(app);
          return;
        }

        // Download / Save QR Button Click
        var saveQrBtn = e.target.closest('#supportSaveQrBtn');
        if (saveQrBtn && state.modalEl.contains(saveQrBtn)) {
          e.preventDefault();
          SupportModal.downloadQr();
          return;
        }

        // Mobile QR Toggle
        if (e.target.closest('#supportToggleQrBtn')) {
          e.preventDefault();
          if (state.qrSection) {
            var isShow = state.qrSection.classList.toggle('show');
            if (state.qrToggleText) {
              state.qrToggleText.textContent = isShow ? 'Hide QR Code' : 'Show QR Code';
            }
            sendTelemetry('support_qr_toggle', { is_shown: isShow });
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
          SupportModal.close();
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
