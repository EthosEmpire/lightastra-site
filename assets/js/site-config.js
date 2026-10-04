/**
 * Light Astra — site configuration
 *
 * The one place to change the social link, how the contact form is delivered and which
 * effects run. Edit the values, save, reload. Nothing here is secret: this file is public,
 * so never put passwords, tokens or API keys in it.
 */
export const siteConfig = {
  /**
   * Social profiles. Instagram is the only public profile; the footer link is already live
   * in the HTML and modules/social.js only confirms it from this address. To add another
   * network later, add its https:// address here and a matching
   * <a data-social="…" data-social-name="…"> inside the footer's [data-social-block].
   */
  social: {
    instagram: 'https://www.instagram.com/lightastra.web/',
  },

  /**
   * What to do with a listed profile that has no address yet:
   *   'disabled' — show it greyed out and marked "soon" (not clickable, announced as unavailable)
   *   'hidden'   — do not show it at all; the whole block disappears if none has an address
   */
  socialPlaceholders: 'hidden',

  /**
   * Contact form delivery.
   *   transport: 'mailto'   — Phase 1. Opens the visitor's email app with the message filled in.
   *   transport: 'endpoint' — later phases. POSTs the inquiry as JSON to `endpoint`
   *                           (the Light Astra lead backend, a Firebase function, the CRM…).
   * The recipient address itself lives in the form's action attribute in quote.html.
   * Switching to 'endpoint' also means extending the Content-Security-Policy in
   * site/layout.html (connect-src) to the backend's origin and allowing the site's origin
   * on the backend (docs/integration-points.md).
   */
  inquiry: {
    transport: 'mailto',
    endpoint: '',
  },

  /**
   * Client support form delivery (support.html), same two transports. Today every request
   * goes to the email app; the future Light Astra CRM replaces it with
   *   transport: 'endpoint', endpoint: 'https://…/api/support'
   * which receives the record described in docs/integration-points.md ("Client support").
   * The site never invents ticket numbers: the CRM assigns them.
   */
  support: {
    transport: 'mailto',
    endpoint: '',
  },

  /**
   * Visual effects. Set enabled to false to switch every scripted effect off.
   * (The CSS side has its own switch: data-fx="on" | "lite" | "off" on the <html> element.)
   *   reveal      fade-in of blocks as they scroll into view (modules/reveal.js)
   *   milk        the drifting milk light behind a hero (CSS; modules/milk.js pauses it off screen)
   *   depth       the perspective tilt of the dragon jewel, project plates and the portrait (modules/depth.js)
   *   apps        the pointer light and dragon parallax of the Business Apps chapter on pricing.html (modules/business-apps.js)
   */
  effects: {
    enabled: true,
    reveal: true,
    milk: true,
    depth: true,
    apps: true,
  },
};
