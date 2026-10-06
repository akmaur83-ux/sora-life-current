// ============================================================
// Catalogue images: every upload becomes a WebP under 150 KB, in the browser,
// before it leaves the admin's machine.
//
// The ladder: longest side 1600 px, then 1400, 1200, 1000, 800; at each size
// quality 0.82 down to 0.5. The first rung that fits wins, so an image is only
// made smaller or softer than it must be. A source is never upscaled, and it
// is never shrunk below 800 px to make the size: an image that cannot fit at
// 800 px is refused rather than shipped as a thumbnail — a product page needs
// the detail.
//
// The decode and encode steps are injectable: the browser path uses
// createImageBitmap and a canvas; tests drive the ladder with a fake codec.
// ============================================================

export const WEBP_MAX_BYTES = 150000;            // "under 150 KB" in either reading of a KB
export const WEBP_SIDES = [1600, 1400, 1200, 1000, 800];
export const WEBP_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];
export const SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

/** Every size × quality the ladder will try for a source of this size, in order. */
export function webpAttempts(width, height) {
  const longest = Math.max(width, height);
  const attempts = [], seen = new Set();
  for (const side of WEBP_SIDES) {
    const scale = Math.min(1, side / longest);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (seen.has(`${w}x${h}`)) continue;                    // a small source collapses several rungs into one
    seen.add(`${w}x${h}`);
    for (const quality of WEBP_QUALITIES) attempts.push({ width: w, height: h, quality });
  }
  return attempts;
}

const kb = (bytes) => `${Math.round(bytes / 1000)} KB`;
const webpName = (name) => `${String(name || 'image').replace(/\.[^.\\/]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'image'}.webp`;

async function decodeInBrowser(file) {
  if (typeof globalThis.createImageBitmap !== 'function') throw new Error('This browser cannot read images for upload.');
  try { return await globalThis.createImageBitmap(file); }
  catch { throw new Error(`“${file.name}” could not be read as an image.`); }
}
async function encodeInBrowser(bitmap, { width, height, quality }) {
  const canvas = typeof globalThis.OffscreenCanvas === 'function'
    ? new globalThis.OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/webp', quality });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))), 'image/webp', quality));
}

/**
 * Turn an uploaded image into a WebP File under maxBytes.
 * Resolves { file, width, height, quality, bytes, sourceBytes }.
 */
export async function compressToWebp(file, { decode = decodeInBrowser, encode = encodeInBrowser, maxBytes = WEBP_MAX_BYTES } = {}) {
  if (!file || typeof file !== 'object') throw new Error('No image selected.');
  if (!SOURCE_TYPES.includes(file.type)) throw new Error(`“${file.name}” is ${file.type ? `a ${file.type} file` : 'not an image'}. Use JPEG, PNG or WebP.`);
  if (!(file.size > 0)) throw new Error(`“${file.name}” is empty.`);
  if (file.size > SOURCE_MAX_BYTES) throw new Error(`“${file.name}” is ${Math.round(file.size / 1024 / 1024)} MB. Use an image under 25 MB.`);
  const image = await decode(file);
  try {
    if (!(image.width > 0 && image.height > 0)) throw new Error(`“${file.name}” has no usable size.`);
    for (const attempt of webpAttempts(image.width, image.height)) {
      const blob = await encode(image, attempt);
      // Safari's canvas silently falls back to PNG for an encoder it lacks.
      if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot create WebP images. Upload from Chrome, Edge or Firefox.');
      if (blob.size <= maxBytes) {
        return {
          file: new File([blob], webpName(file.name), { type: 'image/webp' }),
          width: attempt.width, height: attempt.height, quality: attempt.quality, bytes: blob.size, sourceBytes: file.size,
        };
      }
    }
  } finally { image.close?.(); }
  throw new Error(`“${file.name}” could not be brought under ${kb(maxBytes)} at ${WEBP_SIDES[WEBP_SIDES.length - 1]} px or more. Crop it closer, or use a less detailed image.`);
}
