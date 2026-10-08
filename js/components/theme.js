/**
 * SGOU Academic Database — Reusable Theme Manager
 * Single source of truth for dark/light themes across index.html, view.html, reader.html
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ThemeManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'sgou-theme-v2';
  var listeners = [];

  var ThemeManager = {
    /**
     * Get current theme ('dark' | 'light')
     * @returns {string}
     */
    get: function () {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },

    /**
     * Set explicit theme and persist to localStorage
     * @param {string} theme - 'dark' or 'light'
     */
    set: function (theme) {
      if (theme !== 'dark' && theme !== 'light') theme = 'light';
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (_) {}

      // Synchronize meta theme-color tag
      var metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1714' : '#faf7f2');
      }

      // Notify listeners
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](theme);
        } catch (err) {
          console.warn('[ThemeManager] Listener error:', err);
        }
      }

      // Custom DOM event
      var evt;
      if (typeof CustomEvent === 'function') {
        evt = new CustomEvent('sgou-theme-changed', { detail: { theme: theme } });
      } else {
        evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('sgou-theme-changed', false, false, { theme: theme });
      }
      document.dispatchEvent(evt);
    },

    /**
     * Toggle between dark and light theme
     * @returns {string} New theme
     */
    toggle: function () {
      var next = ThemeManager.get() === 'dark' ? 'light' : 'dark';
      ThemeManager.set(next);
      return next;
    },

    /**
     * Subscribe to theme change events
     * @param {Function} callback - (theme: string) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe: function (callback) {
      if (typeof callback === 'function') {
        listeners.push(callback);
      }
      return function () {
        var idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    /**
     * Initialize theme listeners on interactive buttons
     */
    init: function () {
      // Automatic binding to common theme toggle buttons
      var triggers = ['#themeToggle', '#topbarThemeToggle', '#viewerThemeToggle', '[data-action="toggle-theme"]'];
      triggers.forEach(function (sel) {
        var btn = document.querySelector(sel);
        if (btn && !btn._themeBound) {
          btn._themeBound = true;
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            ThemeManager.toggle();
          });
        }
      });
    }
  };

  return ThemeManager;
});
