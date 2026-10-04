/**
 * Light Astra — the Business Apps chapter's atmosphere (pricing.html)
 *
 * The chapter's colour fields drift in CSS (pages/business-apps.css); this module adds the
 * two things CSS cannot do alone and keeps them cheap:
 *   - a soft pointer light on desktop: --mx / --my (pixels inside the section, at most once
 *     per frame) move a fixed disc through a transform, and --apps-light switches it on while
 *     the pointer is inside (fine pointers only);
 *   - a slow parallax of the blurred emblem: --apps-scroll is the section's progress through
 *     the viewport (0 entering, 1 leaving), updated at most once per frame while visible.
 * Off screen the section carries "is-offscreen" so the keyframes pause (the milk.js
 * convention). Reduced motion, <html data-fx="off" | "lite"> and siteConfig.effects.apps
 * = false stop both effects; the stylesheet keeps the composition static and complete.
 *
 * Markup contract: section[data-apps] (the chapter) — nothing else is touched.
 */
import { effectsAllowed, effectsLevel, onMotionPreferenceChange } from './preferences.js';

const VARS = ['--mx', '--my', '--apps-light', '--apps-scroll'];

export function initBusinessApps(config = {}) {
  const section = document.querySelector('[data-apps]');
  if (!section) {
    return;
  }
  const disabled = config.effects && (config.effects.enabled === false || config.effects.apps === false);
  if (disabled || !('IntersectionObserver' in window)) {
    section.classList.toggle('is-offscreen', Boolean(disabled));
    return;
  }

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const allowed = () => effectsAllowed() && effectsLevel() === 'on';
  let visible = false;
  let frame = 0;

  const reset = () => {
    for (const name of VARS) {
      section.style.removeProperty(name);
    }
  };

  let pointer = null;
  let lightFrame = 0;
  const light = (event) => {
    if (!allowed() || !finePointer.matches) {
      return;
    }
    pointer = event;
    if (lightFrame) {
      return;
    }
    lightFrame = requestAnimationFrame(() => {
      lightFrame = 0;
      const box = section.getBoundingClientRect();
      section.style.setProperty('--mx', `${Math.round(pointer.clientX - box.left)}px`);
      section.style.setProperty('--my', `${Math.round(pointer.clientY - box.top)}px`);
      section.style.setProperty('--apps-light', '1');
    });
  };

  const lightOff = () => {
    section.style.setProperty('--apps-light', '0');
  };

  const parallax = () => {
    if (frame || !visible) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!allowed()) {
        return;
      }
      const box = section.getBoundingClientRect();
      const progress = (window.innerHeight - box.top) / (window.innerHeight + box.height);
      section.style.setProperty('--apps-scroll', Math.min(1, Math.max(0, progress)).toFixed(3));
    });
  };

  section.addEventListener('pointermove', light);
  section.addEventListener('pointerleave', lightOff);
  window.addEventListener('scroll', parallax, { passive: true });
  window.addEventListener('resize', parallax);

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      visible = entry.isIntersecting;
      section.classList.toggle('is-offscreen', !visible);
      if (visible) {
        parallax();
      }
    }
  });
  observer.observe(section);

  onMotionPreferenceChange((reduced) => {
    if (reduced) {
      reset();
    }
  });
  if (!allowed()) {
    reset();
  }
}
