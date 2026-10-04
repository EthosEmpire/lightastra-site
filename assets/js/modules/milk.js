/**
 * Light Astra — milk light (the soft background motion)
 *
 * The milk light itself is CSS: three pale fields drifting very slowly behind a hero
 * (components.css ".milk", animations.css "drift-*"). This module only keeps it cheap:
 * while a layer's section is out of the viewport the section carries "is-offscreen",
 * which pauses the keyframes, and the class goes away as soon as it scrolls back into
 * view. Reduced motion and the <html data-fx> switch are honoured by the stylesheet, so
 * nothing here needs to know about them; when siteConfig.effects.milk is false the
 * layers are simply left paused (the light is still painted, just still).
 *
 * Markup contract:
 *   [data-milk]   a .milk layer (partial site/partials/milk-light.html); its closest
 *                 section, header or article is the scope that is observed
 */
export function initMilk(config = {}) {
  const layers = Array.from(document.querySelectorAll('[data-milk]'));
  if (!layers.length) {
    return;
  }
  const scopes = new Set(layers.map((layer) => layer.closest('section, header, article, main') || layer));

  const disabled = config.effects && (config.effects.enabled === false || config.effects.milk === false);
  if (disabled || !('IntersectionObserver' in window)) {
    for (const scope of scopes) {
      scope.classList.toggle('is-offscreen', Boolean(disabled));
    }
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
    }
  });
  for (const scope of scopes) {
    observer.observe(scope);
  }
}
