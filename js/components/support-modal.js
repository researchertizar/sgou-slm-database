/**
 * SGOU Academic Database — Reusable Support & Donation Modal Component
 * Universal component shared across index.html, view.html, reader.html
 * 
 * Features:
 * - High-trust messaging for student community support
 * - Supportive, emotional, non-transactional copy (no "pay" phrasing)
 * - Dynamic QR code generation for desktop (145px crisp SVG)
 * - 1-tap mobile UPI deep-linking (GPay, PhonePe, Paytm, BHIM)
 * - Resilient copy-to-clipboard with instant feedback
 * - Self-mounting DOM architecture or attachment to existing markup
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
    isQrExpandedOnMobile: false
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
                '<h3 id="supportModalTitle" class="support-title">Support Project</h3>' +
                '<p class="support-subtitle">Voluntary student contribution</p>' +
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
            '<!-- High-Trust Platform Message -->' +
            '<div class="support-intro-card">' +
              '<div class="support-intro-icon" aria-hidden="true">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>' +
                  '<rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>' +
                  '<line x1="6" y1="6" x2="6.01" y2="6"></line>' +
                  '<line x1="6" y1="18" x2="6.01" y2="18"></line>' +
                '</svg>' +
              '</div>' +
              '<p class="support-intro-text">' +
                'This platform is maintained by <strong>' + CONFIG.payee + '</strong> as a free service for all SGOU students. Your voluntary contributions directly fund server hosting, domain renewals, and syllabus updates.' +
              '</p>' +
            '</div>' +

            '<!-- Contribution Amount Selection -->' +
            '<div class="support-section-label">Choose Contribution</div>' +
            '<div class="support-amount-chips" role="radiogroup" aria-label="Contribution Amount">' +
              '<button type="button" class="amount-chip" data-amount="15">₹15</button>' +
              '<button type="button" class="amount-chip active" data-amount="25">₹25<span class="chip-star">★</span></button>' +
              '<button type="button" class="amount-chip" data-amount="50">₹50</button>' +
              '<button type="button" class="amount-chip" data-amount="100">₹100</button>' +
              '<button type="button" class="amount-chip" data-amount="custom">Any</button>' +
            '</div>' +

            '<!-- Mobile 1-Tap Action Section (Primary on Mobile) -->' +
            '<div class="support-mobile-section">' +
              '<a href="' + SupportModal.buildUpiUri(CONFIG.defaultAmount) + '" ' +
                 'id="supportDirectPayBtn" class="support-pay-primary-btn" target="_blank" rel="noopener">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
                  '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' +
                '</svg>' +
                '<span id="supportDirectPayBtnText">Support with ₹25 via UPI</span>' +
              '</a>' +
              '<div class="support-apps-hint">' +
                '<span>Works with GPay, PhonePe, Paytm, BHIM</span>' +
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

            '<!-- Desktop QR Code Display Box (Primary on Desktop) -->' +
            '<div class="support-qr-section" id="supportQrSection">' +
              '<div class="support-qr-card">' +
                '<div class="support-qr-frame" id="supportQrContainer" aria-label="UPI Payment QR Code">' +
                  '<!-- SVG QR code rendered dynamically -->' +
                '</div>' +
                '<div class="support-qr-caption">' +
                  '<span>Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</span>' +
                '</div>' +
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
              'Direct UPI &middot; 0% fee' +
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
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = SupportModal.getTemplate();
        document.body.appendChild(modal);
      } else {
        modal.innerHTML = SupportModal.getTemplate();
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

      if (state.payBtn) state.payBtn.href = uri;
      if (state.payBtnText) {
        if (amount && Number(amount) > 0) {
          state.payBtnText.textContent = 'Support with ₹' + amount + ' via UPI';
        } else {
          state.payBtnText.textContent = 'Support via UPI (Any Amount)';
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
    },

    /**
     * Copy VPA to clipboard with visual feedback
     */
    copyVpa: function () {
      var vpa = CONFIG.vpa;
      var doFeedback = function () {
        if (state.copyBtn) state.copyBtn.classList.add('copied');
        if (state.copyBtnText) state.copyBtnText.textContent = 'Copied! ✓';
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
     */
    open: function (amount) {
      SupportModal.ensureMounted();
      if (!state.modalEl) return;

      var targetAmount = typeof amount === 'number' ? amount : CONFIG.defaultAmount;
      SupportModal.setAmount(targetAmount);

      // Reset mobile QR toggle
      if (state.qrSection) state.qrSection.classList.remove('show');
      if (state.qrToggleText) state.qrToggleText.textContent = 'Show QR Code to Scan';

      state.modalEl.classList.add('visible', 'active');
      state.modalEl.setAttribute('aria-hidden', 'false');

      // Focus first chip for accessibility
      var activeChip = state.modalEl.querySelector('.amount-chip.active');
      if (activeChip) activeChip.focus();
    },

    /**
     * Close modal dialog
     */
    close: function () {
      if (state.modalEl) {
        state.modalEl.classList.remove('visible', 'active');
        state.modalEl.setAttribute('aria-hidden', 'true');
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
        var trigger = e.target.closest('#supportBtn, #footerSupportBtn, #topbarSupport, #readerSupportBtn, [data-action="support"], .support-trigger');
        if (trigger) {
          e.preventDefault();
          var rawAmt = trigger.getAttribute('data-support-amount');
          var amt = rawAmt ? Number(rawAmt) : CONFIG.defaultAmount;
          SupportModal.open(amt);
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

        // Mobile QR Toggle
        if (e.target.closest('#supportToggleQrBtn')) {
          e.preventDefault();
          if (state.qrSection) {
            var isShow = state.qrSection.classList.toggle('show');
            if (state.qrToggleText) {
              state.qrToggleText.textContent = isShow ? 'Hide QR Code' : 'Show QR Code to Scan';
            }
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

      // Escape key listener
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.modalEl && (state.modalEl.classList.contains('visible') || state.modalEl.classList.contains('active'))) {
          SupportModal.close();
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
