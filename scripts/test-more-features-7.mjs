// More features (owner, 2026-11-13, round 7): Help & FAQ, the chat button's online
// status, help with an order on WhatsApp, today's top pick on /offers, Drop a hint.
//   node scripts/test-more-features-7.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
import { parseCareHours, careOpen } from '../src/lib/careHours.js';
import { HELP_TOPICS, filterHelp, faqLd } from '../src/lib/helpFaq.js';
import { STATIC_PATHS } from '../api/sitemap.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// 2026-11-13 is a Friday. IST = UTC+5:30.
const at = (hhmm, day = '2026-11-13') => Date.parse(`${day}T${hhmm}:00+05:30`);

test('care hours: read from the published text; unreadable hours say nothing', () => {
  assert.deepEqual(parseCareHours('9:00 AM–6:00 PM IST'), { start: 540, end: 1080, days: null, opens: '9:00 AM' });
  assert.deepEqual(parseCareHours('Mon–Sat, 10 am – 7 pm').days, [1, 2, 3, 4, 5, 6]);
  assert.equal(parseCareHours('Always here for you'), null);
  assert.equal(parseCareHours(''), null);
  assert.equal(careOpen('', at('10:00')), null);
});
test('care hours: open inside the hours on India time, closed outside and on days off', () => {
  assert.equal(careOpen('9:00 AM–6:00 PM IST', at('10:04')).open, true);
  assert.equal(careOpen('9:00 AM–6:00 PM IST', at('18:00')).open, false);
  assert.equal(careOpen('9:00 AM–6:00 PM IST', at('08:59')).open, false);
  assert.equal(careOpen('Mon–Sat, 9:00 AM–6:00 PM', at('11:00', '2026-11-15')).open, false, 'Sunday');
  assert.equal(careOpen('Mon–Sat, 9:00 AM–6:00 PM', at('11:00', '2026-11-14')).open, true, 'Saturday');
  const s = read('src/components/SiteAssist.jsx');
  assert.match(s, /status\.open \? 'Online now' : `Replies from \$\{status\.opens\}`/);
});
test('help: answers only from the policies — returns linked, never restated; schema for every question', () => {
  const all = HELP_TOPICS.flatMap((t) => t.items);
  assert.ok(all.length >= 12);
  const ship = read('src/pages/Legal.jsx');
  assert.match(ship, /dispatched within 2–3 business days/); assert.match(ship, /approximately 6–7 business days/);
  assert.ok(all.some((i) => /2–3 business days/.test(i.a)) && all.some((i) => /6–7 business days/.test(i.a)));
  const ret = HELP_TOPICS.find((t) => t.id === 'returns').items;
  assert.ok(ret.every((i) => i.link?.to === '/returns' && !/\d+\s*days/.test(i.a)));
  assert.ok(!all.some((i) => /cash on delivery|\bcod\b|guarantee(d)? delivery/i.test(i.a)));
  const ld = faqLd(HELP_TOPICS);
  assert.equal(ld['@type'], 'FAQPage'); assert.equal(ld.mainEntity.length, all.length);
  assert.deepEqual(filterHelp(HELP_TOPICS, 'coupon').flatMap((t) => t.items).map((i) => i.q), ['Where do I enter a coupon code?']);
  assert.equal(filterHelp(HELP_TOPICS, 'zzzz').length, 0);
  assert.equal(filterHelp(HELP_TOPICS, '  '), HELP_TOPICS);
});
test('help: routed, in the footer and the sitemap; every link is a real route', () => {
  assert.match(read('src/App.jsx'), /<Route path="\/help" element={<Help \/>} \/>/);
  assert.match(read('src/components/Footer.jsx'), /<Link to="\/help">Help &amp; FAQ<\/Link>/);
  assert.ok(STATIC_PATHS.includes('/help'));
  const app = read('src/App.jsx');
  for (const i of HELP_TOPICS.flatMap((t) => t.items)) if (i.link) assert.ok(app.includes(`path="${i.link.to}`) || app.includes(`path="${i.link.to.split('/')[1]}`) || i.link.to === '/account/orders', i.link.to);
});
test('order help: WhatsApp with the order number; nothing without a care number', () => {
  const src = read('src/pages/Account.jsx');
  const m = src.match(/export function orderHelpLink\(phone, orderNumber\) \{[\s\S]*?\n\}/);
  assert.ok(m);
  const waNumber = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `91${d}` : (d.length >= 11 && d.length <= 13 ? d : ''); };
  const orderHelpLink = new Function('waNumber', `${m[0].replace(/^export /, '')}; return orderHelpLink;`)(waNumber);
  assert.equal(orderHelpLink('+91 78890 96228', 'SL-1001'), `https://wa.me/917889096228?text=${encodeURIComponent('Hi SORA Lifestyle, I need help with my order SL-1001.')}`);
  assert.equal(orderHelpLink('', 'SL-1001'), '');
  assert.match(src, /Help with this order/);
});
test('today’s top pick: one of the 24 biggest discounts, the same all day in India, changing at midnight', () => {
  const offers = loadModule('src/pages/Offers.jsx', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], Link: () => null, useSearchParams: () => [new URLSearchParams(), () => {}], Icon: () => null, money: (n) => `₹${n}`, supabase: null, products: [], OfferBanner: () => null, LoadMore: () => null, useShowMore: () => ({}), useStorefrontSection: (s, p, d) => d, OFFER_COUNTDOWN: {}, parseIndiaTime: () => 0, offerShareText: () => '', usePageMeta: () => {} });
  const deals = Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, pct: 80 - i }));
  const a = offers.dailyPick(deals, at('00:05')); const b = offers.dailyPick(deals, at('23:55'));
  assert.equal(a.key, b.key);
  assert.ok(deals.slice(0, 24).includes(a));
  const days = new Set(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'].map((d) => offers.dailyPick(deals, at('12:00', d)).key));
  assert.ok(days.size >= 2, 'changes across days');
  assert.equal(offers.dailyPick([], at('12:00')), null);
  assert.equal(offers.istDay(Date.parse('2026-11-13T19:00:00Z')), '2026-11-14', 'after 00:00 IST it is the next day');
  assert.equal(offers.untilMidnight(at('22:30')), '1h 30m');
});
test('drop a hint: a WhatsApp message with the product and its link, on every product page’s share row', () => {
  const src = read('src/components/pdp/PdpOwnerKit.jsx');
  const m = src.match(/export function hintText\(name, url\) \{\n\s*return (`[^`]*`);/);
  const hintText = new Function('name', 'url', `return ${m[1]};`);
  assert.equal(hintText(' Kullu Shawl ', 'https://x/p'), 'Dropping a hint 🎁 I’d love Kullu Shawl from SORA Lifestyle: https://x/p');
  assert.match(src, /Drop a hint/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
