import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const check = (name, fn) => { fn(); console.log(`PASS ${name}`); };

const deferred = read('src/components/DeferredImage.jsx');
const productImage = read('src/components/ProductImage.jsx');
const visualLayers = read('src/components/HomeVisualLayers.jsx');
const mainGallery = read('src/components/ProductGallery.jsx');
const lightbox = read('src/components/pdp/ProductLightbox.jsx');
const promoArtwork = read('src/components/promo/PromoArtwork.jsx');
const promoPoster = read('src/components/promo/PromoPoster.jsx');

check('distant images receive no src before viewport proximity', () => {
  assert.match(deferred, /src=\{ready \? src : undefined\}/);
  assert.match(deferred, /IntersectionObserver/);
  assert.match(deferred, /rootMargin: '600px 180px'/);
  assert.match(deferred, /revealedIdentity === identity/);
  assert.doesNotMatch(deferred, /setReady/);
  assert.match(deferred, /Progressive fallback/);
  assert.match(productImage, /src=\{ready \? src : undefined\}/);
  assert.match(productImage, /srcSet=\{ready \? srcSet : undefined\}/);
});

check('listing priority is limited to the first six cards and one high-priority image', () => {
  const browser = read('src/components/ProductBrowser.jsx');
  const card = read('src/components/ProductCard.jsx');
  assert.match(browser, /index < 6 \? 'eager' : 'lazy'/);
  assert.match(browser, /index === 0 \? 'high' : undefined/);
  assert.match(card, /variant="card"/);
  assert.match(card, /loading=\{mediaLoading\}/);
  assert.match(card, /fetchPriority=\{mediaFetchPriority\}/);
});

check('card derivatives fall back to originals while PDP main and zoom stay original', () => {
  assert.match(productImage, /productCardImageUrl\(originalSrc\)/);
  assert.match(productImage, /if \(usingCard\)[\s\S]*?setCardFailed\(true\)/);
  assert.match(productImage, /const src = usingCard \? cardSrc : originalSrc/);
  assert.match(mainGallery, /frame="v2"\s*loading="eager"\s*fetchPriority="high"/);
  assert.match(mainGallery, /sizes="84px" frame="v2" variant="card"/);
  assert.doesNotMatch(lightbox, /variant="card"/);
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
