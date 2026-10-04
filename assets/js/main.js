/**
 * Light Astra — main entry (shared by every page)
 *
 * Loads the site configuration and starts each feature. Every feature lives in its own
 * module under ./modules and is started independently, so a problem in one can never stop
 * the others; a module whose markup is not on the current page returns at once. The page
 * is fully readable and the contact details are usable without any of this running.
 */
import { siteConfig } from './site-config.js';
import { initNav } from './modules/nav.js';
import { initReveal } from './modules/reveal.js';
import { initMilk } from './modules/milk.js';
import { initDepth } from './modules/depth.js';
import { initContactForm } from './modules/contact-form.js';
import { supportProfile } from './modules/support-message.js';
import { initBusinessApps } from './modules/business-apps.js';
import { initClipboard } from './modules/clipboard.js';
import { initSocial } from './modules/social.js';

const features = [
  ['navigation', initNav],
  ['social links', initSocial],
  ['contact form', (config) => initContactForm(config, { support: supportProfile })],
  ['clipboard', initClipboard],
  ['reveal on scroll', initReveal],
  ['milk light', initMilk],
  ['depth', initDepth],
  ['business apps atmosphere', initBusinessApps],
  ['footer year', initYear],
];

for (const [name, start] of features) {
  try {
    start(siteConfig);
  } catch (error) {
    console.error(`[light-astra] "${name}" could not start`, error);
    // The stylesheet stops relying on scripts for anything optional (e.g. the form's conditional parts).
    document.documentElement.classList.add('js-degraded');
  }
}

// Tells boot.js (and the CSS) that scripting is fully up.
document.documentElement.classList.add('js-ready');

/** Keeps the copyright year current: <span data-year>2026</span>. */
function initYear() {
  const year = String(new Date().getFullYear());
  for (const node of document.querySelectorAll('[data-year]')) {
    node.textContent = year;
  }
}
