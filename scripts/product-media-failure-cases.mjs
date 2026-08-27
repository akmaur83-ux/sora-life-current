// Deterministic fault injection for the REAL importer handler and admin API.
// No remote fallback: every HTTP request is intercepted or fails this test.
import { readFileSync } from 'node:fs';
import handler from '../api/admin/import-media.js';
import { validateDownloadedImage } from '../api/_lib/ssrf.js';

const BASE = 'https://supabase.test';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const imageUrl = (n = 1) => `https://8.8.8.8/image-${n}.png`;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const copy = (data) => JSON.parse(JSON.stringify(data));
const seeded = (id, primary = true) => ({ id, product_id: 1, public_url: `/img/${id}.png`, storage_path: null, sort_order: 0, is_primary: primary });
async function thrown(fn) { try { await fn(); return null; } catch (error) { return error; } }

function fixture(options = {}) {
  const state = {
    rows: copy(options.initial || []), objects: new Set(options.objects || []), calls: [], unexpected: [],
    insertCount: 0, uploadCount: 0, removeCount: 0, selectCount: 0, syncCount: 0, requestedPrimaries: [],
    image: options.initial?.find((row) => row.is_primary)?.public_url || null,
  };
  const injected = (indices, count) => indices?.includes(count);
  async function fetchMock(raw, init = {}) {
    const url = new URL(raw), method = init.method || 'GET';
    const path = url.pathname;
    state.calls.push({ path, method });
    if (url.host === '8.8.8.8' && method === 'GET') {
      if (options.redirectPrivate) return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
      const headers = {};
      const type = options.contentType === undefined ? 'image/png' : options.contentType;
      if (type !== null) headers['Content-Type'] = type;
      if (options.contentLength !== undefined) headers['Content-Length'] = String(options.contentLength);
      return new Response(options.bytes || PNG, { headers });
    }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    if (url.origin === BASE) {
      if (path === '/rest/v1/rpc/rate_limit_check') return json({ allowed: true });
      if (path === '/auth/v1/user') return json({ id: 'test-admin' });
      if (path === '/rest/v1/admin_users') return json(options.notAdmin ? [] : [{ user_id: 'test-admin' }]);
      if (path.startsWith('/storage/v1/object/info/product-images/') && method === 'GET') {
        if (options.failObjectInfo) return json({ message: 'metadata unavailable' }, 503);
        const objectPath = path.slice('/storage/v1/object/info/product-images/'.length);
        return state.objects.has(objectPath) ? json({ name: objectPath }) : json({ code: 'NoSuchKey' }, options.missingObjectStatus || 404);
      }
      if (path.startsWith('/storage/v1/object/product-images/') && method === 'POST') {
        state.uploadCount++;
        const objectPath = path.slice('/storage/v1/object/product-images/'.length);
        if (injected(options.failUpload, state.uploadCount)) return json({ message: 'upload failed' }, 500);
        state.objects.add(objectPath);
        if (options.lostUploadResponse) throw new Error('upload response lost');
        return json({ Key: objectPath });
      }
      if (path === '/storage/v1/object/product-images' && method === 'DELETE') {
        state.removeCount++;
        if (state.removeCount <= (options.cleanupFailures || 0)) return json({ message: 'cleanup unavailable' }, 503);
        if (options.noopCleanup) return json([]);
        const removed = body.prefixes.filter((objectPath) => state.objects.delete(objectPath));
        return json(options.emptyCleanupResponse ? [] : removed.map((name) => ({ name })));
      }
      if (path === '/rest/v1/products') {
        if (method === 'GET') return json([{ id: 1 }]);
        if (method === 'PATCH') {
          state.syncCount++;
          if (options.failSync) return json({ message: 'sync unavailable' }, 500);
          if (options.emptySync) return json([]);
          if (!options.wrongSync) state.image = body.image_url;
          return json([{ id: 1, image_url: state.image }]);
        }
      }
      if (path === '/rest/v1/product_media') {
        const matches = (row) => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3));
        if (method === 'GET') {
          if (options.failRead || (options.failReconcile && url.searchParams.has('storage_path'))) return json({ message: 'read unavailable' }, 503);
          return json(state.rows.filter(matches).sort((a, b) => a.sort_order - b.sort_order));
        }
        if (method === 'POST') {
          state.insertCount++;
          state.requestedPrimaries.push(body.is_primary);
          if (injected(options.failInsert, state.insertCount)) return json({ message: 'insert failed' }, 500);
          const row = { id: `media-${state.insertCount}`, ...body };
          if (options.dropInsertedPrimary || injected(options.dropPrimaryAt, state.insertCount)) row.is_primary = false;
          if (row.is_primary) state.rows.filter((old) => old.product_id === row.product_id).forEach((old) => { old.is_primary = false; });
          state.rows.push(row);
          if (options.lostInsertResponse) throw new Error('insert response lost');
          return options.emptyInsertResponse ? json([]) : json([row]);
        }
        if (method === 'PATCH') {
          if (body.is_primary) {
            state.selectCount++;
            if (options.failSelect) return json({ message: 'selection unavailable' }, 500);
            if (options.emptySelect) return json([]);
          }
          if (body.storage_path && options.failReplace) return json({ message: 'replace failed' }, 500);
          if (body.sort_order !== undefined && options.failReorder) return json({ message: 'reorder failed' }, 500);
          const selected = state.rows.filter(matches);
          if (body.is_primary && selected.length) state.rows.forEach((row) => { row.is_primary = false; });
          selected.forEach((row) => Object.assign(row, body));
          return json(selected);
        }
        if (method === 'DELETE') {
          if (options.failDelete) return json({ message: 'delete failed' }, 500);
          const removed = state.rows.filter(matches);
          state.rows = state.rows.filter((row) => !matches(row));
          if (removed.some((row) => row.is_primary) && state.rows.length) {
            state.rows.sort((a, b) => a.sort_order - b.sort_order)[0].is_primary = true;
          }
          return json(removed);
        }
      }
    }
    state.unexpected.push(`${method} ${url.origin}${path}`);
    throw new Error('Unexpected request: ' + state.unexpected.at(-1));
  }
  const responseData = async (response) => {
    const data = await response.json();
    return { data: response.ok ? data : null, error: response.ok ? null : Object.assign(new Error(`Mock HTTP ${response.status}`), { status: response.status, code: data.code }) };
  };
  // Minimal Supabase query adapter: executes the admin's real query chains.
  const client = {
    from(table) {
      let method = 'GET', body, single = false, optional = false;
      const params = new URLSearchParams();
      const query = {
        select(fields = '*') { params.set('select', fields); return query; },
        eq(key, value) { params.set(key, 'eq.' + value); return query; },
        order() { return query; },
        insert(value) { method = 'POST'; body = value; return query; },
        update(value) { method = 'PATCH'; body = value; return query; },
        delete() { method = 'DELETE'; return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; optional = true; return query; },
        async then(resolve, reject) {
          try {
            const result = await responseData(await fetchMock(`${BASE}/rest/v1/${table}?${params}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }));
            if (single && !result.error) {
              if (result.data.length !== 1 && !(optional && result.data.length === 0)) result.error = new Error('Expected one row');
              result.data = result.data[0] || null;
            }
            return resolve(result);
          } catch (error) { return reject(error); }
        },
      };
      return query;
    },
    storage: { from: () => ({
      upload: async (path, file) => responseData(await fetchMock(`${BASE}/storage/v1/object/product-images/${path}`, { method: 'POST', body: file })),
      remove: async (paths) => responseData(await fetchMock(`${BASE}/storage/v1/object/product-images`, { method: 'DELETE', body: JSON.stringify({ prefixes: paths }) })),
      info: async (path) => responseData(await fetchMock(`${BASE}/storage/v1/object/info/product-images/${path}`)),
      getPublicUrl: (path) => ({ data: { publicUrl: `${BASE}/storage/v1/object/public/product-images/${path}` } }),
    }) },
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  };
  return { state, fetch: fetchMock, client };
}

export async function runMediaFailureTests(t) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { crypto: globalThis.crypto };
  const keys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
  const env = keys.map((key) => [key, process.env[key]]);
  process.env.VITE_SUPABASE_URL = BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'offline-test-service-key';
  process.env.SUPABASE_ANON_KEY = 'offline-test-anon-key';
  let current;
  const selectFixture = (options) => {
    current = fixture(options);
    globalThis.fetch = current.fetch;
    return current.state;
  };
  const noOrphans = (state) => [...state.objects].every((path) => state.rows.some((row) => row.storage_path === path));
  const exactlyOne = (state) => state.rows.filter((row) => row.is_primary).length === 1;
  const call = async (options = {}, request = {}) => {
    const state = selectFixture(options);
    const res = { statusCode: 200, data: null, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {} };
    await handler({ method: 'POST', headers: { authorization: 'Bearer test-token' }, body: { action: 'import', productId: 1, urls: [imageUrl()] }, ...request }, res);
    t(state.unexpected.length === 0, 'handler uses only mocked/expected requests', 'MOCK');
    return { state, ...res };
  };
  try {
    console.log('\n— Importer handler failures (mocked HTTP, real body contract) —');
    let result = await call({ failInsert: [1] });
    t(!result.data.ok && result.state.removeCount === 1 && result.state.objects.size === 0 && noOrphans(result.state), 'upload succeeds + DB insert fails -> Storage object cleaned, zero orphans', 'MOCK');
    result = await call({ failInsert: [1] }, { body: { action: 'import', productId: 1, urls: [imageUrl(1), imageUrl(2)] } });
    t(result.data.ok && result.data.imported.length === 1 && result.data.skipped.length === 1 && exactlyOne(result.state) && noOrphans(result.state), 'first import fails, later succeeds -> exactly one primary and zero orphans', 'MOCK');
    t(result.state.image === result.state.rows[0].public_url && result.data.primaryCount === 1, 'partial import synchronizes the confirmed primary URL', 'MOCK');
    t(result.state.requestedPrimaries.join(',') === 'true,true', 'failed insert does not advance madePrimary', 'MOCK');
    result = await call({ dropPrimaryAt: [1] }, { body: { action: 'import', productId: 1, urls: [imageUrl(1), imageUrl(2), imageUrl(3)] } });
    t(result.data.ok && result.state.requestedPrimaries.join(',') === 'true,true,false' && exactlyOne(result.state), 'madePrimary advances only after a created row confirms is_primary', 'MOCK');
    result = await call({ initial: [seeded('existing')] });
    t(result.data.ok && result.state.rows.find((row) => row.id === 'existing').is_primary && !result.data.imported[0].isPrimary, 'import preserves an existing primary', 'MOCK');
    result = await call({ dropInsertedPrimary: true, failSelect: true });
    t(!result.data.ok && result.statusCode === 502 && result.data.primaryError && result.state.selectCount === 1 && noOrphans(result.state), 'primary-selection failure cannot report success', 'MOCK');
    result = await call({ dropInsertedPrimary: true, emptySelect: true });
    t(!result.data.ok && result.data.primaryError, 'zero-row primary selection is a failure', 'MOCK');
    result = await call({ dropInsertedPrimary: true });
    t(result.data.ok && exactlyOne(result.state) && result.state.selectCount === 1, 'missing primary is repaired and verified', 'MOCK');
    for (const option of ['failSync', 'emptySync', 'wrongSync']) {
      result = await call({ [option]: true });
      t(!result.data.ok && result.statusCode === 502 && result.data.syncError && exactlyOne(result.state) && noOrphans(result.state), `${option}: sync failure surfaced, media retained as authority`, 'MOCK');
    }
    for (const option of ['lostInsertResponse', 'emptyInsertResponse']) {
      result = await call({ [option]: true });
      t(result.data.ok && result.state.removeCount === 0 && noOrphans(result.state), `${option}: committed row reconciled without deleting its image`, 'MOCK');
    }
    result = await call({ lostUploadResponse: true });
    t(!result.data.ok && result.state.objects.size === 0 && result.state.removeCount === 1, 'lost upload response -> generated path cleaned', 'MOCK');
    result = await call({ failInsert: [1], cleanupFailures: 2 });
    t(!result.data.ok && result.state.removeCount === 3 && noOrphans(result.state), 'transient cleanup failures retried -> zero orphans', 'MOCK');
    for (const missingObjectStatus of [400, 404]) {
      result = await call({ failInsert: [1], emptyCleanupResponse: true, missingObjectStatus });
      t(!result.data.ok && result.data.cleanupPending.length === 0 && noOrphans(result.state) && result.state.calls.some((entry) => entry.path.includes('/object/info/')), `empty delete response + confirmed absence (${missingObjectStatus}) -> clean failure without orphan`, 'MOCK');
    }
    result = await call({ failInsert: [1], noopCleanup: true });
    t(!result.data.ok && result.data.cleanupPending.length === 1 && result.state.removeCount === 3 && result.state.objects.size === 1, 'HTTP 200 empty delete with object still present is not treated as successful cleanup', 'MOCK');
    result = await call({ failInsert: [1], emptyCleanupResponse: true, failObjectInfo: true });
    t(!result.data.ok && result.data.cleanupPending.length === 1 && result.state.objects.size === 0, 'unavailable cleanup confirmation is explicit even when deletion may have completed', 'MOCK');
    result = await call({ failInsert: [2], cleanupFailures: 99 }, { body: { action: 'import', productId: 1, urls: [imageUrl(1), imageUrl(2), imageUrl(3)] } });
    t(!result.data.ok && result.statusCode === 502 && result.data.imported.length === 1 && result.data.cleanupPending.length === 1 && result.data.skipped.length === 2 && exactlyOne(result.state), 'partial success cannot hide unresolved cleanup; successful primary is still verified', 'MOCK');
    result = await call({ failInsert: [1], cleanupFailures: 99 }, { body: { action: 'import', productId: 1, urls: [imageUrl(1), imageUrl(2)] } });
    t(!result.data.ok && result.data.cleanupPending.length === 1 && result.state.uploadCount === 1 && result.state.removeCount === 3, 'persistent Storage outage -> explicit unresolved path, batch stops, never false success', 'MOCK');
    result = await call({ failInsert: [1], failReconcile: true });
    t(!result.data.ok && result.data.cleanupPending.length === 1, 'unconfirmed insert reconciliation is explicit, not silently successful', 'MOCK');
    result = await call({ failRead: true });
    t(!result.data.ok && result.state.uploadCount === 0, 'failed initial media read aborts before uploading', 'MOCK');
    for (const contentType of [null, '', 'text/html', 'application/octet-stream', 'image/svg+xml', 'image/heic', 'image/jpeg']) {
      result = await call({ contentType });
      t(!result.data.ok && result.state.uploadCount === 0 && noOrphans(result.state), `Content-Type ${String(contentType)} rejected for PNG bytes before upload`, 'MOCK');
    }
    result = await call({ contentType: 'image/png', bytes: JPEG });
    t(!result.data.ok && result.state.uploadCount === 0, 'PNG Content-Type with JPEG magic rejected', 'MOCK');
    for (const bytes of [Buffer.from('<html>not an image</html>'), Buffer.alloc(0), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])]) {
      result = await call({ contentType: 'image/png', bytes });
      t(!result.data.ok && result.state.uploadCount === 0 && noOrphans(result.state), 'non-image/empty/incomplete PNG signature rejected before Storage upload', 'MOCK');
    }
    const oversized = Buffer.concat([PNG, Buffer.alloc(8 * 1024 * 1024 + 1 - PNG.length)]);
    for (const options of [{ contentLength: oversized.length }, { bytes: oversized }, { bytes: oversized, contentLength: 12 }]) {
      result = await call(options);
      t(!result.data.ok && result.state.uploadCount === 0 && /8MB/.test(result.data.skipped[0].reason) && noOrphans(result.state), 'oversized response rejected (declared size, stream cap, or lying size)', 'MOCK');
    }
    const heif = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from('ftypmif1'), Buffer.alloc(4), Buffer.from('heic')]);
    result = await call({ contentType: 'image/avif', bytes: heif });
    t(!result.data.ok && result.state.uploadCount === 0, 'generic HEIF container is not misidentified as supported AVIF', 'MOCK');
    result = await call({ contentType: 'Image/PNG; charset=binary' });
    t(result.data.ok, 'matching supported Content-Type accepts case/parameters', 'MOCK');
    result = await call({}, { body: { productId: 1, urls: [imageUrl()] }, query: { action: 'import' } });
    t(result.statusCode === 400 && result.state.uploadCount === 0, 'query action does not substitute for required JSON-body action', 'MOCK');
    result = await call({}, { body: JSON.stringify({ action: 'import', productId: 1, urls: [imageUrl()] }) });
    t(result.data.ok, 'serialized JSON-body action uses the real handler contract', 'MOCK');
    result = await call({}, { headers: {} });
    t(result.statusCode === 401 && result.state.uploadCount === 0, 'anonymous importer blocked before any upload', 'MOCK');
    result = await call({ notAdmin: true });
    t(result.statusCode === 401 && result.state.uploadCount === 0, 'non-admin importer blocked', 'MOCK');
    result = await call({ redirectPrivate: true });
    t(!result.data.ok && result.state.uploadCount === 0 && result.state.calls.every((entry) => entry.path !== '/private'), 'redirect to private IP rejected before fetch/upload', 'MOCK');

    console.log('\n— Admin API + staged failure paths (mocked Supabase) —');
    // Only the dependency boundary is replaced; execute the unmodified admin
    // API functions from disk, including their real Supabase query chains.
    globalThis.__productMediaTestClient = {
      from: (...args) => current.client.from(...args),
      storage: { from: (...args) => current.client.storage.from(...args) },
      auth: { getSession: (...args) => current.client.auth.getSession(...args) },
    };
    const operationsUrl = new URL('../src/lib/productMediaOperations.js', import.meta.url).href;
    const source = readFileSync(new URL('../src/lib/adminApi.js', import.meta.url), 'utf8')
      .replace("import { supabase } from './supabase.js';", 'const supabase = globalThis.__productMediaTestClient;')
      .replace("import { BIOSASH_PRODUCTS } from '../data/biosash.js';", 'const BIOSASH_PRODUCTS = [];')
      .replace("'./productMediaOperations.js'", JSON.stringify(operationsUrl));
    const api = await import('data:text/javascript;base64,' + Buffer.from(source + '\n//# sourceURL=adminApi.mock.js').toString('base64'));
    const staged = (preferred = 0) => [0, 1, 2].map((n) => ({ file: { name: `image-${n}.png`, type: 'image/png', size: PNG.length }, isPrimary: n === preferred }));
    let state = selectFixture({ failUpload: [1], failInsert: [1] });
    let committed = await api.adminCommitStagedProductMedia(1, staged());
    t(!committed.ok && committed.created.length === 1 && committed.failed.length === 2 && !committed.primaryError && !committed.syncError && exactlyOne(state) && noOrphans(state), 'staged partial upload/insert failures -> structured result, later success primary, zero orphans', 'MOCK');
    t(committed.primaryCount === 1 && state.requestedPrimaries.join(',') === 'true,true', 'staged madePrimary is not advanced by a failed row insert', 'MOCK');
    state = selectFixture({ dropPrimaryAt: [1] });
    committed = await api.adminCommitStagedProductMedia(1, staged());
    t(committed.ok && committed.primaryCount === 1 && state.requestedPrimaries.join(',') === 'true,true,false' && exactlyOne(state), 'staged primary state advances only on confirmed primary creation', 'MOCK');
    state = selectFixture({ failSelect: true });
    committed = await api.adminCommitStagedProductMedia(1, staged(2));
    t(!committed.ok && committed.primaryError && exactlyOne(state) && state.rows[0].is_primary && state.image === state.rows[0].public_url, 'staged preferred-selection failure surfaced; fallback primary still valid and synchronized', 'MOCK');
    state = selectFixture({ failSync: true });
    committed = await api.adminCommitStagedProductMedia(1, staged(2));
    t(!committed.ok && committed.syncError && committed.created.length === 3 && exactlyOne(state) && noOrphans(state), 'staged image_url sync failure is structured, not swallowed', 'MOCK');
    state = selectFixture({ failInsert: [1], cleanupFailures: 99 });
    committed = await api.adminCommitStagedProductMedia(1, staged());
    t(!committed.ok && committed.cleanupPending.length === 1 && committed.failed.length === 3 && state.uploadCount === 1, 'staged unresolved cleanup stops batch and accounts for unattempted items', 'MOCK');
    state = selectFixture({ failInsert: [2], cleanupFailures: 99 });
    committed = await api.adminCommitStagedProductMedia(1, staged());
    t(!committed.ok && committed.cleanupPending.length === 1 && committed.created.length === 1 && committed.failed.length === 2 && committed.primaryCount === 1, 'staged successful item cannot mask unresolved cleanup later in the batch', 'MOCK');
    state = selectFixture({ failUpload: [1, 2, 3] });
    committed = await api.adminCommitStagedProductMedia(1, staged());
    t(!committed.ok && committed.created.length === 0 && committed.failed.length === 3 && committed.cleanupPending.length === 0 && noOrphans(state), 'all staged uploads fail -> structured failure, no rows or orphans', 'MOCK');
    state = selectFixture({ initial: [seeded('old')] });
    committed = await api.adminCommitStagedProductMedia(1, staged().map((item) => ({ ...item, isPrimary: false })));
    t(committed.ok && state.rows[0].is_primary && exactlyOne(state) && noOrphans(state), 'live multi-upload does not steal existing primary', 'MOCK');
    state = selectFixture({ initial: [seeded('old'), seeded('next', false)], failSelect: true });
    let error = await thrown(() => api.adminSetPrimaryMedia(1, 'next'));
    t(error?.primaryError && exactlyOne(state) && state.image === '/img/old.png', 'admin selection error thrown; optimistic image never synchronized', 'MOCK');
    state = selectFixture({ initial: [seeded('old'), seeded('next', false)], failSync: true });
    error = await thrown(() => api.adminSetPrimaryMedia(1, 'next'));
    t(error?.syncError && state.rows[1].is_primary && exactlyOne(state), 'admin set-primary throws if required product sync fails', 'MOCK');
    state = selectFixture({ initial: [seeded('old'), seeded('next', false)] });
    await api.adminDeleteProductMedia(1, 'old');
    t(exactlyOne(state) && state.rows[0].id === 'next' && state.image === '/img/next.png', 'delete-primary auto-promotion verified and synchronized', 'MOCK');
    state = selectFixture({ initial: [seeded('last')] });
    await api.adminDeleteProductMedia(1, 'last');
    t(state.rows.length === 0 && state.image === null, 'deleting final media clears image_url intentionally', 'MOCK');
    state = selectFixture({ initial: [seeded('old'), seeded('next', false)], failSync: true });
    error = await thrown(() => api.adminDeleteProductMedia(1, 'old'));
    t(error?.syncError && exactlyOne(state), 'delete-primary sync failure is surfaced while promoted row remains authoritative', 'MOCK');
    state = selectFixture({ initial: [seeded('old')], failRead: true });
    error = await thrown(() => api.adminDeleteProductMedia(1, 'old'));
    t(error && state.rows.length === 1, 'failed delete ownership read is not a successful no-op', 'MOCK');
    const owned = { ...seeded('owned'), storage_path: 'products/old.png' };
    state = selectFixture({ initial: [owned], objects: ['products/old.png'], failReplace: true });
    error = await thrown(() => api.adminReplaceProductMedia(1, 'owned', staged()[0].file));
    t(error && state.objects.size === 1 && state.objects.has('products/old.png') && noOrphans(state), 'replacement DB failure cleans new object and preserves existing media', 'MOCK');
    state = selectFixture({ initial: [owned], objects: ['products/old.png'] });
    await api.adminReplaceProductMedia(1, 'owned', staged()[0].file);
    t(!state.objects.has('products/old.png') && noOrphans(state) && state.image === state.rows[0].public_url, 'replacement cleans old object and verifies primary sync', 'MOCK');
    state = selectFixture({ initial: [owned], objects: ['products/old.png'], emptyCleanupResponse: true });
    await api.adminDeleteProductMedia(1, 'owned');
    t(noOrphans(state) && state.image === null && state.calls.some((entry) => entry.path.includes('/object/info/')), 'admin empty deletion response verified using authenticated Storage metadata', 'MOCK');
    state = selectFixture({ initial: [owned], objects: ['products/old.png'], noopCleanup: true });
    error = await thrown(() => api.adminDeleteProductMedia(1, 'owned'));
    t(error?.cleanupPending?.[0] === 'products/old.png' && state.removeCount === 3 && state.image === null, 'admin no-op deletion cannot silently report cleanup success', 'MOCK');
    state = selectFixture({ initial: [owned], objects: ['products/old.png'], emptyCleanupResponse: true, failObjectInfo: true });
    error = await thrown(() => api.adminDeleteProductMedia(1, 'owned'));
    t(error?.cleanupPending?.[0] === 'products/old.png' && state.image === null, 'admin unavailable cleanup verification is an explicit failure', 'MOCK');
    state = selectFixture({ initial: [owned], objects: ['products/old.png'], cleanupFailures: 99 });
    error = await thrown(() => api.adminDeleteProductMedia(1, 'owned'));
    t(error?.cleanupPending?.[0] === 'products/old.png' && state.image === null, 'delete cleanup failure reported without skipping required primary sync', 'MOCK');
    state = selectFixture({ initial: [seeded('one')], failReorder: true });
    error = await thrown(() => api.adminReorderProductMedia(1, ['one']));
    t(!!error, 'Supabase returned reorder error is not ignored', 'MOCK');
    state = selectFixture({ initial: [seeded('one')] });
    error = await thrown(() => api.adminSetPrimaryMedia(2, 'one'));
    t(error && state.rows[0].is_primary && state.syncCount === 0, 'foreign product primary selection cannot update or sync', 'MOCK');
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      t(body.action === 'import' && body.productId === 1, 'admin client sends action in JSON body', 'MOCK');
      return json({ ok: false, imported: [{ id: 'saved' }], primaryError: 'selection failed', error: 'Primary failed' }, 502);
    };
    error = await thrown(() => api.adminImportMedia(1, [imageUrl()]));
    t(error?.details?.imported?.length === 1 && error.details.primaryError, 'admin importer preserves partial failure details', 'MOCK');
    t(validateDownloadedImage({ contentType: 'image/jpeg', buffer: JPEG }) === 'image/jpeg', 'matching JPEG MIME + bytes accepted', 'MOCK');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    delete globalThis.__productMediaTestClient;
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
