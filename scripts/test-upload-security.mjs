// Offline upload-security regression tests. No Storage or database calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  IMAGE_UPLOAD_TYPES, validateImageMetadata, validateImageUpload, validateVideoUpload,
} from '../src/lib/productMediaOperations.js';

let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const bytes = {
  png: [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0],
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0],
  gif: [...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0],
  webp: [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')],
  avif: [0, 0, 0, 20, ...Buffer.from('ftyp'), ...Buffer.from('avif'), 0, 0, 0, 0, ...Buffer.from('avif')],
  svg: [...Buffer.from('<svg onload="alert(1)">')],
  mp4: [0, 0, 0, 20, ...Buffer.from('ftyp'), ...Buffer.from('mp42'), 0, 0, 0, 0],
  webm: [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0],
};
const fakeFile = (name, type, content, extra = {}) => ({
  name, type, size: content.length,
  slice: () => ({ arrayBuffer: async () => Uint8Array.from(content).buffer }),
  ...extra,
});

const originalCreateImageBitmap = globalThis.createImageBitmap;
globalThis.createImageBitmap = async (file) => {
  if (file.corrupt) throw new Error('decode failed');
  return { width: file.width || 1200, height: file.height || 800, close() {} };
};

try {
  await check('every supported raster MIME maps to a canonical safe extension', async () => {
    const fixtures = [
      ['image/png', 'png', bytes.png], ['image/jpeg', 'jpg', bytes.jpeg],
      ['image/webp', 'webp', bytes.webp], ['image/gif', 'gif', bytes.gif],
      ['image/avif', 'avif', bytes.avif],
    ];
    for (const [mime, extension, content] of fixtures) {
      const result = await validateImageUpload(fakeFile('../../payload.svg', mime, content));
      assert.deepEqual(result, { mime, extension });
    }
    assert.equal(Object.hasOwn(IMAGE_UPLOAD_TYPES, 'image/svg+xml'), false);
  });

  await check('MIME spoofing and SVG/script uploads are rejected', async () => {
    await assert.rejects(validateImageUpload(fakeFile('fake.png', 'image/png', bytes.svg)), /contents/);
    await assert.rejects(validateImageUpload(fakeFile('script.svg', 'image/svg+xml', bytes.svg)), /SVG is not allowed/);
    await assert.rejects(validateImageUpload(fakeFile('html.jpg', 'text/html', bytes.jpeg)), /Unsupported image type/);
  });

  await check('empty, unreadable and oversized uploads fail before Storage', async () => {
    assert.throws(() => validateImageMetadata(fakeFile('empty.png', 'image/png', [], { size: 0 })), /empty/);
    assert.throws(() => validateImageMetadata({ name: 'x.png', type: 'image/png', size: 12 }), /cannot be read/);
    assert.throws(() => validateImageMetadata(fakeFile('huge.png', 'image/png', bytes.png, { size: 8 * 1024 * 1024 + 1 })), /too large/);
  });

  await check('signature-valid but corrupt images are rejected by browser decode', async () => {
    await assert.rejects(validateImageUpload(fakeFile('broken.png', 'image/png', bytes.png, { corrupt: true })), /malformed|decoded/);
  });

  await check('oversized pixel canvases are rejected after decoding', async () => {
    await assert.rejects(validateImageUpload(fakeFile('bomb.png', 'image/png', bytes.png, { width: 12000, height: 12000 })), /megapixels|pixels per side/);
  });

  await check('hero video accepts only matching MP4/WebM signatures', async () => {
    assert.deepEqual(await validateVideoUpload(fakeFile('renamed.exe', 'video/mp4', bytes.mp4)), { mime: 'video/mp4', extension: 'mp4' });
    assert.deepEqual(await validateVideoUpload(fakeFile('../clip.svg', 'video/webm', bytes.webm)), { mime: 'video/webm', extension: 'webm' });
    await assert.rejects(validateVideoUpload(fakeFile('fake.mp4', 'video/mp4', bytes.svg)), /contents/);
    await assert.rejects(validateVideoUpload(fakeFile('movie.mov', 'video/quicktime', bytes.mp4)), /MP4 or WebM/);
  });

  await check('storage paths use validated extensions and secure random IDs, never filenames', () => {
    const source = readFileSync('src/lib/adminApi.js', 'utf8');
    assert.doesNotMatch(source, /file\.name\.split/);
    assert.match(source, /cryptoRandomId\(\)\}\.`?\$\{opts\.extension\}/);
    assert.match(source, /cryptoRandomId\(\)\}\.`?\$\{validated\.extension\}/);
    assert.match(source, /randomUUID|getRandomValues/);
    assert.match(source, /upsert:\s*false/);
  });

  await check('Admin file pickers do not advertise wildcard image or video types', () => {
    const paths = [
      'src/admin/pages/Branding.jsx', 'src/admin/pages/HeroSlides.jsx',
      'src/admin/pages/Promotions.jsx', 'src/admin/components/MediaGallery.jsx',
      'src/admin/components/HomepageVisualControls.jsx', 'src/admin/components/HeroCtaAppearanceControls.jsx',
    ];
    const source = paths.map((path) => readFileSync(path, 'utf8')).join('\n');
    assert.doesNotMatch(source, /accept="(?:image|video)\/\*"/);
  });
} finally {
  if (originalCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = originalCreateImageBitmap;
}

console.log(`\n${passed} passed, 0 failed\n`);
