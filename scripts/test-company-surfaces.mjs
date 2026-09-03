import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DELIVERY_FEES } from '../api/_lib/pricing.js';
import {
  companyInfo,
  hasContactChannel,
  policyParagraphs,
  safeEmail,
  safeExternalUrl,
  safePhone,
  socialLinks,
  validateCompanyForSave,
} from '../src/lib/company.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const footer = read('../src/components/Footer.jsx');
const about = read('../src/pages/About.jsx');
const contact = read('../src/pages/Contact.jsx');
const legal = read('../src/pages/Legal.jsx');
const settings = read('../src/admin/pages/Settings.jsx');
const publicSurfaces = [footer, about, contact, legal].join('\n');
const renderedCode = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n');
const publicRenderedCode = [footer, about, contact, legal].map(renderedCode).join('\n');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check('all company and policy routes exist', () => {
  for (const path of ['/about', '/contact', '/privacy', '/terms', '/shipping', '/returns']) {
    assert.match(app, new RegExp(`path=["']${path.replace('/', '\\/')}["']`));
  }
});

check('every footer internal destination resolves to a real route', () => {
  for (const path of ['/shop', '/account', '/account/orders', '/wishlist', '/about', '/contact',
    '/account/creator', '/privacy', '/terms', '/shipping', '/returns', '/admin/login']) {
    assert.match(footer, new RegExp(`to=["']${path.replace('/', '\\/')}["']`), `missing footer link ${path}`);
  }
  assert.match(app, /path=["']\/account\/:tab["']/);
  assert.match(app, /path=["']\/category\/:slug["']/);
});

check('company fields are optional and hidden when unknown', () => {
  const empty = companyInfo({});
  assert.equal(hasContactChannel(empty), false);
  assert.deepEqual(socialLinks(empty), []);
  assert.deepEqual(policyParagraphs(empty, 'privacy'), []);
});

check('configured contact and policy values are normalized without HTML execution', () => {
  const info = companyInfo({
    legalName: '  Sora Example Pvt Ltd  ',
    email: 'help@example.com',
    phone: '+91 98765 43210',
    address: 'Line 1\nLine 2',
    policies: { privacy: '<script>alert(1)</script>\n\nSecond paragraph' },
  });
  assert.equal(info.legalName, 'Sora Example Pvt Ltd');
  assert.equal(info.email, 'help@example.com');
  assert.equal(info.phone, '+91 98765 43210');
  assert.deepEqual(policyParagraphs(info, 'privacy'), ['<script>alert(1)</script>', 'Second paragraph']);
  assert.doesNotMatch(legal, /dangerouslySetInnerHTML/);
});

check('invalid contact values and unsafe social URLs never become public links', () => {
  assert.equal(safeEmail('not-an-email'), '');
  assert.equal(safePhone('call-me'), '');
  for (const value of ['javascript:alert(1)', 'http://example.com', 'https://localhost/a', 'https://127.0.0.1/a', 'https://user:pass@example.com']) {
    assert.equal(safeExternalUrl(value), null);
  }
  assert.equal(safeExternalUrl('https://example.com/sora'), 'https://example.com/sora');
  assert.throws(() => validateCompanyForSave({ email: 'wrong' }), /valid support email/i);
});

check('Admin exposes structured business fields and plain policy text only', () => {
  for (const field of ['legalName', 'email', 'phone', 'hours', 'address', 'social', 'policies']) {
    assert.match(settings, new RegExp(field));
  }
  assert.doesNotMatch(settings, /custom html|raw css|javascript editor/i);
  assert.match(settings, /Plain text only/);
});

check('shipping policy exactly matches server delivery fees', () => {
  assert.deepEqual(DELIVERY_FEES, { std: 0, exp: 79, sched: 49 });
  assert.match(legal, /Standard[\s\S]*₹0/);
  assert.match(legal, /Express[\s\S]*₹79/);
  assert.match(legal, /Scheduled[\s\S]*₹49/);
  assert.doesNotMatch(publicSurfaces, /₹\s*699|above\s+₹?\s*699|orders?\s+over\s+₹?\s*699/i);
});

check('Contact page has no fake submission flow', () => {
  assert.doesNotMatch(contact, /<form|onSubmit=|fetch\(|successfully sent|message sent/i);
  assert.match(contact, /channels\s*\?/);
});

check('public pages contain no internal readiness or placeholder wording', () => {
  assert.doesNotMatch(publicRenderedCode, /owner input required|\bTODO\b|\bplaceholder\b|configuration required|developer notes?|admin notes?|not been published|not configured/i);
});

check('public trust content contains no unsupported claims or placeholders', () => {
  assert.doesNotMatch(publicSurfaces, /href=["']#|lorem ipsum|trusted by thousands|100% authentic|best prices|fastest delivery|award-winning|certified|warehouse|years in business|return within \d+|refund within \d+/i);
});

check('About page positions SORA LIFE as a broad marketplace', () => {
  assert.match(about, /modern marketplace for wellness, personal care and everyday essentials/i);
  assert.match(about, /wishlist/i);
  assert.match(about, /secure checkout/i);
  assert.match(about, /Creator Program/i);
});

console.log(`\n${passed} passed, 0 failed`);
