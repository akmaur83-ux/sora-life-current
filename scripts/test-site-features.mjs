// Site features (owner, 2026-11-08): delivery dates, WhatsApp chat link.
//   node scripts/test-site-features.mjs
import assert from 'node:assert/strict';
import { loadModule } from './catalogue-admin-harness.mjs';
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const eta = loadModule('src/lib/deliveryEstimate.js', {});
test('delivery window: 6–7 business days from today, Sundays not counted', () => {
  const sun = new Date(2026, 10, 8);               // Sun 8 Nov 2026
  const w = eta.deliveryWindow(sun);
  assert.equal(w.from.toDateString(), new Date(2026, 10, 14).toDateString(), 'Mon–Sat → Sat 14');
  assert.equal(w.to.toDateString(), new Date(2026, 10, 16).toDateString(), 'skips Sun 15 → Mon 16');
  const fri = eta.deliveryWindow(new Date(2026, 10, 13));
  assert.equal(fri.from.toDateString(), new Date(2026, 10, 20).toDateString());
  assert.match(w.label, /14.*Nov.*16.*Nov/);
});
const sa = loadModule('src/components/SiteAssist.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], useLocation: () => ({ pathname: '/' }), Icon: () => null, useConsumerCare: () => ({}) });
test('WhatsApp: Indian numbers as published, nothing when unset; a product page names the product and its link', () => {
  assert.equal(sa.waNumber('+91 78890 96228'), '917889096228');
  assert.equal(sa.waNumber('78890 96228'), '917889096228');
  assert.equal(sa.waNumber('078890 96228'), '917889096228');
  assert.equal(sa.waNumber(''), '');
  assert.equal(sa.waLink('', '/', 'x', 'y'), '');
  const p = decodeURIComponent(sa.waLink('+91 78890 96228', '/fashion/p/a-shawl', 'Kalamkari Shawl | SORA LIFESTYLE', 'https://www.soralifestyle.in/fashion/p/a-shawl'));
  assert.match(p, /^https:\/\/wa\.me\/917889096228\?text=Hi SORA Lifestyle, I have a question about Kalamkari Shawl: https:\/\/www\.soralifestyle\.in\/fashion\/p\/a-shawl$/);
  assert.match(decodeURIComponent(sa.waLink('7889096228', '/shop', 'Shop', 'u')), /I need some help\.$/);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
