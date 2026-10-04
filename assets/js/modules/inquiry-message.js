/**
 * Light Astra — inquiry message helpers
 *
 * Pure functions with no DOM access, so they can be unit-tested in Node
 * (see qa/test_inquiry_message.mjs) and reused by any future backend transport.
 */

const CRLF = '\r\n';

/** Longest mailto: address that is safe across common mail apps and operating systems. */
export const MAILTO_SAFE_LENGTH = 1900;

/** Gmail's compose URL tolerates more, but not unlimited, text. */
export const GMAIL_SAFE_LENGTH = 6000;

const SHORTENED_NOTE =
  '[Message shortened to fit this email link. The full text is on the lightastra.com page: use its Copy button and paste it here.]';

/** True for a plausible email address (one @, a dot in the domain, no spaces). */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim());
}

/**
 * Accepts "example.com" as well as "https://example.com".
 * Returns { value, valid }: value is the address with a scheme, valid is false for anything
 * that is not an http(s) web address. An empty input is valid (the field is optional).
 */
export function normalizeWebsite(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { value: '', valid: true };
  }
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
    const hasDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname);
    // "mailto:someone@example.com" or an email address would otherwise parse as
    // https://user:password@host — a web address for a website never carries credentials.
    const hasCredentials = Boolean(url.username || url.password);
    return { value: candidate, valid: isWeb && hasDomain && !hasCredentials };
  } catch {
    return { value: candidate, valid: false };
  }
}

/**
 * Turns the filled-in fields into the plain-text email body.
 * entries: [{ label, value, multiline }] in form order. Empty values are skipped.
 */
export function composeMessage(entries, footer = '') {
  const parts = [];
  for (const entry of entries) {
    const value = String(entry.value ?? '').trim();
    if (!value) {
      continue;
    }
    if (entry.multiline) {
      if (parts.length) {
        parts.push('');
      }
      parts.push(`${entry.label}:`, value.replace(/\r?\n/g, CRLF));
    } else {
      parts.push(`${entry.label}: ${value}`);
    }
  }
  if (footer) {
    parts.push('', '--', footer);
  }
  return parts.join(CRLF);
}

/** A subject is a single header line: line breaks typed or pasted into a field become spaces. */
function oneLine(text) {
  return String(text ?? '').replace(/[\r\n]+/g, ' ').trim();
}

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;

/** Replaces half emoji (lone UTF-16 surrogates) with U+FFFD; encodeURIComponent throws on them. */
function repairText(text) {
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (isHighSurrogate(code) && isLowSurrogate(text.charCodeAt(index + 1))) {
      out += text[index] + text[index + 1];
      index += 1;
    } else if (isHighSurrogate(code) || isLowSurrogate(code)) {
      out += '�';
    } else {
      out += text[index];
    }
  }
  return out;
}

/** encodeURIComponent that never throws, whatever was pasted into a field. */
function encode(text) {
  const value = String(text ?? '');
  try {
    return encodeURIComponent(value);
  } catch {
    return encodeURIComponent(repairText(value));
  }
}

/** mailto: address for one recipient with a subject and body (RFC 6068 percent-encoding). */
export function buildMailtoUrl({ to, subject, body }) {
  const recipient = encode(oneLine(to)).replace(/%40/g, '@');
  return `mailto:${recipient}?subject=${encode(oneLine(subject))}&body=${encode(body)}`;
}

/** Gmail's web compose window, prefilled. Opens only when the visitor chooses it. */
export function buildGmailUrl({ to, subject, body }) {
  const query = [
    'view=cm',
    'fs=1',
    `to=${encode(oneLine(to))}`,
    `su=${encode(oneLine(subject))}`,
    `body=${encode(body)}`,
  ].join('&');
  return `https://mail.google.com/mail/?${query}`;
}

/**
 * Builds a link with `build` and, when it is longer than `limit`, shortens the body until
 * it fits and appends a note telling the reader where the full text is.
 * Returns { url, shortened }.
 */
export function fitToLength(build, message, limit) {
  const full = build(message);
  if (full.length <= limit) {
    return { url: full, shortened: false };
  }
  const body = String(message.body);
  const withBody = (count) => {
    // Never cut an emoji in half.
    const end = count > 0 && isHighSurrogate(body.charCodeAt(count - 1)) ? count - 1 : count;
    return build({ ...message, body: `${body.slice(0, end).trimEnd()}${CRLF}${CRLF}${SHORTENED_NOTE}` });
  };
  let low = 0;
  let high = body.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (withBody(middle).length <= limit) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return { url: withBody(low), shortened: true };
}

/** mailto: address that stays within MAILTO_SAFE_LENGTH. Returns { url, shortened }. */
export function fitMailto(message, limit = MAILTO_SAFE_LENGTH) {
  return fitToLength(buildMailtoUrl, message, limit);
}

/** Gmail compose address that stays within GMAIL_SAFE_LENGTH. Returns { url, shortened }. */
export function fitGmail(message, limit = GMAIL_SAFE_LENGTH) {
  return fitToLength(buildGmailUrl, message, limit);
}
