/**
 * Light Astra — header and navigation (every page)
 *
 * - Menu: a disclosure button that shows and hides the navigation on phones and tablets.
 *   It closes on Escape (focus returns to the button), when any link in the header is
 *   chosen, on a click outside, when keyboard focus leaves the header, and when the
 *   layout switches to the desktop row. On phones (below 600px) the open sheet is an
 *   opaque full-screen layer, so <main> and <footer> are inert while it is open: Tab,
 *   pointer and screen-reader reading stay inside the sheet.
 * - Header state: adds .is-scrolled once the page has moved away from the top.
 * - Current page: the composer (scripts/build_pages.py) writes aria-current="page" on the
 *   current page's link at build time; this module never touches it.
 * - Current section (optional): when a page's navigation also contains in-page links
 *   (<a href="#id"> inside [data-nav]), the link of the section being read gets
 *   aria-current="true" while scrolling. Pages without in-page links skip this entirely.
 *
 * Markup contract (site/layout.html):
 *   [data-header]      the <header>
 *   [data-nav-toggle]  the menu <button> (aria-expanded, aria-controls)
 *   [data-nav]         the <nav>; page links are plain <a href="/page.html">, section links <a href="#id">
 *   main, footer       the page behind the sheet; carry the inert attribute while it is open
 *
 * Without JavaScript the navigation is simply always visible (see boot.js).
 */

export function initNav() {
  const header = document.querySelector('[data-header]');
  const nav = document.querySelector('[data-nav]');
  if (!header || !nav) {
    return;
  }
  initMenu(header);
  initScrolledState(header);
  initCurrentSection(nav);
}

function initMenu(header) {
  const toggle = header.querySelector('[data-nav-toggle]');
  if (!toggle) {
    return;
  }
  // Below 600px the sheet covers the whole page (responsive.css, "phones only").
  const phone = window.matchMedia('(max-width: 599.98px)');
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  // The page behind the open phone sheet is inert: nothing in <main> or <footer> can be
  // focused, clicked or read by assistive technology until the sheet closes.
  const setInert = (inert) => {
    for (const region of document.querySelectorAll('main, footer')) {
      region.toggleAttribute('inert', inert);
    }
  };
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('is-menu-open', open);
    setInert(open && phone.matches);
  };

  setOpen(false);

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // Any link in the header closes the sheet: the navigation links and the call to action
  // inside it, and the brand mark and the Quote button, which stay clickable above it.
  header.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (isOpen() && !header.contains(event.target)) {
      setOpen(false);
    }
  });

  // Keyboard focus moving past the sheet (to the skip link, or to the page on tablets, where
  // the sheet is a card) closes it, so focus never lands behind an open menu.
  header.addEventListener('focusout', (event) => {
    if (isOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) {
      setOpen(false);
    }
  });

  // The inert page belongs to the phone sheet only: keep it in step when the width crosses 600px.
  phone.addEventListener('change', () => setInert(isOpen() && phone.matches));

  // When the layout switches to the desktop navigation the button is no longer rendered.
  window.addEventListener('resize', () => {
    if (isOpen() && toggle.offsetParent === null) {
      setOpen(false);
    }
  });
}

function initScrolledState(header) {
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/** In-page section highlighting: only for navigation links of the form href="#id". */
function initCurrentSection(nav) {
  const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
  const pairs = [];
  const seen = new Set();
  for (const link of links) {
    const id = link.getAttribute('href').slice(1);
    const section = id ? document.getElementById(id) : null;
    // One link per section: the first one in the navigation wins; buttons never take part.
    if (section && !seen.has(id) && !link.classList.contains('btn')) {
      seen.add(id);
      pairs.push({ link, section });
    }
  }
  if (!pairs.length) {
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    // The current section is the last one whose top has passed the upper third of the viewport.
    const line = window.innerHeight * 0.35;
    let current = pairs[0];
    for (const pair of pairs) {
      if (pair.section.getBoundingClientRect().top <= line) {
        current = pair;
      }
    }
    // At the very bottom of the page the last section is current even if it is short.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = pairs.reduce((last, pair) =>
        pair.section.offsetTop > last.section.offsetTop ? pair : last,
      );
    }
    for (const pair of pairs) {
      if (pair === current) {
        pair.link.setAttribute('aria-current', 'true');
      } else {
        pair.link.removeAttribute('aria-current');
      }
    }
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}
