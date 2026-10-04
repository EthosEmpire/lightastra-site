/**
 * Light Astra — the quote form as a lead record
 *
 * Pure functions (no DOM) that turn the quote form's values into the record a future CRM
 * will receive, beside the lead-backend payload the form already builds. Unit-tested in
 * qa/test_quote_record.mjs. contact-form.js attaches the result as `inquiry.record`; nothing
 * sends it today.
 *
 * Field names (the quote form): request_type (mode), name, email, business, existing_website,
 * project_type (the service), message, desired_timeline, estimated_budget, preferred_times,
 * design_notes, and for a business app: app_purpose, employee_range, existing_system.
 */

/** Where the record came from, as the CRM will see it. */
export const QUOTE_SOURCE = 'lightastra.com/quote';

/** The service labels of the form's select and their stable CRM keys. */
export const SERVICE_TYPES = {
  'Website': 'website',
  'Web application': 'web_application',
  'Website redesign': 'website_redesign',
  'Security review or setup': 'security',
  'Automation / integration': 'automation',
  'Business App / Internal System': 'business_app',
  'Ongoing care plan': 'care_plan',
  'Not sure yet': 'not_sure',
};

/** The employee ranges of the business-app question, as the form lists them. */
export const EMPLOYEE_RANGES = ['1–5', '6–20', '21+', 'Not sure yet'];

function clean(value) {
  return String(value ?? '').trim();
}

/** The stable key for a service label ('' for none, 'other' for a label the map does not know). */
export function serviceType(label) {
  const text = clean(label);
  if (!text) {
    return '';
  }
  return SERVICE_TYPES[text] || 'other';
}

/**
 * The CRM-shaped record of a quote or consultation request. Keys are stable; answers that
 * do not apply are empty strings, so the shape never changes. The three business-app fields
 * are only ever filled when the service is a business app.
 */
export function quoteRecord(values = {}, mode = 'quote', submittedAt = new Date().toISOString()) {
  const type = serviceType(values.project_type);
  const app = type === 'business_app';
  return {
    requestType: clean(mode) || 'quote',
    service: clean(values.project_type),
    serviceType: type,
    appPurpose: app ? clean(values.app_purpose) : '',
    employeeRange: app ? clean(values.employee_range) : '',
    existingSystem: app ? clean(values.existing_system) : '',
    name: clean(values.name),
    email: clean(values.email),
    business: clean(values.business),
    existingWebsite: clean(values.existing_website),
    message: clean(values.message),
    desiredTimeline: clean(values.desired_timeline),
    budget: clean(values.estimated_budget),
    preferredTimes: clean(values.preferred_times),
    notes: clean(values.design_notes),
    source: QUOTE_SOURCE,
    submittedAt,
  };
}
