/**
 * Light Astra — depth (the 2D→3D presentation of images)
 *
 * Project plates and the founder figure tilt a few degrees in perspective as they travel
 * through the viewport, drift a little against the scroll and grow by at most 2%; on a
 * device with a fine pointer that can hover, a plate also leans gently toward the pointer.
 * Purely decorative: nothing happens under prefers-reduced-motion, under <html data-fx="off">
 * or "lite" (lite means "no scripted motion", as for the atmosphere), or when
 * siteConfig.effects.depth is false. Without this module the plates simply stand still.
 *
 * Markup contract:
 *   [data-depth]            the element that moves; only its transform is ever written,
 *                           through element.style, so nothing shifts layout
 *   data-depth="tilt"       (default) rotateX/rotateY of a few degrees + lift + scale
 *   data-depth="lift"       lift and scale only, no rotation (for wide or text-heavy plates)
 *   .depth (the parent)     supplies `perspective` and the glow behind the plate (CSS, section 13)
 *   Never put data-depth and data-reveal on the same element: reveal.js animates the
 *   wrapper's transform, this module the plate's.
 *
 * Rules kept here: one requestAnimationFrame per scroll/pointer burst, an
 * IntersectionObserver so off-screen plates cost nothing, never more than MAX_TILT degrees
 * so screenshots stay readable, and transforms are measured from the untransformed wrapper so
 * the plate never chases its own movement.
 */
import { effectsAllowed, effectsLevel, onMotionPreferenceChange } from './preferences.js';

const TILT_X = 2.5;   // degrees from the scroll position: the top edge leans away as a plate rises into view
const TILT_Y = 1.25;  // degrees from the plate's horizontal offset: it turns toward the page centre
const POINTER = 2;    // degrees from the pointer position, on hover-capable fine pointers only
const MAX_TILT = 4;   // degrees, absolute ceiling for either axis
const LIFT = 10;      // px of counter-scroll travel (parallax)
const SCALE = 0.02;   // 1.00 at the viewport edges, 1.02 at its centre

export function initDepth(config = {}) {
  if (config.effects && (config.effects.enabled === false || config.effects.depth === false)) {
    return;
  }
  const plates = Array.from(document.querySelectorAll('[data-depth]')).map((element) => ({
    element,
    // Measured from the untransformed wrapper (.depth), so the plate never chases itself.
    anchor: element.parentElement || element,
    mode: element.dataset.depth === 'lift' ? 'lift' : 'tilt',
    pointer: { x: 0, y: 0 },
    onScreen: false,
    last: '',
  }));
  if (!plates.length || !('IntersectionObserver' in window)) {
    return;
  }

  const allowed = () => effectsAllowed() && effectsLevel() === 'on';
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let ticking = false;

  const render = () => {
    ticking = false;
    if (!allowed()) {
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const plate of plates) {
      if (!plate.onScreen) {
        continue;
      }
      const rect = plate.anchor.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }
      // p: -1 when the plate has just left at the top, 0 at the viewport centre, 1 just below.
      const p = clamp((rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2), -1, 1);
      // q: -1 at the left edge of the viewport, 1 at the right edge.
      const q = clamp((rect.left + rect.width / 2 - vw / 2) / (vw / 2), -1, 1);
      const lift = -p * LIFT;
      const scale = 1 + SCALE * (1 - Math.abs(p));
      let rx = 0;
      let ry = 0;
      if (plate.mode === 'tilt') {
        rx = clamp(p * TILT_X + plate.pointer.y * POINTER, -MAX_TILT, MAX_TILT);
        ry = clamp(-q * TILT_Y - plate.pointer.x * POINTER, -MAX_TILT, MAX_TILT);
      }
      const transform =
        `translate3d(0, ${lift.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) ` +
        `rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      if (transform !== plate.last) {
        plate.last = transform;
        plate.element.style.transform = transform;
      }
    }
  };

  const request = () => {
    if (!ticking && plates.some((plate) => plate.onScreen)) {
      ticking = true;
      window.requestAnimationFrame(render);
    }
  };

  const reset = () => {
    for (const plate of plates) {
      plate.element.style.transform = '';
      plate.last = '';
    }
  };

  // Only plates near the viewport are measured; a margin lets a plate settle before it shows.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const plate = plates.find((candidate) => candidate.anchor === entry.target);
        if (plate) {
          plate.onScreen = entry.isIntersecting;
        }
      }
      request();
    },
    { rootMargin: '25% 0px' },
  );
  for (const plate of plates) {
    observer.observe(plate.anchor);
  }

  // The pointer lean: the corner under the pointer comes toward the visitor.
  for (const plate of plates) {
    if (plate.mode !== 'tilt') {
      continue;
    }
    plate.element.addEventListener('pointermove', (event) => {
      if (!finePointer.matches) {
        return;
      }
      const rect = plate.element.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      plate.pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      plate.pointer.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      request();
    });
    plate.element.addEventListener('pointerleave', () => {
      plate.pointer.x = 0;
      plate.pointer.y = 0;
      request();
    });
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);

  onMotionPreferenceChange((reduced) => {
    if (reduced) {
      reset();
    } else {
      request();
    }
  });

  // The site switch can change while the page is open (data-fx="off" clears the plates).
  if ('MutationObserver' in window) {
    new MutationObserver(() => {
      if (allowed()) {
        request();
      } else {
        reset();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-fx'] });
  }

  request();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
