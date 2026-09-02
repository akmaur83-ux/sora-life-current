import { supabase } from './supabase.js';
import { safeVisualUrl } from './homepageAppearance.js';
import { validateImageUpload } from './productMediaOperations.js';

export async function validateHomepageImage(file) {
  const result = await validateImageUpload(file, {
    allowedTypes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 6 * 1024 * 1024,
  });
  return result.extension;
}

export async function uploadHomepageImage(file) {
  const ext = await validateHomepageImage(file);
  const bucket = supabase.storage.from('product-images');
  const path = `homepage-visuals/${crypto.randomUUID()}.${ext}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  const url = safeVisualUrl(bucket.getPublicUrl(path).data.publicUrl);
  if (!url) throw new Error('Storage returned an unsupported public image URL.');
  return url;
}
