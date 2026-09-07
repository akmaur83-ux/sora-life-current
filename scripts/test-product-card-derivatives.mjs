import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCT_CARD_PROFILE, productCardImageUrl, productCardObjectName, productObjectFilename } from '../src/lib/productImageVariants.js';

const original = 'https://example.supabase.co/storage/v1/object/public/product-images/products/ABC-123.photo.PNG?download=1';
assert.equal(productObjectFilename(original), 'ABC-123.photo.PNG');
assert.equal(productCardObjectName(original), 'abc-123-photo-png-card-700-q86.webp');
assert.equal(productCardImageUrl(original), 'https://example.supabase.co/storage/v1/object/public/product-images/products-optimized/v1/abc-123-photo-png-card-700-q86.webp');
assert.deepEqual(PRODUCT_CARD_PROFILE, { width: 700, quality: 86, version: 1 });
assert.equal(productCardImageUrl('/img/local.png'), null);
assert.equal(productCardImageUrl('https://cdn.example.com/product.jpg'), null);
assert.equal(productCardImageUrl('javascript:alert(1)'), null);

const script = readFileSync(new URL('./product-card-derivatives.mjs', import.meta.url), 'utf8');
assert.match(script, /--dry-run/);
assert.match(script, /withoutEnlargement: true/);
assert.match(script, /upsert: false/);
assert.match(script, /cacheControl: '31536000'/);
assert.match(script, /SORA_SUPABASE_USER_JWT/);
assert.doesNotMatch(script, /service.role|service_role/i);
assert.doesNotMatch(script, /\.remove\(|\.delete\(/);

console.log('Product card derivative path and generator safety checks passed.');
