import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const check = (name, fn) => { fn(); console.log(`PASS ${name}`); };

const deferred = read('src/components/DeferredImage.jsx');
const productImage = read('src/components/ProductImage.jsx');
const hero = read('src/components/Hero.jsx');
const heroCta = read('src/components/HeroCta.jsx');
const visualLayers = read('src/components/HomeVisualLayers.jsx');
const mainGallery = read('src/components/ProductGallery.jsx');
const lightbox = read('src/components/pdp/ProductLightbox.jsx');
const promoArtwork = read('src/components/promo/PromoArtwork.jsx');
const promoPoster = read('src/components/promo/PromoPoster.jsx');

check('distant images receive no src before viewport proximity', () => {
  assert.match(deferred, /src=\{ready \? src : undefined\}/);
  assert.match(deferred, /IntersectionObserver/);
  assert.match(deferred, /rootMargin: '240px 160px'/);
  assert.match(deferred, /Progressive fallback/);
  assert.match(productImage, /src=\{ready \? src : undefined\}/);
  assert.match(productImage, /srcSet=\{ready \? srcSet : undefined\}/);
});

check('configured hero prepares only active and justified adjacent media', () => {
  assert.match(hero, /preparedSlides/);
  assert.match(hero, /mediaPrepared && \(activeVideo/);
  assert.match(hero, /prepareSlide\(active\);/);
  assert.match(hero, /loadedSlides\.current\.has\(id\)[\s\S]*?prepareSlide\(active \+ 1\)/);
  assert.match(hero, /loadedSlides\.current\.add\(id\)[\s\S]*?index === active[\s\S]*?prepareSlide\(index \+ 1\)/);
  assert.match(hero, /loadedSlides\.current\.has\(id\)/);
  assert.match(hero, /onLoad=\{\(\) => mediaReady\(s\.id, i\)\}/);
  assert.doesNotMatch(hero, /SLIDES\.forEach\([^)]*prepareSlide/);
  assert.match(hero, /i === active && s\.kind === 'video'/);
  assert.doesNotMatch(hero, /fetchpriority=/, 'React must receive the canonical fetchPriority prop');
  assert.match(hero, /else mq\.addListener\?\.\([^)]+\)/);
  assert.match(hero, /else mq\.removeListener\?\.\([^)]+\)/);
});

check('inactive slide CTA media does not mount', () => {
  assert.match(heroCta, /active && a\.textureUrl/);
  assert.match(heroCta, /active && a\.iconUrl/);
});

check('mobile-hidden visual layers are removed before their URL is assigned', () => {
  assert.match(visualLayers, /!\(mobile && layer\.hideMobile\)/);
  assert.match(visualLayers, /addListener\?\.\(update\)/);
  assert.match(visualLayers, /removeListener\?\.\(update\)/);
});

check('offscreen promotion artwork keeps src gated by viewport proximity', () => {
  assert.match(promoArtwork, /import DeferredImage from '\.\.\/DeferredImage\.jsx'/);
  assert.match(promoArtwork, /<DeferredImage[\s\S]*?src=\{src\}/);
  assert.match(promoArtwork, /width=\{1500\}[\s\S]*?height=\{1000\}/);
  assert.doesNotMatch(promoArtwork, /<img[\s\S]*?loading="lazy"/);
  assert.match(promoPoster, /if \(imageUrl\)[\s\S]*?<PromoArtwork/);
  assert.doesNotMatch(promoPoster, /<img[\s\S]*?loading="lazy"/);
  assert.match(deferred, /src=\{ready \? src : undefined\}/);
  assert.match(deferred, /io\.observe\(node\)/);
});

check('PDP LCP and opened lightbox stay eager while thumbs and catalogue media stay deferred', () => {
  assert.match(mainGallery, /loading="eager"/);
  assert.match(mainGallery, /fetchPriority="high"/);
  assert.equal((mainGallery.match(/loading="eager"/g) || []).length, 1);
  assert.match(lightbox, /loading="eager"/);
});

console.log('\nStorefront media-loading regression checks passed.');
