// ============================================================
// Promotions (Part 2) — offline unit tests.
//
//   node scripts/test-promotions.mjs
//
// Exercises src/lib/promotions.js: normalization, placement + date-window
// filtering, coupon-code / CTA-URL sanitisation, and the fallback -> supabase
// hand-off (applyPromotions([]) must clear the local sample). Also statically
// asserts the promotion layer never imports pricing / cart / checkout code.
// ============================================================
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PROMOTIONS_FALLBACK } from '../src/data/promotions.js';
import {
  normalizePromo, isRenderablePromo, applyPromotions,
  promosForPlacement, promoLayoutFor, promotions, promotionsSource,
  offerCalloutFrom, isLocalPreviewHost,
} from '../src/lib/promotions.js';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

console.log('\n— normalizePromo —');
{
  const n = normalizePromo({
    id: 1, type: 'weird', title: '  Hello  ', coupon_code: 'save 10!!', cta_url: 'javascript:alert(1)',
    theme_variant: 'neon', text_align: 'justify', placements: ['home', 'x', 'cart'], is_active: false,
  });
  eq(n.type, 'poster', 'unknown type falls back to poster');
  eq(n.title, 'Hello', 'title trimmed');
  eq(n.couponCode, 'SAVE10', 'code upper-cased and stripped to [A-Z0-9_-]');
  eq(n.ctaUrl, null, 'javascript: CTA url rejected');
  eq(n.themeVariant, 'forest', 'unknown theme falls back to forest');
  eq(n.textAlign, 'left', 'unknown align falls back to left');
  eq(n.placements, ['home', 'cart'], 'unknown placement filtered out');
  eq(n.isActive, false, 'is_active honoured');
}
{
  const n = normalizePromo({ title: 'x', cta_url: '/shop' });
  eq(n.ctaUrl, '/shop', 'internal path CTA kept');
  const h = normalizePromo({ title: 'x', cta_url: 'https://sora-life.example/foo' });
  eq(h.ctaUrl, 'https://sora-life.example/foo', 'https CTA kept');
  const p = normalizePromo({ title: 'x', cta_url: '//evil.example' });
  eq(p.ctaUrl, null, 'protocol-relative CTA rejected');
  const http = normalizePromo({ title: 'x', cta_url: 'http://insecure.example' });
  eq(http.ctaUrl, null, 'plain http CTA rejected');
}
eq(normalizePromo(null), null, 'null input -> null');
eq(normalizePromo('nope'), null, 'non-object input -> null');

console.log('\n— isRenderablePromo (date window) —');
{
  const base = { isActive: true, title: 'T' };
  const NOW = Date.parse('2026-06-15T00:00:00Z');
  eq(isRenderablePromo({ ...base }, NOW), true, 'active + no window -> renderable');
  eq(isRenderablePromo({ ...base, isActive: false }, NOW), false, 'inactive -> not renderable');
  eq(isRenderablePromo({ ...base, title: '' }, NOW), false, 'no title -> not renderable');
  eq(isRenderablePromo({ ...base, startsAt: '2026-07-01T00:00:00Z' }, NOW), false, 'not started yet -> not renderable');
  eq(isRenderablePromo({ ...base, endsAt: '2026-06-01T00:00:00Z' }, NOW), false, 'already ended -> not renderable');
  eq(isRenderablePromo({ ...base, startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-07-01T00:00:00Z' }, NOW), true, 'inside window -> renderable');
}

console.log('\n— applyPromotions + placement filtering —');
{
  const changed = applyPromotions([
    { id: 'a', type: 'poster', title: 'Home poster', placements: ['home'], sort_order: 1, is_active: true },
    { id: 'b', type: 'offer', title: 'PDP+cart offer', placements: ['pdp', 'cart'], sort_order: 0, is_active: true },
    { id: 'c', type: 'offer', title: 'Draft', placements: ['home'], sort_order: 2, is_active: false },
    { id: 'd', type: 'offer', title: 'Expired', placements: ['home'], sort_order: 3, is_active: true, ends_at: '2000-01-01T00:00:00Z' },
  ]);
  eq(changed, true, 'applyPromotions returns true when it sets a list');
  eq(promotionsSource, 'supabase', 'source flips to supabase after applyPromotions');
  eq(promosForPlacement('home').map((p) => p.id), ['a'], 'home: only active, in-window, home-placed');
  eq(promosForPlacement('pdp').map((p) => p.id), ['b'], 'pdp: only b');
  eq(promosForPlacement('cart').map((p) => p.id), ['b'], 'cart: only b');
  eq(promosForPlacement('nope'), [], 'unknown placement -> []');
  const lay = promoLayoutFor('home');
  eq([lay.poster?.id, lay.offers.length], ['a', 0], 'promoLayoutFor splits poster/offers');
}
{
  eq(applyPromotions([]), true, 'applyPromotions([]) is accepted');
  eq(promotions.length, 0, 'applyPromotions([]) clears the list (empty table shows nothing)');
  eq(promosForPlacement('home'), [], 'no promos after clear');
  eq(applyPromotions('bad'), false, 'applyPromotions(non-array) is a no-op');
}

console.log('\n— offerCalloutFrom (derived from the admin\'s own words only) —');
{
  const c = (p) => offerCalloutFrom(normalizePromo({ title: 'T', ...p }));
  eq(c({ subtitle: 'Take an extra 10% off your first order.' }), '10% OFF', 'percent off from subtitle');
  eq(c({ badge_text: 'Flat 25% off' }), '25% OFF', 'percent off from badge, badge wins');
  eq(c({ subtitle: 'Get ₹300 off orders above ₹1,499' }), '₹300 OFF', 'rupee amount off');
  eq(c({ badge_text: 'Free shipping' }), 'FREE SHIPPING', 'free shipping phrase');
  eq(c({ subtitle: 'Free delivery on every order' }), 'FREE DELIVERY', 'free delivery phrase');
  eq(c({ subtitle: 'Buy 2 and save more' }), 'BUY 2 & SAVE', 'buy N phrase');
  eq(c({ subtitle: 'Earn cashback on prepaid orders' }), 'CASHBACK', 'cashback phrase');
  eq(c({ title: 'The Honey Gold edit', subtitle: 'Hand-picked for the season.' }), null,
    'no offer stated -> null (poster renders with no callout)');
  eq(offerCalloutFrom(null), null, 'null promo -> null');
  // It must never fabricate a number that is not in the copy.
  eq(c({ subtitle: 'Save more on your monthly ritual' }), null, 'vague "save more" invents no figure');
  eq(c({ badge_text: 'Preview offer' }), 'PREVIEW OFFER', 'explicit demo label preserves the callout without a discount claim');
  eq(c({ badge_text: 'Preview offer', subtitle: '10% off selected products' }), '10% OFF',
    'real admin-authored offer wording retains priority over the preview label');
  eq(normalizePromo({ title: 'Approved offer', coupon_code: 'REAL-OFFER' }).couponCode, 'REAL-OFFER',
    'real admin-authored codes remain supported without demo-only restrictions');
}

console.log('\n— local sample copy is neutral and demo-safe —');
{
  const visibleCopy = PROMOTIONS_FALLBACK.map((p) =>
    [p.title, p.subtitle, p.badge_text, p.cta_text, p.coupon_code].filter(Boolean).join(' '));
  eq(visibleCopy.some((s) => /sea[ -]?buckthorn|himalaya|cold[ -]pressed|skincare|honey gold/i.test(s)), false,
    'site-wide sample copy contains no product, ingredient, region or category claims');
  eq(visibleCopy.some((s) => /\d\s*%|₹|free\s+(?:shipping|delivery)|first order|\bCOD\b|cash-on-delivery|waiv(?:e|ed)|cashback/i.test(s)), false,
    'samples promise no discount amount, shipping threshold or payment-fee waiver');
  eq(PROMOTIONS_FALLBACK.every((p) => /demo|sample|preview/i.test(p.badge_text)), true,
    'every sample has a visible demo/preview badge');
  eq(PROMOTIONS_FALLBACK.every((p) => /demo|sample|preview/i.test(p.subtitle)), true,
    'every sample includes explicit demo context in its supporting copy');
  eq(PROMOTIONS_FALLBACK.filter((p) => p.coupon_code).every((p) => /^DEMO-/.test(p.coupon_code)), true,
    'all copyable sample codes are unmistakably DEMO codes');
  eq(PROMOTIONS_FALLBACK.every((p) => !p.cta_url || p.cta_url === '/shop'), true,
    'sample CTAs are store-wide, without product/category targeting');
  eq(offerCalloutFrom(normalizePromo(PROMOTIONS_FALLBACK[0])), 'PREVIEW OFFER',
    'sample poster retains a dominant demo-safe callout');
}

console.log('\n— admin publication safety notice —');
{
  const src = readFileSync('src/admin/pages/Promotions.jsx', 'utf8');
  eq(src.includes('<strong>Display &amp; copy only.</strong>')
    && src.includes('Promotions created here do not automatically change checkout totals. Only publish discount claims that are fulfilled by an approved checkout offer.'), true,
    'admin notice contains the full requested publication warning');
  eq(src.includes('className="adm-banner info" id="promo-display-notice" role="note"'), true,
    'notice is a visible admin banner with accessible note semantics');
  eq((src.match(/aria-describedby="promo-display-notice"/g) || []).length, 4,
    'title, badge, subtitle and coupon controls are associated with the notice');
  const noticeAt = src.indexOf('id="promo-display-notice"');
  eq(src.indexOf('{editing &&') < noticeAt && noticeAt < src.indexOf('Coupon code (display / copy only'), true,
    'notice appears in both create/edit form immediately before coupon controls');
}

console.log('\n— local-preview seeding gate —');
{
  // Under Node there is no location, so a deployed/non-browser context must
  // start EMPTY: sample campaign copy can never reach a real storefront.
  eq(isLocalPreviewHost(), false, 'no browser location -> not a local preview');
}

console.log('\n— static: promotion layer is display-only —');
{
  const files = [
    'src/lib/promotions.js',
    'src/data/promotions.js',
    ...readdirSync('src/components/promo').map((f) => `src/components/promo/${f}`),
  ];
  const banned = /pricing\.js|api\/_lib|create-order|computeOrderTotal|computeCouponDiscount|consume_coupon|amountPaise/;
  let clean = true;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (banned.test(src)) { bad(`${f} references pricing/checkout internals`); clean = false; }
  }
  if (clean) ok(`${files.length} promotion files touch no pricing / checkout code`);
}
{
  // The migration must not alter pricing tables or the real coupons engine.
  const mig = readFileSync('supabase/migrations/0017_promotions.sql', 'utf8');
  const touchesCoupons = /\b(alter|drop)\s+table\s+public\.coupons\b/i.test(mig)
    || /\b(create|replace)\s+function\s+public\.consume_coupon\b/i.test(mig);
  (!touchesCoupons)
    ? ok('0017 migration does not touch public.coupons / consume_coupon')
    : bad('0017 migration modifies the real coupon engine');
  (/create table if not exists public\.promotions/i.test(mig))
    ? ok('0017 creates public.promotions')
    : bad('0017 missing promotions table');
  (/enable row level security/i.test(mig) && /is_sora_admin\(\)/.test(mig))
    ? ok('0017 enables RLS with the standard admin gate')
    : bad('0017 RLS / admin gate missing');

  // Hardening: DB-level cta_url CHECK.
  (/add constraint promotions_cta_url_chk/i.test(mig)
    && /\^\/\[\^\[:space:\]\[:cntrl:\]\]\*\$/.test(mig)
    && /\^https:\/\//.test(mig)
    && /cta_url !~ '\^\/\/'/.test(mig))
    ? ok('0017 adds the cta_url CHECK (internal path | https only; //, http:, js:, data: rejected)')
    : bad('0017 cta_url CHECK constraint missing or incomplete');

  // Hardening: deterministic privileges — SELECT to anon+authenticated,
  // anon writes revoked, no direct write grant to anon.
  (/grant select on public\.promotions to anon, authenticated;/i.test(mig))
    ? ok('0017 grants SELECT to anon + authenticated')
    : bad('0017 missing explicit SELECT grant');
  (/revoke insert, update, delete on public\.promotions from anon;/i.test(mig))
    ? ok('0017 revokes anon INSERT/UPDATE/DELETE')
    : bad('0017 missing anon write revoke');
  (!/grant\s+(insert|update|delete|all)\s+on\s+public\.promotions\s+to\s+[^;]*\banon\b/i.test(mig))
    ? ok('0017 never grants a write privilege to anon')
    : bad('0017 grants a write privilege to anon');

  // Storage: promo-media public read + admin-only write, no anon write policy.
  (/create policy "promo-media public read"[\s\S]*?for select[\s\S]*?bucket_id = 'promo-media'/i.test(mig))
    ? ok('promo-media: public read policy present')
    : bad('promo-media: public read policy missing');
  (/create policy "promo-media admin write"[\s\S]*?for all[\s\S]*?is_sora_admin\(\)[\s\S]*?with check[\s\S]*?is_sora_admin\(\)/i.test(mig))
    ? ok('promo-media: write policy is admin-only (is_sora_admin on using + with check)')
    : bad('promo-media: admin write policy missing / not gated');
  (!/create policy[^;]*promo-media[^;]*for (insert|update|delete|all)[^;]*\banon\b/i.test(mig))
    ? ok('promo-media: no policy grants write to anon')
    : bad('promo-media: a policy exposes writes to anon');
}

// The admin write path mirrors the DB cta_url CHECK client-side, so re-check it.
console.log('\n— admin cta_url guard mirrors the DB constraint —');
{
  const api = readFileSync('src/lib/adminApi.js', 'utf8');
  const has = /function safeAdminCtaUrl\(/.test(api) && /cta_url: safeAdminCtaUrl\(p\.cta_url\)/.test(api);
  has ? ok('adminApi.js validates cta_url via safeAdminCtaUrl before write')
      : bad('adminApi.js does not guard cta_url before write');

  // "not provisioned" (null) must stay distinct from "no promotions" ([]),
  // and main.jsx must only apply an array.
  (/if \(isMissingPromotions\(error\)\) return null;/.test(api))
    ? ok('fetchPublicPromotions returns null when the table is missing')
    : bad('fetchPublicPromotions does not distinguish a missing table');
  const main = readFileSync('src/main.jsx', 'utf8');
  (/if \(promotions && applyPromotions\(promotions\)\)/.test(main))
    ? ok('main.jsx applies promotions only when the fetch returned a list')
    : bad('main.jsx promotion bootstrap is not null-guarded');
}

console.log('\n— promo-media cleanup (real admin API, mocked Supabase; no network) —');
{
  const origin = 'https://promotions-test.supabase.co';
  const base = `${origin}/storage/v1/object/public/promo-media/`;
  const oldPath = 'promo/old-123.png', newPath = 'promo/new-456.png';
  const oldUrl = base + oldPath, newUrl = base + newPath;
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
  let current;
  const check = async (name, test) => {
    try { await test(); ok(name); } catch (error) { bad(`${name}: ${error.message}`); }
  };
  const rejection = async (operation, message) => {
    let caught;
    try { await operation(); } catch (error) { caught = error; }
    assert.ok(caught, 'must reject, not report success');
    assert.match(caught.message, message);
    return caught;
  };
  function fixture(options = {}) {
    const state = {
      rows: [{ id: 1, title: 'QA', image_url: oldUrl, is_active: false }, ...(options.shared ? [{ id: 2, image_url: oldUrl }] : [])],
      objects: new Set(options.objects || [oldPath, newPath]), calls: [], buckets: [],
    };
    if ('imageUrl' in options) state.rows[0].image_url = options.imageUrl;
    const errorFor = (stage) => options[`${stage}Error`];
    const client = {
      from(table) {
        assert.equal(table, 'promotions', 'no other table is allowed');
        let action = 'read', payload, single = false;
        const filters = [];
        const query = {
          select() { return query; },
          eq(key, value) { filters.push((row) => row[key] === value); return query; },
          is(key, value) { filters.push((row) => row[key] === value); return query; },
          neq(key, value) { action = 'references'; filters.push((row) => row[key] !== value); return query; },
          limit() { return query; },
          update(row) { action = 'update'; payload = row; return query; },
          insert(row) { action = 'insert'; payload = row; return query; },
          delete() { action = 'delete'; return query; },
          single() { single = true; return query; },
          async execute() {
            state.calls.push(action);
            if (errorFor(action)) return { data: null, error: errorFor(action) };
            if (options[`${action}Empty`]) return { data: null, error: null };
            if (options.concurrent === action) state.rows[0].image_url = base + 'promo/concurrent.png';
            let rows = state.rows.filter((row) => filters.every((filter) => filter(row)));
            if (action === 'insert') { rows = [{ ...payload, id: 3 }]; state.rows.push(...rows); }
            if (single && rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Expected one visible row' } };
            if (action === 'update') rows.forEach((row) => Object.assign(row, payload));
            if (action === 'delete') state.rows = state.rows.filter((row) => !rows.includes(row));
            const data = single ? { ...rows[0] } : rows.map((row) => ({ ...row }));
            if (options.updateWrongImage && action === 'update') data.image_url = oldUrl;
            return { data, error: null };
          },
          then(resolve, reject) { return query.execute().then(resolve, reject); },
        };
        return query;
      },
      storage: {
        from(bucket) {
          state.buckets.push(bucket);
          assert.equal(bucket, 'promo-media', 'no other bucket is allowed');
          return {
            getPublicUrl(path) { return { data: { publicUrl: base + path } }; },
            async upload(path) {
              state.calls.push('upload');
              if (options.uploadError) return { data: null, error: options.uploadError };
              state.objects.add(path);
              return { data: { path }, error: null };
            },
            async remove(paths) {
              state.calls.push('remove');
              assert.deepEqual(paths, [oldPath], 'only the exact old object may be removed');
              if (options.removeThrow) throw options.removeThrow;
              if (options.removeError) return { data: null, error: options.removeError };
              if (!options.removeNoop) state.objects.delete(oldPath);
              return { data: [], error: null }; // Storage can return an empty 200 response.
            },
            async info(path) {
              state.calls.push('info');
              assert.equal(path, oldPath);
              if (options.infoError) return { data: null, error: options.infoError };
              if (options.infoEmpty) return { data: null, error: null };
              if (state.objects.has(path)) return { data: { name: path }, error: null };
              return { data: null, error: options.missingError || { status: 404, code: 'NoSuchKey', message: 'Object not found' } };
            },
          };
        },
      },
    };
    current = { client, state };
    return state;
  }
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]);
  const fakeUploadFile = (name, type, bytes, declaredSize = bytes.length) => ({
    name, type, size: declaredSize,
    slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }),
  });
  try {
    globalThis.fetch = async () => { throw new Error('Network is forbidden in promotions cleanup tests'); };
    globalThis.window = { crypto: { randomUUID: () => 'new-456' } };
    globalThis.__promotionCleanupTestClient = {
      from: (...args) => current.client.from(...args),
      storage: { from: (...args) => current.client.storage.from(...args) },
    };
    const operationsUrl = new URL('../src/lib/productMediaOperations.js', import.meta.url).href;
    const source = readFileSync('src/lib/adminApi.js', 'utf8')
      .replace("import { supabase } from './supabase.js';", 'const supabase = globalThis.__promotionCleanupTestClient;')
      .replace("import { BIOSASH_PRODUCTS } from '../data/biosash.js';", 'const BIOSASH_PRODUCTS = [];')
      .replace("'./productMediaOperations.js'", JSON.stringify(operationsUrl));
    const api = await import('data:text/javascript;base64,' + Buffer.from(source + '\n//# sourceURL=adminApi.promotion-test.js').toString('base64'));
    fixture();
    await check('own canonical promo-media URL yields the exact object path', () => {
      assert.equal(api.promoImageStoragePath(oldUrl), oldPath);
      assert.equal(api.promoImageStoragePath(base + 'image_1.webp'), 'image_1.webp');
    });
    const rejectedUrls = [
      ['external HTTPS', 'https://example.com/promo.png'],
      ['another Supabase project', oldUrl.replace('promotions-test.', 'another-project.')],
      ['product-images', oldUrl.replace('/promo-media/', '/product-images/')],
      ['hero-media', oldUrl.replace('/promo-media/', '/hero-media/')],
      ['bucket-name prefix spoof', oldUrl.replace('/promo-media/', '/promo-media-other/')],
      ['signed URL', oldUrl.replace('/object/public/', '/object/sign/')],
      ['protocol-relative URL', oldUrl.replace('https:', '')],
      ['wrong protocol', oldUrl.replace('https:', 'http:')],
      ['credentials in URL', oldUrl.replace('https://', 'https://admin:password@')],
      ['lookalike host', oldUrl.replace('.co/', '.co.evil.example/')],
      ['query string', oldUrl + '?download=1'],
      ['fragment', oldUrl + '#image'],
      ['empty object path', base],
      ['empty path segment', base + 'promo//image.png'],
      ['dot segment', base + './promo/image.png'],
      ['traversal before bucket', origin + '/storage/v1/object/public/product-images/../promo-media/promo/image.png'],
      ['traversal within path', base + 'promo/../image.png'],
      ['encoded traversal', base + 'promo/%2e%2e/image.png'],
      ['double-encoded traversal', base + 'promo/%252e%252e/image.png'],
      ['encoded slash', base + 'promo%2fimage.png'],
      ['encoded backslash', base + 'promo%5cimage.png'],
      ['literal backslash', base + 'promo\\image.png'],
      ['control character', base + 'promo/\u0000image.png'],
      ['whitespace', ' ' + oldUrl],
      ['malformed percent escape', base + 'promo/%zz.png'],
      ['not a URL', 'not-a-url'],
      ['null', null],
    ];
    for (const [label, url] of rejectedUrls) {
      await check(`cleanup rejects ${label}`, () => assert.equal(api.promoImageStoragePath(url), null));
    }
    await check('delete reads current image, removes/verifies Storage, then deletes row', async () => {
      const state = fixture();
      await api.adminDeletePromotion(1);
      assert.deepEqual(state.calls, ['read', 'references', 'remove', 'info', 'delete']);
      assert.equal(state.rows.length, 0);
      assert.deepEqual([...state.objects], [newPath]);
    });
    for (const [label, url] of rejectedUrls) {
      await check(`delete never touches Storage for ${label}`, async () => {
        const state = fixture({ imageUrl: url });
        await api.adminDeletePromotion(1);
        assert.deepEqual(state.calls, ['read', 'delete']);
        assert.equal(state.rows.length, 0);
        assert.equal(state.objects.size, 2);
      });
    }
    for (const stage of ['read', 'references', 'remove']) {
      await check(`${stage} failure stops promotion deletion and surfaces the error`, async () => {
        const state = fixture({ [`${stage}Error`]: { message: `${stage} denied`, code: '42501' } });
        await rejection(() => api.adminDeletePromotion(1), new RegExp(`${stage} denied`));
        assert.equal(state.rows.length, 1);
        assert.equal(state.objects.size, 2);
        assert.ok(!state.calls.includes('delete'));
      });
    }
    await check('missing/unreadable promotion is never treated as deleted', async () => {
      const state = fixture({ readEmpty: true });
      await rejection(() => api.adminDeletePromotion(1), /could not be read/);
      assert.deepEqual(state.calls, ['read']);
    });
    await check('Storage network exception is explicit and leaves the row intact', async () => {
      const state = fixture({ removeThrow: new Error('network unavailable') });
      const error = await rejection(() => api.adminDeletePromotion(1), /cleanup unresolved.*network unavailable/);
      assert.deepEqual(error.cleanupPending, [oldPath]);
      assert.equal(state.rows.length, 1);
    });
    await check('empty successful Storage delete that leaves the object must not delete the row', async () => {
      const state = fixture({ removeNoop: true });
      await rejection(() => api.adminDeletePromotion(1), /removal was not confirmed/);
      assert.equal(state.rows.length, 1);
      assert.ok(state.objects.has(oldPath));
      assert.ok(!state.calls.includes('delete'));
    });
    for (const infoError of [
      { status: 403, code: 'AccessDenied', message: 'Access denied' },
      { status: 404, code: 'NoSuchBucket', message: 'Bucket not found' },
      { status: 503, message: 'Storage unavailable' },
    ]) {
      await check(`Storage verification ${infoError.status}/${infoError.message} is not proof of cleanup`, async () => {
        const state = fixture({ infoError });
        const error = await rejection(() => api.adminDeletePromotion(1), /cleanup unresolved/);
        assert.deepEqual(error.cleanupPending, [oldPath]);
        assert.equal(state.rows.length, 1);
        assert.ok(!state.calls.includes('delete'));
      });
    }
    await check('empty Storage verification cannot silently report success', async () => {
      const state = fixture({ infoEmpty: true });
      await rejection(() => api.adminDeletePromotion(1), /cleanup unresolved/);
      assert.equal(state.rows.length, 1);
    });
    for (const missingError of [
      { status: 400, code: 'NoSuchKey', message: 'Object not found' },
      { status: 404, message: 'Object not found' },
    ]) {
      await check(`explicit missing-object response ${missingError.status} permits safe retry`, async () => {
        const state = fixture({ objects: [newPath], missingError });
        await api.adminDeletePromotion(1);
        assert.equal(state.rows.length, 0);
      });
    }
    for (const options of [
      { deleteError: { message: 'DB deletion denied' } }, { deleteEmpty: true }, { concurrent: 'delete' },
    ]) {
      await check(`DB delete failure/zero rows/concurrent edit reports partial completion (${JSON.stringify(options)})`, async () => {
        const state = fixture(options);
        const error = await rejection(() => api.adminDeletePromotion(1), /image was removed.*deletion could not be confirmed/);
        assert.equal(error.imageRemoved, true);
        assert.equal(state.rows.length, 1);
        assert.ok(!state.objects.has(oldPath));
      });
    }
    await check('shared promotion image is retained when deleting one row', async () => {
      const state = fixture({ shared: true });
      await api.adminDeletePromotion(1);
      assert.deepEqual(state.rows.map((row) => row.id), [2]);
      assert.ok(state.objects.has(oldPath));
      assert.deepEqual(state.calls, ['read', 'references', 'delete']);
    });
    const update = (imageUrl = newUrl) => api.adminUpsertPromotion({ id: 1, title: 'QA edited', image_url: imageUrl, is_active: false });
    await check('replacement uploads, saves new URL, then removes/verifies only the old object', async () => {
      const state = fixture({ objects: [oldPath] });
      const uploaded = await api.uploadPromoImage(fakeUploadFile('new.png', 'image/png', pngBytes));
      const saved = await update(uploaded);
      assert.equal(uploaded, newUrl);
      assert.equal(saved.image_url, newUrl);
      assert.deepEqual(state.calls, ['upload', 'read', 'update', 'references', 'remove', 'info']);
      assert.deepEqual([...state.objects], [newPath]);
    });
    await check('failed replacement upload never removes the current image or updates its row', async () => {
      const state = fixture({ objects: [oldPath], uploadError: { message: 'Upload denied' } });
      await rejection(() => api.uploadPromoImage(fakeUploadFile('new.png', 'image/png', pngBytes)), /Upload denied/);
      assert.deepEqual(state.calls, ['upload']);
      assert.equal(state.rows[0].image_url, oldUrl);
      assert.ok(state.objects.has(oldPath));
    });
    for (const options of [
      { readError: { message: 'Read denied' } }, { updateError: { message: 'Update denied' } },
      { updateEmpty: true }, { updateWrongImage: true }, { concurrent: 'update' },
    ]) {
      await check(`unconfirmed replacement never removes the old image (${JSON.stringify(options)})`, async () => {
        const state = fixture(options);
        await rejection(() => update(), /denied|could not be confirmed|Expected one visible row/);
        assert.ok(state.objects.has(oldPath));
        assert.ok(!state.calls.includes('remove'));
      });
    }
    await check('unchanged image URL does not trigger cleanup', async () => {
      const state = fixture();
      await update(oldUrl);
      assert.deepEqual(state.calls, ['read', 'update']);
      assert.equal(state.objects.size, 2);
    });
    for (const alias of [
      oldUrl.replace('promotions-test.supabase.co', 'PROMOTIONS-TEST.supabase.co:443'),
      oldUrl + '?download=1', oldUrl + '#image', oldUrl.replace('old-123', '%6fld-123'),
    ]) {
      await check(`same-object URL edit retains the current image (${alias})`, async () => {
        const state = fixture();
        await update(alias);
        assert.deepEqual(state.calls, ['read', 'update']);
        assert.ok(state.objects.has(oldPath));
      });
    }
    for (const [label, url] of rejectedUrls.slice(0, 4)) {
      await check(`replacement never deletes old ${label} image`, async () => {
        const state = fixture({ imageUrl: url });
        await update();
        assert.deepEqual(state.calls, ['read', 'update']);
        assert.equal(state.objects.size, 2);
      });
    }
    for (const options of [
      { referencesError: { message: 'Reference lookup denied' } },
      { removeError: { message: 'Storage delete denied' } }, { removeNoop: true },
      { infoError: { status: 503, message: 'Storage unavailable' } },
    ]) {
      await check(`post-save cleanup failure explicitly preserves saved replacement (${JSON.stringify(options)})`, async () => {
        const state = fixture(options);
        const error = await rejection(() => update(), /Promotion saved, but the previous image needs cleanup/);
        assert.equal(error.savedPromotion.image_url, newUrl);
        assert.deepEqual(error.cleanupPending, [oldPath]);
        assert.equal(state.rows[0].image_url, newUrl);
        assert.ok(state.objects.has(newPath));
        assert.ok(state.calls.indexOf('update') < state.calls.indexOf('references'));
      });
    }
    await check('shared old image is retained after a successful replacement', async () => {
      const state = fixture({ shared: true });
      await update();
      assert.equal(state.rows[0].image_url, newUrl);
      assert.equal(state.rows[1].image_url, oldUrl);
      assert.ok(state.objects.has(oldPath));
      assert.ok(!state.calls.includes('remove'));
    });
    await check('new promotion insertion has no previous-image cleanup', async () => {
      const state = fixture();
      await api.adminUpsertPromotion({ title: 'QA new', image_url: newUrl, is_active: false });
      assert.deepEqual(state.calls, ['insert']);
      assert.equal(state.objects.size, 2);
    });
    await check('invalid and oversized uploads are rejected before Storage access', async () => {
      const state = fixture();
      await rejection(() => api.uploadPromoImage(fakeUploadFile('bad.svg', 'image/svg+xml', Buffer.from('<svg>'))), /image|type|JPEG|PNG/i);
      await rejection(() => api.uploadPromoImage(fakeUploadFile('large.png', 'image/png', pngBytes, 6 * 1024 * 1024 + 1)), /too large/);
      assert.deepEqual(state.calls, []);
    });
    const adminUi = readFileSync('src/admin/pages/Promotions.jsx', 'utf8');
    await check('admin displays saved-but-cleanup-pending warning after reload', () => {
      assert.match(adminUi, /if \(ex\.savedPromotion\) \{ setEditing\(null\); await load\(\); \}[\s\S]*?setErr\(ex\.message/);
      assert.match(adminUi, /className="adm-banner err" role="alert"/);
      assert.match(adminUi, /Delete promotion[\s\S]*?uploaded promo image/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    delete globalThis.__promotionCleanupTestClient;
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
