// More features (owner, 2026-11-20, round 11): sell on SORA, bulk gifting, request it,
// Admin → Enquiries, made in India, the leather care guide.
//   node scripts/test-more-features-11.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const e = loadModule('src/lib/enquiries.js', { supabase: null });

await test('enquiries: checked as the table checks them; a way to reply unless it is a product request', () => {
  assert.equal(e.cleanEnquiry('request', { query: '  red   leather   jacket ' }).row.query, 'red leather jacket');
  assert.match(e.cleanEnquiry('request', {}).error, /looking for/);
  assert.match(e.cleanEnquiry('partner', { name: 'A', business: 'B' }).error, /phone number or an email/);
  assert.match(e.cleanEnquiry('partner', { name: 'A', phone: '9876543210' }).error, /brand or business/);
  assert.equal(e.cleanEnquiry('partner', { name: 'A', business: 'B', phone: '+91 98765-43210' }).row.phone, '9876543210');
  assert.match(e.cleanEnquiry('bulk', { name: 'A', phone: '12ab' }).error, /phone/);
  assert.match(e.cleanEnquiry('bulk', { name: 'A', email: 'nope' }).error, /email/);
  assert.equal(e.cleanEnquiry('bulk', { name: 'A', email: 'a@b.in', store: 'evil' }).row.store, null);
  assert.equal(e.cleanEnquiry('x', {}).error, 'Unknown form.');
  assert.equal(e.cleanEnquiry('request', { query: 'x'.repeat(300) }).row.query.length, 120);
});
await test('enquiries: the honeypot is dropped silently; a send failure reads plainly', async () => {
  let inserted = 0;
  const ok = { from: () => ({ insert: async () => { inserted += 1; return { error: null }; } }) };
  assert.deepEqual(await e.sendEnquiry('request', { query: 'x', company_url: 'spam' }, ok), { ok: true });
  assert.equal(inserted, 0);
  assert.deepEqual(await e.sendEnquiry('request', { query: 'x' }, ok), { ok: true });
  assert.equal(inserted, 1);
  const bad = { from: () => ({ insert: async () => ({ error: { message: 'rls' } }) }) };
  assert.match((await e.sendEnquiry('request', { query: 'x' }, bad)).error, /try again/);
});
await test('the table: insert only for visitors, admin reads and marks; a reply channel is required', () => {
  const sql = read('supabase/migrations/0047_enquiries.sql');
  assert.match(sql, /grant insert \(kind, name, phone, email, business, city, website, query, store, message\) on public\.enquiries to anon, authenticated;/);
  assert.match(sql, /for select to authenticated using \(public\.is_sora_admin\(\)\)/);
  assert.match(sql, /grant select, update \(status\) on public\.enquiries to authenticated;/);
  assert.match(sql, /check \(kind = 'request' or phone is not null or email is not null\)/);
});
await test('admin enquiries: filters, newest first; the same request counted once with how many', () => {
  const a = loadModule('src/admin/pages/Enquiries.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, ENQUIRY_KINDS: e.ENQUIRY_KINDS, toCsv: () => '', downloadCsv: () => {} });
  const rows = [{ id: 1, kind: 'request', status: 'new', query: 'Red Jacket', created_at: '2026-11-20T01' }, { id: 2, kind: 'request', status: 'done', query: 'red jacket', created_at: '2026-11-20T03' }, { id: 3, kind: 'partner', status: 'new', created_at: '2026-11-20T02' }];
  assert.deepEqual(a.filterEnquiries(rows).map((r) => r.id), [2, 3, 1]);
  assert.deepEqual(a.filterEnquiries(rows, 'request', 'new').map((r) => r.id), [1]);
  assert.deepEqual(a.requestTally(rows), [{ query: 'Red Jacket', n: 2 }]);
  assert.match(read('src/App.jsx'), /<Route path="enquiries" element=\{<AdminEnquiries \/>\} \/>/);
  assert.match(read('src/admin/AdminLayout.jsx'), /\{ to: '\/admin\/enquiries', label: 'Enquiries' \}/);
});
await test('request it: under every store\'s empty search', () => {
  assert.match(read('src/fashion/FashionListing.jsx'), /<RequestProduct q=\{q\} store="fashion" \/>/);
  assert.match(read('src/homeliving/HomeLivingSearch.jsx'), /<RequestProduct q=\{q\} store="homeliving" \/>/);
  assert.match(read('src/pages/Shop.jsx'), /isCatalogHydrated\(\) && searchProducts\(params\.get\('q'\)\)\.length === 0 && <div className="v2-wrap"><RequestProduct q=\{params\.get\('q'\)\} store="wellness" \/><\/div>/);
});
await test('made in India only from the record; leather care only on real leather', () => {
  const o = loadModule('src/components/ProductOrigin.jsx', { Link: () => null, Icon: () => null });
  assert.equal(o.madeInIndia('IN'), true); assert.equal(o.madeInIndia('india'), true); assert.equal(o.madeInIndia(''), false); assert.equal(o.madeInIndia('CN'), false);
  assert.equal(o.isLeather('Genuine leather'), true);
  assert.equal(o.isLeather('Genuine suede leather'), true);
  assert.equal(o.isLeather('PU leather'), false);
  assert.equal(o.isLeather('', 'Faux leather jacket'), false);
  assert.equal(o.isLeather('', 'Rider Leather Biker Jacket'), true, 'no material recorded: the name');
  assert.equal(o.isLeather('Cotton', 'Leather-look shirt'), false, 'a recorded material wins over the name');
  assert.match(read('src/fashion/FashionProductPage.jsx'), /<ProductOrigin origin=\{facts\?\.country_of_origin\} material=\{facts\?\.material\} name=\{view\.name\} \/>/);
  assert.match(read('src/App.jsx'), /<Route path="\/guides\/leather-care" element=\{<LeatherCare \/>\} \/>/);
  const g = loadModule('src/pages/LeatherCare.jsx', { Link: () => null, Icon: () => null, usePageMeta: () => {} });
  assert.ok(g.CARE_SECTIONS.length >= 6);
  assert.ok(!g.CARE_SECTIONS.flatMap(([, t]) => t).some((t) => /\b(years|lifetime|guarantee|waterproof|forever)\b/i.test(t)), 'no promises about how long it lasts');
  for (const p of ['/sell', '/guides/leather-care']) assert.ok(read('api/sitemap.js').includes(`'${p}'`), p);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
