// Round 19 (owner, 2026-11-20): a faster site — the bundle is minified, and heavy
// product pictures are re-encoded and served from /img/opt/.
//   node scripts/test-more-features-19.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { supabaseFromBundle } from '../build/publish-content.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the build minifies', () => {
  assert.match(read('rollup.config.mjs'), /import terser from '@rollup\/plugin-terser';/);
  assert.match(read('rollup.config.mjs'), /terser\(\{ compress: \{ passes: 2 \}, format: \{ comments: false \} \}\)/);
  assert.ok(JSON.parse(read('package.json')).devDependencies['@rollup/plugin-terser']);
});
test('the deploy step still finds the project in a minified bundle (and in a readable one)', () => {
  const url = 'https://sjqtevgcexumcmmjbehv.supabase.co'; const key = 'sb_publishable__rkhLKtvMtOYXbJikyHE6Q_yGGTSPEZ';
  assert.deepEqual(supabaseFromBundle(`const e="${url}",t="${key}";`), { url, key });
  assert.deepEqual(supabaseFromBundle(`const supabaseUrl = "${url}";\nconst supabasePublishableKey = "${key}";`), { url, key });
  assert.throws(() => supabaseFromBundle('console.log(1)'));
});
test('every re-encoded picture is in the repo, small, and named in the rollback map', () => {
  const { map } = JSON.parse(read('scripts/data/image-optimise-2026-11-20.json'));
  const entries = Object.entries(map);
  assert.ok(entries.length >= 200);
  for (const [from, to] of entries) {
    assert.match(from, /^https:\/\//);
    assert.match(to, /^\/img\/opt\/[0-9a-f]{16}\.webp$/);
    const f = new URL(`..${to}`, import.meta.url);
    assert.ok(existsSync(f), to);
    assert.ok(statSync(f).size < 400_000, `${to} is ${statSync(f).size} bytes`);
  }
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
