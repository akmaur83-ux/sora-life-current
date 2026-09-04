// Offline regression coverage for the real ProductBrowser component's filter
// state. JSX is compiled in memory; hooks and leaf UI components are stubbed.
// No browser, network, generated bundle, catalogue write or payment operation.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { transformSync } from '@babel/core';
import { offersFor, deliveryEstimate, TRUST_ITEMS } from '../src/data/pdpContent.js';
import {
  PRICE_BANDS, SHOP_SORTS, productMatchesHighlight, productMatchesPriceBand,
  readShopUrlState, updateShopUrlState,
} from '../src/lib/shopFilters.js';

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
    PromoRail,categories,searchProducts,lockScroll,unlockScroll,PRICE_BANDS,
    SHOP_SORTS,productMatchesHighlight,productMatchesPriceBand,
    readShopUrlState,updateShopUrlState,h}=env;
  ${code}
  return ProductBrowser(env.props);
`);
let state = [], cursor = 0, query = new URLSearchParams();
const product = (id, price, category = 'wellness') => ({
  id, name: id, price, category, categories: [category], stock: 1,
  isNew: false, isBestseller: false, onSale: false, discountPct: 0, isFeatured: false,
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
  categories: [{ slug: 'wellness' }, { slug: 'devices' }],
  searchProducts: (q) => catalogue.filter((p) => p.name.includes(q)),
  lockScroll: () => {}, unlockScroll: () => {}, PRICE_BANDS, SHOP_SORTS,
  productMatchesHighlight, productMatchesPriceBand, readShopUrlState, updateShopUrlState,
  h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
};
function render(baseProducts = catalogue) {
  cursor = 0;
  env.props = { baseProducts };
  return renderComponent(env);
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...tree.children.flatMap(nodes)];
}
const cards = (tree) => nodes(tree).filter((n) => n.type === 'ProductCard').map((n) => n.props.product.id);
const clear = (tree) => nodes(tree).find((n) => n.type === 'button' && n.children.includes('Clear')).props.onClick();
const choosePrice = (tree, id) => nodes(tree)
  .find((n) => n.type === 'button' && n.props.className?.includes('v2-fp__price') && n.props.key === id)
  .props.onClick();
const reset = () => { state = []; query = new URLSearchParams(); catalogue = seed; };

console.log('\n— complete catalogue hydration and URL-persisted price bands —');
let tree = render();
check('fallback render has no implicit price filter', () => assert.deepEqual(cards(tree), ['Seed']));
catalogue = live;
tree = render();
check('hydration includes every eligible product, including above the seed maximum', () => assert.deepEqual(cards(tree), ['Low', 'High', 'Maximum']));
check('hydration does not silently mark a price filter active', () => assert.ok(!nodes(tree).some((n) => n.props.className === 'v2-flt__n')));
choosePrice(tree, '2000-4999');
tree = render();
check('a price band filters at its exact boundaries', () => assert.deepEqual(cards(tree), ['High']));
check('the selected price band is persisted in the URL', () => assert.equal(query.get('price'), '2000-4999'));
catalogue = [...live, product('Later maximum', 50000)];
tree = render();
check('catalogue updates preserve the selected URL band', () => assert.deepEqual(cards(tree), ['High']));
clear(tree);
tree = render();
check('Clear restores the complete latest catalogue', () => assert.equal(cards(tree).length, 4));
check('Clear removes the price query parameter', () => assert.equal(query.has('price'), false));

reset();
tree = render();
choosePrice(tree, 'under-500');
catalogue = live;
tree = render();
check('selection made before hydration filters the live catalogue', () => assert.deepEqual(cards(tree), ['Low']));
state = [];
tree = render();
check('fresh mount/refresh rehydrates the URL price filter', () => assert.deepEqual(cards(tree), ['Low']));
clear(tree);
tree = render(catalogue.filter((p) => p.category === 'devices'));
check('category base remains constrained without an implicit cap', () => assert.deepEqual(cards(tree), ['Maximum']));
query = new URLSearchParams('q=High');
tree = render();
check('search reaches matching products throughout the catalogue', () => assert.deepEqual(cards(tree), ['High']));
choosePrice(tree, 'under-500');
tree = render();
check('price filtering still combines with search', () => assert.deepEqual(cards(tree), []));
clear(tree);
tree = render();
check('reset preserves search while removing the price filter', () => assert.deepEqual(cards(tree), ['High']));

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
