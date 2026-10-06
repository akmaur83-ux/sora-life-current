// ============================================================
// Store catalogue admin — the offline harness.
//
// Three pieces, shared by the catalogue admin suites and the static render:
//
//   1. loadCatalogueAdmin()  the REAL rules module, API module and page,
//      compiled in memory (the babel loader the SSR harnesses use) with a
//      fake Supabase client injected where the browser client would be.
//   2. createCatalogueDb()   an in-memory stand-in for PostgREST over the
//      four catalogue tables: the constraints, triggers and row-level
//      security of migrations 0033–0035, as the client experiences them —
//      an RLS-refused INSERT is error 42501, an RLS-filtered UPDATE or
//      DELETE matches zero rows and reports no error, exactly as PostgREST
//      does. Nothing here talks to a network.
//   3. mount()               a minimal hook runtime (useState / useEffect /
//      useRef / useMemo / useCallback) that expands the page into plain host
//      elements, so a test can type, click and submit, and the settled tree
//      renders with react-dom/server for the screenshots.
//
// CATALOGUE_SRC_ROOT points the loader at another checkout — the suites run
// against the pre-change tree to prove they are not vacuous.
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { transformSync } from '@babel/core';

export const ROOT = process.env.CATALOGUE_SRC_ROOT
  ? resolve(process.env.CATALOGUE_SRC_ROOT)
  : resolve(fileURLToPath(new URL('..', import.meta.url)));
export const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const has = (rel) => existsSync(resolve(ROOT, rel));
export const h = React.createElement;
const importSrc = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

/** Every export of a module, compiled in memory with `deps` in scope (imports removed). */
export function loadModule(rel, deps = {}) {
  const names = [];
  const { code } = transformSync(read(rel), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportAllDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) {
        const d = path.node.declaration;
        if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) { names.push(['default', d.id.name]); path.replaceWith(d); }
        else { names.push(['default', '__default__']); path.replaceWith({ type: 'VariableDeclaration', kind: 'const', declarations: [{ type: 'VariableDeclarator', id: { type: 'Identifier', name: '__default__' }, init: d }] }); }
      },
      ExportNamedDeclaration(path) {
        const d = path.node.declaration;
        if (d) {
          if (d.type === 'VariableDeclaration') for (const x of d.declarations) names.push([x.id.name, x.id.name]);
          else names.push([d.id.name, d.id.name]);
          path.replaceWith(d);
        } else { for (const s of path.node.specifiers) names.push([s.exported.name, s.local.name]); path.remove(); }
      },
    } })],
  });
  const scope = { React, ...React, ...hooks, ...deps };
  const body = `${code}\n; return { ${names.map(([e, l]) => `${JSON.stringify(e)}: ${l}`).join(', ')} };`;
  return new Function(...Object.keys(scope), body)(...Object.values(scope));
}

// ---- 2. The catalogue database -------------------------------------------------------
const STORES = ['fashion', 'grocery', 'homeliving'];
const ADMIN_TABLES = ['catalogue_categories', 'catalogue_products', 'catalogue_variants', 'catalogue_product_media'];
const same = (a, b) => a === b || (a != null && b != null && String(a) === String(b));
const clone = (v) => structuredClone(v);
const err = (code, message, details = null) => ({ code, message, details, hint: null });

/**
 * rows: { catalogue_categories: [...], ... }. `session.admin` decides every
 * RLS predicate (each catalogue policy is "auth.uid() in admin_users").
 */
export function createCatalogueDb(rows = {}, { admin = true } = {}) {
  const db = Object.fromEntries(ADMIN_TABLES.map((t) => [t, clone(rows[t] || [])]));
  const session = { admin };
  const log = [];
  const storage = { objects: new Map(), uploads: [] };
  let clock = 0, serial = 0;
  const stamp = () => `2026-10-06T00:00:${String(Math.floor(clock / 1000) % 60).padStart(2, '0')}.${String(++clock % 1000000).padStart(6, '0')}+00:00`;
  const newId = (table) => `${table.replace('catalogue_', '').slice(0, 3)}-${++serial}`;
  for (const t of ADMIN_TABLES) for (const row of db[t]) { row.updated_at ??= stamp(); row.created_at ??= row.updated_at; }

  // ---- RLS, from 0034 §6 and §8 ----
  const visible = (table, row) => session.admin || (table === 'catalogue_product_media' ? true : row.is_active === true);

  // ---- constraints (names as the database gives them) ----
  function check(table, row, id) {
    const others = db[table].filter((r) => r.id !== id);
    if (table === 'catalogue_products') {
      if (!String(row.name || '').trim()) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_name_check"');
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug || '')) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_slug_check"');
      if (!(Number(row.mrp) >= 0)) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_mrp_check"');
      if (row.sale_price != null && !(Number(row.sale_price) >= 0 && Number(row.sale_price) <= Number(row.mrp))) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_sale_price_check"');
      if (row.sku != null && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(row.sku)) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_sku_chk"');
      if (row.hsn_code != null && !/^[0-9]{4}([0-9]{2}){0,2}$/.test(row.hsn_code)) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_hsn_code_chk"');
      if (row.gst_rate != null && !(Number(row.gst_rate) >= 0 && Number(row.gst_rate) <= 100)) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_gst_rate_chk"');
      if (!(Number(row.stock) >= 0)) return err('23514', 'new row for relation "catalogue_products" violates check constraint "catalogue_products_stock_chk"');
      if (others.some((r) => r.store === row.store && r.slug === row.slug)) return err('23505', 'duplicate key value violates unique constraint "catalogue_products_store_slug_key"', `Key (store, slug)=(${row.store}, ${row.slug}) already exists.`);
      if (row.sku != null && others.some((r) => r.store === row.store && r.sku === row.sku)) return err('23505', 'duplicate key value violates unique constraint "catalogue_products_store_sku_key"');
      const cat = db.catalogue_categories.find((c) => c.id === row.category_id);
      if (row.category_id && cat && cat.store !== row.store) return err('P0001', `catalogue_products: "${row.name}" is in the ${row.store} store but its category is in the ${cat.store} store`);
    }
    if (table === 'catalogue_categories') {
      if (!String(row.name || '').trim()) return err('23514', 'new row for relation "catalogue_categories" violates check constraint "catalogue_categories_name_check"');
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug || '')) return err('23514', 'new row for relation "catalogue_categories" violates check constraint "catalogue_categories_slug_check"');
      if (others.some((r) => r.store === row.store && (r.parent_id || null) === (row.parent_id || null) && r.slug === row.slug)) return err('23505', 'duplicate key value violates unique constraint "catalogue_categories_store_parent_slug_key"');
    }
    if (table === 'catalogue_variants') {
      if (!String(row.size || '').trim()) return err('23514', 'new row for relation "catalogue_variants" violates check constraint "catalogue_variants_size_check"');
      if (row.store === 'fashion' && !String(row.colour || '').trim()) return err('23514', 'new row for relation "catalogue_variants" violates check constraint "catalogue_variants_colour_chk"');
      if (!(Number(row.stock) >= 0)) return err('23514', 'new row for relation "catalogue_variants" violates check constraint "catalogue_variants_stock_check"');
      if (row.sku != null && others.some((r) => r.sku === row.sku)) return err('23505', 'duplicate key value violates unique constraint "catalogue_variants_sku_key"');
      if (others.some((r) => r.product_id === row.product_id && r.size === row.size && (r.colour || '') === (row.colour || ''))) return err('23505', 'duplicate key value violates unique constraint "catalogue_variants_product_id_size_colour_key"');
      const product = db.catalogue_products.find((p) => p.id === row.product_id);
      if (!product) return err('23503', 'insert or update on table "catalogue_variants" violates foreign key constraint "catalogue_variants_product_id_fkey"');
      if (product.store !== row.store) return err('P0001', `catalogue_variants: variant ${row.sku || row.size} is in the ${row.store} store but its product is in the ${product.store} store`);
    }
    if (table === 'catalogue_product_media') {
      if (!db.catalogue_products.some((p) => p.id === row.product_id)) return err('23503', 'insert or update on table "catalogue_product_media" violates foreign key constraint "catalogue_product_media_product_id_fkey"');
      if (!String(row.public_url || '').trim()) return err('23514', 'new row for relation "catalogue_product_media" violates check constraint "catalogue_product_media_public_url_check"');
    }
    return null;
  }

  // ---- triggers ----
  function syncImages(productId) {
    const product = db.catalogue_products.find((p) => p.id === productId);
    if (!product) return;
    const media = db.catalogue_product_media.filter((m) => m.product_id === productId)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)));
    product.images = media.map((m) => m.public_url);
    product.updated_at = stamp();          // the products touch trigger fires on the cache write
  }
  function demoteSiblings(row) {
    if (!row.is_primary) return;
    for (const m of db.catalogue_product_media) if (m.product_id === row.product_id && m.id !== row.id && m.is_primary) { m.is_primary = false; m.updated_at = stamp(); }
  }
  const DEFAULTS = {
    catalogue_categories: { parent_id: null, tagline: '', image_url: null, sort_order: 0, is_active: true, is_demo: false },
    catalogue_products: { brand: '', description: null, category_id: null, sale_price: null, images: [], rating: 0, review_count: 0, is_active: true, is_new: false, is_bestseller: false, sort_order: 0, is_demo: false, sku: null, hsn_code: null, gst_rate: null, net_content: null, stock: 0 },
    catalogue_variants: { colour: '', colour_hex: null, sku: null, stock: 0, price_override: null, is_active: true, sort_order: 0, is_demo: false },
    catalogue_product_media: { storage_path: null, alt_text: '', sort_order: 0, is_primary: false },
  };
  const derive = (table, row) => {
    if (table === 'catalogue_products') {
      const mrp = Number(row.mrp), sale = row.sale_price == null ? null : Number(row.sale_price);
      row.discount_percent = mrp > 0 && sale != null && sale < mrp ? Math.round(((mrp - sale) / mrp) * 100) : 0;
    }
    return row;
  };

  function embed(table, row, columns) {
    const out = clone(row);
    if (table === 'catalogue_products' && /variants:catalogue_variants/.test(columns)) {
      out.variants = clone(db.catalogue_variants.filter((v) => v.product_id === row.id && visible('catalogue_variants', v)).sort((a, b) => a.sort_order - b.sort_order));
    }
    if (table === 'catalogue_products' && /media:catalogue_product_media/.test(columns)) {
      out.media = clone(db.catalogue_product_media.filter((m) => m.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order));
    }
    return out;
  }

  function execute(q) {
    log.push({ table: q.table, action: q.action, ops: q.ops, payload: q.payload });
    const table = db[q.table];
    if (!table) return { data: null, error: err('42P01', `relation "public.${q.table}" does not exist`) };
    const match = (row) => q.filters.every((f) => f(row));
    let data;
    if (q.action === 'select') {
      data = table.filter((row) => visible(q.table, row) && match(row)).map((row) => embed(q.table, row, q.columns));
      if (q.orderBy.length) data.sort((a, b) => { for (const [k, asc] of q.orderBy) { const x = a[k], y = b[k]; if (x === y) continue; return (x > y ? 1 : -1) * (asc ? 1 : -1); } return 0; });
    } else if (q.action === 'insert') {
      if (!session.admin) return { data: null, error: err('42501', `new row violates row-level security policy for table "${q.table}"`) };
      const created = [];
      for (const input of [].concat(q.payload)) {
        const now = stamp();
        const row = derive(q.table, { ...DEFAULTS[q.table], id: input.id || newId(q.table), ...clone(input), created_at: now, updated_at: now });
        if (row.store && !STORES.includes(row.store)) return { data: null, error: err('23514', `new row for relation "${q.table}" violates check constraint "${q.table}_store_chk"`) };
        const problem = check(q.table, row, row.id);
        if (problem) return { data: null, error: problem };
        if (q.table === 'catalogue_product_media') demoteSiblings(row);
        table.push(row); created.push(row);
        if (q.table === 'catalogue_product_media') syncImages(row.product_id);
      }
      data = created.map((row) => embed(q.table, row, ''));
    } else if (q.action === 'update') {
      // RLS USING: a non-admin's UPDATE sees no rows, so it changes nothing and reports no error.
      const targets = table.filter((row) => session.admin && match(row));
      const updated = [];
      for (const row of targets) {
        if ('store' in q.payload && q.payload.store !== row.store) return { data: null, error: err('P0001', `${q.table}: store is set when a row is created and cannot change`) };
        const next = derive(q.table, { ...row, ...clone(q.payload), updated_at: stamp() });
        const problem = check(q.table, next, row.id);
        if (problem) return { data: null, error: problem };
        if (q.table === 'catalogue_product_media') demoteSiblings(next);
        Object.assign(row, next); updated.push(row);
        if (q.table === 'catalogue_product_media') syncImages(row.product_id);
      }
      data = updated.map((row) => embed(q.table, row, ''));
    } else if (q.action === 'delete') {
      const targets = table.filter((row) => session.admin && match(row));
      if (q.table === 'catalogue_categories') {
        const ids = new Set(targets.map((r) => r.id));
        if (table.some((c) => c.parent_id && ids.has(c.parent_id) && !ids.has(c.id))) {
          return { data: null, error: err('23503', 'update or delete on table "catalogue_categories" violates foreign key constraint "catalogue_categories_parent_id_fkey" on table "catalogue_categories"') };
        }
        for (const p of db.catalogue_products) if (ids.has(p.category_id)) { p.category_id = null; p.updated_at = stamp(); }   // on delete set null
      }
      db[q.table] = table.filter((row) => !targets.includes(row));
      if (q.table === 'catalogue_products') {
        const ids = new Set(targets.map((r) => r.id));
        db.catalogue_variants = db.catalogue_variants.filter((v) => !ids.has(v.product_id));          // on delete cascade
        db.catalogue_product_media = db.catalogue_product_media.filter((m) => !ids.has(m.product_id));  // on delete cascade
      }
      if (q.table === 'catalogue_product_media') {
        for (const gone of targets) {
          if (gone.is_primary) {
            const next = db.catalogue_product_media.filter((m) => m.product_id === gone.product_id).sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)))[0];
            if (next) { next.is_primary = true; next.updated_at = stamp(); }
          }
          syncImages(gone.product_id);
        }
      }
      data = targets.map((row) => clone(row));
    }
    if (q.limitN != null) data = data.slice(0, q.limitN);
    if (q.rangeArgs) data = data.slice(q.rangeArgs[0], q.rangeArgs[1] + 1);
    if (q.action !== 'select' && !q.returning) data = null;
    if (q.mode === 'single') {
      if (!data || data.length !== 1) return { data: null, error: err('PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${data ? data.length : 0} rows`) };
      return { data: data[0], error: null };
    }
    if (q.mode === 'maybe') {
      if (data && data.length > 1) return { data: null, error: err('PGRST116', 'JSON object requested, multiple (or no) rows returned') };
      return { data: data?.[0] ?? null, error: null };
    }
    return { data, error: null };
  }

  class Query {
    constructor(table) { Object.assign(this, { table, action: 'select', columns: '*', filters: [], ops: [], orderBy: [], limitN: null, rangeArgs: null, mode: 'many', returning: false, payload: null }); }
    select(columns = '*') { if (this.action === 'select') this.columns = columns; else this.returning = columns; this.ops.push(['select', columns]); return this; }
    insert(rows) { this.action = 'insert'; this.payload = rows; this.ops.push(['insert', rows]); return this; }
    update(patch) { this.action = 'update'; this.payload = patch; this.ops.push(['update', patch]); return this; }
    delete() { this.action = 'delete'; this.ops.push(['delete']); return this; }
    upsert(rows) { this.ops.push(['upsert', rows]); throw new Error('upsert is not used by the catalogue admin'); }
    eq(key, value) { this.ops.push(['eq', key, value]); this.filters.push((row) => same(row[key], value)); return this; }
    neq(key, value) { this.ops.push(['neq', key, value]); this.filters.push((row) => !same(row[key], value)); return this; }
    in(key, values) { this.ops.push(['in', key, values]); this.filters.push((row) => values.some((v) => same(row[key], v))); return this; }
    is(key, value) { this.ops.push(['is', key, value]); this.filters.push((row) => (row[key] ?? null) === value); return this; }
    order(key, { ascending = true } = {}) { this.ops.push(['order', key]); this.orderBy.push([key, ascending]); return this; }
    range(from, to) { this.ops.push(['range', from, to]); this.rangeArgs = [from, to]; return this; }
    limit(n) { this.ops.push(['limit', n]); this.limitN = n; return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => execute(this)).then(resolve, reject); }
  }

  const supabase = {
    from: (table) => new Query(table),
    storage: {
      from: (bucket) => ({
        async upload(path, file, opts = {}) {
          storage.uploads.push({ bucket, path, type: opts.contentType || file?.type, size: file?.size, admin: session.admin });
          if (!session.admin) return { data: null, error: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } };
          if (storage.objects.has(`${bucket}/${path}`) && !opts.upsert) return { data: null, error: { statusCode: '409', message: 'The resource already exists' } };
          storage.objects.set(`${bucket}/${path}`, { file, opts });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  };
  return { db: () => db, raw: db, supabase, session, log, storage, stamp, writes: () => log.filter((q) => q.action !== 'select') };
}

// ---- 1. The real modules ------------------------------------------------------------
export async function loadCatalogueAdmin({ supabase, uploadImage = null, deps = {} } = {}) {
  const fashion = await importSrc('src/lib/fashion.js');
  const appearance = await importSrc('src/lib/homepageAppearance.js');
  const format = await importSrc('src/lib/format.js');
  const mediaOps = await importSrc('src/lib/productMediaOperations.js');
  const content = await importSrc('src/lib/productContent.js');
  // The REAL wellness uploader (validation, then product-images/<folder>/<random>.<ext>)
  // over the fake client's storage, which admits admin sessions only.
  const adminApi = loadModule('src/lib/adminApi.js', { supabase, BIOSASH_PRODUCTS: [], normalizeContentPatch: content.normalizeContentPatch, ...mediaOps });
  // The real WebP ladder with a fake codec (Node has no canvas); see imageFile().
  const image = has('src/lib/storeCatalogueImage.js') ? await importSrc('src/lib/storeCatalogueImage.js') : null;
  const compressToWebp = image ? (file, opts = {}) => image.compressToWebp(file, { decode: fakeDecode, encode: fakeEncode, ...opts }) : undefined;
  const ruleDeps = { buildTree: fashion.buildTree, validatePlacement: fashion.validatePlacement, safeVisualUrl: appearance.safeVisualUrl, ...deps };
  const rules = loadModule('src/lib/storeCatalogueAdmin.js', ruleDeps);
  const api = loadModule('src/lib/storeCatalogueAdminApi.js', { supabase, uploadImage: uploadImage || adminApi.uploadImage, compressToWebp, safeVisualUrl: appearance.safeVisualUrl, ...rules, ...deps });
  const csv = has('src/lib/storeCatalogueCsv.js') ? loadModule('src/lib/storeCatalogueCsv.js', { ...rules }) : {};
  return { rules, api, csv, fashion, appearance, format, adminApi, image };
}

// ---- A fake image codec -------------------------------------------------------------
// imageFile() makes a File that "decodes" to the given size. fakeEncode() turns
// a rung of the ladder into a WebP-headed blob whose size grows with pixels ×
// quality × detail, so a test chooses which rung fits by choosing `detail`.
export function imageFile(name, { width = 3000, height = 2000, detail = 0.2, type = 'image/jpeg', encoderType = 'image/webp' } = {}) {
  const file = new File([JSON.stringify({ width, height, detail, encoderType })], name, { type });
  return file;
}
export async function fakeDecode(file) {
  const meta = JSON.parse(await file.text());
  return { ...meta, closed: false, close() { this.closed = true; } };
}
export async function fakeEncode(img, { width, height, quality }) {
  const size = Math.max(16, Math.round(width * height * quality * img.detail));
  const bytes = new Uint8Array(size);
  bytes.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  bytes.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
  return new Blob([bytes], { type: img.encoderType });
}

/** The page module with its router hooks, API and rules injected. */
export function loadCataloguePage({ rules, api, csv = {}, format, router, deps = {} }) {
  const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
  return loadModule('src/admin/pages/StoreCatalogue.jsx', {
    Link, money: format.money, useNavigate: () => router.navigate, useParams: () => router.params, useSearchParams: () => [router.search, router.setSearch],
    ...rules, ...api, ...csv, ...deps,
  });
}

export function fakeRouter(params, search = '') {
  const router = { params, search: new URLSearchParams(search), navigations: [] };
  router.navigate = (to, opts) => { router.navigations.push([to, opts]); };
  router.setSearch = (next) => { router.search = typeof next === 'function' ? next(router.search) : new URLSearchParams(next); mountState.dirty = true; };
  return router;
}

// ---- 3. The hook runtime ------------------------------------------------------------
const mountState = { current: null, dirty: false, effects: [] };
const depsChanged = (prev, next) => !prev || !next || prev.length !== next.length || next.some((d, i) => !Object.is(d, prev[i]));
export const hooks = {
  useState(init) {
    const inst = mountState.current, k = inst.i++;
    if (!(k in inst.slots)) inst.slots[k] = typeof init === 'function' ? init() : init;
    const slots = inst.slots;
    return [slots[k], (value) => { const next = typeof value === 'function' ? value(slots[k]) : value; if (!Object.is(next, slots[k])) { slots[k] = next; mountState.dirty = true; } }];
  },
  useRef(init) { const inst = mountState.current, k = inst.i++; if (!(k in inst.slots)) inst.slots[k] = { current: init }; return inst.slots[k]; },
  useMemo(fn, deps) { const inst = mountState.current, k = inst.i++; const prev = inst.slots[k]; if (!prev || depsChanged(prev.deps, deps)) inst.slots[k] = { deps, value: fn() }; return inst.slots[k].value; },
  useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
  useEffect(fn, deps) {
    const inst = mountState.current, k = inst.i++; const prev = inst.slots[k];
    if (!prev || depsChanged(prev.deps, deps)) {
      const entry = { deps, cleanup: null };
      if (prev?.cleanup) mountState.effects.push(prev.cleanup);
      inst.slots[k] = entry;
      mountState.effects.push(() => { const c = fn(); if (typeof c === 'function') entry.cleanup = c; });
    }
  },
};
hooks.useLayoutEffect = hooks.useEffect;

/**
 * Mount an element and return a handle. Host elements in `tree` keep their
 * real props (onClick, onChange, onSubmit…); `act(fn)` runs fn and settles.
 */
export async function mount(element) {
  const instances = new Map();
  function expand(node, path) {
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (Array.isArray(node)) return node.map((child, i) => expand(child, `${path}.${child?.key ?? i}`));
    const { type, props } = node;
    if (typeof type === 'function') {
      const id = `${path}/${type.name || 'anon'}${node.key != null ? `#${node.key}` : ''}`;
      if (!instances.has(id)) instances.set(id, { slots: [] });
      const inst = instances.get(id); inst.i = 0;
      const outer = mountState.current; mountState.current = inst;
      let out;
      try { out = type(props); } finally { mountState.current = outer; }
      return expand(out, id);
    }
    const children = props?.children === undefined ? undefined : expand(props.children, `${path}>${typeof type === 'string' ? type : 'f'}`);
    return { ...node, props: children === undefined ? props : { ...props, children } };
  }
  const handle = { tree: null, instances };
  handle.render = () => { handle.tree = expand(element, 'root'); return handle.tree; };
  handle.settle = async () => {
    for (let round = 0; round < 60; round += 1) {
      mountState.dirty = false;
      handle.render();
      const effects = mountState.effects; mountState.effects = [];
      for (const effect of effects) effect();
      await new Promise((r) => setTimeout(r, 0));
      if (!mountState.dirty && !mountState.effects.length) { handle.render(); return handle; }
    }
    throw new Error('the page did not settle');
  };
  handle.act = async (fn) => { await fn(); await new Promise((r) => setTimeout(r, 0)); return handle.settle(); };
  handle.find = (pred) => findAll(handle.tree, pred);
  handle.text = () => textOf(handle.tree);
  await handle.settle();
  return handle;
}

export function findAll(node, pred, out = []) {
  if (Array.isArray(node)) { for (const child of node) findAll(child, pred, out); return out; }
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  findAll(node.props?.children, pred, out);
  return out;
}
export function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}
/** The element a label wraps: <label><span class=label>Text</span><input…/></label>. */
export function fieldByLabel(tree, label) {
  const wrap = findAll(tree, (n) => n.type === 'label' && findAll(n, (s) => s.type === 'span' && /\blabel\b/.test(s.props?.className || '') && textOf(s) === label).length)[0];
  if (!wrap) return null;
  const control = findAll(wrap, (n) => ['input', 'select', 'textarea'].includes(n.type))[0];
  const error = findAll(wrap, (n) => n.type === 'span' && /\berr\b/.test(n.props?.className || ''))[0];
  return { wrap, control, error: error ? textOf(error) : null };
}
export const buttonByText = (tree, text) => findAll(tree, (n) => n.type === 'button' && textOf(n).trim() === text)[0];
export const formOf = (tree, heading) => findAll(tree, (n) => n.type === 'form' && findAll(n, (x) => typeof x.type === 'string' && /^h[23]$/.test(x.type) && textOf(x) === heading).length)[0];
export const change = (control, value) => control.props.onChange({ target: { value, checked: value } });
export const submit = (form) => form.props.onSubmit({ preventDefault() {} });

// ---- Fixtures: a small catalogue in all three stores --------------------------------
// Shaped like the tables. Demo rows mirror the 0034/0035 seeds (is_demo); a
// few real rows sit beside them so the demo delete has something to protect.
export function catalogueFixtures() {
  const cat = (id, store, name, slug, extra = {}) => ({ id, store, name, slug, parent_id: null, tagline: '', image_url: null, sort_order: 0, is_active: true, is_demo: false, ...extra });
  const prod = (id, store, name, slug, category_id, extra = {}) => ({
    id, store, name, slug, brand: 'SORA LIFE', description: `${name}.`, category_id, mrp: 1000, sale_price: 900, sku: null, hsn_code: null, gst_rate: null,
    net_content: null, stock: 10, images: [], rating: 0, review_count: 0, is_active: true, is_new: false, is_bestseller: false, sort_order: 0, is_demo: false, ...extra,
  });
  const variant = (id, store, product_id, size, colour, extra = {}) => ({ id, store, product_id, size, colour, colour_hex: null, sku: null, stock: 5, price_override: null, is_active: true, sort_order: 0, is_demo: false, ...extra });
  const media = (id, product_id, public_url, extra = {}) => ({ id, product_id, storage_path: null, public_url, alt_text: '', sort_order: 0, is_primary: true, ...extra });
  return {
    catalogue_categories: [
      cat('fc-clothing', 'fashion', 'Clothing', 'clothing', { sort_order: 1 }),
      cat('fc-shirts', 'fashion', 'Shirts', 'shirts', { parent_id: 'fc-clothing' }),
      cat('fc-dresses', 'fashion', 'Dresses', 'dresses', { parent_id: 'fc-clothing', sort_order: 2 }),
      cat('hc-bedsheets', 'homeliving', 'Bedsheets', 'bedsheets', { is_demo: true, sort_order: 1 }),
      cat('hc-towels', 'homeliving', 'Towels', 'towels', { is_demo: true, sort_order: 2 }),
      cat('hc-rugs', 'homeliving', 'Rugs & Mats', 'rugs-mats', { is_demo: true, sort_order: 3 }),
      cat('gc-atta', 'grocery', 'Atta & Rice', 'atta-rice', { is_demo: true }),
    ],
    catalogue_products: [
      prod('fp-linen', 'fashion', 'Linen Shirt', 'linen-shirt', 'fc-shirts', { mrp: 1299, sale_price: 999, sku: 'AW-LIN-SHIRT', images: ['/img/fashion-hero.webp'], is_bestseller: true, sort_order: 1 }),
      prod('fp-wrap', 'fashion', 'Wrap Dress', 'wrap-dress', 'fc-dresses', { mrp: 2199, sale_price: null, sku: 'AW-WRAP', images: [], is_active: false, is_demo: true, sort_order: 2 }),
      prod('hp-botanical', 'homeliving', 'Botanical Bedsheet Set', 'botanical-bedsheet-set-king', 'hc-bedsheets', { mrp: 1899, sale_price: 1499, sku: 'SL-HL-BED-BOT-K', net_content: 'King · 1 bedsheet + 2 pillow covers', stock: 40, images: ['/img/homeliving-product-botanical-bedsheet-set.webp'], is_demo: true, sort_order: 1 }),
      prod('hp-towel', 'homeliving', 'Bath Towel Set', 'bath-towel-set-pack-of-2', 'hc-towels', { mrp: 949, sale_price: 799, sku: 'SL-HL-TWL-BATH-2', stock: 50, images: ['/img/homeliving-product-bath-towel-set.webp'], is_demo: true, sort_order: 2 }),
      prod('hp-percale', 'homeliving', 'Percale Sheet Set', 'percale-sheet-set', 'hc-bedsheets', { mrp: 2499, sale_price: 2199, sku: 'HL-PERC', hsn_code: '6302', gst_rate: 12, stock: 0, images: ['/img/homeliving-product-botanical-bedsheet-set.webp'], sort_order: 3 }),
      prod('gp-rice', 'grocery', 'Sona Masoori Rice', 'sona-masoori-rice-1kg', 'gc-atta', { mrp: 99, sale_price: 89, sku: 'SL-GR-RICE-SM-1KG', net_content: '1 kg', stock: 100, images: ['/img/grocery-product-sona-masoori-rice.webp'], is_demo: true }),
    ],
    catalogue_variants: [
      variant('fv-m', 'fashion', 'fp-linen', 'M', 'Sage', { colour_hex: '#A9B48C', sku: 'AW-LIN-M-SAGE', stock: 12 }),
      variant('fv-l', 'fashion', 'fp-linen', 'L', 'Sage', { colour_hex: '#A9B48C', sku: 'AW-LIN-L-SAGE', stock: 4, sort_order: 1 }),
      variant('hv-king', 'homeliving', 'hp-percale', 'King', 'Ivory', { sku: 'HL-PERC-K-IV', stock: 6 }),
      variant('hv-queen', 'homeliving', 'hp-percale', 'Queen', 'Ivory', { sku: 'HL-PERC-Q-IV', stock: 3, sort_order: 1 }),
    ],
    catalogue_product_media: [
      media('m-linen', 'fp-linen', '/img/fashion-hero.webp', { alt_text: 'Linen Shirt' }),
      media('m-botanical', 'hp-botanical', '/img/homeliving-product-botanical-bedsheet-set.webp', { alt_text: 'Botanical Bedsheet Set' }),
      media('m-towel', 'hp-towel', '/img/homeliving-product-bath-towel-set.webp', { alt_text: 'Bath Towel Set' }),
      media('m-percale', 'hp-percale', '/img/homeliving-product-botanical-bedsheet-set.webp', { alt_text: 'Percale Sheet Set' }),
      media('m-rice', 'gp-rice', '/img/grocery-product-sona-masoori-rice.webp', { alt_text: 'Sona Masoori Rice' }),
    ],
  };
}

/** A mounted page over a fresh database. */
export async function openPage({ params, search = '', fixtures = catalogueFixtures(), admin = true, deps = {} } = {}) {
  const store = createCatalogueDb(fixtures, { admin });
  const mods = await loadCatalogueAdmin({ supabase: store.supabase, deps });
  const router = fakeRouter(params, search);
  const win = { answer: true, asked: [], reloaded: false, confirm(message) { win.asked.push(message); return win.answer; }, location: { reload() { win.reloaded = true; } } };
  const page = loadCataloguePage({ ...mods, router, deps: { window: win, ...deps } });
  const handle = await mount(h(page.default));
  return { ...mods, store, router, page, handle, win };
}
