/**
 * SGOU Academic Database — B2B Partner & Academy Placement Inquiries
 * Accessible, lightweight component for commercial educational partnerships.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./toast.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./toast.js'));
  } else {
    root.PartnerModal = factory(root.Toast);
  }
})(typeof self !== 'undefined' ? self : this, function (Toast) {
  'use strict';

  var CONFIG = {
    whatsappPhone: '919544572262',
    adminEmail: 'ahayas.info@gmail.com'
  };

  var state = {
    modalEl: null,
    lastFocusedElement: null
  };

  function sendTelemetry(name, params) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, params || {});
      }
      if (window.Analytics && typeof window.Analytics.event === 'function') {
        window.Analytics.event(name, params || {});
      }
    } catch (_) {}
  }

  var PartnerModal = {
    getTemplate: function () {
      return (
        '<div class="partner-modal" role="dialog" aria-modal="true" aria-labelledby="partnerModalTitle">' +
          '<div class="partner-header">' +
            '<div class="partner-header-left">' +
              '<div class="partner-handshake-badge" aria-hidden="true">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
                  '<circle cx="9" cy="7" r="4"/>' +
                  '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
                  '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
                '</svg>' +
              '</div>' +
              '<div>' +
                '<h3 id="partnerModalTitle" class="partner-title">Institution Partnership</h3>' +
                '<p class="partner-subtitle">Academic placements &amp; coaching inquiries</p>' +
              '</div>' +
            '</div>' +
            '<button class="partner-close-btn" id="partnerCloseBtn" aria-label="Close dialog" title="Close (Esc)" type="button">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +

          '<div class="partner-body">' +
            '<form id="partnerInquiryForm">' +
              '<div class="partner-form-group">' +
                '<label class="partner-label" for="partnerBrandName">Institution Name <span class="required">*</span></label>' +
                '<input type="text" id="partnerBrandName" class="partner-input" placeholder="Tuition center / Academy" required>' +
              '</div>' +

              '<div class="partner-form-group" style="margin-top:0.75rem;">' +
                '<label class="partner-label" for="partnerCategory">Category <span class="required">*</span></label>' +
                '<select id="partnerCategory" class="partner-select">' +
                  '<option value="Degree Tuition (B.Com, BCA, BA, BBA, M.Com)">Degree Tuition (B.Com, BCA, BA, BBA, M.Com)</option>' +
                  '<option value="Kerala PSC &amp; Govt Exams">Kerala PSC &amp; Govt Exams</option>' +
                  '<option value="IT, Coding &amp; Data Science">IT, Coding &amp; Data Science</option>' +
                  '<option value="Study Abroad &amp; Languages">Study Abroad &amp; Languages</option>' +
                  '<option value="Academic Publisher / Books">Academic Publisher / Books</option>' +
                '</select>' +
              '</div>' +

              '<div class="partner-form-group" style="margin-top:0.75rem;">' +
                '<label class="partner-label" for="partnerDistrict">District / Reach <span class="required">*</span></label>' +
                '<select id="partnerDistrict" class="partner-select">' +
                  '<option value="All Kerala">All Kerala</option>' +
                  '<option value="Malappuram">Malappuram</option>' +
                  '<option value="Kollam">Kollam</option>' +
                  '<option value="Ernakulam">Ernakulam</option>' +
                  '<option value="Kozhikode">Kozhikode</option>' +
                  '<option value="Thiruvananthapuram">Thiruvananthapuram</option>' +
                  '<option value="Thrissur / Palakkad / Kannur">Thrissur / Palakkad / Kannur</option>' +
                '</select>' +
              '</div>' +

              '<div class="partner-form-group" style="margin-top:0.75rem;">' +
                '<label class="partner-label" for="partnerContact">WhatsApp / Phone <span class="required">*</span></label>' +
                '<input type="tel" id="partnerContact" class="partner-input" placeholder="+91 ..." required>' +
              '</div>' +

              '<div class="partner-form-group" style="margin-top:0.75rem;">' +
                '<label class="partner-label" for="partnerNotes">Note (Optional)</label>' +
                '<textarea id="partnerNotes" class="partner-textarea" placeholder="Specific courses or requirements..."></textarea>' +
              '</div>' +

              '<div class="partner-actions" style="margin-top:1rem;">' +
                '<button type="submit" class="partner-submit-btn" id="partnerSubmitBtn">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
                    '<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>' +
                  '</svg>' +
                  '<span>Continue to WhatsApp</span>' +
                '</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>'
      );
    },

    ensureMounted: function () {
      if (state.modalEl && document.body.contains(state.modalEl)) return;

      var existing = document.getElementById('partnerModal');
      if (existing) {
        state.modalEl = existing;
      } else {
        var backdrop = document.createElement('div');
        backdrop.id = 'partnerModal';
        backdrop.className = 'partner-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.innerHTML = PartnerModal.getTemplate();
        document.body.appendChild(backdrop);
        state.modalEl = backdrop;
      }

      PartnerModal.bindEvents();
    },

    bindEvents: function () {
      if (!state.modalEl || state.modalEl._eventsBound) return;
      state.modalEl._eventsBound = true;

      // Close on backdrop click
      state.modalEl.addEventListener('click', function (e) {
        if (e.target === state.modalEl) {
          PartnerModal.close();
        }
      });

      // Close button
      var closeBtn = state.modalEl.querySelector('#partnerCloseBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          PartnerModal.close();
        });
      }

      // Escape key listener
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && PartnerModal.isOpen()) {
          e.preventDefault();
          e.stopPropagation();
          PartnerModal.close();
        }
      });

      // Form submission
      var form = state.modalEl.querySelector('#partnerInquiryForm');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          PartnerModal.submit();
        });
      }
    },

    isOpen: function () {
      return state.modalEl && (state.modalEl.classList.contains('visible') || state.modalEl.classList.contains('active'));
    },

    open: function (triggerEl) {
      PartnerModal.ensureMounted();
      if (!state.modalEl) return;

      state.lastFocusedElement = triggerEl || document.activeElement;
      state.modalEl.classList.add('visible', 'active');
      state.modalEl.setAttribute('aria-hidden', 'false');

      sendTelemetry('partner_modal_open', {
        source: triggerEl ? (triggerEl.id || 'partner_button') : 'direct'
      });

      var firstInput = state.modalEl.querySelector('#partnerBrandName');
      if (firstInput) {
        setTimeout(function () {
          try { firstInput.focus(); } catch (_) {}
        }, 100);
      }
    },

    close: function () {
      if (!state.modalEl) return;
      state.modalEl.classList.remove('visible', 'active');
      state.modalEl.setAttribute('aria-hidden', 'true');

      if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
        try { state.lastFocusedElement.focus(); } catch (_) {}
      }
    },

    submit: function () {
      if (!state.modalEl) return;

      var brandName = (state.modalEl.querySelector('#partnerBrandName')?.value || '').trim();
      var category = state.modalEl.querySelector('#partnerCategory')?.value || '';
      var district = state.modalEl.querySelector('#partnerDistrict')?.value || '';
      var contact = (state.modalEl.querySelector('#partnerContact')?.value || '').trim();
      var notes = (state.modalEl.querySelector('#partnerNotes')?.value || '').trim();

      if (!brandName || !contact) {
        if (Toast && typeof Toast.show === 'function') {
          Toast.show('Please enter your academy name and contact number.');
        } else {
          alert('Please enter your academy name and contact number.');
        }
        return;
      }

      // Dispatch telemetry event
      sendTelemetry('partner_inquiry', {
        brand_name: brandName,
        category: category,
        district: district,
        contact: contact,
        notes: notes
      });

      // Format WhatsApp deep link
      var text = '🤝 *SGOU Academic Database — B2B Academy Placement Inquiry*\n\n' +
                 '*Academy / Brand:* ' + brandName + '\n' +
                 '*Category:* ' + category + '\n' +
                 '*Target District:* ' + district + '\n' +
                 '*Contact:* ' + contact + '\n' +
                 (notes ? '*Notes / Requirements:* ' + notes + '\n\n' : '\n') +
                 'Hi Ahayas, we would like to explore sponsored academy placements on SGOU Academic Database.';

      var waUrl = 'https://api.whatsapp.com/send?phone=' + CONFIG.whatsappPhone +
                  '&text=' + encodeURIComponent(text);

      PartnerModal.close();

      if (Toast && typeof Toast.show === 'function') {
        Toast.show('Inquiry submitted! Opening WhatsApp chat…', 3500);
      }

      setTimeout(function () {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }, 400);
    }
  };

  return PartnerModal;
});
