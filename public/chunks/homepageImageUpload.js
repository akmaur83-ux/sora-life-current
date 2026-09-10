import { bI as supabase, bf as safeVisualUrl, bw as validateImageUpload } from '../bundle.js';

async function validateHomepageImage(file) {
  const result = await validateImageUpload(file, {
    allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 6 * 1024 * 1024
  });
  return result.extension;
}
async function uploadHomepageImage(file) {
  const ext = await validateHomepageImage(file);
  const bucket = supabase.storage.from('product-images');
  const path = `homepage-visuals/${crypto.randomUUID()}.${ext}`;
  const {
    error
  } = await bucket.upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const url = safeVisualUrl(bucket.getPublicUrl(path).data.publicUrl);
  if (!url) throw new Error('Storage returned an unsupported public image URL.');
  return url;
}

export { uploadHomepageImage as u };
//# sourceMappingURL=homepageImageUpload.js.map
