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
  assert.match(hero, /onLoad=\{i === active \? prepareNext : undefined\}/);
  assert.match(hero, /i === active && s\.kind === 'video'/);
  assert.doesNotMatch(hero, /fetchpriority=/, 'React must receive the canonical fetchPriority prop');
});

check('inactive slide CTA media does not mount', () => {
  assert.match(heroCta, /active && a\.textureUrl/);
  assert.match(heroCta, /active && a\.iconUrl/);
});

check('mobile-hidden visual layers are removed before their URL is assigned', () => {
  assert.match(visualLayers, /!\(mobile && layer\.hideMobile\)/);
});

check('PDP LCP image stays eager while thumbs and catalogue media stay deferred', () => {
  assert.match(mainGallery, /loading="eager"/);
  assert.match(mainGallery, /fetchPriority="high"/);
  assert.equal((mainGallery.match(/loading="eager"/g) || []).length, 1);
});

console.log('\nStorefront media-loading regression checks passed.');
