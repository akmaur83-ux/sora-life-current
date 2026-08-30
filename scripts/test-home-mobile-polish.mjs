// Offline, Homepage-only regression checks. No network or catalogue writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from '@babel/core';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const { code } = transformSync(read('../src/components/CategoryRail.jsx'), {
  configFile: false, babelrc: false,
  presets: [['@babel/preset-react', { runtime: 'classic', pragma: 'h' }]],
  plugins: [() => ({ visitor: {
    ImportDeclaration(path) { path.remove(); },
    ExportNamedDeclaration(path) { path.replaceWith(path.node.declaration); },
    ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
  } })],
});
const choose = new Function('h', 'React', `${code}; return categoryRepresentative;`)(() => null, { Fragment: 'Fragment' });
const category = { slug: 'wellness' };
const product = (id, extra = {}) => ({ id, slug: id, category: 'wellness', stock: 5, image: '/img/real.jpg', sortOrder: 0, ...extra });
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

check('empty category uses its icon', () => assert.equal(choose(category, []), null));
check('never borrows from another category', () => assert.equal(choose(category, [product('other', { category: 'hair-care' })]), null));
check('out-of-stock products are excluded', () => assert.equal(choose(category, [product('out', { stock: 0 })]), null));
check('explicitly inactive products are excluded', () => assert.equal(choose(category, [product('inactive', { isActive: false }), product('inactive-db', { is_active: false })]), null));
check('missing/invalid images use the icon', () => {
  for (const image of [null, '', '   ', 'javascript:bad', '//untrusted/image.jpg']) assert.equal(choose(category, [product('bad', { image })]), null);
});
check('real storage images are eligible', () => assert.equal(choose(category, [product('real', { image: 'https://example.com/storage/real.png' })]).id, 'real'));
check('secondary category membership is respected', () => assert.equal(choose(category, [product('secondary', { category: 'skin-care', categories: ['skin-care', 'wellness'] })]).id, 'secondary'));
check('primary category wins before sort order', () => assert.equal(choose(category, [product('secondary', { category: 'skin-care', categories: ['wellness'], sortOrder: 0 }), product('primary', { sortOrder: 10 })]).id, 'primary'));
check('configured ordering wins within a category', () => assert.equal(choose(category, [product('later', { sortOrder: 2 }), product('first', { sortOrder: 1 })]).id, 'first'));
check('ties are stable across input order', () => {
  const list = [product('z'), product('a')];
  assert.equal(choose(category, list).id, 'a');
  assert.equal(choose(category, [...list].reverse()).id, 'a');
});
check('catalogue records and order are never mutated', () => {
  const list = Object.freeze([Object.freeze(product('z')), Object.freeze(product('a'))]);
  choose(category, list);
  assert.equal(list[0].id, 'z');
});
const css = read('../src/styles/v2-home.css');
check('stylesheet braces stay balanced', () => {
  let depth = 0;
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (c === '{') depth++;
    if (c === '}') { depth--; assert.ok(depth >= 0, 'unexpected closing brace'); }
  }
  assert.equal(depth, 0);
});
check('landscape aspect ratio is preserved for both hero modes', () => assert.equal((css.match(/aspect-ratio:358 \/ 215/g) || []).length, 2));
check('category photos are contained and failed images reveal the icon', () => {
  assert.match(css, /\.v2-cat__photo img\s*\{[^}]*object-fit:contain/);
  assert.match(css, /\.v2-cat__photo:has\(\.v2-pimg__fallback\)\s*\{\s*display:none/);
});
check('category visuals reuse ProductImage, not another image loader', () => {
  const source = read('../src/components/CategoryRail.jsx');
  assert.match(source, /<ProductImage/);
  assert.match(source, /frame="v2" fit="contain"/);
  assert.doesNotMatch(source, /<img\b|price|rating|Add to cart/);
});
console.log(`\n${passed} passed, 0 failed`);
