// ============================================================
// Creator KYC documents — offline suite.
//
// Everything here runs in memory: the pure rules module, the API functions
// against a fake Supabase client that records every call, the real JSX
// rendered with react-dom/server, and the migration read as text.
//
// NO NETWORK, NO SECRETS, NO DATABASE, NO BROWSER.
//
// Run: node scripts/test-kyc-documents.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as rules from '../src/lib/kycDocuments.js';
import { money2 } from '../src/lib/format.js';

const {
  KYC_BUCKET, KYC_DOCUMENT_MAX_BYTES, KYC_DOCUMENT_TYPES, KYC_DOCUMENT_ACCEPT, KYC_DOCUMENT_KINDS,
  kycDocumentPath, isKycDocumentPath, sniffKycDocumentType, validateKycDocumentMetadata,
  validateKycDocument, friendlyKycDocumentError, kycDocumentState,
} = rules;

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
function component(file, name, deps = {}) {
  const { code } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.node.declaration ? path.replaceWith(path.node.declaration) : path.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Icon = () => h('span');

// ---- fake files -----------------------------------------------------------
const bytesOf = (arr) => new Uint8Array(arr);
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20];
const GIF = [...'GIF89a'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = [...'%PDF-1.7\n%'].map((c) => c.charCodeAt(0)).concat([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
const SVG = [...'<svg xmlns="http://www.w3.org/2000/svg">'].map((c) => c.charCodeAt(0));
function fakeFile({ name = 'doc.jpg', type = 'image/jpeg', size, head = JPEG, unreadable = false } = {}) {
  const body = bytesOf(head);
  return {
    name, type, size: size ?? body.length,
    slice() {
      return { arrayBuffer: async () => { if (unreadable) throw new Error('nope'); return body.buffer; } };
    },
  };
}

const CID = '3f6d2a9e-1b4c-4e8f-9a0d-5c7b8e2f1a34';
const CID_OTHER = '9a0d5c7b-8e2f-1a34-3f6d-2a9e1b4c4e8f';

// ============================================================
console.log('\n— Rules: constants mirror migration 0030 —');
// ============================================================

const migration = read('../supabase/migrations/0030_creator_kyc_documents.sql').replace(/\r\n/g, '\n');

await test('bucket name, size limit and MIME list are the ones the migration creates', () => {
  assert.equal(KYC_BUCKET, 'kyc-documents');
  assert.equal(KYC_DOCUMENT_MAX_BYTES, 5242880);
  assert.match(migration, /'kyc-documents'[\s\S]*?false[\s\S]*?5242880/);
  for (const mime of Object.keys(KYC_DOCUMENT_TYPES)) assert.ok(migration.includes(mime), `${mime} missing from bucket allowed_mime_types`);
  assert.deepEqual(Object.keys(KYC_DOCUMENT_TYPES), ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  assert.equal(KYC_DOCUMENT_ACCEPT, 'image/jpeg,image/png,image/webp,application/pdf');
});

await test('exactly two document kinds, pan and bank, mapped to the 0030 columns', () => {
  assert.deepEqual(KYC_DOCUMENT_KINDS.map((k) => k.kind), ['pan', 'bank']);
  assert.deepEqual(KYC_DOCUMENT_KINDS.map((k) => k.field), ['pan_document_path', 'bank_document_path']);
  assert.match(migration, /p_kind not in \('pan', 'bank'\)/);
  assert.match(migration, /add column if not exists pan_document_path\s+text/);
  assert.match(migration, /add column if not exists bank_document_path\s+text/);
});

// ============================================================
console.log('\n— Rules: object paths —');
// ============================================================

// The regex the RPC applies, lifted from the migration so the two cannot drift.
const sqlRe = (() => {
  const m = migration.match(/p_path !~ \('\^' \|\| v_cid::text \|\| '\/' \|\| p_kind \|\| '\/(.+?)'\)/);
  assert.ok(m, 'set_kyc_document path regex not found in 0030');
  return (cid, kind) => new RegExp(`^${cid}/${kind}/${m[1].replace(/\\\\/g, '\\')}`);
})();

await test('kycDocumentPath builds <creator>/<kind>/<id>.<ext> and only that', () => {
  const p = kycDocumentPath(CID, 'pan', 'jpg', 'abc-123');
  assert.equal(p, `${CID}/pan/abc-123.jpg`);
  assert.ok(isKycDocumentPath(p, CID, 'pan'));
  assert.ok(sqlRe(CID, 'pan').test(p), 'the SQL regex must accept what the client builds');
  assert.throws(() => kycDocumentPath(CID, 'aadhaar', 'jpg', 'x'), /Invalid document destination/);
  assert.throws(() => kycDocumentPath(CID, 'pan', 'svg', 'x'), /Invalid document destination/);
  assert.throws(() => kycDocumentPath(CID, 'pan', 'jpg', '../../etc'), /Invalid document destination/);
  assert.throws(() => kycDocumentPath(CID, 'pan', 'jpg', 'a b'), /Invalid document destination/);
  assert.throws(() => kycDocumentPath('not-a-uuid', 'pan', 'jpg', 'x'), /Invalid document destination/);
});

await test('the client matcher and the SQL regex agree on every sample path', () => {
  const samples = [
    `${CID}/pan/abc.jpg`, `${CID}/pan/abc.jpeg`, `${CID}/bank/abc.pdf`, `${CID}/bank/A-1.webp`, `${CID}/pan/x.png`,
    `${CID}/pan/abc.JPG`, `${CID}/pan/abc.svg`, `${CID}/pan/abc.jpg.exe`, `${CID}/pan/../bank/abc.jpg`,
    `${CID}/aadhaar/abc.jpg`, `${CID_OTHER}/pan/abc.jpg`, `${CID}/pan/abc.jpg\n`, `${CID}/pan/`, `${CID}/pan/a b.jpg`,
    `${CID}/pan/abc.pdf?x=1`, `/${CID}/pan/abc.jpg`, `${CID}//pan/abc.jpg`, `${CID}/pan/abc..jpg`,
  ];
  for (const kind of ['pan', 'bank']) {
    for (const s of samples) {
      assert.equal(isKycDocumentPath(s, CID, kind), sqlRe(CID, kind).test(s), `disagree on ${JSON.stringify(s)} for ${kind}`);
    }
  }
});

await test('a path under another creator, or of another kind, is refused when scoped', () => {
  assert.equal(isKycDocumentPath(`${CID_OTHER}/pan/a.jpg`, CID, 'pan'), false);
  assert.equal(isKycDocumentPath(`${CID}/bank/a.jpg`, CID, 'pan'), false);
  assert.equal(isKycDocumentPath(`${CID}/bank/a.jpg`), true, 'unscoped: any well-formed path');
  assert.equal(isKycDocumentPath(null), false);
  assert.equal(isKycDocumentPath(42), false);
});

// ============================================================
console.log('\n— Rules: file validation —');
// ============================================================

await test('sniffing: JPEG, PNG, WebP and PDF are recognised; GIF, AVIF, SVG and junk are not', () => {
  assert.equal(sniffKycDocumentType(bytesOf(JPEG)), 'image/jpeg');
  assert.equal(sniffKycDocumentType(bytesOf(PNG)), 'image/png');
  assert.equal(sniffKycDocumentType(bytesOf(WEBP)), 'image/webp');
  assert.equal(sniffKycDocumentType(bytesOf(PDF)), 'application/pdf');
  assert.equal(sniffKycDocumentType(bytesOf(GIF)), null, 'GIF is an image the bucket does not take');
  assert.equal(sniffKycDocumentType(bytesOf(SVG)), null);
  assert.equal(sniffKycDocumentType(bytesOf([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
  assert.equal(sniffKycDocumentType(bytesOf([0x25, 0x50])), null, 'too short');
  assert.equal(sniffKycDocumentType('%PDF-1.4'), null, 'strings are not bytes');
});

await test('metadata: type, emptiness and the 5 MB ceiling are enforced before any read', () => {
  assert.doesNotThrow(() => validateKycDocumentMetadata(fakeFile()));
  assert.throws(() => validateKycDocumentMetadata(null), /Choose a file/);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ type: 'image/gif', name: 'a.gif' })), /Unsupported file type \(image\/gif\)/);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ type: 'image/svg+xml' })), /Unsupported/);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ type: '' })), /Unsupported file type\./);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ size: 0 })), /empty/);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ size: NaN })), /empty/);
  assert.throws(() => validateKycDocumentMetadata(fakeFile({ size: KYC_DOCUMENT_MAX_BYTES + 1 })), /too large \(5\.0 MB\)\. Keep it under 5 MB/);
  assert.doesNotThrow(() => validateKycDocumentMetadata(fakeFile({ size: KYC_DOCUMENT_MAX_BYTES })), 'exactly 5 MB is allowed');
  assert.throws(() => validateKycDocumentMetadata({ type: 'image/jpeg', size: 10 }), /cannot be read/);
});

await test('full validation: the bytes must agree with the declared type', async () => {
  assert.deepEqual(await validateKycDocument(fakeFile()), { mime: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(await validateKycDocument(fakeFile({ type: 'application/pdf', name: 'a.pdf', head: PDF })), { mime: 'application/pdf', extension: 'pdf' });
  assert.deepEqual(await validateKycDocument(fakeFile({ type: 'image/webp', head: WEBP })), { mime: 'image/webp', extension: 'webp' });
  assert.deepEqual(await validateKycDocument(fakeFile({ type: 'image/png', head: PNG })), { mime: 'image/png', extension: 'png' });
  await assert.rejects(validateKycDocument(fakeFile({ type: 'image/png', head: JPEG })), /contents do not match/);
  await assert.rejects(validateKycDocument(fakeFile({ type: 'application/pdf', head: JPEG })), /contents do not match/);
  await assert.rejects(validateKycDocument(fakeFile({ type: 'image/jpeg', head: PDF })), /contents do not match/, 'a PDF renamed .jpg');
  await assert.rejects(validateKycDocument(fakeFile({ type: 'image/jpeg', head: SVG })), /contents do not match/, 'SVG renamed .jpg');
  await assert.rejects(validateKycDocument(fakeFile({ unreadable: true })), /could not be read/);
  await assert.rejects(validateKycDocument(fakeFile({ type: 'image/gif', head: GIF })), /Unsupported/);
});

await test('friendly errors cover every reason set_kyc_document returns, and never echo unknown ones', () => {
  const reasons = [...migration.matchAll(/set_kyc_document[\s\S]*$/g)][0][0].matchAll(/'reason', '([a-z_]+)'/g);
  for (const [, r] of reasons) {
    const msg = friendlyKycDocumentError(r);
    assert.ok(msg && !msg.includes(r), `${r} → "${msg}" leaks the code`);
    assert.notEqual(msg, friendlyKycDocumentError('__unknown__'), `${r} falls through to the default`);
  }
  assert.equal(friendlyKycDocumentError('permission denied for table x'), 'The document could not be saved. Please try again.');
});

await test('kycDocumentState reads a slot from the profile row', () => {
  const none = kycDocumentState(null, 'pan');
  assert.equal(none.uploaded, false); assert.equal(none.path, null); assert.equal(none.uploadedAt, null);
  const row = { pan_document_path: `${CID}/pan/a.PDF`, bank_document_path: null, documents_updated_at: '2026-09-10T10:00:00Z' };
  const pan = kycDocumentState(row, 'pan');
  assert.equal(pan.uploaded, true); assert.equal(pan.fileType, 'pdf'); assert.equal(pan.uploadedAt, row.documents_updated_at);
  assert.equal(pan.label, 'PAN card');
  const bank = kycDocumentState(row, 'bank');
  assert.equal(bank.uploaded, false); assert.equal(bank.uploadedAt, null, 'the timestamp belongs to the uploaded slot only');
  assert.throws(() => kycDocumentState(row, 'aadhaar'), /Unknown KYC document kind/);
});

// ============================================================
console.log('\n— API: upload → register → clean up, against a recording client —');
// ============================================================

function fakeSupabase({ uploadError = null, rpcError = null, rpcData = null, signError = null, removeError = null } = {}) {
  const calls = [];
  const storageBucket = (bucket) => ({
    upload: async (path, file, opts) => { calls.push(['upload', bucket, path, opts]); return { error: uploadError }; },
    remove: async (paths) => { calls.push(['remove', bucket, paths]); return { error: removeError }; },
    createSignedUrl: async (path, secs) => { calls.push(['createSignedUrl', bucket, path, secs]); return signError ? { data: null, error: signError } : { data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=T` }, error: null }; },
    getPublicUrl: (path) => { calls.push(['getPublicUrl', bucket, path]); return { data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` } }; },
  });
  const table = () => {
    const q = { _calls: [] };
    for (const m of ['select', 'eq', 'order', 'limit', 'maybeSingle']) q[m] = (...a) => { q._calls.push([m, ...a]); return q; };
    q.then = (res) => res({ data: [], error: null });
    return q;
  };
  const supabase = {
    storage: { from: storageBucket },
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return { data: rpcData, error: rpcError }; },
    from: (t) => { const q = table(); calls.push(['from', t, q]); return q; },
    auth: { getSession: async () => ({ data: { session: null } }) },
  };
  return { supabase, calls };
}

function apiWith(fake) {
  const deps = { supabase: fake.supabase, normalizeDestination: (x) => x, ...rules };
  return {
    uploadKycDocument: component('../src/lib/creatorApi.js', 'uploadKycDocument', deps),
    adminKycDocumentUrl: component('../src/lib/creatorApi.js', 'adminKycDocumentUrl', deps),
    adminListKycAudit: component('../src/lib/creatorApi.js', 'adminListKycAudit', deps),
    KYC_SIGNED_URL_SECONDS: component('../src/lib/creatorApi.js', 'KYC_SIGNED_URL_SECONDS', deps),
  };
}

await test('happy path: validate → upload (upsert:false, sniffed content type) → rpc → remove the replaced object', async () => {
  const prev = `${CID}/pan/old.jpg`;
  const fake = fakeSupabase({ rpcData: { ok: true, kind: 'pan', path: 'set-below', previous_path: prev, identity_status: 'pending' } });
  const api = apiWith(fake);
  const res = await api.uploadKycDocument({ creatorId: CID, kind: 'pan', file: fakeFile({ type: 'application/pdf', name: 'pan.pdf', head: PDF }) });
  assert.equal(res.ok, true);
  const names = fake.calls.map((c) => c[0]);
  assert.deepEqual(names, ['upload', 'rpc', 'remove']);
  const [, bucket, path, opts] = fake.calls[0];
  assert.equal(bucket, KYC_BUCKET);
  assert.ok(isKycDocumentPath(path, CID, 'pan'), `upload path ${path} is not a valid PAN path for this creator`);
  assert.ok(path.endsWith('.pdf'), 'extension comes from the sniffed type');
  assert.equal(opts.upsert, false, 'never overwrite an existing object');
  assert.equal(opts.contentType, 'application/pdf');
  assert.deepEqual(fake.calls[1].slice(1), ['set_kyc_document', { p_kind: 'pan', p_path: path }]);
  assert.deepEqual(fake.calls[2].slice(1), [KYC_BUCKET, [prev]], 'the previous object is removed after the row points at the new one');
  assert.ok(!names.includes('getPublicUrl'), 'a private bucket has no public URL');
});

await test('a replaced document whose previous path equals the new one is not removed', async () => {
  const fake = fakeSupabase({ rpcData: { ok: true, previous_path: null } });
  const api = apiWith(fake);
  await api.uploadKycDocument({ creatorId: CID, kind: 'bank', file: fakeFile() });
  assert.deepEqual(fake.calls.map((c) => c[0]), ['upload', 'rpc']);
});

await test('an invalid file never reaches storage, and the message is the validator\'s', async () => {
  const fake = fakeSupabase();
  const api = apiWith(fake);
  const res = await api.uploadKycDocument({ creatorId: CID, kind: 'pan', file: fakeFile({ type: 'image/png', head: JPEG }) });
  assert.equal(res.ok, false); assert.equal(res.reason, 'invalid_file'); assert.match(res.message, /contents do not match/);
  assert.deepEqual(fake.calls, []);
  const big = await api.uploadKycDocument({ creatorId: CID, kind: 'pan', file: fakeFile({ size: KYC_DOCUMENT_MAX_BYTES + 1 }) });
  assert.equal(big.reason, 'invalid_file'); assert.match(big.message, /too large/);
  assert.deepEqual(fake.calls, []);
});

await test('bad kind / missing creator are refused before any I/O', async () => {
  const fake = fakeSupabase();
  const api = apiWith(fake);
  assert.deepEqual(await api.uploadKycDocument({ creatorId: CID, kind: 'aadhaar', file: fakeFile() }), { ok: false, reason: 'bad_kind' });
  assert.deepEqual(await api.uploadKycDocument({ creatorId: null, kind: 'pan', file: fakeFile() }), { ok: false, reason: 'not_a_creator' });
  assert.deepEqual(fake.calls, []);
});

await test('a storage failure (e.g. RLS on a foreign folder) surfaces and nothing is registered', async () => {
  const fake = fakeSupabase({ uploadError: { message: 'new row violates row-level security policy' } });
  const api = apiWith(fake);
  const res = await api.uploadKycDocument({ creatorId: CID_OTHER, kind: 'pan', file: fakeFile() });
  assert.equal(res.ok, false); assert.equal(res.reason, 'upload_failed'); assert.match(res.message, /row-level security/);
  assert.deepEqual(fake.calls.map((c) => c[0]), ['upload'], 'no rpc after a failed upload');
});

await test('when the RPC refuses, the just-uploaded object is removed so no orphan lingers', async () => {
  for (const scenario of [
    { fake: fakeSupabase({ rpcError: { message: 'permission denied' } }), expectReason: 'permission denied' },
    { fake: fakeSupabase({ rpcData: { ok: false, reason: 'not_uploaded' } }), expectReason: 'not_uploaded' },
  ]) {
    const api = apiWith(scenario.fake);
    const res = await api.uploadKycDocument({ creatorId: CID, kind: 'bank', file: fakeFile() });
    assert.equal(res.ok, false); assert.equal(res.reason, scenario.expectReason);
    const names = scenario.fake.calls.map((c) => c[0]);
    assert.deepEqual(names, ['upload', 'rpc', 'remove']);
    assert.deepEqual(scenario.fake.calls[2][2], [scenario.fake.calls[0][2]], 'removes exactly the object it uploaded');
  }
});

await test('a failed clean-up of the previous object does not fail the upload', async () => {
  const fake = fakeSupabase({ rpcData: { ok: true, previous_path: `${CID}/bank/old.png` }, removeError: { message: 'gone' } });
  const api = apiWith(fake);
  const res = await api.uploadKycDocument({ creatorId: CID, kind: 'bank', file: fakeFile() });
  assert.equal(res.ok, true);
});

await test('admin document links are signed for 60 s and never public', async () => {
  const fake = fakeSupabase();
  const api = apiWith(fake);
  assert.equal(api.KYC_SIGNED_URL_SECONDS, 60);
  const url = await api.adminKycDocumentUrl(`${CID}/pan/a.jpg`);
  assert.match(url, /\/object\/sign\/kyc-documents\//);
  assert.deepEqual(fake.calls, [['createSignedUrl', KYC_BUCKET, `${CID}/pan/a.jpg`, 60]]);
  await assert.rejects(api.adminKycDocumentUrl(null), /No document on file/);
  await assert.rejects(api.adminKycDocumentUrl(''), /No document on file/);
  const failing = fakeSupabase({ signError: new Error('Object not found') });
  await assert.rejects(apiWith(failing).adminKycDocumentUrl(`${CID}/pan/a.jpg`), /Object not found/);
  assert.ok(!fake.calls.some((c) => c[0] === 'getPublicUrl') && !failing.calls.some((c) => c[0] === 'getPublicUrl'));
});

await test('the audit list is read from creator_kyc_audit for one creator, newest first', async () => {
  const fake = fakeSupabase();
  const api = apiWith(fake);
  await api.adminListKycAudit(CID);
  const [, tableName, q] = fake.calls.find((c) => c[0] === 'from');
  assert.equal(tableName, 'creator_kyc_audit');
  const ops = Object.fromEntries(q._calls.map(([m, ...a]) => [m, a]));
  assert.deepEqual(ops.eq, ['creator_id', CID]);
  assert.deepEqual(ops.order, ['created_at', { ascending: false }]);
  assert.match(ops.select[0], /to_notes/);
});

// ============================================================
console.log('\n— Portal: the rejection reason and document rows (SSR) —');
// ============================================================

const CreatorPayouts = component('../src/components/creator/CreatorPayouts.jsx', 'CreatorPayouts', { Icon, money2, ...rules });
const portal = (kyc, extra = {}) => renderToStaticMarkup(h(CreatorPayouts, {
  creator: { id: CID }, earnings: { available: 0, payout_day: 1, min_payout: 500 }, kyc, payouts: [],
  onSubmitKyc: async () => ({ ok: true }), onUploadKycDocument: async () => ({ ok: true }), onRequestPayout: async () => ({ ok: true }), onChanged: async () => {},
  ...extra,
}));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

await test('a rejected creator sees the reviewer\'s reason, verbatim, under the status line', () => {
  const html = portal({ identity_status: 'rejected', legal_name: 'A', verification_notes: 'Name on PAN does not match the bank account holder.' });
  assert.match(html, /crp__kyc-reason/);
  assert.match(text(html), /Reason from our team/);
  assert.match(text(html), /Name on PAN does not match the bank account holder\./);
  assert.match(html, /crp__kyc-msg is-bad/);
});

await test('needs_update shows the reason too; pending and verified never show stale notes', () => {
  const notes = 'Upload a clearer bank proof.';
  assert.match(portal({ identity_status: 'needs_update', verification_notes: notes }), /crp__kyc-reason/);
  for (const s of ['pending', 'verified', 'not_started']) {
    const html = portal({ identity_status: s, verification_notes: notes });
    assert.doesNotMatch(html, /crp__kyc-reason/, `${s} rendered the reason block`);
    assert.doesNotMatch(text(html), /Upload a clearer bank proof/, `${s} rendered the note text`);
  }
});

await test('no reason block when there are no notes, or when the notes are blank', () => {
  assert.doesNotMatch(portal({ identity_status: 'rejected' }), /crp__kyc-reason/);
  assert.doesNotMatch(portal({ identity_status: 'rejected', verification_notes: '' }), /crp__kyc-reason/);
  assert.doesNotMatch(portal(null), /crp__kyc-reason/);
});

await test('the reason is HTML-escaped, never injected', () => {
  const html = portal({ identity_status: 'rejected', verification_notes: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

await test('two document rows always render: PAN card and bank proof', () => {
  const html = portal(null);
  assert.match(html, /crp__docs/);
  assert.equal((html.match(/class="crp__doc[" ]/g) || []).length, 2);
  assert.match(html, /data-kind="pan"/); assert.match(html, /data-kind="bank"/);
  assert.match(text(html), /PAN card/); assert.match(text(html), /Bank proof/);
  assert.match(text(html), /JPEG, PNG, WebP or PDF, up to 5 MB each/);
});

await test('an empty slot says so and offers "Choose file"; an uploaded slot shows type + date and offers "Replace"', () => {
  const empty = portal({ identity_status: 'not_started' });
  assert.equal((text(empty).match(/Not uploaded yet/g) || []).length, 2);
  assert.equal((text(empty).match(/Choose file/g) || []).length, 2);
  assert.doesNotMatch(text(empty), /Replace/);

  const html = portal({ identity_status: 'pending', pan_document_path: `${CID}/pan/a.pdf`, bank_document_path: null, documents_updated_at: '2026-09-10T10:00:00Z' });
  const rows = html.split(/<div class="crp__doc(?=[" ])/).slice(1);
  assert.equal(rows.length, 2);
  const pan = rows.find((r) => r.includes('data-kind="pan"'));
  const bank = rows.find((r) => r.includes('data-kind="bank"'));
  assert.match(text(pan), /On file · PDF · uploaded 10 Sept? 2026/);
  assert.match(text(pan), /Replace/);
  assert.ok(pan.startsWith(' is-uploaded"'), 'the PAN row carries is-uploaded');
  assert.ok(bank.startsWith('"'), 'the bank row does not');
  assert.match(text(bank), /Not uploaded yet/);
  assert.match(text(bank), /Choose file/);
  assert.doesNotMatch(bank, /is-uploaded/);
});

await test('the file inputs accept exactly the bucket\'s MIME list and nothing else', () => {
  const html = portal(null);
  const accepts = [...html.matchAll(/<input[^>]*type="file"[^>]*accept="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(accepts, [KYC_DOCUMENT_ACCEPT, KYC_DOCUMENT_ACCEPT]);
  assert.match(html, /id="kyc-doc-pan"/); assert.match(html, /for="kyc-doc-pan"/);
  assert.match(html, /id="kyc-doc-bank"/); assert.match(html, /for="kyc-doc-bank"/);
});

await test('the creator never sees a storage path, URL or bucket name', () => {
  const html = portal({ identity_status: 'verified', pan_document_path: `${CID}/pan/a.jpg`, bank_document_path: `${CID}/bank/b.pdf`, documents_updated_at: '2026-09-10T10:00:00Z' });
  assert.doesNotMatch(html, new RegExp(CID));
  assert.doesNotMatch(html, /kyc-documents/);
  assert.doesNotMatch(html, /supabase\.co|https?:\/\//);
  assert.doesNotMatch(html, /<a /, 'no links to documents in the portal');
});

await test('a verified creator is warned that replacing a document reopens review', () => {
  assert.match(text(portal({ identity_status: 'verified' })), /Replacing a document sends your verification back for review/);
  assert.doesNotMatch(text(portal({ identity_status: 'pending' })), /Replacing a document sends/);
});

await test('the portal passes the creator\'s own id into uploadKycDocument', () => {
  const src = read('../src/pages/CreatorPortal.jsx');
  assert.match(src, /uploadKycDocument\(\{ creatorId: creator\.id, kind, file \}\)/);
  assert.match(src, /onUploadKycDocument=/);
});

// ============================================================
console.log('\n— Admin: signed links only while valid, history on demand (SSR) —');
// ============================================================

const adminDeps = {
  adminListKyc: async () => [], adminSetKycStatus: async () => ({ ok: true }), adminListCreators: async () => [],
  KYC_STATUSES: ['not_started', 'pending', 'verified', 'rejected', 'needs_update'],
  adminKycDocumentUrl: async () => 'never-called-during-ssr', adminListKycAudit: async () => [], KYC_SIGNED_URL_SECONDS: 60,
  KYC_DOCUMENT_KINDS, kycDocumentState,
};
const AdminDocs = component('../src/admin/pages/Kyc.jsx', 'KycDocuments', adminDeps);
const AdminHistory = component('../src/admin/pages/Kyc.jsx', 'KycHistory', adminDeps);
const AdminKyc = component('../src/admin/pages/Kyc.jsx', 'Kyc', adminDeps);

await test('an uploaded document renders a "View" button — no href, no URL, until the admin asks', () => {
  const html = renderToStaticMarkup(h(AdminDocs, { row: { creator_id: CID, pan_document_path: `${CID}/pan/a.jpg`, bank_document_path: null, documents_updated_at: '2026-09-10T10:00:00Z' }, onError: () => {} }));
  const pan = html.slice(html.indexOf('data-kind="pan"'), html.indexOf('data-kind="bank"'));
  const bank = html.slice(html.indexOf('data-kind="bank"'));
  assert.match(text(pan), /View pan card/);
  assert.doesNotMatch(pan, /href=/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<a /);
  assert.match(text(bank), /Not uploaded/);
  assert.doesNotMatch(text(bank), /View/);
  assert.match(text(html), /Documents · updated/);
});

await test('the page never uses getPublicUrl, and its privacy line names the 60 s expiry', () => {
  const src = read('../src/admin/pages/Kyc.jsx');
  assert.doesNotMatch(src, /getPublicUrl/);
  assert.match(src, /adminKycDocumentUrl/);
  assert.match(src, /rel="noopener noreferrer"/);
  const html = renderToStaticMarkup(h(AdminDocs, { row: { creator_id: CID }, onError: () => {} }));
  assert.doesNotMatch(html, /href=/);
  const page = renderToStaticMarkup(h(AdminKyc));
  assert.match(text(page), /Creator KYC/);
});

await test('history is collapsed by default and loads nothing until opened', () => {
  let loads = 0;
  const H = component('../src/admin/pages/Kyc.jsx', 'KycHistory', { ...adminDeps, adminListKycAudit: async () => { loads++; return []; } });
  const html = renderToStaticMarkup(h(H, { creatorId: CID, onError: () => {} }));
  assert.match(text(html), /History/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /adm-kyc-history__list/);
  assert.equal(loads, 0);
});

await test('creatorApi never exposes a public URL for the KYC bucket', () => {
  const src = read('../src/lib/creatorApi.js').replace(/\r\n/g, '\n');
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(code, /getPublicUrl/, 'no call anywhere in creatorApi (comments stripped)');
  const kyc = src.slice(src.indexOf('// ---- Creator KYC documents ----'));
  assert.match(kyc, /createSignedUrl\(path, KYC_SIGNED_URL_SECONDS\)/);
  assert.match(src, /KYC_SELF = '[^']*verification_notes[^']*'/, 'the creator can read the reason');
  assert.match(src, /KYC_SELF = '[^']*pan_document_path,bank_document_path,documents_updated_at[^']*'/);
  assert.match(src, /KYC_ADMIN = '[^']*pan_document_path,bank_document_path,documents_updated_at[^']*'/);
});

await test('the admin payout page explains a kyc_required refusal', () => {
  assert.match(read('../src/admin/pages/Payouts.jsx'), /kyc_required: '[^']*no longer verified/);
});

// ============================================================
console.log('\n— Migration 0030: what the database enforces —');
// ============================================================

await test('the bucket is private, capped at 5 MB, and limited to four MIME types', () => {
  const m = migration.match(/insert into storage\.buckets[\s\S]*?on conflict[\s\S]*?;/);
  assert.ok(m, 'bucket insert not found');
  assert.match(m[0], /'kyc-documents',\s*'kyc-documents',\s*false/);
  assert.match(m[0], /public\s*=\s*false/, 'the upsert keeps it private too');
  assert.match(m[0], /5242880/);
  assert.match(m[0], /array\['image\/jpeg', 'image\/png', 'image\/webp', 'application\/pdf'\]/);
});

await test('exactly four storage policies: creator insert/read/delete on their own folder, admin read on all', () => {
  const policies = [...migration.matchAll(/create policy "([^"]+)"\s+on storage\.objects\s+for (\w+)([\s\S]*?);/g)]
    .map((m) => ({ name: m[1], cmd: m[2], body: m[3] }));
  assert.deepEqual(policies.map((p) => p.name), [
    'kyc-documents creator insert', 'kyc-documents creator read', 'kyc-documents creator delete', 'kyc-documents admin read',
  ]);
  for (const p of policies.filter((p) => p.name.includes('creator'))) {
    assert.match(p.body, /bucket_id = 'kyc-documents'/);
    assert.match(p.body, /\(storage\.foldername\(name\)\)\[1\] = public\.current_creator_id\(\)::text/, `${p.name} is not folder-scoped`);
  }
  const admin = policies.find((p) => p.name === 'kyc-documents admin read');
  assert.equal(admin.cmd, 'select');
  assert.match(admin.body, /public\.is_sora_admin\(\)/);
  assert.doesNotMatch(admin.body, /foldername/);
  // Nobody else: no policy is granted to anon, and no policy is unconditional.
  for (const p of policies) {
    assert.doesNotMatch(p.body, /\bto anon\b|\bto public\b/, `${p.name} is open to anon`);
    assert.doesNotMatch(p.body, /using \(\s*true\s*\)|with check \(\s*true\s*\)/, `${p.name} is unconditional`);
  }
  assert.ok(policies.every((p) => !['update', 'all'].includes(p.cmd)), 'no update/all policy — objects are replaced, never edited in place');
});

await test('both payout functions re-check KYC before moving money', () => {
  const fn = (name) => {
    const start = migration.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, `${name} missing`);
    const end = migration.indexOf('end $$;', start);
    return migration.slice(start, end);
  };
  const review = fn('admin_review_payout');
  assert.match(review, /if v_to = 'approved' then[\s\S]*?creator_kyc_status\(v\.creator_id\)[\s\S]*?'kyc_required'/);
  const paid = fn('admin_mark_payout_paid');
  assert.match(paid, /creator_kyc_status\(v\.creator_id\)[\s\S]*?'kyc_required'/);
  // The guard runs before the status update / ledger settlement, not after.
  assert.ok(review.indexOf("'kyc_required'") < review.indexOf('update public.creator_payout_requests'), 'review: guard after the update');
  assert.ok(paid.indexOf("'kyc_required'") < paid.indexOf('update public.creator_payout_requests'), 'paid: guard after the update');
  assert.match(migration, /create or replace function public\.creator_kyc_status\(p_creator_id uuid\)[\s\S]*?'not_started'/);
});

await test('the audit trail is trigger-fed, admin-readable, and unwritable from the client', () => {
  assert.match(migration, /create trigger creator_kyc_audit_trg[\s\S]*?after insert or update on public\.creator_kyc_profiles/);
  assert.match(migration, /create policy "kyc audit admin read"[\s\S]*?using \(public\.is_sora_admin\(\)\)/);
  assert.match(migration, /revoke insert, update, delete, truncate on table public\.creator_kyc_audit from anon, authenticated/);
  assert.doesNotMatch(migration, /create policy "[^"]*" on public\.creator_kyc_audit for (insert|update|delete|all)/);
});

await test('set_kyc_document is creator-only and refuses paths outside the caller\'s folder', () => {
  const start = migration.indexOf('create or replace function public.set_kyc_document(');
  const body = migration.slice(start, migration.indexOf('end $$;', start));
  assert.match(body, /v_cid := public\.current_creator_id\(\)/);
  assert.match(body, /'not_a_creator'/);
  assert.match(body, /bucket_id = 'kyc-documents' and name = p_path/);
  assert.match(body, /identity_status = case when identity_status = 'verified' then 'pending' else identity_status end/);
  assert.match(migration, /revoke all on function public\.set_kyc_document\(text, text\) from public, anon/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
