// ============================================================
// Scroll on navigation, site-wide — src/lib/scrollOnNavigate.js (the rules)
// and src/components/ScrollManager.jsx (mounted once in main.jsx).
//
//   node scripts/test-scroll-on-navigate.mjs
//
// Offline. The rules are run as a table; the real component is compiled and
// driven through catalogue-admin-harness.mjs's hook runtime against a fake
// window (scrolls, clicks, frames, history, sessionStorage), with the router
// hooks stubbed so each test can push, replace and pop locations.
// Pinned:
//   * a new path opens at the top; back/forward return to where that entry
//     was left; a #hash goes to its anchor (a new page shows its top while
//     the anchor renders); a change to the query string alone moves nothing
//   * positions are taken on scroll and on the link click that starts a
//     navigation, never from the next page's layout; they survive a reload
//   * a restore or an anchor waits for the page to render and gives way to
//     the visitor; jumps are instant despite html { scroll-behavior: smooth }
//   * one manager inside <BrowserRouter> (every storefront and the admin);
//     the wellness shell's and the fashion departments' own resets are gone
//
// CATALOGUE_SRC_ROOT=<pre-change checkout> runs it against the old tree.
// ============================================================
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { ROOT, read, has, h, loadModule, hooks, mount } from './catalogue-admin-harness.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const lib = has('src/lib/scrollOnNavigate.js') ? await import(pathToFileURL(resolve(ROOT, 'src/lib/scrollOnNavigate.js')).href) : {};
const loc = (path, key = 'default') => {
  const u = new URL(path, 'http://x');
  return { pathname: u.pathname, search: u.search, hash: u.hash, key, state: null };
};

console.log('\n— The rules —');

await test('scrollDecision: new path → top; query only → none; #hash → anchor; back/forward → the remembered position', () => {
  const d = lib.scrollDecision;
  const list = loc('/homeliving/category/bedsheets', 'a');
  assert.deepEqual(d({ action: 'PUSH', prev: list, next: loc('/homeliving/p/sheet', 'b') }), { kind: 'top' });
  assert.deepEqual(d({ action: 'REPLACE', prev: list, next: loc('/admin/orders', 'b') }), { kind: 'top' }, 'a redirect to a new path too');
  assert.deepEqual(d({ action: 'REPLACE', prev: list, next: loc('/homeliving/category/bedsheets?sort=price-asc', 'a') }), { kind: 'none' }, 'sort');
  assert.deepEqual(d({ action: 'PUSH', prev: list, next: loc('/homeliving/category/bedsheets?size=King&colour=Sage', 'c') }), { kind: 'none' }, 'filters');
  assert.deepEqual(d({ action: 'PUSH', prev: loc('/admin/store-catalogue/homeliving'), next: loc('/admin/store-catalogue/homeliving?tab=images', 'c') }), { kind: 'none' }, 'an admin tab');
  assert.deepEqual(d({ action: 'PUSH', prev: loc('/fashion/women'), next: loc('/fashion/women#fd-products', 'c') }), { kind: 'anchor', id: 'fd-products', top: false }, 'same page: just the anchor');
  assert.deepEqual(d({ action: 'PUSH', prev: loc('/'), next: loc('/fashion/women#fd-products', 'c') }), { kind: 'anchor', id: 'fd-products', top: true }, 'new page: the top while the anchor renders');
  assert.deepEqual(d({ action: 'POP', prev: loc('/homeliving/p/sheet', 'b'), next: list, saved: 1840 }), { kind: 'restore', y: 1840 });
  assert.deepEqual(d({ action: 'POP', prev: loc('/homeliving/p/sheet', 'b'), next: list, saved: 0 }), { kind: 'restore', y: 0 }, 'a page left at the top comes back at the top');
  assert.deepEqual(d({ action: 'POP', prev: loc('/homeliving/p/sheet', 'b'), next: list }), { kind: 'top' }, 'an entry we never saw: as a new page');
  assert.deepEqual(d({ action: 'POP', prev: loc('/p/x'), next: loc('/p/x#reviews') }), { kind: 'anchor', id: 'reviews', top: false }, 'a plain <a href="#reviews">');
  assert.deepEqual(d({ action: 'POP', prev: loc('/p/x'), next: loc('/p/x#reviews'), saved: 2500, anchorClicked: true }), { kind: 'anchor', id: 'reviews', top: false }, 'clicked again: the anchor, not where an earlier visit to #reviews was left');
  assert.deepEqual(d({ action: 'POP', prev: loc('/p/x'), next: loc('/p/x#reviews'), saved: 2500 }), { kind: 'restore', y: 2500 }, 'back/forward to it: where it was left');
  assert.deepEqual(d({ action: 'POP', prev: null, next: list, saved: 600 }), { kind: 'restore', y: 600 }, 'reload');
  assert.deepEqual(d({ action: 'POP', prev: null, next: loc('/fashion/men#fd-products') }), { kind: 'anchor', id: 'fd-products', top: false }, 'opened at an anchor');
  assert.deepEqual(d({ action: 'POP', prev: null, next: list }), { kind: 'none' }, 'a first visit is left to the browser');
});

await test('entryKey tells apart entries React Router did not key; anchorId decodes; positions are capped, oldest first, and junk storage reads as empty', () => {
  assert.equal(lib.entryKey(loc('/a?b=1#c', 'k9')), 'k9');
  assert.equal(lib.entryKey(loc('/a?b=1#c')), 'default:/a?b=1#c');
  assert.notEqual(lib.entryKey(loc('/p/x')), lib.entryKey(loc('/p/x#reviews')), 'the first page and its native #anchor entry differ');
  assert.equal(lib.anchorId('#caf%C3%A9'), 'café'); assert.equal(lib.anchorId('#'), null); assert.equal(lib.anchorId(''), null); assert.equal(lib.anchorId('#%E0%A4'), '%E0%A4');
  const m = new Map();
  for (let i = 0; i < lib.MAX_SCROLL_ENTRIES + 5; i += 1) lib.rememberPosition(m, `k${i}`, i * 10.4);
  assert.equal(m.size, lib.MAX_SCROLL_ENTRIES); assert.equal(m.has('k0'), false); assert.equal(m.get('k204'), 2122);
  lib.rememberPosition(m, 'k5', 1); assert.equal([...m.keys()].at(-1), 'k5', 'a re-saved entry becomes the newest');
  for (const raw of [null, '', 'x', '{}', '[["a","1"],[2,3],["ok",40]]']) {
    const s = { getItem: () => raw };
    const got = lib.readPositions(s);
    assert.ok(got instanceof Map);
    if (raw && raw.startsWith('[[')) assert.deepEqual([...got], [['ok', 40]]);
  }
  assert.equal(lib.readPositions({ getItem() { throw new Error('denied'); } }).size, 0);
  assert.doesNotThrow(() => lib.writePositions({ setItem() { throw new Error('quota'); } }, new Map([['a', 1]])));
});

// ---- the component against a fake browser ------------------------------------------
// navType: how the browser says this document was loaded ('navigate' | 'reload' | 'back_forward').
function fakeBrowser({ height = 4000, inner = 800, knowsInstant = true, navType = 'navigate' } = {}) {
  const bags = { window: new Map(), document: new Map() };
  const add = (bag) => (type, fn) => { if (!bag.has(type)) bag.set(type, new Set()); bag.get(type).add(fn); };
  const remove = (bag) => (type, fn) => bag.get(type)?.delete(fn);
  const tasks = new Map(), log = [], store = new Map(), elements = new Map(), sheets = [];
  let nextId = 1;
  const clock = { now: 1_000_000 };
  const queue = (kind) => (fn) => { const id = nextId++; tasks.set(id, { fn, kind }); return id; };
  const unqueue = (id) => tasks.delete(id);
  const clamp = (y) => Math.max(0, Math.min(y, doc.documentElement.scrollHeight - win.innerHeight));
  const doc = {
    documentElement: { scrollHeight: height, style: { scrollBehavior: '' } },
    readyState: 'complete', hidden: false,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (sel) => (sel === 'link[rel="stylesheet"]' ? sheets : []),
    addEventListener: add(bags.document), removeEventListener: remove(bags.document),
  };
  const win = {
    scrollY: 0, innerHeight: inner, history: { scrollRestoration: 'auto' },
    sessionStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    performance: { getEntriesByType: (t) => (t === 'navigation' ? [{ type: navType }] : []) },
    getComputedStyle: (el) => ({ scrollMarginTop: `${el.margin || 0}px` }),
    scrollTo(a, b) {
      const opts = typeof a === 'object' ? a : { top: b };
      if (opts.behavior === 'instant' && !knowsInstant) throw new TypeError("'instant' is not a valid enum value");
      win.scrollY = clamp(opts.top);
      log.push({ to: opts.top, at: win.scrollY, behavior: opts.behavior || `css:${doc.documentElement.style.scrollBehavior || 'smooth'}` });
    },
    requestAnimationFrame: queue('frame'), cancelAnimationFrame: unqueue,
    setTimeout: queue('timer'), clearTimeout: unqueue,
    addEventListener: add(bags.window), removeEventListener: remove(bags.window),
  };
  const fire = (where, type, event = {}) => { for (const fn of [...(bags[where].get(type) || [])]) fn({ type, ...event }); };
  return {
    win, doc, log, store, elements, bags, clock,
    Date: { now: () => clock.now },
    scrollBy(y) { win.scrollY = y; fire('window', 'scroll'); },
    clickLink(href = '/somewhere') { fire('document', 'click', { target: { closest: (sel) => (sel === 'a[href]' ? { getAttribute: (n) => (n === 'href' ? href : null) } : null) } }); },
    intent(type = 'wheel') { fire('window', type); },
    // A scroll whose event has not been dispatched yet (a hidden tab, or the same frame as the back press).
    scrollSilently(y) { win.scrollY = y; },
    popstate() { fire('window', 'popstate'); },
    /** n ticks of 16 ms: every frame callback and timer queued before the tick runs once. */
    frames(n = 1) { for (let i = 0; i < n; i += 1) { clock.now += 16; const batch = [...tasks.entries()]; tasks.clear(); for (const [, t] of batch) t.fn(); } },
    pending: (kind) => [...tasks.values()].filter((t) => !kind || t.kind === kind).length,
    addAnchor(id, top, margin = 0) {
      const el = {
        top, margin,
        getBoundingClientRect: () => ({ top: el.top - win.scrollY }),
        scrollIntoView(opts) {
          if (opts?.behavior === 'instant' && !knowsInstant) throw new TypeError('bad enum');
          win.scrollY = clamp(el.top - el.margin);
          log.push({ anchor: id, block: opts?.block, behavior: opts?.behavior || `css:${doc.documentElement.style.scrollBehavior || 'smooth'}` });
        },
      };
      elements.set(id, el);
      return el;
    },
    pendingSheet() { const link = { sheet: null }; sheets.push(link); return link; },
    setHeight(px) { doc.documentElement.scrollHeight = px; },
  };
}
async function manager(b, first = loc('/homeliving')) {
  const router = { location: first, action: 'POP' };
  const C = loadModule('src/components/ScrollManager.jsx', {
    ...hooks, ...lib, useLocation: () => router.location, useNavigationType: () => router.action, window: b.win, document: b.doc, Date: b.Date,
  });
  const handle = await mount(h(C.default));
  await handle.settle();
  const go = (action, location) => handle.act(() => { router.action = action; router.location = location; });
  return { handle, router, go };
}

console.log('\n— The component —');

await test('a new page opens at the top, instantly — behavior "instant", so html { scroll-behavior: smooth } never makes it glide; an engine without "instant" gets the CSS set aside and put back', async () => {
  const b = fakeBrowser();
  const { go } = await manager(b);
  assert.equal(b.win.history.scrollRestoration, 'manual', 'the browser’s own restoration is off');
  b.scrollBy(1500);
  b.clickLink();
  await go('PUSH', loc('/homeliving/p/sunlit', 'k1'));
  assert.deepEqual(b.log.at(-1), { to: 0, at: 0, behavior: 'instant' });
  const old = fakeBrowser({ knowsInstant: false });
  const second = await manager(old);
  old.scrollBy(1500);
  await second.go('PUSH', loc('/fashion', 'k1'));
  assert.deepEqual(old.log.at(-1), { to: 0, at: 0, behavior: 'css:auto' }, 'the CSS set aside for the call');
  assert.equal(old.doc.documentElement.style.scrollBehavior, '', 'and put back');
});

await test('back returns to where the listing was left; forward to where the product page was', async () => {
  const b = fakeBrowser();
  const list = loc('/homeliving/category/bedsheets', 'kL'), pdp = loc('/homeliving/p/sunlit', 'kP');
  const { go } = await manager(b, list);
  b.scrollBy(1840); b.clickLink();
  await go('PUSH', pdp);
  assert.equal(b.win.scrollY, 0);
  b.scrollBy(620);
  await go('POP', list);
  assert.equal(b.win.scrollY, 1840, 'back');
  await go('POP', pdp);
  assert.equal(b.win.scrollY, 620, 'forward');
});

await test('the link click takes the position before the next page can move it: a scroll the new layout causes is not saved as the old page’s', async () => {
  const b = fakeBrowser();
  const list = loc('/fashion/c/shirts', 'kL');
  const { go } = await manager(b, list);
  b.scrollBy(2200); b.clickLink();
  b.scrollBy(300);                                   // the old page collapsing under a short new one, before the commit
  await go('PUSH', loc('/fashion/p/linen-shirt', 'kP'));
  await go('POP', list);
  assert.equal(b.win.scrollY, 2200);
});

await test('the popstate listener is added when the module loads, ahead of the router’s (on window the order of adding decides, not the capture flag)', () => {
  const src = read('src/components/ScrollManager.jsx');
  assert.match(src, /^if \(typeof window !== 'undefined'\) window\.addEventListener\('popstate', \(\) => beforePop\?\.\(\)\);$/m, 'at the top level of the module');
  assert.match(src, /beforePop = remember;/);
  const main = read('src/main.jsx');
  assert.ok(main.indexOf("import ScrollManager from './components/ScrollManager.jsx';") < main.indexOf('ReactDOM.createRoot('), 'imported before anything renders');
});

await test('back/forward take the position at the popstate, before the router renders: a last scroll with no event yet is not lost; after a native #anchor click the pre-click position is kept', async () => {
  const b = fakeBrowser();
  const list = loc('/homeliving/category/bedsheets', 'kL'), pdp = loc('/homeliving/p/sunlit', 'kP');
  const { go } = await manager(b, list);
  b.clickLink(); await go('PUSH', pdp);
  b.scrollSilently(640);                     // no scroll event delivered
  b.popstate(); await go('POP', list);
  b.popstate(); await go('POP', pdp);
  assert.equal(b.win.scrollY, 640, 'forward returns to it');
  // A plain <a href="#reviews">: the click records 1000, the browser jumps to the anchor, then popstate.
  const b2 = fakeBrowser();
  const page = loc('/product/x', 'kX');
  const second = await manager(b2, page);
  b2.scrollBy(1000); b2.clickLink(); b2.scrollSilently(2600); b2.popstate();
  b2.addAnchor('reviews', 2600);
  await second.go('POP', loc('/product/x#reviews'));
  b2.popstate(); await second.go('POP', page);
  assert.equal(b2.win.scrollY, 1000, 'back from the anchor returns to where the page was before the click');
});

await test('a plain <a href="#fd-products"> clicked a second time goes to the anchor, not to where the first visit was left (its entries share a key)', async () => {
  const b = fakeBrowser();
  const page = loc('/fashion/women', 'kW');
  const { go } = await manager(b, page);
  b.addAnchor('fd-products', 1541);
  b.scrollBy(300); b.clickLink('#fd-products'); b.scrollSilently(1541); b.popstate();
  await go('POP', loc('/fashion/women#fd-products'));
  assert.equal(b.win.scrollY, 1541);
  b.scrollBy(2500);                                  // read on, past the products
  b.popstate(); await go('POP', page);
  assert.equal(b.win.scrollY, 300, 'back: before the anchor');
  b.clickLink('#fd-products'); b.scrollSilently(1541); b.popstate();
  await go('POP', loc('/fashion/women#fd-products'));
  assert.equal(b.win.scrollY, 1541, 'the anchor again, not 2500');
  b.popstate(); await go('POP', page);
  b.popstate(); await go('POP', loc('/fashion/women#fd-products'));
  assert.equal(b.win.scrollY, 1541, 'forward without a click: where that entry was left');
});

await test('filters, sort and a variant change only the query string and do not move the page', async () => {
  const b = fakeBrowser();
  const { go } = await manager(b, loc('/homeliving/category/bedsheets', 'kL'));
  b.scrollBy(900);
  const before = b.log.length;
  await go('REPLACE', loc('/homeliving/category/bedsheets?sort=price-asc', 'kL'));
  await go('PUSH', loc('/homeliving/category/bedsheets?sort=price-asc&size=King', 'kM'));
  await go('REPLACE', loc('/homeliving/category/bedsheets?sort=price-asc&size=King&view=list', 'kM'));
  assert.equal(b.log.length, before, 'no scroll at all'); assert.equal(b.win.scrollY, 900);
});

await test('a #hash on the same page goes to its anchor with the page’s own smooth behaviour; on a new page the top shows first, then the anchor once it renders', async () => {
  const b = fakeBrowser();
  const { go } = await manager(b, loc('/fashion/women', 'k0'));
  b.addAnchor('fd-products', 1300);
  await go('PUSH', loc('/fashion/women#fd-products', 'k1'));
  assert.deepEqual(b.log.at(-1), { anchor: 'fd-products', block: 'start', behavior: 'css:smooth' }, 'same page: the page’s own smooth behaviour');
  b.elements.clear(); b.scrollBy(2500);
  await go('PUSH', loc('/fashion/men#fd-products', 'k2'));
  assert.deepEqual(b.log.at(-1), { to: 0, at: 0, behavior: 'instant' }, 'the top while the anchor is not there yet');
  b.frames(3);
  b.addAnchor('fd-products', 1700);
  b.frames(1);
  assert.deepEqual(b.log.at(-1), { anchor: 'fd-products', block: 'start', behavior: 'instant' }, 'a new page jumps, it does not glide');
  assert.equal(b.win.scrollY, 1700);
  b.frames(4); assert.equal(b.pending(), 0, 'and, the page being settled, stops looking');
});

await test('an anchor that never renders leaves a new page at its top and gives up after about a second', async () => {
  const b = fakeBrowser();
  const { go } = await manager(b, loc('/', 'k0'));
  b.scrollBy(3000);
  await go('PUSH', loc('/product/x#nowhere', 'k1'));
  b.frames(80);
  assert.equal(b.win.scrollY, 0); assert.equal(b.pending(), 0);
});

await test('a restore waits for the page to be tall enough (content still loading), then lands; the visitor scrolling first cancels it', async () => {
  const b = fakeBrowser({ height: 6000 });
  const list = loc('/grocery/category/atta', 'kL');
  const { go } = await manager(b, list);
  b.scrollBy(4800); b.clickLink();
  await go('PUSH', loc('/grocery/p/rice', 'kP'));
  b.setHeight(1500);                                  // the listing comes back short until its rows render
  await go('POP', list);
  assert.equal(b.win.scrollY, 700, 'as far as it can go for now');
  b.frames(2); b.setHeight(6000); b.frames(1);
  assert.equal(b.win.scrollY, 4800, 'then the remembered position');
  b.frames(4); assert.equal(b.pending(), 0, 'and stops once the page is settled');
  // Again, but the visitor scrolls before the rows arrive: the restore gives way.
  b.clickLink(); await go('PUSH', loc('/grocery/p/rice', 'kP2'));
  b.setHeight(1500); await go('POP', list);
  b.intent('wheel'); b.scrollBy(200); b.setHeight(6000); b.frames(5);
  assert.equal(b.win.scrollY, 200);
});

await test('positions survive a reload (sessionStorage), and a plain <a href="#reviews"> on a product page lands on the reviews', async () => {
  const b = fakeBrowser();
  const pdp = loc('/product/ashwagandha', 'kP');
  const first = await manager(b, pdp);
  b.scrollBy(1234);
  await first.go('PUSH', loc('/shop', 'kS'));
  for (const fn of [...(b.bags.window.get('pagehide') || [])]) fn();
  // A fresh page load on the same history entry (the key lives in history.state).
  const b2 = fakeBrowser({ navType: 'reload' }); b2.store.set(lib.SCROLL_STORAGE_KEY, b.store.get(lib.SCROLL_STORAGE_KEY));
  await manager(b2, pdp);
  assert.equal(b2.win.scrollY, 1234);
  const b3 = fakeBrowser();
  const { go } = await manager(b3, loc('/product/ashwagandha'));
  b3.addAnchor('reviews', 2600);
  await go('POP', loc('/product/ashwagandha#reviews'));
  assert.equal(b3.win.scrollY, 2600);
});

await test('a fresh visit to a URL seen before goes to its anchor (or stays put); only a reload or back/forward into the site restores the remembered position', async () => {
  const saved = JSON.stringify([['default:/fashion/men#fd-products', 777], ['default:/fashion/men', 900]]);
  const fresh = fakeBrowser({ navType: 'navigate' }); fresh.store.set(lib.SCROLL_STORAGE_KEY, saved); fresh.addAnchor('fd-products', 1734);
  await manager(fresh, loc('/fashion/men#fd-products'));
  assert.equal(fresh.win.scrollY, 1734, 'typed or pasted: the anchor');
  const plain = fakeBrowser({ navType: 'navigate' }); plain.store.set(lib.SCROLL_STORAGE_KEY, saved);
  await manager(plain, loc('/fashion/men'));
  assert.equal(plain.win.scrollY, 0, 'no anchor: left where the browser put it');
  for (const navType of ['reload', 'back_forward']) {
    const again = fakeBrowser({ navType }); again.store.set(lib.SCROLL_STORAGE_KEY, saved); again.addAnchor('fd-products', 1734);
    await manager(again, loc('/fashion/men#fd-products'));
    assert.equal(again.win.scrollY, 777, `${navType}: where it was left`);
  }
});

await test('on a direct load the store stylesheet arrives after the first render: the anchor found on the unstyled page is followed to where it settles, then let go', async () => {
  const b = fakeBrowser({ height: 6000 });
  b.doc.readyState = 'interactive';
  const sheet = b.pendingSheet();
  const anchor = b.addAnchor('fd-products', 3000, 24);       // unstyled: far down the page
  await manager(b, loc('/fashion/men#fd-products'));
  assert.equal(b.win.scrollY, 2976, 'to the anchor as it stands, less its scroll-margin');
  b.frames(3); assert.ok(b.pending() > 0, 'still holding while the sheet is out');
  sheet.sheet = {}; b.doc.readyState = 'complete'; b.setHeight(3855); anchor.top = 1734;   // styled
  b.frames(1);
  assert.equal(b.win.scrollY, 1710, 'followed to where it settled');
  b.frames(4); assert.equal(b.pending(), 0, 'settled for three ticks: let go');
  anchor.top = 1900; b.frames(3);
  assert.equal(b.win.scrollY, 1710, 'later changes are the visitor’s page, not ours');
});

await test('the visitor scrolling, tapping or pressing a key during the hold ends it at once; the hold never outlasts three seconds', async () => {
  const b = fakeBrowser({ height: 6000 });
  b.doc.readyState = 'interactive'; b.pendingSheet();
  const anchor = b.addAnchor('fd-products', 3000);
  await manager(b, loc('/fashion/men#fd-products'));
  b.intent('touchstart'); b.scrollBy(2500);
  anchor.top = 1700; b.frames(5);
  assert.equal(b.win.scrollY, 2500, 'the visitor’s scroll stands');
  const slow = fakeBrowser({ height: 6000 });
  slow.doc.readyState = 'interactive'; slow.pendingSheet();                // a sheet that never arrives
  slow.addAnchor('fd-products', 3000);
  await manager(slow, loc('/fashion/men#fd-products'));
  slow.frames(200);                                                     // 3.2 s
  assert.equal(slow.pending(), 0, 'given up after HOLD_MS');
});

await test('in a background tab (no animation frames) the wait runs on a timer, so a link opened in a new tab still lands on its anchor', async () => {
  const b = fakeBrowser();
  b.doc.hidden = true;
  await manager(b, loc('/fashion/men#fd-products'));
  assert.equal(b.pending('frame'), 0); assert.equal(b.pending('timer'), 1, 'waiting on a timer');
  b.frames(2); b.addAnchor('fd-products', 1734); b.frames(1);
  assert.equal(b.win.scrollY, 1734);
});

console.log('\n— Wiring —');

await test('one ScrollManager, inside <BrowserRouter> (every storefront and the admin are under it); the old per-shell resets are gone', () => {
  const main = read('src/main.jsx');
  assert.match(main, /import ScrollManager from '\.\/components\/ScrollManager\.jsx';/);
  assert.match(main, /<BrowserRouter>\s*\{\/\*[\s\S]*?\*\/\}\s*<ScrollManager \/>\s*<CustomerAuthProvider>/, 'the first child of the router');
  const files = [];
  const walk = (dir) => { for (const f of readdirSync(resolve(ROOT, dir))) { const rel = `${dir}/${f}`; if (statSync(resolve(ROOT, rel)).isDirectory()) walk(rel); else if (/\.(jsx?|mjs)$/.test(f)) files.push(rel); } };
  walk('src');
  assert.deepEqual(files.filter((f) => /<ScrollManager\b/.test(read(f))), ['src/main.jsx'], 'mounted once');
  const layout = read('src/components/Layout.jsx');
  assert.doesNotMatch(layout, /ScrollToTop|scrollTo\(/, 'the wellness shell no longer resets on its own (it fired on back/forward and ignored #hash)');
  assert.doesNotMatch(read('src/fashion/FashionDepartment.jsx'), /window\.scrollTo/, 'nor do the fashion departments');
  const windowScrolls = files.filter((f) => /\bwindow\.scrollTo\(/.test(read(f)));
  assert.deepEqual(windowScrolls.sort(), ['src/components/ScrollManager.jsx', 'src/pages/Checkout.jsx'], 'nothing else moves the window on a route change (Checkout scrolls up once an order is placed, on the same page)');
  const app = read('src/App.jsx');
  assert.match(app, /path="\/admin"/, 'the admin is a route of the same App');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
