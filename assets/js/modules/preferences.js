/**
 * Light Astra — visitor and site preferences for motion and effects
 *
 * One place that answers "may decorative motion run right now?":
 *   - the visitor's operating-system setting (prefers-reduced-motion), and
 *   - the site switch on the <html> element: data-fx="on" | "lite" | "off".
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

/** True when the visitor has asked their system to reduce motion. */
export function prefersReducedMotion() {
  return REDUCED_MOTION.matches;
}

/** The site-wide effects level from <html data-fx="…">: 'on' (default), 'lite' or 'off'. */
export function effectsLevel() {
  const level = document.documentElement.dataset.fx;
  return level === 'off' || level === 'lite' ? level : 'on';
}

/** True when scripted, decorative motion is allowed. */
export function effectsAllowed() {
  return !prefersReducedMotion() && effectsLevel() !== 'off';
}

/** Calls listener(reduced: boolean) whenever the visitor's motion preference changes. */
export function onMotionPreferenceChange(listener) {
  const handler = (event) => listener(event.matches);
  if (typeof REDUCED_MOTION.addEventListener === 'function') {
    REDUCED_MOTION.addEventListener('change', handler);
  } else if (typeof REDUCED_MOTION.addListener === 'function') {
    REDUCED_MOTION.addListener(handler); // Safari 13 and earlier
  }
}
