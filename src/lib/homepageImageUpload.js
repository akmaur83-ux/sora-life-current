import { supabase } from './supabase.js';
import { safeVisualUrl } from './homepageAppearance.js';

export async function validateHomepageImage(file) {
  const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  if (!file || !types[file.type]) throw new Error('Choose a PNG, JPEG or WebP image. SVG, HTML and other files are not allowed.');
  if (!file.size || file.size > 6 * 1024 * 1024) throw new Error('Choose an image smaller than 6 MB.');
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (bytes, offset = 0) => bytes.every((n, i) => b[offset + i] === n);
  const detected = starts([137, 80, 78, 71, 13, 10, 26, 10]) ? 'image/png'
    : starts([255, 216, 255]) ? 'image/jpeg'
      : starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8) ? 'image/webp' : null;
  if (detected !== file.type) throw new Error('The image contents do not match its file type.');
  return types[detected];
}

export async function uploadHomepageImage(file) {
  const ext = await validateHomepageImage(file);
  // Decode before storage: reject corrupt images and oversized pixel canvases.
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be decoded. Please export it as PNG, JPEG or WebP.'); });
  const tooLarge = bitmap.width * bitmap.height > 24000000 || bitmap.width > 10000 || bitmap.height > 10000;
  bitmap.close();
  if (tooLarge) throw new Error('Use an image under 24 megapixels and 10,000 pixels per side.');
  const bucket = supabase.storage.from('product-images');
  const path = `homepage-visuals/${crypto.randomUUID()}.${ext}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  const url = safeVisualUrl(bucket.getPublicUrl(path).data.publicUrl);
  if (!url) throw new Error('Storage returned an unsupported public image URL.');
  return url;
}
