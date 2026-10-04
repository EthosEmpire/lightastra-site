/*
 * Light Astra — boot
 *
 * A tiny classic script loaded in <head>. It marks the document as script-enabled before
 * the first paint, so the mobile menu starts closed without a flash.
 *
 * Safety net: if main.js never finishes starting (network error, very old browser), the
 * mark is removed after a few seconds and the page falls back to its no-script layout,
 * where the navigation is simply always visible.
 */
(function (root) {
  'use strict';
  root.classList.add('js');
  window.setTimeout(function () {
    if (!root.classList.contains('js-ready')) {
      root.classList.remove('js');
    }
  }, 6000);
})(document.documentElement);
