/**
 * SGOU Academic Database — Reusable Clipboard Utility
 * Safe, robust copy with navigator.clipboard and execCommand fallback
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ClipboardUtil = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ClipboardUtil = {
    /**
     * Copy text to user's clipboard
     * @param {string} text - text to copy
     * @returns {Promise<boolean>}
     */
    copy: function (text) {
      if (typeof text !== 'string') text = String(text || '');

      // Modern asynchronous clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext !== false) {
        return navigator.clipboard.writeText(text).then(function () {
          return true;
        }).catch(function () {
          return ClipboardUtil._fallbackCopy(text);
        });
      }

      return Promise.resolve(ClipboardUtil._fallbackCopy(text));
    },

    /**
     * Fallback copy using hidden textarea
     * @private
     */
    _fallbackCopy: function (text) {
      try {
        var textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        var successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return Boolean(successful);
      } catch (err) {
        console.warn('[ClipboardUtil] Fallback copy failed:', err);
        return false;
      }
    }
  };

  return ClipboardUtil;
});
