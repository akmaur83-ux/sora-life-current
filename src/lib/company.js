import { contact } from './settings.js';
import { safeTrackingUrl } from './orderFulfillment.js';

// ============================================================
// COMPANY / BUSINESS INFORMATION
//
// The factual details a marketplace is expected to publish: who operates it,
// how to reach them, when. Every value is admin-entered and every one is
// OPTIONAL — nothing here has a default, because a default would be a
// fabricated fact. Whatever is unset is simply absent from the public UI.
//
// Stored inside the EXISTING `contact` site_settings row, which is already on
// the public-read allowlist (migrations 0009 and 0015). A dedicated `company`
// key would have needed a migration to be readable by the storefront, and this
// record is exactly what `contact` already was — the store's own details — so
// it is widened rather than duplicated.
//
//   contact = {
//     email, phone, address,                       // pre-existing
//     legalName, hours,                            // added here
//     social:   { instagram, facebook, ... },      // added here
//     policies: { privacy, terms, shipping, returns },  // owner legal text
//   }
//
// This module is deliberately React-free so the rules below can be tested in
// Node without a DOM.
// ============================================================

export const SOCIAL_NETWORKS = [
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'facebook', label: 'Facebook', icon: 'facebook' },
  { key: 'x', label: 'X', icon: 'twitter' },
  { key: 'youtube', label: 'YouTube', icon: 'externalLink' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'externalLink' },
];

// One URL policy for every admin-supplied external link. safeTrackingUrl
// already IS that policy — https only, no embedded credentials, no local,
// private or literal-IP hosts — so it is reused rather than reimplemented,
// keeping a single place where the rule can be reviewed.
export const safeExternalUrl = safeTrackingUrl;

/** One line of admin text: no control characters, collapsed, length-capped. */
function line(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

/** Multi-line admin text (an address, a policy). Blank lines collapse to one. */
function block(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim()
    .slice(0, max);
}

/**
 * An address good enough to render as a mailto:. Deliberately strict rather
 * than RFC-complete: a value that does not look like an address is far more
 * likely to be a typo than a valid exotic one, and publishing a broken
 * support address is worse than publishing none.
 */
export function safeEmail(value) {
  // Trimmed, never repaired. Stripping the space out of "a b@x.com" would
  // publish a mailto: for an address nobody typed, which is worse than
  // publishing none — so an address with anything odd inside it is rejected.
  const text = line(value, 200);
  return /^[^\s@,;:<>"'()[\]\\]+@[^\s@,;:<>"'()[\]\\]+\.[A-Za-z]{2,}$/.test(text) ? text : '';
}

/** A dialable number. Digits, spaces and the usual separators only. */
export function safePhone(value) {
  const text = line(value, 40);
  if (!/^\+?[\d][\d\s\-().]{4,}$/.test(text)) return '';
  return /\d{5,}/.test(text.replace(/\D/g, '')) ? text : '';
}

/** `tel:` target for a phone that has already passed safePhone(). */
export function telHref(phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

export const POLICY_KEYS = ['privacy', 'terms', 'shipping', 'returns'];
const MAX_POLICY_LENGTH = 20000;

export function sanitizeCompany(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const social = {};
  for (const network of SOCIAL_NETWORKS) {
    const url = safeExternalUrl(src.social?.[network.key]);
    if (url) social[network.key] = url;
  }
  const policies = {};
  for (const key of POLICY_KEYS) {
    const text = block(src.policies?.[key], MAX_POLICY_LENGTH);
    if (text) policies[key] = text;
  }
  return {
    legalName: line(src.legalName, 120),
    email: safeEmail(src.email),
    phone: safePhone(src.phone),
    address: block(src.address, 400),
    hours: line(src.hours, 160),
    social,
    policies,
  };
}

/**
 * Admin-side validation. Public rendering is deliberately forgiving and hides
 * malformed values; saving should be stricter so an admin is told which field
 * needs attention rather than believing an unusable contact method is live.
 */
export function validateCompanyForSave(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  if (String(src.email || '').trim() && !safeEmail(src.email)) {
    throw new Error('Enter a valid support email address or leave it blank.');
  }
  if (String(src.phone || '').trim() && !safePhone(src.phone)) {
    throw new Error('Enter a valid support phone number or leave it blank.');
  }
  for (const network of SOCIAL_NETWORKS) {
    const value = String(src.social?.[network.key] || '').trim();
    if (value && !safeExternalUrl(value)) {
      throw new Error(`${network.label} must be a public https:// URL or left blank.`);
    }
  }
  return sanitizeCompany(src);
}

/** The business record for the current session. */
export function companyInfo(source = contact) {
  return sanitizeCompany(source);
}

/** True when there is at least one way for a customer to make contact. */
export function hasContactChannel(info) {
  return Boolean(info?.email || info?.phone || info?.address);
}

/** The social links that are actually configured, in a stable order. */
export function socialLinks(info) {
  return SOCIAL_NETWORKS
    .filter((network) => info?.social?.[network.key])
    .map((network) => ({ ...network, url: info.social[network.key] }));
}

/** Owner-supplied text for one policy, split into paragraphs. [] when unset. */
export function policyParagraphs(info, key) {
  const text = info?.policies?.[key];
  return text ? text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
}
