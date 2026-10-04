/**
 * Light Astra — social links
 *
 * Instagram is the only public profile (owner direction, 2026-10-03), and its footer link
 * ships live in the HTML: href, target, rel and a complete accessible name whose text ends
 * in "(opens in a new tab)". This module reads the address from site-config.js and
 * re-applies it to that link, together with target="_blank" and rel="me noopener noreferrer",
 * so the configuration stays the one place to change the address. It never rewrites the
 * accessible name of a link that has text, hides nothing that is live, and adds no profile
 * of its own: a network outside NETWORKS, or one without an https:// address, is left as
 * the HTML shipped it (a text-less, disabled placeholder would be hidden only when
 * siteConfig.socialPlaceholders is 'hidden'; the site ships none).
 *
 * Markup contract:
 *   [data-social-block]              wrapper hidden entirely when nothing is left to show
 *   a[data-social="instagram"]       the link (a placeholder would be <a role="link" aria-disabled="true"> with no href)
 *     [data-social-note]             optional child that says "soon" (removed once the link is live)
 *   data-social-name="Instagram"     the network's display name; used for the accessible name only
 *                                    when the link has no text of its own (an icon-only link)
 */

/** Allow-list of the networks this module activates: Instagram only. */
const NETWORKS = ['instagram'];

export function initSocial(config = {}) {
  const addresses = config.social || {};
  const hidePending = config.socialPlaceholders === 'hidden';

  for (const block of document.querySelectorAll('[data-social-block]')) {
    let visible = 0;
    for (const link of block.querySelectorAll('[data-social]')) {
      const network = link.dataset.social;
      const address = NETWORKS.includes(network) ? safeAddress(addresses[network]) : '';
      const item = link.closest('li') || link;
      if (address) {
        activate(link, address);
        visible += 1;
      } else if (hidePending) {
        item.hidden = true;
      } else {
        visible += 1;
      }
    }
    block.hidden = visible === 0;
  }
}

/** Only absolute https:// addresses are accepted; anything else is treated as "not set". */
function safeAddress(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function activate(link, address) {
  link.href = address;
  link.target = '_blank';
  link.rel = 'me noopener noreferrer';
  link.removeAttribute('role');
  link.removeAttribute('aria-disabled');
  // A link with text keeps the name the HTML gives it (visible text plus the new-tab note), so
  // what is announced is what is seen. Only a text-less link, such as an icon, is named here.
  if (!link.textContent.trim() && !link.hasAttribute('aria-label')) {
    const name = link.dataset.socialName || link.dataset.social;
    link.setAttribute('aria-label', `Light Astra on ${name} (opens in a new tab)`);
  }
  link.classList.add('is-live');
  link.querySelector('[data-social-note]')?.remove();
}
