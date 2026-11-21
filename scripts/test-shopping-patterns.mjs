// Round 35 (owner, 2026-11-21): Blinkit/Zepto's shopping patterns in SORA's own look —
// floating cart bar, card stepper, turning search hints, savings, order again, cart add-ons,
// one-tap address, fly-to-cart + haptics, skeletons, pinch-zoom everywhere.
//   node scripts/test-shopping-patterns.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = { useEffect: () => {}, useRef: () => ({}), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], Link: () => null, Icon: () => null };

test('the cart bar shows wherever a shopper browses, never on purchase or account pages', () => {
  const m = loadModule('src/components/MobileCartSummary.jsx', { ...R, useLocation: () => ({ pathname: '/' }), useStore: () => ({}), money: String, MobileTabBar: () => null });
  for (const p of ['/', '/shop', '/fashion', '/fashion/winter', '/homeliving', '/category/skin-care', '/gifts', '/grocery']) assert.equal(m.cartBarRoute(p), true, p);
  for (const p of ['/cart', '/checkout', '/product/x', '/fashion/p/x', '/homeliving/p/x', '/account/orders', '/invoice/SL-1', '/admin']) assert.equal(m.cartBarRoute(p), false, p);
  const jsx = read('src/components/MobileCartSummary.jsx');
  assert.match(jsx, /\{savings > 0 && <span className="v2-mobile-cart__saved">Saved \{money\(savings\)\}<\/span>\}/);
  assert.match(read('src/fashion/FashionLayout.jsx'), /<MobileCartSummary tabbar=\{<MobileTabBar store="fashion" savedCount=\{wish\.count\} \/>\} \/>/);
  assert.match(read('src/homeliving/HomeLivingLayout.jsx'), /<MobileCartSummary tabbar=\{over \? <><\/> : <BottomNav \/>\} \/>/);
});
test('the card becomes − qty + for the plain line in the bag; minus at one removes it; plus stops at stock', () => {
  const c = read('src/components/ProductCard.jsx');
  assert.match(c, /cart\.find\(\(l\) => !l\.catalogue && l\.key === String\(product\.id\)\)/);
  assert.match(c, /if \(line\.qty <= 1\) dispatch\(\{ type: 'REMOVE', key: line\.key \}\); else dispatch\(\{ type: 'SET_QTY', key: line\.key, qty: line\.qty - 1 \}\);/);
  assert.match(c, /disabled=\{atStock\}/);
});
test('search hints are real words for each store, turning only after the first tick', () => {
  const f = loadModule('src/lib/feel.js', { useEffect: () => {}, useState: (v) => [v, () => {}] });
  assert.equal(f.hintText(['a', 'b'], 3), 'Search "b"');
  assert.equal(f.hintText([], 0), '');
  assert.ok(f.SEARCH_HINTS.wellness.includes('face wash') && f.SEARCH_HINTS.fashion.includes('leather jacket') && f.SEARCH_HINTS.homeliving.includes('bedsheet'));
  assert.ok(!f.SEARCH_HINTS.homeliving.includes('rug'), 'no hint without products behind it');
  assert.match(read('src/lib/feel.js'), /const \[i, setI\] = useState\(-1\);/);
  assert.match(read('src/components/Header.jsx'), /placeholder=\{hint \|\| "Search wellness essentials"\}/);
  assert.match(read('src/fashion/FashionLayout.jsx'), /config\.header\.searchPlaceholder !== SEARCH_PLACEHOLDER \? config\.header\.searchPlaceholder : ''\) \|\| hint \|\| SEARCH_PLACEHOLDER/);
});
test('order again: own recent wellness buys still on sale, newest first, no repeats, no cancelled orders', () => {
  const o = loadModule('src/components/OrderAgain.jsx', { ...R, ProductRail: () => null, useCustomerAuth: () => ({}), supabase: null, productById: {} });
  const by = { 1: { id: 1, stock: 5, price: 100 }, 2: { id: 2, stock: 0, price: 100 }, 3: { id: 3, stock: 2, price: 50 }, 4: { id: 4, stock: 9, price: 0 } };
  const orders = [
    { items: [{ product_id: 3 }, { product_id: 1 }, { catalogue: 'fashion', product_id: 'f' }] },
    { status: 'cancelled', items: [{ product_id: 4 }] },
    { items: [{ biosash_id: 1 }, { product_id: 2 }] },
  ];
  assert.deepEqual(o.orderAgainProducts(orders, by).map((p) => p.id), [3, 1]);
  assert.match(read('src/pages/Home.jsx'), /<BagReminder phone=\{false\} \/>\n.*\n      <OrderAgain \/>/);
});
test('cart: the saving shown is the quote\'s product + coupon discount; add-ons are small, in stock, not in the bag', () => {
  const x = loadModule('src/components/CartExtras.jsx', { ...R, ProductImage: () => null, useStore: () => ({}), money: String, products: [], isPurchasable: () => true });
  assert.equal(x.orderSavings({ productDiscount: 300, couponDiscount: 120 }, 999), 420);
  assert.equal(x.orderSavings(null, 250), 250);
  const list = [{ id: 1, stock: 3, price: 299 }, { id: 2, stock: 3, price: 599 }, { id: 3, stock: 0, price: 99 }, { id: 4, stock: 5, price: 149, isBestseller: true }, { id: 5, stock: 2, price: 99 }];
  assert.deepEqual(x.addOnPicks(list, ['5']).map((p) => p.id), [4, 1]);
  const cart = read('src/pages/Cart.jsx');
  assert.match(cart, /<CartSavings breakdown=\{quote\.breakdown\} fallback=\{savings\} \/>/);
  assert.match(cart, /<BeforeCheckout \/>/);
});
test('checkout: a chosen, complete saved address shows as one card with Change; the form is still validated', () => {
  const c = read('src/pages/Checkout.jsx');
  assert.match(c, /const compactAddr = Boolean\(showSaved && selectedAddrId && addrComplete && !editAddr/);
  assert.match(c, /<button type="button" className="linkbtn" onClick=\{\(\) => setEditAddr\(true\)\}>Change<\/button>/);
  assert.match(c, /function validateShipping\(\) \{/);
  assert.ok(c.includes("if (!/^\\d{6}$/.test(form.pin.trim())) e.pin = 'Enter a 6-digit PIN code.';"), 'validation untouched');
});
test('every add ticks the phone and flies the picture into the bag, from one place; still for reduced motion', () => {
  const t = read('src/components/Toasts.jsx');
  assert.match(t, /if \(t\.kind === 'cart' && \/\^Added to cart\/\.test\(String\(t\.message\)\)\) celebrateAdd\(\);/);
  const f = read('src/lib/feel.js');
  assert.match(f, /if \(!from \|\| reducedMotion\(\) \|\| typeof document === 'undefined'\) return;/);
  assert.match(f, /navigator\.vibrate\(ms\)/);
});
test('skeletons while catalogues load; pinch-zoom on wellness pictures too', () => {
  assert.match(read('src/fashion/FashionProductPage.jsx'), /if \(!view && status === 'loading'\) return <div className="fs-listing"><SkeletonPdp \/><\/div>;/);
  assert.match(read('src/homeliving/HomeLivingProductPage.jsx'), /if \(!view && status === 'loading'\) return <div className="hl-wrap hl-listing"><SkeletonPdp \/><\/div>;/);
  assert.match(read('src/fashion/FashionHome.jsx'), /<SkeletonGrid count=\{6\} label="Loading the catalogue…" \/>/);
  assert.match(read('src/components/ProductGallery.jsx'), /<GalleryZoom\n/);
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
