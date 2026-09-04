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

console.log('\nPDP merchandising regression checks passed.');
