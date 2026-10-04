/**
 * Light Astra — inquiry forms (quote.html, support.html)
 *
 * The site has no backend yet. A form validates in the browser, then opens the visitor's
 * email app with the message filled in (a mailto: link) and shows a panel with fallbacks:
 * open the email app again, copy the message, copy the address, or open Gmail.
 * Nothing is sent by this script; the visitor presses send in their own email app.
 *
 * One module, two kinds of form, chosen by data-inquiry-kind on the <form>:
 *   (absent / "quote")  the quote form: two modes chosen with the request_type radios — a
 *                       project quote (default) and a consultation. The mode sets the email
 *                       subject base ("Quote request" / "Consultation request", followed by
 *                       " — <visitor's name>"), the submit button text and which optional
 *                       parts are shown ([data-mode-only]). quote.html#consultation selects
 *                       the consultation (the hash is read at load and on change).
 *   "support"           the client support form. Its subject, body and payload come from a
 *                       message profile (modules/support-message.js) that main.js passes in:
 *                       initContactForm(config, { support: supportProfile }). A profile is
 *                       { subject(values), body(values, entries), payload(values),
 *                       normalizeField?(field) } — pure functions over the form's values by
 *                       field name, so the message format is unit-testable without a browser.
 *
 * Later phases deliver an inquiry to a backend by setting the form kind's transport to
 * 'endpoint' in site-config.js (`inquiry` for the quote form, `support` for the support
 * form). The quote payload follows the contract of the Light Astra lead backend
 * (supabase/README.md on the integration branch): only the fields listed in ENDPOINT_FIELDS
 * are sent, request_type is always "project_inquiry" (the contract's one type for both
 * modes), and the fields the contract does not know (the consultation mode,
 * desired_timeline, preferred_times) are folded into design_notes as labelled first lines
 * (see FOLDED_FIELDS). The support payload is the profile's record (docs/integration-points.md).
 * A 422 answer carries per-field error codes, and any other failure falls back to the email
 * app so a request is never lost.
 *
 * Markup contract:
 *   form[data-inquiry-form]            action="mailto:<recipient>"; data-subject="Quote request" (quote default subject base);
 *                                      data-inquiry-kind="support" for the support form
 *   fieldset[data-request-type]        the quote form's mode switch: radios name="request_type" value="quote|consultation",
 *     [data-summary-label]             each with data-subject="<subject base>", data-submit-label="<button text>" and
 *                                      data-summary-value="<text for the email>"; the fieldset's data-summary-label
 *                                      ("Request type") puts the choice into the email like any other field
 *   [data-mode-only="<mode>"]          parts shown only in that mode; hidden and disabled otherwise (visible without JavaScript)
 *   [data-show-when="<field>=<value>"] parts shown only while a named field (a select or radio group) has that value —
 *                                      the quote form's business-app questions; hidden and disabled otherwise; a control
 *                                      with data-required is required only while its part is shown
 *   option[data-hash="<name>"]         a select option the page hash preselects: /quote.html#business-app chooses the
 *                                      business-app service (read at load and on hashchange)
 *   [data-summary-label]               every field that belongs in the email, in order (quote form; profiles read values by name)
 *   [data-msg-required] [data-msg-invalid] [data-msg-short] [data-msg-long]   validation messages (HTML-owned copy)
 *   pattern="…"                        an input's format, checked after the profile tidied the value (data-msg-invalid explains it)
 *   [data-normalize="website"]         a web-address field: a bare domain is completed to https:// on blur and in the message
 *                                      (the quote form's existing_website field behaves the same by name)
 *   [data-error-for="<field name>"]    where a field's message is shown (referenced by aria-describedby)
 *   input[data-honeypot]               honeypot: hidden, named company_url by this script, must stay empty; never in the email
 *   [data-submit]                      the submit button; its text lives in [data-submit-label] (or the button itself)
 *   [data-inquiry-status]              the panel shown after submit (tabindex="-1"), containing
 *     [data-status-title] [data-inquiry-preview] [data-mailto-link] [data-gmail-link] [data-inquiry-edit]
 *     [data-mailto-only]               parts that only make sense when the email app was used
 *   a[href="#quote"] etc.              any link elsewhere on the page to the form, to something inside it (#consultation)
 *                                      or to its section brings the form back while the status panel is showing; a link
 *                                      to a wider target (the skip link to #main) does not; optional data-project-type /
 *                                      data-prefill preselect the service and start the message
 */
import { composeMessage, fitGmail, fitMailto, isValidEmail, normalizeWebsite } from './inquiry-message.js';
import { quoteRecord } from './quote-record.js';

const MESSAGE_FOOTER = 'Sent from lightastra.com';
const DEFAULT_SUBJECT = 'Quote request';
const DEFAULT_MODE = 'quote';

/** The backend's one request type: both quote modes are project inquiries to the lead backend. */
const REQUEST_TYPE = 'project_inquiry';

/** The only fields the lead backend receives, by name (anything else is refused by the endpoint). */
const ENDPOINT_FIELDS = [
  'name',
  'email',
  'business',
  'existing_website',
  'project_type',
  'estimated_budget',
  'desired_launch_date',
  'message',
  'design_notes',
  'company_url',
];

/** Quote-form fields outside the backend contract: where their value travels, and its label. */
const FOLDED_FIELDS = {
  desired_timeline: { into: 'design_notes', label: 'Desired timeline' },
  preferred_times: { into: 'design_notes', label: 'Preferred days and times' },
  app_purpose: { into: 'design_notes', label: 'App purpose' },
  employee_range: { into: 'design_notes', label: 'Employees' },
  existing_system: { into: 'design_notes', label: 'Existing system' },
};

const LIMITS = {
  name: { min: 2, max: 120 },
  message: { min: 10, max: 5000 },
  business: { max: 160 },
  existing_website: { max: 300 },
  estimated_budget: { max: 80 },
  desired_timeline: { max: 120 },
  preferred_times: { max: 200 },
  design_notes: { max: 3000 },
  app_purpose: { min: 10, max: 1200 },
  existing_system: { max: 200 },
  // support form
  company: { max: 160 },
  project_url: { max: 300 },
  page_url: { max: 300 },
  description: { min: 10, max: 5000 },
};

/** The message profile of each initialised form (none for the quote form). */
const profilesByForm = new WeakMap();

export function initContactForm(config = {}, profiles = {}) {
  const form = document.querySelector('[data-inquiry-form]');
  if (!form) {
    return;
  }
  const status = document.querySelector('[data-inquiry-status]');
  const kind = form.dataset.inquiryKind || DEFAULT_MODE;
  const profile = profiles[kind] || null;
  if (profile) {
    profilesByForm.set(form, profile);
  }
  const delivery = (kind === DEFAULT_MODE ? config.inquiry : config[kind]) || {};
  const settings = { transport: 'mailto', endpoint: '', ...delivery };

  // Scripted validation replaces the browser's bubbles with clear, consistent inline messages.
  // Without JavaScript the native validation and the mailto: action still work.
  form.noValidate = true;

  // The honeypot gets its field name only here: a no-script submission (the native mailto:
  // fallback) therefore never carries it, while a backend still receives it as company_url.
  form.querySelector('[data-honeypot]')?.setAttribute('name', 'company_url');

  initModes(form, kind);
  initConditions(form);
  initHashOptions(form);
  setEarliestLaunchDate(form);

  // Links elsewhere on the page that lead to the form ("Get a Quote", "Book a consultation",
  // "Request support") bring the form back while the status panel is showing, and may
  // preselect the service or start the message.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('a[href^="#"], [data-project-type], [data-prefill]');
    if (!trigger || form.contains(trigger) || !leadsToForm(trigger, form)) {
      return;
    }
    preselect(form, trigger.dataset);
    if (status && !status.hidden) {
      showForm(form, status);
    }
  });

  form.addEventListener('focusout', (event) => {
    const field = event.target;
    if (isWebsiteField(field)) {
      const result = normalizeWebsite(field.value);
      if (result.valid && result.value) {
        field.value = result.value;
      }
    }
    tidy(form, field);
    if (form.dataset.validated === 'true' && isValidatable(field)) {
      validateField(form, field);
    }
  });

  form.addEventListener('input', (event) => {
    if (event.target.getAttribute('aria-invalid') === 'true') {
      validateField(form, event.target);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.busy === 'true') {
      return;
    }
    form.dataset.validated = 'true';
    const invalid = getFields(form).filter((field) => !validateField(form, field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const inquiry = readInquiry(form);
    setBusy(form, true);
    let delivered = false;
    try {
      if (settings.transport === 'endpoint' && settings.endpoint) {
        const outcome = await sendToEndpoint(settings.endpoint, inquiry.payload);
        if (outcome.fieldErrors) {
          showServerErrors(form, outcome.fieldErrors);
          return;
        }
        delivered = outcome.ok;
      }
    } catch (error) {
      // A backend problem must never lose a request: fall through to the email app.
      console.warn('[light-astra] inquiry endpoint unavailable, using the email app instead', error);
    } finally {
      setBusy(form, false);
    }
    if (!delivered) {
      window.location.href = inquiry.mailtoUrl;
    }
    showStatus(form, status, inquiry, delivered);
  });

  status?.querySelector('[data-inquiry-edit]')?.addEventListener('click', () => {
    showForm(form, status);
    form.elements.name?.focus();
  });
}

/* ---- modes ------------------------------------------------------------------------------ */

function modeRadios(form) {
  return Array.from(form.querySelectorAll('input[type="radio"][name="request_type"]'));
}

/**
 * Wires the request_type radios: the checked one defines the mode, the page hash can choose
 * one ("#consultation" names a radio by value, id, or the id of a wrapper around it), and
 * the markup's own subject and button text are the defaults the quote mode falls back to.
 * A form without radios (the support form) runs in the one mode named by its kind.
 */
function initModes(form, kind) {
  const radios = modeRadios(form);
  if (!profilesByForm.has(form)) {
    form.dataset.subjectDefault = form.dataset.subject || DEFAULT_SUBJECT;
  }
  const label = submitLabel(form);
  if (label) {
    form.dataset.submitLabelDefault = label.textContent.trim();
  }
  if (!radios.length) {
    applyMode(form, kind, {});
    return;
  }
  const apply = () => {
    const checked = radios.find((radio) => radio.checked) || radios[0];
    checked.checked = true;
    applyMode(form, checked.value || DEFAULT_MODE, checked.dataset);
  };
  radios.forEach((radio) => radio.addEventListener('change', apply));
  const fromHash = () => {
    const wanted = radioForHash(window.location.hash, radios);
    if (wanted) {
      wanted.checked = true;
    }
    apply();
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

function radioForHash(hash, radios) {
  const id = String(hash || '').slice(1);
  if (!id) {
    return null;
  }
  const anchor = document.getElementById(id);
  return radios.find((radio) => radio.value === id || radio.id === id || (anchor && anchor.contains(radio))) || null;
}

function submitLabel(form) {
  const button = form.querySelector('[data-submit]');
  return button ? button.querySelector('[data-submit-label]') || button : null;
}

function applyMode(form, mode, data) {
  form.dataset.mode = mode;
  if (!profilesByForm.has(form)) {
    form.dataset.subject = data.subject || form.dataset.subjectDefault || DEFAULT_SUBJECT;
  }
  const label = submitLabel(form);
  if (label) {
    label.textContent = data.submitLabel || form.dataset.submitLabelDefault || label.textContent;
  }
  for (const part of form.querySelectorAll('[data-mode-only]')) {
    setPartActive(part, part.dataset.modeOnly.split(/\s+/).includes(mode));
  }
}

/**
 * Shows or hides a conditional part. The controls of an inactive part are disabled, so they
 * neither block validation nor travel in the message; a control marked data-required is
 * required only while its part is active (the HTML never says required, so a visitor
 * without JavaScript can still send any kind of request). The is-active class is the
 * stylesheet's cue: parts without it stay hidden from the first paint while scripts run.
 */
function setPartActive(part, on) {
  part.hidden = !on;
  part.classList.toggle('is-active', on);
  for (const control of part.querySelectorAll('input, select, textarea')) {
    control.disabled = !on;
    if (control.hasAttribute('data-required')) {
      control.required = on;
    }
  }
}

/* ---- conditional parts ------------------------------------------------------------------ */

/**
 * Parts that depend on an answer: <div data-show-when="project_type=Business App / Internal System">
 * is shown while the named field has that value and hidden — its controls disabled, so they
 * neither block validation nor travel in the message — otherwise. Without JavaScript every
 * part is simply visible.
 */
function initConditions(form) {
  const parts = Array.from(form.querySelectorAll('[data-show-when]'));
  if (!parts.length) {
    return;
  }
  const apply = () => {
    for (const part of parts) {
      const rule = part.dataset.showWhen || '';
      const at = rule.indexOf('=');
      const name = rule.slice(0, at).trim();
      const wanted = rule.slice(at + 1).trim();
      // The raw value: the rule must hold while the form itself is hidden behind the status panel too.
      const field = form.elements[name];
      const current = field && typeof field.value === 'string' ? field.value.trim() : '';
      setPartActive(part, at > 0 && current === wanted);
    }
  };
  form.addEventListener('change', apply);
  form.addEventListener('inquiry:preselect', apply);
  apply();
}

/** Selects the option whose data-hash matches the page hash (/quote.html#business-app) and tells the form. */
function initHashOptions(form) {
  const options = Array.from(form.querySelectorAll('select option[data-hash]'));
  if (!options.length) {
    return;
  }
  const fromHash = () => {
    const id = String(window.location.hash || '').slice(1);
    const option = id && options.find((item) => item.dataset.hash === id);
    if (!option) {
      return;
    }
    const select = option.closest('select');
    if (select && select.value !== option.value) {
      select.value = option.value;
      form.dispatchEvent(new Event('inquiry:preselect'));
    }
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

/* ---- links to the form ------------------------------------------------------------------ */

/**
 * True for a trigger that points at the form, at something inside it (a mode anchor), at its
 * own section, or carries a preselection. A link to a wider ancestor, such as the skip link
 * to #main, merely moves focus and must leave the status panel in place.
 */
function leadsToForm(trigger, form) {
  if (trigger.dataset.projectType || trigger.dataset.prefill) {
    return true;
  }
  const href = trigger.getAttribute('href') || '';
  if (!href.startsWith('#') || href.length < 2) {
    return false;
  }
  const target = document.getElementById(href.slice(1));
  return Boolean(target) && (target === form || form.contains(target) || target === form.closest('section'));
}

function preselect(form, { projectType, prefill }) {
  const select = form.elements.project_type;
  if (projectType && select) {
    const option = Array.from(select.options).find((item) => item.value === projectType);
    if (option) {
      select.value = option.value;
      form.dispatchEvent(new Event('inquiry:preselect'));
    }
  }
  const message = form.elements.message;
  if (prefill && message && !message.value.trim()) {
    message.value = prefill;
  }
}

/* ---- validation ------------------------------------------------------------------------- */

function isValidatable(field) {
  return (
    Boolean(field.name) &&
    field.name !== 'company_url' &&
    field.type !== 'radio' &&
    field.type !== 'submit' &&
    field.willValidate !== false
  );
}

function getFields(form) {
  return Array.from(form.elements).filter(isValidatable);
}

/** A web-address field: the quote form's existing_website, or any field marked data-normalize="website". */
function isWebsiteField(field) {
  return Boolean(field) && (field.name === 'existing_website' || field.dataset?.normalize === 'website');
}

/** Lets the form's profile tidy a field's value (identifiers, for instance) before it is read or checked. */
function tidy(form, field) {
  const profile = profilesByForm.get(form);
  if (!profile || typeof profile.normalizeField !== 'function' || !field || typeof field.value !== 'string') {
    return;
  }
  const value = profile.normalizeField(field);
  if (typeof value === 'string' && value !== field.value) {
    field.value = value;
  }
}

function problemWith(field) {
  const value = field.value.trim();
  const limit = LIMITS[field.name] || {};
  if (field.required && !value) {
    return field.dataset.msgRequired || 'Please fill in this field.';
  }
  if (!value) {
    return '';
  }
  if (field.type === 'email' && !isValidEmail(value)) {
    return field.dataset.msgInvalid || 'Please enter a valid email address.';
  }
  if (isWebsiteField(field) && !normalizeWebsite(value).valid) {
    return field.dataset.msgInvalid || 'Please enter a full web address, like https://example.com.';
  }
  const pattern = field.getAttribute('pattern');
  if (pattern && !matchesPattern(value, pattern)) {
    return field.dataset.msgInvalid || 'Please check the format of this field.';
  }
  if (limit.min && value.length < limit.min) {
    return field.dataset.msgShort || `Please enter at least ${limit.min} characters.`;
  }
  if (limit.max && value.length > limit.max) {
    return field.dataset.msgLong || `Please keep this under ${limit.max} characters.`;
  }
  return '';
}

/** The HTML pattern attribute's rule: the whole value must match. A broken pattern never blocks a visitor. */
function matchesPattern(value, pattern) {
  try {
    return new RegExp(`^(?:${pattern})$`, 'u').test(value);
  } catch {
    return true;
  }
}

/** Shows or clears the message for one field. Returns true when the field is valid. */
function validateField(form, field, override) {
  if (override === undefined) {
    tidy(form, field);
  }
  const problem = override ?? problemWith(field);
  const error = form.querySelector(`[data-error-for="${field.name}"]`);
  if (problem) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }
  if (error) {
    error.textContent = problem;
    error.hidden = !problem;
  }
  return !problem;
}

/** Per-field codes from a backend answer: { email: 'invalid', message: 'too_short' } */
function showServerErrors(form, fieldErrors) {
  let first = null;
  for (const [name, code] of Object.entries(fieldErrors)) {
    const field = form.elements[name];
    if (!field || typeof field.setAttribute !== 'function') {
      continue;
    }
    const message =
      {
        required: field.dataset.msgRequired,
        invalid: field.dataset.msgInvalid,
        too_short: field.dataset.msgShort,
        too_long: field.dataset.msgLong,
      }[code] || field.dataset.msgInvalid || 'Please check this field.';
    validateField(form, field, message);
    first = first || field;
  }
  first?.focus();
}

/* ---- reading the form ------------------------------------------------------------------- */

/** A date field (the backend's desired_launch_date) cannot be set in the past. The forms have none; kept for a form that grows one. */
function setEarliestLaunchDate(form) {
  const field = form.elements.desired_launch_date;
  if (!field || field.type !== 'date') {
    return;
  }
  const now = new Date();
  const pad = (number) => String(number).padStart(2, '0');
  field.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** A part of the form that the current mode hides contributes nothing to the message. */
function inactive(node) {
  return node.disabled === true || node.closest('[hidden]') !== null;
}

function describe(node) {
  const label = node.dataset.summaryLabel;
  if (inactive(node)) {
    return { label, value: '' };
  }
  if (node.matches('fieldset')) {
    const checked = node.querySelector('input:checked');
    return { label, value: checked ? checked.dataset.summaryValue || checked.value : '' };
  }
  if (node.matches('select')) {
    const option = node.options[node.selectedIndex];
    return { label, value: node.value && option ? option.textContent : '' };
  }
  if (node.matches('textarea')) {
    return { label, value: node.value, multiline: true };
  }
  if (node.type === 'date') {
    return { label, value: node.value ? formatDate(node.value) : '' };
  }
  if (isWebsiteField(node)) {
    return { label, value: websiteValue(node.value) };
  }
  return { label, value: node.value };
}

/**
 * The website as it travels in the message and the payload: a bare domain is completed to
 * https:// here as well as on blur, because Enter inside the field submits before any blur.
 */
function websiteValue(raw) {
  const result = normalizeWebsite(raw);
  return result.valid && result.value ? result.value : raw;
}

function getRecipient(form) {
  const action = form.getAttribute('action') || '';
  if (action.toLowerCase().startsWith('mailto:')) {
    return decodeURIComponent(action.slice(7).split('?')[0]);
  }
  return form.dataset.recipient || '';
}

function valueOf(form, name) {
  const element = form.elements[name];
  if (!element || typeof element.value !== 'string') {
    return '';
  }
  if (typeof element.disabled === 'boolean' && inactive(element)) {
    return '';
  }
  const value = element.value.trim();
  return isWebsiteField(element) ? websiteValue(value) : value;
}

/** Every named answer by field name (radio groups give their checked value; the honeypot is left out). */
function valuesOf(form) {
  const values = {};
  for (const element of form.elements) {
    const name = element.name;
    if (!name || name === 'company_url' || name in values) {
      continue;
    }
    values[name] = valueOf(form, name);
  }
  return values;
}

/** The chosen mode as the email names it ("Project quote", "Consultation"), or '' in a one-mode form. */
function modeLabel(form) {
  const checked = modeRadios(form).find((radio) => radio.checked);
  return checked ? checked.dataset.summaryValue || checked.value : '';
}

/** The JSON the lead backend receives for the quote form: contract fields only, empty values left out. */
function buildPayload(form) {
  const payload = { request_type: REQUEST_TYPE };
  for (const field of ENDPOINT_FIELDS) {
    const value = valueOf(form, field);
    if (value) {
      payload[field] = value;
    }
  }
  // Fields the contract does not know travel inside one it does, as labelled first lines;
  // the mode goes first so a consultation request is recognised at a glance.
  const folded = [];
  if (form.dataset.mode && form.dataset.mode !== DEFAULT_MODE) {
    folded.push(`Request type: ${modeLabel(form) || form.dataset.mode}`);
  }
  for (const [field, { label }] of Object.entries(FOLDED_FIELDS)) {
    const value = valueOf(form, field);
    if (value) {
      folded.push(`${label}: ${value}`);
    }
  }
  if (folded.length) {
    payload.design_notes = [...folded, payload.design_notes].filter(Boolean).join('\n');
  }
  return payload;
}

function readInquiry(form) {
  const profile = profilesByForm.get(form);
  const entries = Array.from(form.querySelectorAll('[data-summary-label]')).map(describe);
  const values = valuesOf(form);
  const to = getRecipient(form);
  let subject;
  let body;
  let payload;
  let record;
  if (profile) {
    subject = profile.subject(values, form);
    body = profile.body(values, entries);
    payload = profile.payload(values, form);
    record = payload;
  } else {
    const subjectBase = form.dataset.subject || DEFAULT_SUBJECT;
    subject = values.name ? `${subjectBase} — ${values.name}` : subjectBase;
    body = composeMessage(entries, MESSAGE_FOOTER);
    payload = buildPayload(form);
    record = quoteRecord(values, form.dataset.mode);
  }
  const message = { to, subject, body };

  // payload: what the configured endpoint receives today (the lead backend's contract for the
  // quote form); record: the CRM-shaped lead (docs/integration-points.md) — carried, not sent.
  return {
    to,
    subject,
    body,
    mailtoUrl: fitMailto(message).url,
    gmailUrl: fitGmail(message).url,
    payload,
    record,
  };
}

/* ---- delivery --------------------------------------------------------------------------- */

function setBusy(form, busy) {
  form.dataset.busy = busy ? 'true' : 'false';
  const button = form.querySelector('[data-submit]');
  if (button) {
    button.disabled = busy;
  }
}

/**
 * POSTs the inquiry. Resolves { ok: true } when stored, { fieldErrors } for a 422 answer,
 * and throws for anything else (the caller then falls back to the email app).
 */
async function sendToEndpoint(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (response.ok && body && body.ok) {
    return { ok: true };
  }
  if (response.status === 422 && body && body.fields) {
    return { ok: false, fieldErrors: body.fields };
  }
  throw new Error(`Inquiry endpoint answered ${response.status}`);
}

/* ---- status panel ----------------------------------------------------------------------- */

function showStatus(form, status, inquiry, delivered) {
  if (!status) {
    return;
  }
  const preview = status.querySelector('[data-inquiry-preview]');
  if (preview) {
    preview.textContent = `To: ${inquiry.to}\nSubject: ${inquiry.subject}\n\n${inquiry.body.replace(/\r\n/g, '\n')}`;
  }
  const mailtoLink = status.querySelector('[data-mailto-link]');
  if (mailtoLink) {
    mailtoLink.href = inquiry.mailtoUrl;
  }
  const gmailLink = status.querySelector('[data-gmail-link]');
  if (gmailLink) {
    gmailLink.href = inquiry.gmailUrl;
  }
  const title = status.querySelector('[data-status-title]');
  if (title && delivered && status.dataset.titleSent) {
    title.textContent = status.dataset.titleSent;
  }
  for (const part of status.querySelectorAll('[data-mailto-only]')) {
    part.hidden = delivered;
  }
  status.dataset.state = delivered ? 'sent' : 'mailto';
  form.hidden = true;
  status.hidden = false;
  status.focus();
}

function showForm(form, status) {
  status.hidden = true;
  form.hidden = false;
}
