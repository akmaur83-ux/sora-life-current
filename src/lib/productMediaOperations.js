// Product Media orchestration and pure upload validation shared by the admin
// client and importer. Adapters perform I/O; this module has no credentials.
export const IMAGE_UPLOAD_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
});

export const IMAGE_UPLOAD_ACCEPT = Object.keys(IMAGE_UPLOAD_TYPES).join(',');
export const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_UPLOAD_TYPES = Object.freeze({ 'video/mp4': 'mp4', 'video/webm': 'webm' });

const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));
const startsWith = (bytes, signature, offset = 0) => signature.every((value, index) => bytes[offset + index] === value);

export function sniffUploadImageType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'mif1') {
      const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
      const end = Math.min(bytes.length, boxSize || bytes.length);
      for (let offset = 16; offset + 4 <= end; offset += 4) {
        if (['avif', 'avis'].includes(ascii(bytes, offset, 4).toLowerCase())) return 'image/avif';
      }
    }
  }
  return null;
}

export function validateImageMetadata(file, { allowedTypes = Object.keys(IMAGE_UPLOAD_TYPES), maxBytes = IMAGE_UPLOAD_MAX_BYTES } = {}) {
  if (!file) throw new Error('No file selected.');
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported image type${file.type ? ` (${file.type})` : ''}. Use JPEG, PNG, WebP, GIF or AVIF. SVG is not allowed.`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected image is empty.');
  if (file.size > maxBytes) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }
  if (typeof file.slice !== 'function') throw new Error('The selected image cannot be read.');
}

async function verifyImageDecode(file, { maxPixels, maxDimension }) {
  if (typeof globalThis.createImageBitmap !== 'function') return;
  let bitmap;
  try { bitmap = await globalThis.createImageBitmap(file); }
  catch { throw new Error('This image is malformed or could not be decoded.'); }
  try {
    const width = Number(bitmap.width), height = Number(bitmap.height);
    if (!width || !height) throw new Error('This image has invalid dimensions.');
    if (width > maxDimension || height > maxDimension || width * height > maxPixels) {
      throw new Error(`Use an image under ${Math.floor(maxPixels / 1000000)} megapixels and ${maxDimension.toLocaleString()} pixels per side.`);
    }
  } finally { bitmap.close?.(); }
}

export async function validateImageUpload(file, {
  allowedTypes = Object.keys(IMAGE_UPLOAD_TYPES),
  maxBytes = IMAGE_UPLOAD_MAX_BYTES,
  maxPixels = 24 * 1000 * 1000,
  maxDimension = 10000,
} = {}) {
  validateImageMetadata(file, { allowedTypes, maxBytes });
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer()); }
  catch { throw new Error('The selected image could not be read.'); }
  const detectedType = sniffUploadImageType(bytes);
  if (!detectedType || detectedType !== file.type || !allowedTypes.includes(detectedType)) {
    throw new Error('The image contents do not match its declared file type.');
  }
  await verifyImageDecode(file, { maxPixels, maxDimension });
  return { mime: detectedType, extension: IMAGE_UPLOAD_TYPES[detectedType] };
}

export async function validateVideoUpload(file, { maxBytes = 100 * 1024 * 1024 } = {}) {
  if (!file || !VIDEO_UPLOAD_TYPES[file.type]) throw new Error('Please choose an MP4 or WebM video.');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected video is empty.');
  if (file.size > maxBytes) throw new Error(`Video is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  if (typeof file.slice !== 'function') throw new Error('The selected video cannot be read.');
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer()); }
  catch { throw new Error('The selected video could not be read.'); }
  const mp4 = bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp';
  const webm = bytes.length >= 4 && startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if ((file.type === 'video/mp4' && !mp4) || (file.type === 'video/webm' && !webm)) {
    throw new Error('The video contents do not match its declared file type.');
  }
  return { mime: file.type, extension: VIDEO_UPLOAD_TYPES[file.type] };
}

export class MediaOperationError extends Error {
  constructor(phase, message, details = {}) {
    super(message);
    this.name = 'MediaOperationError';
    this.phase = phase;
    Object.assign(this, details);
  }
}

export async function removeMediaObject(storagePath, remove) {
  let cause;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await remove(storagePath); return; }
    catch (error) { cause = error; }
  }
  // Storage and Postgres cannot commit atomically. Never call an unresolved
  // compensating delete a success: retain the exact path for recovery.
  throw new MediaOperationError('cleanup', 'Storage cleanup could not be confirmed: ' + storagePath, {
    cleanupPending: [storagePath], cause,
  });
}

export async function persistUploadedMedia(uploaded, create, findByPath, remove) {
  try { return await create(); }
  catch (error) {
    // An insert can commit while its response is lost. Reconcile before
    // deleting, otherwise cleanup could break a successfully persisted row.
    let saved;
    try { saved = await findByPath(uploaded.storagePath); }
    catch (cause) {
      throw new MediaOperationError('reconcile', 'Could not confirm media persistence; do not retry this upload until checked.', {
        cleanupPending: [uploaded.storagePath], cause,
      });
    }
    if (saved) return saved;
    await removeMediaObject(uploaded.storagePath, remove);
    throw new MediaOperationError('insert', error.message || 'Could not save media.', { cleaned: uploaded.storagePath });
  }
}

// Always read back the authoritative rows. A preferred selection may fail
// while the previous primary remains valid; report the failure and sync that
// actual primary, never the optimistic UI choice. Empty galleries clear the
// denormalised image_url (needed when the last uploaded image is deleted).
export async function settlePrimaryMedia(ops, preferredId = null) {
  let rows = [], primary = null, primaryCount = null;
  let primaryError = null, syncError = null;
  try {
    rows = await ops.list();
    let primaries = rows.filter((row) => row.isPrimary);
    const preferred = preferredId == null ? null : rows.find((row) => String(row.id) === String(preferredId));
    if (preferredId != null && !preferred) throw new Error('The selected primary no longer belongs to this product.');
    if (rows.length && (primaries.length !== 1 || (preferred && preferred.id !== primaries[0]?.id))) {
      const chosen = preferred || primaries[0] || rows[0];
      try { await ops.select(chosen.id); }
      catch (error) { primaryError = error.message || 'Primary selection failed.'; }
      rows = await ops.list();
      primaries = rows.filter((row) => row.isPrimary);
    }
    primaryCount = primaries.length;
    if (rows.length && primaryCount !== 1) throw new Error('Media must have exactly one primary; found ' + primaryCount + '.');
    primary = primaries[0] || null;
    if (preferred && primary?.id !== preferred.id) primaryError ||= 'The requested primary selection was not confirmed.';
  } catch (error) { primaryError ||= error.message || 'Could not verify primary media.'; }

  // Never clear image_url when a failed read made the gallery look empty.
  if (primary || (primaryCount === 0 && rows.length === 0 && !primaryError)) {
    try { await ops.sync(primary?.url || null); }
    catch (error) { syncError = error.message || 'Product image synchronization failed.'; }
  }
  return { ok: !primaryError && !syncError, rows, primary, primaryCount, primaryError, syncError };
}

export async function commitStagedMedia(items, ops) {
  const created = [], failed = [], cleanupPending = [];
  let initial;
  try { initial = await ops.list(); }
  catch (error) {
    return { ok: false, created, failed, cleanupPending, primaryCount: null, primaryError: error.message, syncError: null };
  }
  let madePrimary = initial.filter((row) => row.isPrimary).length === 1;
  const baseOrder = initial.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);
  for (const [index, item] of items.entries()) {
    try {
      const uploaded = await ops.upload(item.file);
      const row = await persistUploadedMedia(uploaded,
        () => ops.add({ ...uploaded, altText: item.alt || '', sortOrder: baseOrder + created.length, isPrimary: !madePrimary }),
        ops.find, ops.remove);
      created.push({ ...row, wantedPrimary: !!item.isPrimary });
      // Only a successful, confirmed row can advance the primary state.
      if (row.isPrimary) madePrimary = true;
    } catch (error) {
      failed.push({ name: item.file?.name || 'image ' + (index + 1), phase: error.phase || 'upload', error: error.message });
      if (error.cleanupPending?.length) {
        cleanupPending.push(...error.cleanupPending);
        failed.push(...items.slice(index + 1).map((pending) => ({ name: pending.file?.name || 'image', phase: 'not-attempted', error: 'Not attempted while cleanup is unresolved.' })));
        break;
      }
    }
  }
  const preferred = created.find((row) => row.wantedPrimary) || (initial.some((row) => row.isPrimary) ? null : created[0]);
  const state = created.length
    ? await settlePrimaryMedia(ops, preferred?.id)
    : { ok: true, primary: null, primaryCount: initial.filter((row) => row.isPrimary).length, primaryError: null, syncError: null, rows: initial };
  return {
    ok: state.ok && !failed.length && !cleanupPending.length,
    created: created.map((row) => state.rows.find((saved) => saved.id === row.id) || row),
    failed, cleanupPending, primary: state.primary, primaryCount: state.primaryCount,
    primaryError: state.primaryError, syncError: state.syncError,
  };
}

export function mediaFailureMessage(result) {
  return [
    ...(result.failed || []).map((item) => `${item.name}: ${item.error}`),
    result.primaryError && `Primary: ${result.primaryError}`,
    result.syncError && `Image sync: ${result.syncError}`,
    result.cleanupPending?.length && `Cleanup unresolved — do not re-upload until checked: ${result.cleanupPending.join(', ')}`,
  ].filter(Boolean).join(' ');
}
