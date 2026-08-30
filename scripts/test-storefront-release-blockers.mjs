// Offline regression coverage for the real ProductBrowser component's filter
// state. JSX is compiled in memory; hooks and leaf UI components are stubbed.
// No browser, network, generated bundle, catalogue write or payment operation.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { transformSync } from '@babel/core';
import { offersFor, deliveryEstimate, TRUST_ITEMS } from '../src/data/pdpContent.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/components/ProductBrowser.jsx');
const { code } = transformSync(source, {
  configFile: false, babelrc: false,
  presets: [['@babel/preset-react', { runtime: 'classic', pragma: 'h' }]],
  plugins: [() => ({ visitor: {
    ImportDeclaration(path) { path.remove(); },
    ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
  } })],
});
const renderComponent = new Function('env', `
  const React = { Fragment: 'Fragment' };
  const {useState,useMemo,useEffect,useSearchParams,Link,Icon,ProductCard,
    PromoRail,categories,priceRange,searchProducts,money,lockScroll,unlockScroll,h}=env;
  ${code}
  return ProductBrowser(env.props);
`);
let state = [], cursor = 0, query = new URLSearchParams();
const product = (id, price, category = 'wellness') => ({
  id, name: id, price, category, rating: 0, flags: [], stock: 1,
});
const seed = [product('Seed', 2308)];
const live = [product('Low', 53), product('High', 2493), product('Maximum', 40500, 'devices')];
let catalogue = seed;
const env = {
  useState(initial) {
    const slot = cursor++;
    if (!(slot in state)) state[slot] = initial;
    return [state[slot], (value) => { state[slot] = value; }];
  },
  useMemo: (fn) => fn(), useEffect: () => {},
  useSearchParams: () => [query, (next) => { query = next; }],
  Link: 'Link', Icon: 'Icon', ProductCard: 'ProductCard', PromoRail: 'PromoRail',
  categories: [], searchProducts: (q) => catalogue.filter((p) => p.name.includes(q)),
  money: (n) => `₹${n}`, lockScroll: () => {}, unlockScroll: () => {},
  h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
};
function render(baseProducts = catalogue) {
  cursor = 0;
  env.priceRange = { min: Math.min(...catalogue.map((p) => p.price)), max: Math.max(...catalogue.map((p) => p.price)) };
  env.props = { baseProducts };
  return renderComponent(env);
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...tree.children.flatMap(nodes)];
}
const cards = (tree) => nodes(tree).filter((n) => n.type === 'ProductCard').map((n) => n.props.product.id);
const slider = (tree) => nodes(tree).find((n) => n.props.type === 'range');
const clear = (tree) => nodes(tree).find((n) => n.type === 'button' && n.children.includes('Clear')).props.onClick();
const choose = (tree, value) => slider(tree).props.onChange({ target: { value: String(value) } });
const reset = () => { state = []; query = new URLSearchParams(); catalogue = seed; };

console.log('\n— default max-price hydration and explicit selection —');
let tree = render();
check('fallback render has no selected price cap', () => assert.deepEqual(cards(tree), ['Seed']));
catalogue = live;
tree = render();
check('hydration includes every eligible product, including above the seed maximum', () => assert.deepEqual(cards(tree), ['Low', 'High', 'Maximum']));
check('default slider follows the real catalogue maximum', () => assert.equal(slider(tree).props.value, 40500));
check('slider upper bound matches the catalogue maximum', () => assert.equal(slider(tree).props.max, 40500));
check('native range can reach the exact maximum', () => assert.equal((40500 - 53) % slider(tree).props.step, 0));
check('hydration does not silently mark a price filter active', () => assert.ok(!nodes(tree).some((n) => n.props.className === 'v2-flt__n')));
choose(tree, 2500);
tree = render();
check('explicitly lowering max price filters normally', () => assert.deepEqual(cards(tree), ['Low', 'High']));
catalogue = [...live, product('Later maximum', 50000)];
tree = render();
check('later catalogue updates preserve the user cap', () => assert.equal(slider(tree).props.value, 2500));
check('later catalogue updates still refresh the slider upper bound', () => assert.equal(slider(tree).props.max, 50000));
clear(tree);
tree = render();
check('Clear restores the complete latest catalogue', () => assert.equal(cards(tree).length, 4));
catalogue = [...catalogue, product('Newest maximum', 60000)];
tree = render();
check('cleared state keeps following subsequent hydration', () => assert.equal(slider(tree).props.value, 60000));

reset();
tree = render();
choose(tree, 1000);
catalogue = live;
tree = render();
check('selection made before hydration is not overwritten', () => assert.equal(slider(tree).props.value, 1000));
check('pre-hydration selection still filters the live catalogue', () => assert.deepEqual(cards(tree), ['Low']));
state = [];
tree = render();
check('fresh mount/refresh restores all hydrated products', () => assert.equal(cards(tree).length, 3));
tree = render(catalogue.filter((p) => p.category === 'devices'));
check('category base remains constrained without the stale cap', () => assert.deepEqual(cards(tree), ['Maximum']));
query = new URLSearchParams('q=High');
tree = render();
check('search reaches real products above the fallback cap', () => assert.deepEqual(cards(tree), ['High']));
choose(tree, 1000);
tree = render();
check('manual max-price filtering still combines with search', () => assert.deepEqual(cards(tree), []));
clear(tree);
tree = render();
check('reset preserves search while removing the price cap', () => assert.deepEqual(cards(tree), ['High']));

console.log('\n— Standard shipping presentation only —');
check('PDP offer row says free standard shipping', () => assert.equal(offersFor()[0].title, 'Free standard shipping'));
check('PDP trust row says free standard shipping', () => assert.equal(TRUST_ITEMS[0][1], 'Free standard shipping'));
check('delivery presentation no longer carries a stale threshold', () => assert.ok(!('freeThreshold' in deliveryEstimate())));
for (const file of ['../src/components/TrustStrip.jsx', '../src/components/pdp/ProductDeliveryInfo.jsx', '../src/data/pdpContent.js']) {
  check(`${file}: no threshold shipping copy`, () => {
    const text = read(file);
    assert.doesNotMatch(text, /699|freeShippingThreshold|FREE_SHIP_THRESHOLD|freeThreshold|shipping (?:over|above)|orders above/i);
    assert.match(text, /Free standard shipping/i);
  });
}
console.log(`\n${passed} passed, 0 failed\n`);
