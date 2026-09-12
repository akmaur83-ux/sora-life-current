// ============================================================
// KYC documents — the pure rules, shared by the creator portal and the tests.
//
// No I/O here. The bucket, its RLS and the set_kyc_document() RPC (migration
// 0030) are the real gate; this module exists so the client refuses the same
// things the server would, with a message a person can act on, before a
// single byte is uploaded.
//
// Mirrors 0030 exactly:
//   bucket      kyc-documents, private, 5 MB, {jpeg, png, webp, pdf}
//   object path <creator_id>/<kind>/<id>.<ext>   kind ∈ {pan, bank}
// ============================================================
import { sniffUploadImageType } from './productMediaOperations.js';

export const KYC_BUCKET = 'kyc-documents';
export const KYC_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

// MIME → extension. The order is what the <input accept> lists.
export const KYC_DOCUMENT_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
});
export const KYC_DOCUMENT_ACCEPT = Object.keys(KYC_DOCUMENT_TYPES).join(',');

export const KYC_DOCUMENT_KINDS = Object.freeze([
  {
    kind: 'pan',
    label: 'PAN card',
    field: 'pan_document_path',
    hint: 'A clear photo or scan of the PAN card, showing the number and name.',
  },
  {
    kind: 'bank',
    label: 'Bank proof',
    field: 'bank_document_path',
    hint: 'A cancelled cheque, passbook page or bank statement header showing the account holder, account number and IFSC.',
  },
]);
export const KYC_KIND_SET = new Set(KYC_DOCUMENT_KINDS.map((k) => k.kind));

// The same expression set_kyc_document() applies (0030 §5), so a path the
// client builds is a path the server accepts, and nothing else is.
const PATH_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(pan|bank)\/([A-Za-z0-9-]+)\.(jpg|jpeg|png|webp|pdf)$/;

export function kycDocumentPath(creatorId, kind, extension, id) {
  const path = `${String(creatorId).toLowerCase()}/${kind}/${id}.${extension}`;
  if (!isKycDocumentPath(path, creatorId, kind)) throw new Error('Invalid document destination.');
  return path;
}

export function isKycDocumentPath(path, creatorId, kind) {
  if (typeof path !== 'string') return false;
  const m = PATH_RE.exec(path);
  if (!m) return false;
  if (creatorId != null && m[1] !== String(creatorId).toLowerCase()) return false;
  if (kind != null && m[2] !== kind) return false;
  return true;
}

// PDFs are the one non-image type the bucket takes; sniff them the same way.
export function sniffKycDocumentType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5) return null;
  if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  const image = sniffUploadImageType(bytes);
  return image && KYC_DOCUMENT_TYPES[image] ? image : null;
}

// Metadata-only checks: synchronous, so a form can refuse before reading.
export function validateKycDocumentMetadata(file) {
  if (!file) throw new Error('Choose a file first.');
  if (!KYC_DOCUMENT_TYPES[file.type]) {
    throw new Error(`Unsupported file type${file.type ? ` (${file.type})` : ''}. Upload a JPEG, PNG, WebP or PDF.`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > KYC_DOCUMENT_MAX_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under ${Math.floor(KYC_DOCUMENT_MAX_BYTES / 1024 / 1024)} MB.`);
  }
  if (typeof file.slice !== 'function') throw new Error('The selected file cannot be read.');
}

// Full check: metadata, then the first bytes must agree with the declared type.
export async function validateKycDocument(file) {
  validateKycDocumentMetadata(file);
  let bytes;
  try { bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer()); }
  catch { throw new Error('The selected file could not be read.'); }
  const detected = sniffKycDocumentType(bytes);
  if (!detected || detected !== file.type) {
    throw new Error('The file contents do not match its type. Export it again as a JPEG, PNG, WebP or PDF.');
  }
  return { mime: detected, extension: KYC_DOCUMENT_TYPES[detected] };
}

// set_kyc_document() reasons → copy. Unknown reasons fall back, never leak.
export function friendlyKycDocumentError(reason) {
  switch (reason) {
    case 'not_a_creator': return 'Only an approved creator account can upload verification documents.';
    case 'bad_kind': return 'Unknown document type.';
    case 'bad_path': return 'The upload landed somewhere unexpected. Please try again.';
    case 'not_uploaded': return 'The upload did not complete. Please try again.';
    default: return 'The document could not be saved. Please try again.';
  }
}

// What the portal shows for a document slot, from the profile row alone.
export function kycDocumentState(kyc, kind) {
  const def = KYC_DOCUMENT_KINDS.find((k) => k.kind === kind);
  if (!def) throw new Error(`Unknown KYC document kind: ${kind}`);
  const path = kyc?.[def.field] || null;
  return {
    ...def,
    path,
    uploaded: Boolean(path),
    uploadedAt: path ? (kyc?.documents_updated_at || null) : null,
    fileType: path ? (path.split('.').pop() || '').toLowerCase() : null,
  };
}
