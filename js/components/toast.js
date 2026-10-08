/**
 * SGOU Academic Database — Reusable Toast Notification Component
 * Unified across catalog (index.html), standalone viewer (view.html), and reader (reader.html)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Toast = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _timer = null;

  var Toast = {
    /**
     * Get or create toast container element
     * @returns {HTMLElement}
     */
    getElement: function () {
      var el = document.getElementById('toast') || document.getElementById('readerToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
      }
      return el;
    },

    /**
     * Show toast message
     * @param {string} message - Text to display
     * @param {string} [type='info'] - Optional type ('info', 'success', 'error')
     * @param {number} [duration=3000] - Duration in ms
     */
    show: function (message, type, duration) {
      if (!message) return;
      var el = Toast.getElement();
      if (!el) return;

      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }

      el.textContent = message;
      el.className = 'toast visible' + (type ? ' ' + type : '');

      var dur = typeof duration === 'number' ? duration : 3000;
      _timer = setTimeout(function () {
        Toast.dismiss();
      }, dur);
    },

    /**
     * Dismiss visible toast
     */
    dismiss: function () {
      var el = Toast.getElement();
      if (el) {
        el.classList.remove('visible', 'show');
      }
      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }
    }
  };

  return Toast;
});
