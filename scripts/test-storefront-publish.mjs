// ============================================================
// Publish-time storefront content — offline suite.
//
//   node scripts/test-storefront-publish.mjs
//
// Pins, with no network and no database:
//   * the rules: a value that breaks one is rejected (editor and build), never
//     rendered; the schema agrees field for field with the storefront's own
//     normalisers;
//   * the build step (build/publish-content.mjs): on success the published
//     content is written into index.html as one safe JSON block and its uploaded
//     images are copied in under content-hashed names; on ANY failure — the read,
//     a missing store, a rule, an image, the page — it throws having written
//     nothing, and the CLI exits 1 (Vercel then never promotes the deployment);
//   * the publish endpoint: admin-only through the database function, run as the
//     caller; the deploy hook is called only after a recorded publish, and its URL
//     never appears in any response or log line;
//   * the deploy hook URL is server-side only: absent from every file the browser
//     can receive (src/, index.html, public/), and no build can inline it;
//   * the page reads the published block before its first render, ignores the
//     homepage record's stale copies, and an admin's ?preview=draft shows drafts.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as content from '../src/lib/storefrontContent.js';
import { normalizeFashionStorefront, normalizeLifestyleStorefront, DEFAULT_FASHION_STOREFRONT, DEFAULT_LIFESTYLE_STOREFRONT } from '../src/lib/storefrontCustomization.js';
import { publishContent, supabaseFromBundle } from '../build/publish-content.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}

const PROJECT = 'https://abcdefghijklmnopqrst.supabase.co';
const KEY = 'sb_publishable_TESTKEY0123456789abcdef';
const STORAGE = `${PROJECT}/storage/v1/object/public/product-images/storefront/`;
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24, 7)]);

console.log('\n— The rules —');

await test('the schema is the storefront\'s own: the same fields, and the same lengths its normalisers keep', () => {
  const keysOf = (spec, value) => (spec.type === 'group' ? Object.keys(spec.fields).sort() : null);
  assert.deepEqual(keysOf(content.STOREFRONT_SCHEMAS.fashion), Object.keys(DEFAULT_FASHION_STOREFRONT).sort());
  assert.deepEqual(keysOf(content.STOREFRONT_SCHEMAS.lifestyle), Object.keys(DEFAULT_LIFESTYLE_STOREFRONT).sort());
  const check = (store, spec, defaults, normalize, path = []) => {
    for (const [key, field] of Object.entries(spec.fields)) {
      const at = [...path, key];
      if (field.type === 'group') { check(store, field, defaults[key], normalize, at); continue; }
      if (field.type === 'list') {
        assert.equal(defaults[key].length, field.length, at.join('.'));
        for (const [k, f] of Object.entries(field.fields)) {
          if (f.type !== 'text') continue;
          const long = 'x'.repeat(f.max + 9);
          const out = normalize({ [key]: [{ [k]: long }] });
          assert.equal(out[key][0][k].length, f.max, `${store}.${at.join('.')}.0.${k} keeps ${f.max}`);
        }
        continue;
      }
      assert.ok(Object.hasOwn(defaults, key), `${store}.${at.join('.')} is a field of the defaults`);
      if (field.type === 'text') {
        const input = {}; let node = input;
        at.slice(0, -1).forEach((p) => { node[p] = {}; node = node[p]; });
        node[at.at(-1)] = 'x'.repeat(field.max + 9);
        const out = at.reduce((o, p) => o[p], normalize(input));
        assert.equal(out.length, field.max, `${store}.${at.join('.')} keeps ${field.max}`);
      }
    }
  };
  check('fashion', content.STOREFRONT_SCHEMAS.fashion, DEFAULT_FASHION_STOREFRONT, normalizeFashionStorefront);
  check('lifestyle', content.STOREFRONT_SCHEMAS.lifestyle, DEFAULT_LIFESTYLE_STOREFRONT, normalizeLifestyleStorefront);
});

await test('the built-in content passes; a bad value is rejected with its field, never trimmed or swapped', () => {
  for (const [store, defaults] of [['fashion', DEFAULT_FASHION_STOREFRONT], ['lifestyle', DEFAULT_LIFESTYLE_STOREFRONT]]) {
    assert.deepEqual(content.validateStorefrontContent(store, defaults).errors, {}, store);
  }
  const { errors } = content.validateStorefrontContent('fashion', {
    header: { tagline: 'x'.repeat(61) },
    hero: { ctaLink: 'https://evil.example', image: 'javascript:alert(1)', title: 'Line\u0000break', note: 42 },
    sections: { productsTitle: '' },
    extra: 'nope',
  });
  assert.match(errors['header.tagline'], /Keep it to 60 characters \(it has 61\)/);
  assert.match(errors['hero.ctaLink'], /starting with \//);
  assert.match(errors['hero.image'], /uploaded here/);
  assert.match(errors['hero.title'], /control characters/);
  assert.match(errors['hero.note'], /Expected text/);
  assert.match(errors.extra, /Not a field/);
  assert.equal(errors['sections.productsTitle'], undefined, 'empty means "the built-in value"');
  for (const link of ['//evil.example/x', '/ok path', '/x\\y']) assert.ok(content.validateStorefrontContent('fashion', { hero: { ctaLink: link } }).errors['hero.ctaLink'], link);
  assert.deepEqual(content.validateStorefrontContent('fashion', { hero: { ctaLink: '/fashion/c/clothing?sort=new' } }).errors, {});
  assert.ok(content.validateStorefrontContent('lifestyle', { heroSlides: [{}, {}, {}, {}] }).errors.heroSlides, 'at most three slides');
  assert.ok(content.validateStorefrontContent('wellness', { hero: {} }).errors.hero, 'a store with no editable fields takes nothing yet');
  assert.ok(content.validateStorefrontContent('nowhere', {}).errors['']);
});

await test('images: uploaded here or shipped with the site; the build also lets an older saved https image through, untouched', () => {
  assert.ok(content.isUploadedImage(`${STORAGE}a1b2.webp`));
  for (const bad of [`${PROJECT}/storage/v1/object/public/other-bucket/a.webp`, `${STORAGE}a.webp?x=1`, `${STORAGE}../a.webp`, 'http://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/product-images/a.webp', 'https://evil.example/storage/v1/object/public/product-images/a.webp']) {
    assert.equal(content.isUploadedImage(bad), false, bad);
  }
  const external = { hero: { image: 'https://cdn.example.com/hero.webp' } };
  assert.ok(content.validateStorefrontContent('fashion', external).errors['hero.image'], 'the editor refuses a pasted outside image');
  assert.deepEqual(content.validateStorefrontContent('fashion', external, { mode: 'published' }).errors, {}, 'the build lets an older one through');
  assert.deepEqual(content.validateStorefrontContent('fashion', { hero: { image: '/img/fashion-hero.webp' } }).errors, {});
  assert.ok(content.validateStorefrontContent('fashion', { hero: { image: 'javascript:alert(1)' } }, { mode: 'published' }).errors['hero.image'], 'never an unsafe one');
});

console.log('\n— The build step —');

function site({ index = '<!doctype html><html><body><div id="root"></div>\n<!--sora-content-->\n<script type="module" src="/public/bundle.js"></script></body></html>', bundle = `const supabaseUrl = "${PROJECT}";\nconst supabasePublishableKey = "${KEY}";\n` } = {}) {
  const root = mkdtempSync(join(process.env.TEMP || tmpdir(), 'publish-content-'));
  mkdirSync(join(root, 'public'), { recursive: true });
  writeFileSync(join(root, 'index.html'), index);
  writeFileSync(join(root, 'public', 'bundle.js'), bundle);
  return root;
}
const ROWS = () => [
  { store: 'wellness', content: {}, draft_version: 1, published_at: '2026-10-13T08:00:00Z' },
  { store: 'fashion', content: { hero: { title: 'Autumn </script><script>alert(1)</script> edit', image: `${STORAGE}hero.webp` }, header: { tagline: 'Live bright & easy' } }, draft_version: 4, published_at: '2026-10-13T08:00:00Z' },
  { store: 'homeliving', content: {}, draft_version: 1, published_at: null },
  { store: 'grocery', content: {}, draft_version: 1, published_at: null },
  { store: 'lifestyle', content: { promo: { image: '/img/homeliving-promo.webp' }, heroSlides: [{ id: 'home', wide: `${STORAGE}hero.webp` }] }, draft_version: 2, published_at: '2026-10-13T08:00:00Z' },
];
function fakeFetch({ rows = ROWS(), status = 200, body = null, images = {}, throwOn = null } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (throwOn && String(url).includes(throwOn)) throw new TypeError('fetch failed');
    if (String(url).startsWith(`${PROJECT}/rest/v1/storefront_published`)) {
      return new Response(body ?? JSON.stringify(rows), { status, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).startsWith(STORAGE)) {
      const img = images[String(url)] ?? { status: 200, type: 'image/webp', bytes: WEBP };
      return new Response(img.bytes, { status: img.status, headers: { 'content-type': img.type } });
    }
    return new Response('not found', { status: 404 });
  };
  fn.calls = calls;
  return fn;
}
const fakeDocument = (html) => ({ getElementById: (id) => { const m = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)</script>`).exec(html); return m ? { textContent: m[1] } : null; } });

await test('success: the published content is written into index.html as one safe JSON block, uploaded images are copied in under content-hashed names', async () => {
  const root = site();
  const fetch = fakeFetch();
  const summary = await publishContent({ root, fetch });
  assert.equal(summary.stores, 5); assert.equal(summary.images, 1, 'the same upload in two places is copied once');
  const read0 = fetch.calls[0];
  assert.equal(read0.url, `${PROJECT}/rest/v1/storefront_published?select=store,content,draft_version,published_at`, 'read from the project the committed bundle talks to');
  assert.equal(read0.init.headers.apikey, KEY, 'with its public key');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<!--sora-content-->/, 'the marker is replaced');
  assert.equal((html.match(/<script id="sora-content" type="application\/json">/g) || []).length, 1);
  assert.doesNotMatch(html.split('<script id="sora-content" type="application/json">')[1].split('</script>')[0], /<|>/, 'nothing in the block can close it');
  const name = `${createHash('sha256').update(WEBP).digest('hex').slice(0, 20)}.webp`;
  assert.deepEqual(readdirSync(join(root, 'img', 'published')), [name]);
  assert.deepEqual(readFileSync(join(root, 'img', 'published', name)), WEBP);
  const data = content.readInlinedContent(fakeDocument(html));
  assert.equal(data.stores.fashion.hero.title, 'Autumn </script><script>alert(1)</script> edit', 'the text survives exactly');
  assert.equal(data.stores.fashion.hero.image, `/img/published/${name}`, 'served by the site, not by Supabase');
  assert.equal(data.stores.lifestyle.heroSlides[0].wide, `/img/published/${name}`);
  assert.equal(data.stores.lifestyle.promo.image, '/img/homeliving-promo.webp', 'a shipped file stays as it is');
  assert.deepEqual(data.versions.fashion, { version: 4, publishedAt: '2026-10-13T08:00:00Z' });
  assert.ok(!existsSync(join(root, 'img', '.published-tmp')));
  rmSync(root, { recursive: true, force: true });
});

const FAILURES = [
  ['the read cannot connect', { fetch: () => fakeFetch({ throwOn: '/rest/v1/' }) }, /request did not complete/],
  ['the read answers HTTP 500', { fetch: () => fakeFetch({ status: 500 }) }, /HTTP 500/],
  ['the table is missing (HTTP 404: migration 0037 not applied)', { fetch: () => fakeFetch({ status: 404, body: '{"code":"PGRST205"}' }) }, /HTTP 404/],
  ['the answer is not JSON', { fetch: () => fakeFetch({ body: '<html>' }) }, /not readable JSON/],
  ['the answer is not a list', { fetch: () => fakeFetch({ body: '{"store":"fashion"}' }) }, /not a list/],
  ['a store has no published record', { fetch: () => fakeFetch({ rows: ROWS().filter((r) => r.store !== 'grocery') }) }, /grocery: no published record/],
  ['a published value breaks a rule', { fetch: () => fakeFetch({ rows: ROWS().map((r) => (r.store === 'fashion' ? { ...r, content: { hero: { ctaLink: 'https://evil.example' } } } : r)) }) }, /fashion\.hero\.ctaLink/],
  ['an image will not download', { fetch: () => fakeFetch({ images: { [`${STORAGE}hero.webp`]: { status: 404, type: 'text/plain', bytes: Buffer.from('x') } } }) }, /answered HTTP 404/],
  ['an "image" is not one', { fetch: () => fakeFetch({ images: { [`${STORAGE}hero.webp`]: { status: 200, type: 'image/webp', bytes: Buffer.from('<html>') } } }) }, /not a WebP, PNG or JPEG/],
  ['index.html has no marker', { site: { index: '<html></html>' } }, /marker/],
  ['the bundle names no Supabase project', { site: { bundle: 'console.log(1)' } }, /carries no Supabase project URL and key/],
];
for (const [what, setup, message] of FAILURES) {
  await test(`failure — ${what}: it throws and writes nothing`, async () => {
    const root = site(setup.site);
    const before = readFileSync(join(root, 'index.html'));
    await assert.rejects(publishContent({ root, fetch: (setup.fetch || fakeFetch)() }), message);
    assert.deepEqual(readFileSync(join(root, 'index.html')), before, 'index.html is byte-identical');
    assert.ok(!existsSync(join(root, 'img', 'published')), 'no image was written');
    assert.ok(!existsSync(join(root, 'img', '.published-tmp')), 'nothing half-written is left');
    rmSync(root, { recursive: true, force: true });
  });
}

await test('the command line exits 1 on a failure, says the live site is unchanged, and leaves index.html as it was', () => {
  const root = site({ bundle: 'console.log("no supabase here")' });
  const before = readFileSync(join(root, 'index.html'));
  const run = spawnSync(process.execPath, [join(ROOT, 'build', 'publish-content.mjs'), root], { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /FAILED — this deployment stops here and the live site is unchanged/);
  assert.deepEqual(readFileSync(join(root, 'index.html')), before);
  rmSync(root, { recursive: true, force: true });
});

await test('Vercel runs it after the normal build, on every deploy, and the repository ships the marker', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.equal(vercel.buildCommand, 'npm run build && node build/publish-content.mjs');
  assert.equal((read('index.html').match(/<!--sora-content-->/g) || []).length, 1);
  assert.ok(read('index.html').indexOf('<!--sora-content-->') < read('index.html').indexOf('src="/public/bundle.js"'), 'before the app\'s script');
  assert.match(read('.gitignore'), /^img\/published\/$/m, 'copied images are never committed');
  assert.doesNotMatch(read('.vercelignore'), /^(build|src|img)\/?$/m, 'the step, its rules and the image folder reach the build');
  assert.deepEqual(supabaseFromBundle(read('public/bundle.js')).url.length > 0, true, 'the committed bundle names its project');
});

console.log('\n— The publish endpoint —');

const HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_HOOKSECRET123/hk_SECRET456';
process.env.VITE_SUPABASE_URL = PROJECT;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-the-rate-limiter';
process.env.SUPABASE_ANON_KEY = KEY;
const { default: handler } = await import('../api/admin/publish-storefront.js');
const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.admin-session-token.signature';
function call({ method = 'POST', body = { store: 'fashion', version: 4 }, auth = TOKEN, hook = HOOK, rpc = { status: 200, body: { store: 'fashion', version: 4, published_at: '2026-10-13T09:00:00Z' } }, deploy = { status: 201 } } = {}) {
  if (hook === null) delete process.env.VERCEL_DEPLOY_HOOK_URL; else process.env.VERCEL_DEPLOY_HOOK_URL = hook;
  const calls = [], logs = [];
  const realFetch = globalThis.fetch, realConsole = { log: console.log, warn: console.warn, error: console.error };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/rpc/rate_limit_check')) return new Response(JSON.stringify({ allowed: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).endsWith('/rpc/admin_publish_storefront')) return new Response(JSON.stringify(rpc.body), { status: rpc.status, headers: { 'content-type': 'application/json' } });
    if (String(url) === HOOK) { if (deploy.throws) throw new Error(`request to ${HOOK} failed, reason: connect ECONNREFUSED`); return new Response('{}', { status: deploy.status }); }
    return new Response('{}', { status: 404 });
  };
  for (const k of Object.keys(realConsole)) console[k] = (...args) => logs.push(args.join(' '));
  const res = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return handler({ method, headers: auth ? { authorization: auth } : {}, body }, res).finally(() => {
    globalThis.fetch = realFetch; Object.assign(console, realConsole);
  }).then(() => ({ res, calls, logs }));
}
const leaks = ({ res, logs }) => [JSON.stringify(res.body), JSON.stringify(res.headers), ...logs].some((s) => /HOOKSECRET|SECRET456|integrations\/deploy|api\.vercel\.com/.test(s || ''));
const hookCalls = (calls) => calls.filter((c) => c.url === HOOK);

await test('success: the publish is recorded as the signed-in admin, then the deploy hook is called once — and the answer does not carry it', async () => {
  const out = await call();
  assert.equal(out.res.statusCode, 200);
  assert.deepEqual(out.res.body, { ok: true, store: 'fashion', version: 4, publishedAt: '2026-10-13T09:00:00Z', rebuild: 'started' });
  const rpc = out.calls.find((c) => c.url.endsWith('/rpc/admin_publish_storefront'));
  assert.equal(rpc.init.headers.Authorization, TOKEN, 'the database checks the caller\'s own session');
  assert.equal(rpc.init.headers.apikey, KEY, 'with the public key, not the service key');
  assert.deepEqual(JSON.parse(rpc.init.body), { p_store: 'fashion', p_expected_version: 4 });
  assert.equal(hookCalls(out.calls).length, 1); assert.equal(hookCalls(out.calls)[0].init.method, 'POST');
  assert.ok(out.calls.indexOf(rpc) < out.calls.indexOf(hookCalls(out.calls)[0]), 'recorded first, rebuilt second');
  assert.equal(leaks(out), false);
});

const REFUSALS = [
  ['a GET', { method: 'GET' }, 405],
  ['no deploy hook configured', { hook: null }, 503],
  ['a deploy hook that is not Vercel\'s', { hook: 'https://evil.example/deploy' }, 503],
  ['no session', { auth: null }, 401],
  ['an unknown store', { body: { store: 'pharmacy', version: 4 } }, 400],
  ['no version', { body: { store: 'fashion' } }, 400],
  ['a signed-in customer (the database refuses: admin only)', { rpc: { status: 400, body: { message: 'admin only' } } }, 403],
  ['an expired session', { rpc: { status: 401, body: { message: 'JWT expired' } } }, 403],
  ['a draft that moved since it was opened', { rpc: { status: 400, body: { message: 'stale: this storefront was saved elsewhere since it was opened' } } }, 409],
  ['any other database failure', { rpc: { status: 500, body: { message: 'boom' } } }, 502],
];
for (const [what, setup, status] of REFUSALS) {
  await test(`refused — ${what}: HTTP ${status}, the site is not rebuilt, and nothing names the hook`, async () => {
    const out = await call(setup);
    assert.equal(out.res.statusCode, status, JSON.stringify(out.res.body));
    assert.equal(out.res.body.ok, false);
    assert.equal(hookCalls(out.calls).length, 0, 'the hook is not called');
    if (status === 503 || status === 405 || status === 400 || status === 401) assert.equal(out.calls.filter((c) => c.url.endsWith('/rpc/admin_publish_storefront')).length, 0, 'nothing is published');
    assert.equal(leaks(out), false);
  });
}

for (const [what, deploy] of [['the hook answers HTTP 500', { status: 500 }], ['the hook cannot be reached (its error names the URL)', { throws: true }]]) {
  await test(`the rebuild does not start — ${what}: HTTP 502 "press Publish again", and nothing names the hook`, async () => {
    const out = await call({ deploy });
    assert.equal(out.res.statusCode, 502);
    assert.equal(out.res.body.error, 'Published, but the site rebuild did not start. Press Publish again.');
    assert.equal(leaks(out), false);
  });
}

console.log('\n— The hook stays on the server —');

function filesUnder(rel, pattern) {
  const out = [];
  const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (pattern.test(name)) out.push(p); } };
  if (existsSync(join(ROOT, rel))) walk(join(ROOT, rel));
  return out;
}
await test('the deploy hook URL is never in the bundle or the browser: no file the browser receives names it, and no build can inline it', () => {
  const browser = [...filesUnder('src', /\.(m?js|jsx|css|json)$/), ...filesUnder('public', /\.(js|map|css|html|json)$/), join(ROOT, 'index.html')];
  assert.ok(browser.length > 50, 'the whole client tree is scanned');
  for (const f of browser) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /VERCEL_DEPLOY_HOOK|integrations\/deploy|api\.vercel\.com/, relative(ROOT, f));
  }
  const readers = [...filesUnder('api', /\.js$/), ...filesUnder('src', /\.(m?js|jsx)$/), ...filesUnder('build', /\.m?js$/)]
    .filter((f) => /VERCEL_DEPLOY_HOOK_URL/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  assert.deepEqual(readers, ['api/admin/publish-storefront.js'], 'one server function reads it');
  assert.doesNotMatch('VERCEL_DEPLOY_HOOK_URL', /^VITE_/, 'not a VITE_ variable');
  const rollup = read('rollup.config.mjs');
  const inlined = [...rollup.matchAll(/'(import\.meta\.env\.[A-Z_]+|process\.env\.[A-Z_]+)'\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(inlined, ['import.meta.env.VITE_OAUTH_PROVIDERS', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', 'import.meta.env.VITE_SUPABASE_URL', 'process.env.NODE_ENV'], 'the build inlines only these');
  assert.doesNotMatch(rollup, /DEPLOY_HOOK|'process\.env'\s*:/);
});

await test('the admin\'s publish request carries only the store, the version and the admin\'s own session', async () => {
  const { loadModule } = await import('./catalogue-admin-harness.mjs');
  const sent = [];
  const api = loadModule('src/lib/storefrontContentApi.js', { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'admin-session-token' } } }) } } });
  const result = await api.publishStorefront('lifestyle', 9, { fetchImpl: async (url, init) => { sent.push({ url, init }); return new Response(JSON.stringify({ ok: true, version: 9, publishedAt: 'x' }), { status: 200 }); } });
  assert.equal(result.version, 9);
  assert.equal(sent[0].url, '/api/admin/publish-storefront');
  assert.deepEqual(JSON.parse(sent[0].init.body), { store: 'lifestyle', version: 9 });
  assert.equal(sent[0].init.headers.Authorization, 'Bearer admin-session-token');
  await assert.rejects(api.publishStorefront('lifestyle', 9, { fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'This storefront was saved elsewhere since you opened it.' }), { status: 409 }) }), (e) => e.isStaleWrite && /saved elsewhere/.test(e.message));
});

console.log('\n— The page —');

async function freshSettings(html) {
  const saved = globalThis.document;
  globalThis.document = html ? fakeDocument(html) : undefined;
  try { return await import(`${pathToFileURL(join(ROOT, 'src/lib/settings.js')).href}?case=${Math.random()}`); }
  finally { globalThis.document = saved; }
}
await test('the page takes the published storefronts from the block before its first render, and the homepage record\'s stale copies never replace them', async () => {
  const block = `<script id="sora-content" type="application/json">${content.serializeInlinedContent({ stores: { fashion: { hero: { title: 'Published hero' } }, lifestyle: { header: { tagline: 'Published lifestyle' } }, wellness: {}, homeliving: {}, grocery: {} }, versions: {} })}</script>`;
  const s = await freshSettings(`<html>${block}</html>`);
  assert.equal(s.getHomepageSnapshot().fashion_storefront.hero.title, 'Published hero', 'there at module load: before any render or fetch');
  assert.equal(s.getHomepageSnapshot().lifestyle_storefront.header.tagline, 'Published lifestyle');
  let notified = 0; s.subscribeHomepage(() => { notified += 1; });
  s.applyHomepage({ fashion_storefront: { hero: { title: 'Old copy in the homepage record' } }, discovery: { categoryCards: [] } });
  assert.equal(s.getHomepageSnapshot().fashion_storefront.hero.title, 'Published hero', 'the stale copy is ignored');
  assert.deepEqual(s.getHomepageSnapshot().discovery, { categoryCards: [] }, 'the rest of the record still applies');
  assert.equal(s.applyStorefrontDrafts([{ store: 'fashion', content: { hero: { title: 'Draft hero' } } }]), true);
  assert.equal(s.getHomepageSnapshot().fashion_storefront.hero.title, 'Draft hero', 'an admin\'s preview shows the draft');
  assert.equal(notified, 2);
  assert.equal(s.applyStorefrontDrafts([]), false, 'no drafts readable (not an admin): nothing changes');
  const bare = await freshSettings(null);
  assert.equal(bare.getHomepageSnapshot().fashion_storefront, undefined, 'no block (local dev): the built-in content');
});

await test('draft preview is an admin\'s only: drafts are admin-read in the database, and the page asks only on ?preview=draft', () => {
  const main = read('src/main.jsx');
  assert.match(main, /get\('preview'\) === 'draft'[\s\S]{0,200}fetchStorefrontDraftsForPreview\(\)[\s\S]{0,120}applyStorefrontDrafts\(drafts\)/);
  assert.match(main, /Draft preview — not live/);
  const sql = read('supabase/migrations/0037_storefront_content.sql');
  assert.match(sql, /create policy "storefront_drafts admin read" on public\.storefront_drafts\s+for select using \(public\.is_sora_admin\(\)\);/);
  assert.match(sql, /create policy "storefront_published public read" on public\.storefront_published\s+for select using \(true\);/);
  // Writes: an admin's own session, through admin-only RLS — never a function running as the table owner.
  for (const table of ['storefront_drafts', 'storefront_published']) {
    const writes = [...sql.matchAll(new RegExp(`create policy "[^"]+" on public\\.${table}\\s+for (\\w+)([^;]*);`, 'g'))].filter((m) => m[1] !== 'select');
    assert.deepEqual(writes.map((m) => m[1]), ['update'], `${table}: one write policy, update only (no insert, no delete)`);
    assert.equal(writes[0][2].trim(), 'using (public.is_sora_admin()) with check (public.is_sora_admin())', `${table}: admin-only in USING and WITH CHECK`);
  }
  assert.doesNotMatch(sql, /security definer/i, 'nothing runs as its owner');
  for (const fn of ['admin_save_storefront_draft', 'admin_publish_storefront']) {
    const body = sql.slice(sql.indexOf(`create or replace function public.${fn}`));
    assert.match(body.slice(0, 900), /security invoker[\s\S]*if not public\.is_sora_admin\(\) then\s+raise exception 'admin only'/, fn);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`), fn);
  }
  assert.match(sql, /where store = p_store and version = p_expected_version/, 'a save is refused if the draft moved');
  assert.match(sql, /if v_version <> p_expected_version then\s+raise exception 'stale/, 'a publish names the version it publishes');
  // However a row is changed (the functions, or an admin's direct write), the version check holds.
  assert.match(sql, /if new\.version <> old\.version \+ 1 then\s+raise exception 'stale/, 'every draft change moves the version on by exactly one');
  assert.match(sql, /before update on public\.storefront_drafts\s+for each row execute function public\.storefront_drafts_next_version\(\);/);
  assert.match(sql, /where d\.store = new\.store and d\.version = new\.draft_version and d\.content = new\.content\) then\s+raise exception 'stale/, 'a published record is exactly a saved draft');
  assert.match(sql, /before update on public\.storefront_published\s+for each row execute function public\.storefront_published_is_draft\(\);/);
  assert.match(sql, /'fashion_storefront'[\s\S]*'lifestyle_storefront'/, 'seeded from what the site shows today');
  assert.match(read('supabase/migrations/0038_drop_hero_slides.sql'), /^drop table if exists public\.hero_slides;$/m);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
