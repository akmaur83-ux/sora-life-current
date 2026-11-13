// The SORA app (owner, 2026-11-13: "sora app pe kaam kro ache se deep mein"): the
// installable web app (manifest, service worker, offline page, install flows) and
// the Android package for Google Play (android/, .well-known/assetlinks.json).
//   node scripts/test-sora-app.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isIosSafari, countVisit, shouldNudge, NUDGE_EVERY_MS } from '../src/lib/appMode.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sw = read('sw.js');
const re = (name) => { const m = sw.match(new RegExp(`const ${name} = (/.+/);`)); return new Function(`return ${m[1]};`)(); };

test('service worker: payment, sign-in, account, cart, checkout, admin and the API are never served from the device', () => {
  const NEVER = re('NEVER');
  for (const p of ['/api/razorpay/create-order', '/checkout', '/cart', '/account/orders', '/admin', '/admin/orders', '/login', '/creator', '/invoice/SL-1', '/passport/SL-1', '/fashion/cart', '/homeliving/checkout', '/grocery/cart']) assert.ok(NEVER.test(p), p);
  for (const p of ['/', '/fashion', '/fashion/p/x', '/offers', '/brands', '/shop', '/product/x']) assert.ok(!NEVER.test(p), p);
  assert.match(sw, /if \(request\.method !== 'GET'\) return;/, 'only GET is ever handled');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)\) return;/);
  assert.ok(!/razorpay/i.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')), 'no Razorpay handling in code');
});
test('service worker: only the public catalogue is kept from Supabase — never orders, addresses, coupons, profiles, creators', () => {
  const T = re('PUBLIC_TABLES');
  for (const t of ['catalogue_products', 'catalogue_variants', 'catalogue_categories', 'products', 'categories', 'promotions', 'site_settings', 'storefront_published']) assert.ok(T.test(`/rest/v1/${t}?`), t);
  for (const t of ['orders', 'customer_addresses', 'coupons', 'coupon_redemptions', 'profiles', 'creator_partners', 'product_reviews', 'stock_alerts', 'storefront_drafts', 'catalogue_parties']) assert.ok(!T.test(`/rest/v1/${t}?`), t);
  assert.ok(!T.test('/auth/v1/token?'), 'auth');
  assert.match(sw, /\/\\\/admin\(\\\/\|\$\)\/\.test\(ref\)/, 'nothing the admin reads');
});
test('service worker: network first for pages and code (a deploy is live at once), an offline page, saved copies kept bounded', () => {
  assert.match(sw, /if \(request\.mode === 'navigate'\) \{ event\.respondWith\(page\(event\)\); return; \}/);
  assert.match(sw, /networkFirst\(event, request, SHELL\)/);
  assert.match(sw, /const NETWORK_WAIT_MS = 3500;/);
  assert.match(sw, /'\/offline\.html'/);
  assert.match(sw, /response\.type !== 'basic' && response\.type !== 'cors'/, 'opaque responses never stored');
  assert.match(sw, /const LIMITS = \{ \[PAGES\]: \d+, \[STATIC\]: \d+, \[DATA\]: \d+ \};/);
  const off = read('offline.html');
  assert.ok(!/<script/i.test(off), 'the offline page runs no script (CSP)');
  assert.match(off, /<a href="\/">Try again<\/a>/);
});
test('served with the right headers; the CSP lets the worker run (script-src self)', () => {
  const v = JSON.parse(read('vercel.json'));
  const h = (src) => v.headers.find((x) => x.source === src)?.headers || [];
  assert.match(h('/sw.js').find((x) => x.key === 'Cache-Control').value, /no-cache/);
  assert.equal(h('/.well-known/assetlinks.json').find((x) => x.key === 'Content-Type').value, 'application/json');
  const csp = h('/(.*)').find((x) => x.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src 'self'/); assert.ok(!/worker-src/.test(csp) || /worker-src[^;]*'self'/.test(csp));
  assert.match(read('src/components/AppShell.jsx'), /register\('\/sw\.js', \{ scope: '\/', updateViaCache: 'none' \}\)/);
});
const png = (p) => { const b = readFileSync(new URL(`../${p}`, import.meta.url)); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };
const webp = (p) => { const b = readFileSync(new URL(`../${p}`, import.meta.url)); const t = b.toString('ascii', 12, 16); if (t === 'VP8 ') return `${b.readUInt16LE(26) & 0x3fff}x${b.readUInt16LE(28) & 0x3fff}`; if (t === 'VP8X') return `${1 + b.readUIntLE(24, 3)}x${1 + b.readUIntLE(27, 3)}`; return `${1 + (b.readUInt32LE(21) & 0x3fff)}x${1 + ((b.readUInt32LE(21) >> 14) & 0x3fff)}`; };
test('manifest: installable — standalone, scope, start URL, any + maskable icons, screenshots; every file exists at its stated size', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.id, '/', 'the id never changes (installed apps would become a different app)');
  assert.equal(m.display, 'standalone'); assert.equal(m.scope, '/'); assert.ok(m.start_url.startsWith('/'));
  assert.equal(m.theme_color, '#1E3A2F');
  for (const purpose of ['any', 'maskable']) for (const size of ['192x192', '512x512']) assert.ok(m.icons.some((i) => i.purpose === purpose && i.sizes === size), `${purpose} ${size}`);
  for (const i of m.icons) assert.equal(png(i.src.slice(1)), i.sizes, i.src);
  for (const s of m.shortcuts) for (const i of s.icons) assert.equal(png(i.src.slice(1)), i.sizes, i.src);
  assert.ok(m.screenshots.some((s) => s.form_factor === 'wide') && m.screenshots.some((s) => s.form_factor === 'narrow'));
  for (const s of m.screenshots) assert.equal(webp(s.src.slice(1)), s.sizes, s.src);
  const idx = read('index.html');
  assert.match(idx, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
  assert.match(idx, /<link rel="apple-touch-icon" sizes="180x180" href="\/assets\/apple-touch-icon.png" \/>/);
  assert.equal(png('assets/apple-touch-icon.png'), '180x180');
});
test('install: iPhone Safari gets the Share guide; Chrome/in-app browsers on iPhone and Android do not', () => {
  const S = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  assert.equal(isIosSafari(S), true);
  assert.equal(isIosSafari(S.replace('Version/18.1', 'CriOS/131.0')), false);
  assert.equal(isIosSafari(`${S} Instagram 300.0`), false);
  assert.equal(isIosSafari('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'), false);
  assert.equal(isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', 5, 'MacIntel'), true, 'iPad asking for the desktop site');
});
test('install card: second day or later, phone only, not in the app, 30 days after "Not now"', () => {
  const t0 = Date.parse('2026-11-13T10:00:00+05:30');
  let s = countVisit(null, t0);
  assert.equal(s.visits, 1);
  assert.equal(countVisit(s, t0 + 3600e3).visits, 1, 'same day counts once');
  s = countVisit(s, t0 + 86400e3);
  assert.equal(s.visits, 2);
  const ctx = { now: t0 + 86400e3, canInstall: true, standalone: false, phone: true };
  assert.equal(shouldNudge({ visits: 1 }, ctx), false);
  assert.equal(shouldNudge(s, ctx), true);
  assert.equal(shouldNudge(s, { ...ctx, phone: false }), false);
  assert.equal(shouldNudge(s, { ...ctx, standalone: true }), false);
  assert.equal(shouldNudge(s, { ...ctx, canInstall: false }), false);
  assert.equal(shouldNudge({ ...s, dismissed: ctx.now - 1000 }, ctx), false);
  assert.equal(shouldNudge({ ...s, dismissed: ctx.now - NUDGE_EVERY_MS - 1 }, ctx), true);
  const nudge = read('src/components/AppNudge.jsx');
  assert.match(nudge, /const QUIET = \/\^\\\/\(cart\|checkout\|admin/);
  assert.match(nudge, /\.hx-pcard:not\(\.hx-acard\)/, 'never on top of the promo card');
});
test('app runtime: new-version notice never on cart/checkout and never reloads by itself; Back button only in the app', () => {
  const a = read('src/components/AppShell.jsx');
  assert.match(a, /const QUIET = \/\^\\\/\(cart\|checkout\|fashion\\\/cart\|homeliving\\\/cart\|grocery\\\/cart\|grocery\\\/checkout\|admin\|invoice\)/);
  assert.equal((a.match(/window\.location\.reload\(\)/g) || []).length, 1);
  assert.match(a, /onClick=\{\(\) => window\.location\.reload\(\)\}>Refresh<\/button>/);
  assert.match(a, /const showBack = app && !quiet && !HOMES\.test\(pathname\);/);
  assert.match(read('src/main.jsx'), /<StoreProvider>[\s\S]*<AppShell \/>[\s\S]*<\/StoreProvider>/);
});
test('android: the Play package opens www.soralifestyle.in full screen; assetlinks names the same package; no key in the repo', () => {
  const twa = JSON.parse(read('android/twa-manifest.json'));
  assert.equal(twa.packageId, 'in.soralifestyle.app');
  assert.equal(twa.host, 'www.soralifestyle.in');
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /applicationId: 'in\.soralifestyle\.app'/);
  assert.match(gradle, /hostName: 'www\.soralifestyle\.in'/);
  assert.match(gradle, /targetSdkVersion 3[6-9]/);
  const links = JSON.parse(read('.well-known/assetlinks.json'));
  assert.equal(links[0].target.package_name, twa.packageId);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  for (const f of links[0].target.sha256_cert_fingerprints) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  const tracked = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).split('\n');
  assert.deepEqual(tracked.filter((f) => /\.(jks|keystore|aab|apk)$|local\.properties$/.test(f)), [], 'no signing key or build output committed');
  assert.ok(read('.vercelignore').split('\n').includes('android'), 'the Android project is not deployed to the site');
});
test('account deletion (Google Play requirement): a public page, linked from Settings and Help; it deletes nothing by itself', () => {
  const page = read('src/pages/DeleteAccount.jsx');
  assert.match(read('src/App.jsx'), /<Route path="\/delete-account" element={<DeleteAccount \/>} \/>/);
  assert.match(read('src/pages/Account.jsx'), /<Link to="\/delete-account" className="linkbtn linkbtn--danger">/);
  assert.match(read('src/lib/helpFaq.js'), /to: '\/delete-account'/);
  assert.ok(!/supabase|auth\.|fetch\(/.test(page), 'no deletion or sign-in code on the page');
  for (const h of ['What is deleted', 'What is kept, and for how long', 'How long it takes']) assert.ok(page.includes(h), h);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
