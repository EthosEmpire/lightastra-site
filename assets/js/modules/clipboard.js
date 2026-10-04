/**
 * Light Astra — copy to clipboard
 *
 * Markup contract:
 *   <button type="button" data-copy="text to copy">…</button>
 *   <button type="button" data-copy-from="#selector-of-element">…</button>   copies that element's text
 * Optional on the button:
 *   data-copied-label="Copied"          temporary button text after a successful copy
 *   data-copied-message="Email address copied."   what is announced to assistive technology
 *   a child [data-copy-label]           the part of the button whose text is swapped
 * A polite live region with [data-live-region] (visually hidden, one per page) receives the
 * announcement; without it the button text change is the only feedback.
 */

const FEEDBACK_MS = 2200;

export function initClipboard() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy], [data-copy-from]');
    if (!button) {
      return;
    }
    const text = textFor(button);
    if (!text) {
      return;
    }
    const copied = await copyText(text);
    // The legacy path selects a temporary textarea and removes it, which drops focus to <body>:
    // give it back to the button so a keyboard user keeps their place.
    if (document.activeElement === document.body) {
      button.focus({ preventScroll: true });
    }
    giveFeedback(button, copied);
  });
}

function textFor(button) {
  if (button.dataset.copy) {
    return button.dataset.copy;
  }
  const source = button.dataset.copyFrom ? document.querySelector(button.dataset.copyFrom) : null;
  if (!source) {
    return '';
  }
  return 'value' in source && typeof source.value === 'string' ? source.value : source.textContent.trim();
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  return legacyCopy(text);
}

/** Works on plain-HTTP previews and older browsers, where the async clipboard API is unavailable. */
function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'visually-hidden';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

function giveFeedback(button, copied) {
  const label = button.querySelector('[data-copy-label]') || button;
  const original = button.dataset.originalLabel || label.textContent;
  button.dataset.originalLabel = original;

  label.textContent = copied ? button.dataset.copiedLabel || 'Copied' : 'Copy failed';
  button.classList.toggle('is-copied', copied);

  const region = document.querySelector('[data-live-region]');
  if (region) {
    region.textContent = copied
      ? button.dataset.copiedMessage || 'Copied to the clipboard.'
      : 'Copying did not work. Please select the text and copy it manually.';
  }

  window.clearTimeout(Number(button.dataset.copyTimer));
  button.dataset.copyTimer = String(
    window.setTimeout(() => {
      label.textContent = original;
      button.classList.remove('is-copied');
      if (region) {
        region.textContent = '';
      }
    }, FEEDBACK_MS),
  );
}
