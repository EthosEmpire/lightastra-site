/**
 * Light Astra — client support message profile
 *
 * Pure functions (no DOM) that turn the support form's values into the email subject and
 * body used today and into the record a future CRM endpoint will receive. Unit-tested in
 * qa/test_support_message.mjs. The form itself is driven by modules/contact-form.js, which
 * calls this profile for a form marked data-inquiry-kind="support".
 *
 * Field names (the support form):
 *   client_id, project_id, name, company, email, project_url, support_type, priority,
 *   page_url, description
 *
 * Client and project identifiers (LA-C…, LA-P…) only help locate the right project. They
 * are not credentials and nothing here treats them as proof of identity: the future CRM
 * verifies the registered client account and email.
 */

/** Where the record came from, as the future CRM will see it. */
export const SUPPORT_SOURCE = 'lightastra.com/support';

/** Request types, in the order the form lists them. */
export const SUPPORT_TYPES = [
  'Website Content Update',
  'Bug / Something Not Working',
  'New Feature',
  'Design Change',
  'Security Concern',
  'Hosting / Domain',
  'Maintenance',
  'Other',
];

/** Priorities, in the order the form lists them. */
export const PRIORITIES = ['Normal', 'Important', 'Website / Service Down'];

export const PRIORITY_DOWN = 'Website / Service Down';

const SUBJECT_TAG = '[LIGHT ASTRA SUPPORT]';
const DOWN_TAG = '[SERVICE DOWN]';
const MESSAGE_FOOTER = 'Sent from lightastra.com/support.html';
const CRLF = '\r\n';

/** The identifier letter for each ID field. */
const ID_LETTERS = { client_id: 'C', project_id: 'P' };

/**
 * Tidies an identifier the way a person might type it: spaces removed, upper case, the
 * hyphen restored ("la c1027", "LAC1027" and "LA-C1027" all become "LA-C1027"). Anything
 * that does not look like a Light Astra identifier is returned trimmed and upper-cased so the
 * form's pattern check can explain the format. An empty value stays empty (the IDs are optional).
 */
export function normalizeId(value, letter) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) {
    return '';
  }
  const match = raw.match(/^LA-?([A-Z])-?([0-9A-Z]+)$/);
  if (!match) {
    return raw;
  }
  const kind = letter ? String(letter).toUpperCase() : match[1];
  return match[1] === kind ? `LA-${kind}${match[2]}` : raw;
}

/** True for an identifier of the given kind: LA-C or LA-P followed by 2 to 12 letters or digits. */
export function isValidId(value, letter) {
  const kind = String(letter ?? '').toUpperCase();
  return new RegExp(`^LA-${kind}[0-9A-Z]{2,12}$`).test(normalizeId(value, kind));
}

function clean(value) {
  return String(value ?? '').trim();
}

/**
 * Subject line, e.g.
 *   [LIGHT ASTRA SUPPORT] LA-C1027 / LA-P2048 — Website Content Update
 *   [LIGHT ASTRA SUPPORT] Client Support Request — Example Company       (no identifiers)
 * A service-down priority adds [SERVICE DOWN] so the request stands out in the inbox.
 */
export function supportSubject(values = {}) {
  const ids = [normalizeId(values.client_id, 'C'), normalizeId(values.project_id, 'P')].filter(Boolean).join(' / ');
  const tags = clean(values.priority) === PRIORITY_DOWN ? `${SUBJECT_TAG} ${DOWN_TAG}` : SUBJECT_TAG;
  if (ids) {
    return `${tags} ${ids} — ${clean(values.support_type) || 'Support request'}`;
  }
  const who = clean(values.company) || clean(values.name) || 'registered client';
  return `${tags} Client Support Request — ${who}`;
}

/**
 * The plain-text email body: a labelled block per answer, identifiers first. Missing
 * identifiers are written as "(not provided)" so the request is handled by registered email;
 * other empty optional answers are left out.
 */
export function supportBody(values = {}) {
  const blocks = [
    ['Client ID', normalizeId(values.client_id, 'C') || '(not provided)'],
    ['Project ID', normalizeId(values.project_id, 'P') || '(not provided)'],
    ['Client', clean(values.name)],
    ['Company', clean(values.company)],
    ['Registered Email', clean(values.email)],
    ['Website', clean(values.project_url)],
    ['Request Type', clean(values.support_type)],
    ['Priority', clean(values.priority)],
    ['Relevant Page', clean(values.page_url)],
    ['Request', clean(values.description).replace(/\r?\n/g, CRLF)],
  ];
  const parts = ['LIGHT ASTRA CLIENT SUPPORT REQUEST', ''];
  for (const [label, value] of blocks) {
    if (!value) {
      continue;
    }
    parts.push(`${label}:`, value, '');
  }
  parts.push('--', MESSAGE_FOOTER);
  return parts.join(CRLF);
}

/**
 * The record a CRM endpoint (POST /api/support, to be built) will receive. Keys are stable;
 * optional answers are empty strings so the shape never changes. `submittedAt` is the
 * browser's UTC time; the CRM assigns the ticket number (LA-T…) — nothing is invented here.
 */
export function supportPayload(values = {}, submittedAt = new Date().toISOString()) {
  return {
    clientId: normalizeId(values.client_id, 'C'),
    projectId: normalizeId(values.project_id, 'P'),
    name: clean(values.name),
    company: clean(values.company),
    email: clean(values.email),
    projectUrl: clean(values.project_url),
    requestType: clean(values.support_type),
    priority: clean(values.priority),
    pageUrl: clean(values.page_url),
    description: clean(values.description),
    source: SUPPORT_SOURCE,
    submittedAt,
  };
}

/** The profile contact-form.js uses for a form marked data-inquiry-kind="support". */
export const supportProfile = {
  subject: supportSubject,
  body: supportBody,
  payload: (values) => supportPayload(values),
  /** Tidies an identifier field as the visitor leaves it (and again before validation). */
  normalizeField(field) {
    const letter = ID_LETTERS[field.name];
    return letter ? normalizeId(field.value, letter) : undefined;
  },
};
