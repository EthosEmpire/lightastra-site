/**
 * Light Astra — reveal on scroll
 *
 * Elements marked with data-reveal fade in the first time they scroll into view.
 *
 * Content is never hidden by default. Only elements that are still below the viewport when
 * this module starts are given .reveal-pending, so a script that fails to load, a visitor
 * who prefers reduced motion, a print-out and a search engine all see every piece of content.
 *
 * Markup contract:
 *   [data-reveal]                 the element to reveal
 *   [data-reveal-delay="1".."6"]  optional stagger step (the delay itself is defined in CSS)
 * CSS contract:
 *   .reveal-pending               the hidden starting state
 *   [data-reveal]                 carries the transition
 */

import { effectsAllowed, onMotionPreferenceChange } from './preferences.js';

export function initReveal(config = {}) {
  const items = Array.from(document.querySelectorAll('[data-reveal]'));
  if (!items.length || !('IntersectionObserver' in window)) {
    return;
  }
  if (config.effects && (config.effects.enabled === false || config.effects.reveal === false)) {
    return;
  }
  if (!effectsAllowed()) {
    return;
  }

  const pending = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          pending.delete(entry.target);
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
  );

  const fold = window.innerHeight * 0.95;
  for (const item of items) {
    if (item.getBoundingClientRect().top > fold) {
      item.classList.add('reveal-pending');
      pending.add(item);
      observer.observe(item);
    }
  }

  const showEverything = () => {
    for (const item of pending) {
      item.classList.remove('reveal-pending');
    }
    pending.clear();
    observer.disconnect();
  };

  // If the visitor switches reduced motion on while the page is open, stop hiding things.
  onMotionPreferenceChange((reduced) => {
    if (reduced) {
      showEverything();
    }
  });
  // Printing must never produce blank sections.
  window.addEventListener('beforeprint', showEverything);
}
