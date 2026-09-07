import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/components/StorefrontMotion.jsx', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');

function setup(pathname = '/', reducedInitially = false) {
  const events = new Map();
  let callback, cleanup, disconnected = 0, cancelled = 0, animated = 0;
  const classes = new Set();
  const reduced = { matches: reducedInitially, addEventListener: (_, fn) => { callback = fn; }, removeEventListener: () => {} };
  const fine = { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
  class Element {
    matches(selector) { return selector.includes('.v2-pc'); }
    querySelectorAll() { return []; }
    contains() { return false; }
    classList = { add: (name) => classes.add(name), remove: (name) => classes.delete(name), toggle: (name, value) => value ? classes.add(name) : classes.delete(name) };
    animate() {
      animated++;
      return { finished: new Promise(() => {}), cancel: () => cancelled++ };
    }
  }
  const card = new Element();
  const root = new Element();
  root.matches = () => false;
  root.querySelectorAll = () => [card];
  root.addEventListener = (name, fn) => events.set(name, fn);
  root.removeEventListener = (name) => events.delete(name);
  let intersect;
  const observed = [];
  class Observer {
    constructor(fn) { intersect = fn; }
    observe(el) { observed.push(el); }
    unobserve() {}
    disconnect() { disconnected++; }
  }
  const context = {
    useLocation: () => ({ pathname }),
    useEffect: (fn) => { cleanup = fn(); },
    window: { matchMedia: (query) => query.includes('reduced') ? reduced : fine, IntersectionObserver: Observer },
    IntersectionObserver: Observer,
    MutationObserver: class { observe() {} disconnect() { disconnected++; } },
    Element, document: { querySelector: () => root, activeElement: null },
    cancelAnimationFrame() {}, requestAnimationFrame() {},
  };
  vm.runInNewContext(`${source}\nStorefrontMotion();`, context);
  return {
    classes, events, observed,
    show: () => intersect?.([{ target: card, isIntersecting: true }]),
    reduce: () => { reduced.matches = true; callback?.(); },
    cleanup: () => cleanup?.(),
    state: () => ({ animated, cancelled, disconnected }),
  };
}

for (const route of ['/checkout', '/cart', '/account', '/account/orders', '/creator', '/admin', '/product/example', '/privacy']) {
  const test = setup(route);
  assert.equal(test.observed.length, 0, `${route} must not acquire motion observers`);
  assert.equal(test.events.size, 0, `${route} must not acquire pointer handlers`);
}
for (const route of ['/', '/shop', '/category/hair-care', '/category/long-category-name/']) {
  const test = setup(route);
  assert.equal(test.observed.length, 1);
  test.show();
  assert.equal(test.state().animated, 1);
  test.events.get('pointerdown')();
  assert.equal(test.state().cancelled, 1, 'interaction settles entrances');
  test.cleanup();
  assert.equal(test.events.size, 0);
  assert.equal(test.classes.has('sl-motion'), false);
  assert.equal(test.state().disconnected, 2, 'route changes disconnect both observers');
}
const disabled = setup('/', true);
disabled.show();
assert.equal(disabled.state().animated, 0, 'reduced motion starts fully visible without animation');
const toggle = setup();
toggle.show();
toggle.reduce();
assert.equal(toggle.state().cancelled, 1, 'live reduced-motion preference cancels running entrances');
assert.equal(toggle.classes.has('sl-motion'), false);
console.log('PASS motion route isolation, interaction settling, reduced motion, and observer cleanup');
