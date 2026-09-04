import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productGallery, secondaryProductGallery } from '../src/data/products.js';
import { selectPdpRecommendations } from '../src/lib/pdpRecommendations.js';

const product = (id, overrides = {}) => ({
  id,
  slug: `product-${id}`,
  name: `Product ${id}`,
  category: 'care',
  categories: ['care'],
  brand: 'Brand A',
  price: 100,
  priceVerified: true,
  stock: 10,
  isActive: true,
  ...overrides,
});

const run = (name, fn) => {
  fn();
  console.log(`✓ ${name}`);
};

run('legacy gallery keeps the optimised primary and unique secondary images', () => {
  const item = product('gallery', {
    image: '/img/gallery.png',
    gallery: ['https://catalogue.test/primary.png', 'https://catalogue.test/side.jpg', 'https://catalogue.test/side.jpg', 'https://catalogue.test/back.jpg'],
  });
  assert.deepEqual(productGallery(item).map((frame) => frame.url), [
    '/img/gallery.png',
    'https://catalogue.test/side.jpg',
    'https://catalogue.test/back.jpg',
  ]);
  assert.deepEqual(secondaryProductGallery(item).map((frame) => frame.url), [
    'https://catalogue.test/side.jpg',
    'https://catalogue.test/back.jpg',
  ]);
});

run('structured product_media stays first and gains only unique legacy secondaries', () => {
  const media = [
    { id: 'm1', url: '/img/media.png', alt: 'Real', isPrimary: true, sortOrder: 0 },
    { id: 'm2', url: 'https://catalogue.test/side.jpg', alt: 'Side', isPrimary: false, sortOrder: 1 },
  ];
  const frames = productGallery(product('media', {
    image: '/img/media.png',
    gallery: ['https://catalogue.test/primary.jpg', 'https://catalogue.test/side.jpg', 'https://catalogue.test/back.jpg'],
    media,
  }));
  assert.deepEqual(frames.map((frame) => frame.url), [
    '/img/media.png',
    'https://catalogue.test/side.jpg',
    'https://catalogue.test/back.jpg',
  ]);
});

run('recommendations prioritise category, then evidenced brand, then fallback', () => {
  const current = product('current');
  const fallback = product('fallback', { category: 'other', categories: ['other'], brand: 'Brand B' });
  const sameBrand = product('brand', { category: 'other', categories: ['other'] });
  const sameCategory = product('category', { brand: 'Brand B' });
  const result = selectPdpRecommendations(current, [fallback, sameBrand, sameCategory, current], 3);
  assert.deepEqual(result.map((item) => item.id), ['category', 'brand', 'fallback']);
});

run('recommendations exclude current and ineligible products', () => {
  const current = product('current');
  const valid = product('valid');
  const result = selectPdpRecommendations(current, [
    current,
    product('inactive', { isActive: false }),
    product('out', { stock: 0 }),
    product('unpriced', { price: 0, priceVerified: false }),
    valid,
  ]);
  assert.deepEqual(result.map((item) => item.id), ['valid']);
});

run('PDP media rejects failed catalogue URLs and exposes a real image viewer', () => {
  const productImage = readFileSync(new URL('../src/components/ProductImage.jsx', import.meta.url), 'utf8');
  const gallery = readFileSync(new URL('../src/components/pdp/ProductCatalogueGallery.jsx', import.meta.url), 'utf8');
  const mainGallery = readFileSync(new URL('../src/components/ProductGallery.jsx', import.meta.url), 'utf8');
  const lightbox = readFileSync(new URL('../src/components/pdp/ProductLightbox.jsx', import.meta.url), 'utf8');
  assert.match(productImage, /onImageError\?\.\(src\)/, 'image failures must reach the gallery owner');
  assert.match(gallery, /failedUrls\.has\(frame\.url\)/, 'failed catalogue frames must leave the rendered grid');
  assert.match(mainGallery, /ProductLightbox/, 'the primary PDP gallery must open the viewer');
  assert.match(lightbox, /aria-modal="true"/);
  assert.match(lightbox, /event\.key === 'Escape'/);
  assert.match(lightbox, /ArrowRight/);
  assert.match(lightbox, /Math\.abs\(dx\) > 45/, 'touch swipe must navigate real frames');
});

run('gallery dots are position indicators, not controls', () => {
  const gallery = readFileSync(new URL('../src/components/ProductGallery.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/v2-pdp.css', import.meta.url), 'utf8');
  const dots = gallery.slice(gallery.indexOf('className="pdp__dots"'), gallery.indexOf('pdp__thumbs'));

  // Not interactive: no button, no handler, no focus, no widget semantics.
  assert.match(dots, /<span/, 'each indicator is a span, not a button');
  assert.doesNotMatch(dots, /<button/, 'indicators must not be buttons');
  assert.doesNotMatch(dots, /onClick/, 'indicators must not be clickable');
  assert.doesNotMatch(dots, /tabIndex/, 'indicators must not be focusable');
  assert.doesNotMatch(dots, /role="tab"|role="tablist"/, 'no tab/tablist semantics');
  assert.doesNotMatch(dots, /aria-selected|aria-pressed/, 'no widget selection state');
  assert.match(dots, /className="pdp__dots" aria-hidden="true"/,
    'the strip is hidden from assistive tech - .pdp__main already announces "image N of M"');

  // Exactly one active indicator, driven by the current frame.
  assert.match(dots, /\$\{i === idx \? 'active' : ''\}/, 'exactly one indicator is active, and it follows idx');

  // No hit-area scaffolding left behind.
  assert.doesNotMatch(css, /\.pdp__dot::after/, 'the pseudo-element hit area must be gone');
  assert.doesNotMatch(css, /width:calc\(100% \+ 5px\)/, 'the tiled hit width must be gone');

  // Visual appearance is exactly as before.
  const dotRule = css.slice(css.indexOf('.v2-pdp-root .pdp__dot {'), css.indexOf('.v2-pdp-root .pdp__dot.active'));
  assert.match(dotRule, /width:14px; height:2px/, 'the 2px line is unchanged');
  assert.doesNotMatch(dotRule, /position:relative/, 'the positioning context is no longer needed');
  assert.match(css, /\.v2-pdp-root \.pdp__dot\.active \{ width:24px/, 'the active indicator still widens to 24px');
  assert.match(css, /\.v2-pdp-root \.pdp__dots \{[\s\S]*?gap:5px/, 'strip layout unchanged');
});

run('the thumbnail rail remains the accessible image selector', () => {
  const gallery = readFileSync(new URL('../src/components/ProductGallery.jsx', import.meta.url), 'utf8');
  const thumbs = gallery.slice(gallery.indexOf('className="pdp__thumbs"'));

  assert.match(thumbs, /<button/, 'thumbnails stay real buttons');
  assert.match(thumbs, /onClick=\{\(\) => go\(i\)\}/, 'a thumbnail still selects its image');
  assert.match(thumbs, /aria-label=\{`View image \$\{i \+ 1\}\$\{f\.isPrimary \? ' \(primary\)' : ''\}`\}/,
    'thumbnails stay labelled');
  assert.match(thumbs, /aria-pressed=\{i === idx\}/, 'thumbnail selection stays exposed');

  // Swipe and keyboard remain on the frame, so the dots losing their handler
  // costs nothing: every way of changing image still exists.
  assert.match(gallery, /if \(Math\.abs\(dx\) > 40\) go\(idx \+ \(dx < 0 \? 1 : -1\)\)/, 'swipe still changes image');
  assert.match(gallery, /if \(e\.key === 'ArrowRight'\) go\(idx \+ 1\); if \(e\.key === 'ArrowLeft'\) go\(idx - 1\)/,
    'arrow keys still change image');
  assert.match(gallery, /aria-label=\{single \? undefined : `\$\{product\.name\} — image \$\{idx \+ 1\} of \$\{count\}`\}/,
    'the frame announces the current position, which is what the dots used to convey');
});

run('quantity cannot go below one, and says so', () => {
  const page = readFileSync(new URL('../src/pages/Product.jsx', import.meta.url), 'utf8');

  // Starts at 1 and is still clamped.
  assert.match(page, /const \[qty, setQty\] = useState\(1\)/, 'quantity starts at 1');
  assert.match(page, /setQty\(\(q\) => Math\.max\(1, q - 1\)\)/, 'the clamp stays - never below 1');

  // Native disabled state at the minimum, so it is not a silent no-op.
  assert.match(page, /aria-label="Decrease quantity" disabled=\{out \|\| qty <= 1\}/,
    'minus is disabled at qty 1 (and when out of stock)');
  // Increase is untouched: only out-of-stock disables it, no arbitrary maximum.
  assert.match(page, /aria-label="Increase quantity" disabled=\{out\}/,
    'increase behaviour is unchanged and uncapped');

  // The Add to Cart payload is unchanged.
  assert.match(page, /addToCart\(product, qty, variant\)/, 'add still sends the chosen quantity and variant');
});

run('variant radio semantics are intact (not re-fixed)', () => {
  // Recorded because a prior audit wrongly reported these as missing. They were
  // already correct; this pins them so the false positive cannot come back.
  const page = readFileSync(new URL('../src/pages/Product.jsx', import.meta.url), 'utf8');
  assert.match(page, /role="radiogroup"/, 'the pack-size group is a radiogroup');
  assert.match(page, /role="radio"/, 'each pack size is a radio');
  assert.match(page, /aria-checked=\{selected\}/, 'selection is exposed to assistive tech');
});

console.log('\nPDP merchandising regression checks passed.');
