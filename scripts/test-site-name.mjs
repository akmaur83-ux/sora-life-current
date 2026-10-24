// ============================================================
// The site's name: SORA LIFE -> SORA LIFESTYLE (owner, 2026-10-24).
//
// Pinned:
//   * Admin -> Branding reaches the storefront. It stores site_name, logo_url,
//     favicon_url (snake_case, as the 0001 seed did) and the storefront reads
//     siteName, logoUrl, faviconUrl; the record used to be merged as stored, so
//     nothing saved there ever showed. Colours stay with Appearance.
//   * The tab title and the legal-page defaults put the name in without
//     stacking: "SORA LIFE" is the start of "SORA LIFESTYLE".
//   * No customer- or admin-facing text in the code still says the old name,
//     except the defaults behind admin-edited content, which the owner is
//     changing in the admin (listed by name below), and comments.
//   * The logo file and the "Health & Wellness" tagline are unchanged (new
//     artwork to come).
//
//   node scripts/test-site-name.mjs
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ROOT, read, loadModule, mount, h, findAll, textOf } from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const settings = await import(pathToFileURL(resolve(ROOT, 'src/lib/settings.js')).href);
const legal = await import(pathToFileURL(resolve(ROOT, 'src/lib/legalPages.js')).href);
const fresh = async () => import(`${pathToFileURL(resolve(ROOT, 'src/lib/settings.js')).href}?${Math.random()}`);
const SEED = { logo_url: '/assets/sora-life-logo.png', site_name: 'SORA LIFE', tagline: 'HEALTH & WELLNESS', primary_color: '#1E3A2F', accent_color: '#E8B04B', favicon_url: null };

console.log('\n— Admin → Branding reaches the storefront —');

await test('B1 the built-in name is SORA LIFESTYLE; the logo file and the tagline are unchanged', async () => {
  const s = await fresh();
  assert.equal(s.branding.siteName, 'SORA LIFESTYLE');
  assert.equal(s.branding.logoUrl, '/assets/sora-life-logo.png');
  assert.equal(s.branding.tagline, 'HEALTH & WELLNESS');
});

await test('B2 the name, logo and favicon saved in Admin → Branding are what the storefront uses', async () => {
  const s = await fresh();
  s.applyBranding({ ...SEED, site_name: 'SORA LIFESTYLE', logo_url: 'https://cdn.example/logo.webp', favicon_url: '/img/favicon.png' });
  assert.equal(s.branding.siteName, 'SORA LIFESTYLE');
  assert.equal(s.branding.logoUrl, 'https://cdn.example/logo.webp');
  assert.equal(s.branding.faviconUrl, '/img/favicon.png');
  assert.ok(!('site_name' in s.branding) && !('logo_url' in s.branding), 'no stored-only keys left lying in it');
});

await test('B3 so a record that still says SORA LIFE shows SORA LIFE: the saved setting wins over the built-in name', async () => {
  const s = await fresh();
  s.applyBranding(SEED);
  assert.equal(s.branding.siteName, 'SORA LIFE');
});

await test('B4 a blank field keeps the built-in value, an image address must be a site path or https, and colours are not taken', async () => {
  const s = await fresh();
  s.applyBranding({ site_name: '  ', tagline: '', logo_url: 'javascript:alert(1)', favicon_url: '//evil.example/x.png', primary_color: '#FF0000', accent_color: '#00FF00' });
  assert.deepEqual(
    [s.branding.siteName, s.branding.tagline, s.branding.logoUrl, s.branding.faviconUrl, s.branding.primaryColor, s.branding.accentColor],
    ['SORA LIFESTYLE', 'HEALTH & WELLNESS', '/assets/sora-life-logo.png', null, '#1E3A2F', '#E8B04B'],
  );
});

await test('B5 the Branding page points colours to Appearance instead of offering pickers that change nothing', async () => {
  const page = loadModule('src/admin/pages/Branding.jsx', {
    adminGetSetting: async () => SEED, adminSetSetting: async () => {}, uploadImage: async () => '',
  });
  const handle = await mount(h(page.default));
  assert.equal(findAll(handle.tree, (n) => n.type === 'input' && n.props.type === 'color').length, 0, 'no colour inputs');
  assert.match(textOf(handle.tree), /Set in Appearance \(Primary brand color and Accent\)/);
});

await test('B6 the admin Legal pages screen builds a missing page with the saved name too', () => {
  const src = read('src/admin/pages/LegalPages.jsx');
  assert.match(src, /defaultLegalPage\(p\.id, contact \|\| \{\}, brandingFromSetting\(branding\)\.siteName\)/);
});

console.log('\n— The name goes in without stacking —');

await test('T1 the tab title gets the name in front, the same however many times it is applied', () => {
  const html = read('index.html');
  const title = /<title>([^<]*)<\/title>/.exec(html)[1];
  assert.equal(title, 'Sora Lifestyle — Modern Wellness, Beauty & Everyday Care');
  const once = settings.titleWithSiteName(title, 'SORA LIFESTYLE');
  assert.equal(once, 'SORA LIFESTYLE — Modern Wellness, Beauty & Everyday Care');
  assert.equal(settings.titleWithSiteName(once, 'SORA LIFESTYLE'), once);
  assert.equal(settings.titleWithSiteName('Sora Life — Modern Wellness, Beauty & Everyday Care', 'SORA LIFESTYLE'), once);
  assert.equal(settings.titleWithSiteName(once, 'SORA LIFE'), 'SORA LIFE — Modern Wellness, Beauty & Everyday Care');
});

await test('T2 the tab title and favicon follow the saved setting once it loads, not only the first render', () => {
  const app = read('src/App.jsx');
  assert.match(app, /useEffect\(\(\) => \{\n\s*if \(siteName\) document\.title = titleWithSiteName\(document\.title, siteName\);\n\s*\}, \[siteName\]\);/);
  assert.match(app, /\}, \[faviconUrl\]\);/);
  assert.doesNotMatch(app, /document\.title\.replace\(/);
});

await test('T3 a legal page built from the defaults carries the name once, whatever it is', () => {
  for (const id of ['privacy', 'terms', 'returns']) {
    const page = legal.defaultLegalPage(id, {}, 'SORA LIFESTYLE');
    const all = `${page.intro}\n${page.body}`;
    assert.doesNotMatch(all, /LIFESTYLESTYLE/, `${id}: no stacked name`);
    assert.doesNotMatch(all, /SORA LIFE(?!STYLE)/, `${id}: no old name`);
    if (id !== 'returns') assert.match(all, /SORA LIFESTYLE/, `${id}: the name`); // the returns text names no one
    assert.equal(legal.defaultLegalPage(id, {}, 'SORA LIFE').intro, legal.defaultLegalPage(id, {}).intro.replace(/SORA LIFESTYLE/g, 'SORA LIFE'));
  }
  assert.match(legal.defaultLegalPage('privacy').intro, /SORA LIFESTYLE/, 'the built-in name when none is given');
});

console.log('\n— What the code still says —');

// The defaults behind content the owner edits in the admin, left for the owner: their names, so a new
// one cannot hide among them.
const OWNER_EDITS = new Map([
  ['src/components/FashionBanner.jsx', [/text: 'Fashion for your style\. Living for your space\. All at SORA LIFE\.'/]],   // Storefronts → Wellness → store carousel
  ['src/components/HomeStorefront.jsx', [/eyebrow: 'SORA LIFE Jewellery'/]],                                                // Storefronts → Wellness → jewellery banner
  ['src/fashion/departmentContent.js', [/eyebrow: 'SORA LIFE Jewellery'/, /eyebrow: `SORA LIFE \/ \$\{M\.label\}`/]],      // Storefronts → Fashion → departments
  ['src/fashion/jewelleryContent.js', [/eyebrow: 'SORA LIFE Jewellery'/]],                                                  // Storefronts → Fashion → jewellery
  ['src/lib/storefrontCustomization.js', [/brandsTitle: 'Top Brands on SORA LIFE'/]],                                       // Storefronts → Fashion/Lifestyle
  ['src/data/promotions.js', [/SORA LIFE/]],                                                                               // the sample promotions (Promotions)
  ['src/lib/legalPageDefaults.js', [/SORA LIFE|Sora Life/]],                                                               // Legal pages' built-in text
  ['src/lib/legalPages.js', [/const BUILT_IN_NAME = \/\\bSORA LIFE\\b\/g;/]],                                              // the pattern that replaces it
]);
const isComment = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);

await test('N1 no text in the storefront, admin, server or page shell still says SORA LIFE, but the owner\'s admin-edited defaults', () => {
  const files = execFileSync('git', ['ls-files', 'src', 'api', 'index.html'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(jsx?|mjs|html)$/.test(f));
  const stale = [];
  for (const file of files) {
    const lines = read(file).split('\n');
    let inBlock = false;
    lines.forEach((line, i) => {
      // Block comments: /* … */ and {/* … */} spanning lines.
      const opens = /\/\*/.test(line) && !/\*\//.test(line.slice(line.indexOf('/*')));
      if (inBlock) { if (/\*\//.test(line)) inBlock = false; return; }
      if (opens) { inBlock = true; if (isComment(line)) return; }
      if (isComment(line) || !/SORA LIFE(?!STYLE)|Sora Life(?!style)/.test(line)) return;
      if ((OWNER_EDITS.get(file) || []).some((re) => re.test(line))) return;
      stale.push(`${file}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(stale, []);
});

await test('N2 the passport seal, the checkout window, the payment messages and the shipping policy say SORA LIFESTYLE', () => {
  assert.match(read('src/styles/passport.css'), /content: "SORA LIFESTYLE";\n[^\n]*\n[^\n]*\n\s*font-size: 6px; letter-spacing: 0\.08em;/);
  assert.match(read('src/pages/Checkout.jsx'), /name: 'Sora Lifestyle',/);
  assert.equal((read('api/razorpay/verify.js').match(/You have not been charged by Sora Lifestyle\./g) || []).length, 4);
  const shipping = read('src/pages/Legal.jsx');
  assert.match(shipping, /blurb: `How \$\{name\} dispatches and delivers eligible orders across India\.`/);
  assert.match(shipping, /body: `\$\{name\} ships eligible orders across India/);
});

await test('N4 on a phone the fashion headers fit the longer name between the menu and the icons (measured: 6px clear or more at 320–393px)', () => {
  const fashion = read('src/styles/fashion.css');
  const phone = fashion.slice(fashion.indexOf('@media (max-width: 599px) {'));
  assert.match(phone, /\.fs-logo > svg \{ display: none; \}\n\s*\.fs-logo__txt strong \{ font-size: clamp\(14px, calc\(\(100vw - 184px\) \/ 8\.8\), 20px\); letter-spacing: \.06em; \}/);
  const departments = read('src/styles/fashion-departments.css');
  assert.match(departments, /\.sw-header \.fs-logo__txt strong \{ font-size: clamp\(13px, calc\(\(100vw - 206px\) \/ 8\.3\), 21px\); letter-spacing: \.02em; \}/);
  assert.match(departments, /\.wm-header \.fs-logo__txt strong \{ font-size: clamp\(12px, calc\(\(100vw - 216px\) \/ 8\.3\), 21px\); letter-spacing: \.02em; \}/);
  assert.match(departments, /\.jw-header \.fs-logo__txt strong \{ font-size: clamp\(12px, calc\(\(100vw - 216px\) \/ 8\.3\), 20px\); letter-spacing: \.02em; \}/);
});

await test('N3 the logo file and the "Health & Wellness" tagline are left as they are', () => {
  for (const file of ['src/pages/Invoice.jsx', 'src/pages/Passport.jsx', 'src/lib/settings.js']) assert.match(read(file), /\/assets\/sora-life-logo\.png/, file);
  assert.match(read('src/pages/Invoice.jsx'), /<p className="inv__brand-sub">Health &amp; Wellness<\/p>/);
  assert.match(read('src/pages/Invoice.jsx'), /alt="SORA LIFESTYLE — Health and Wellness"/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
