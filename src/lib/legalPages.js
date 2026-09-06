import { LEGAL_DEFAULTS } from './legalPageDefaults.js';
import { safeEmail, safePhone, sanitizeCompany } from './company.js';

export const LEGAL_PAGES = [
  { id: 'privacy', label: 'Privacy Policy', kind: 'markdown' },
  { id: 'terms', label: 'Terms & Conditions', kind: 'markdown' },
  { id: 'returns', label: 'Returns, Refunds & Cancellation', kind: 'markdown' },
  { id: 'contact', label: 'Contact & help', kind: 'contact' },
  { id: 'grievance', label: 'Grievance Redressal', kind: 'contact' },
];
export const legalKey = (id) => 'legal_' + id;
export const CONTACT_FIELDS = [
  ['legalName', 'Business name', 'text'], ['address', 'Registered address', 'textarea'],
  ['email', 'Support email', 'email'], ['phone', 'Support phone', 'tel'], ['hours', 'Support hours', 'text'],
];
export const GRIEVANCE_FIELDS = [
  ['officerName', 'Grievance officer name', 'text'], ['officerEmail', 'Grievance officer email', 'email'],
  ['officerPhone', 'Grievance officer phone', 'tel'], ['officerAddress', 'Grievance officer address', 'textarea'],
  ['acknowledgement', 'Acknowledgement timeline', 'text'], ['resolution', 'Resolution timeline', 'text'],
  ['responseNote', 'How complaints are handled', 'textarea'],
];
const clean = (v, max = 2000) => typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max) : '';
export function normalizeLegalPage(id, raw = {}) {
  const page = { title: clean(raw?.title, 160), intro: clean(raw?.intro), updated_at: null };
  if (raw?.updated_at && Number.isFinite(Date.parse(raw.updated_at))) page.updated_at = new Date(raw.updated_at).toISOString();
  if (LEGAL_PAGES.find(p => p.id === id)?.kind === 'markdown') page.body = clean(raw?.body, 60000);
  else {
    for (const [key] of [...CONTACT_FIELDS, ...(id === 'grievance' ? GRIEVANCE_FIELDS : [])]) page[key] = clean(raw?.[key]);
    page.email = safeEmail(page.email); page.phone = safePhone(page.phone);
    if (id === 'grievance') { page.officerEmail = safeEmail(page.officerEmail); page.officerPhone = safePhone(page.officerPhone); }
    if (id === 'contact') page.faqs = (Array.isArray(raw?.faqs) ? raw.faqs : []).slice(0, 30)
      .map(f => ({ q: clean(f?.q, 300), a: clean(f?.a, 4000) })).filter(f => f.q && f.a);
  }
  return page;
}
export function defaultLegalPage(id, legacy = {}, name = 'SORA LIFE') {
  const page = structuredClone(LEGAL_DEFAULTS[id]);
  if (!page) return null;
  if (page.body) {
    page.body = page.body.replaceAll('SORA LIFE', name);
    page.intro = page.intro.replaceAll('SORA LIFE', name);
    if (legacy.policies?.[id]?.trim()) page.body += '\n\n# Full policy\n\n' + legacy.policies[id];
    const info = sanitizeCompany(legacy);
    page.body += '\n\n# Questions about this?\n\n' + (info.email || info.phone || info.address
      ? "See the Contact & help page for the store's published contact channels and support hours, when available."
      : 'Visit Contact & help for available support and order-tracking options.');
    if (info.legalName) page.body += '\n\nBusiness: ' + info.legalName;
    if (info.address) page.body += '\n\nPublished address: ' + info.address;
    if (info.email) page.body += '\n\n' + info.email + (info.phone ? ' · ' + info.phone : '');
  }
  if (id === 'contact') {
    const info = sanitizeCompany(legacy);
    for (const [key] of CONTACT_FIELDS) page[key] = info[key] || '';
    if (info.email || info.phone || info.address) page.intro = 'Find quick answers below, track an order from your account, or reach ' + name + ' through the published contact channels.';
  }
  return normalizeLegalPage(id, page);
}
export function hasLegalContent(id, page) {
  if (LEGAL_PAGES.find(p => p.id === id)?.kind === 'markdown') return Boolean(page?.body?.trim());
  return Boolean(page?.intro?.trim() || page?.faqs?.length || [...CONTACT_FIELDS, ...GRIEVANCE_FIELDS].some(([key]) => page?.[key]?.trim()));
}
export function validateLegalPage(id, raw) {
  for (const [key, label, type] of [...CONTACT_FIELDS, ...GRIEVANCE_FIELDS]) {
    if (raw[key]?.trim() && ((type === 'email' && !safeEmail(raw[key])) || (type === 'tel' && !safePhone(raw[key])))) throw new Error('Enter a valid ' + label.toLowerCase() + ' or leave it blank.');
  }
  // Unresolved drafting placeholders must never be published as legal facts.
  if (/\[(?:[A-Z][A-Z _/–—.,:()'-]{2,}|e\.g\.[^\]]*)\]/.test(JSON.stringify(raw))) throw new Error('Fill or remove all square-bracket drafting placeholders before saving.');
  return normalizeLegalPage(id, raw);
}
