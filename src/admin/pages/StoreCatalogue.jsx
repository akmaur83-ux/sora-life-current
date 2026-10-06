import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money } from '../../lib/format.js';
import { CATALOGUE_STORES, catalogueSlug, categoryOptions, catalogueProductHref, catalogueFailureView, versionAfterOwnWrite, gstNote, GROCERY_NOT_SOLD, GROCERY_VARIANTS_UNREAD } from '../../lib/storeCatalogueAdmin.js';
import { listStoreCategories, listStoreProducts, getStoreProduct, saveStoreProduct, saveStoreCategory, saveStoreVariant, uploadStoreImage, saveStoreMedia, removeStoreMedia, addStoreImages, reorderStoreMedia, setStoreMediaPrimary, saveStoreMediaAlt, applyCatalogueImport, deleteStoreVariant, previewStoreDemoDelete, deleteStoreDemoRows } from '../../lib/storeCatalogueAdminApi.js';
import { planProductImport, planVariantImport, productsToCsv, variantsToCsv, describeDiff } from '../../lib/storeCatalogueCsv.js';
import { productClaimWarnings, CLAIM_KINDS } from '../../lib/claimWarnings.js';

const EMPTY_PRODUCT = { name: '', slug: '', brand: '', description: '', category_id: '', mrp: '', sale_price: '', sku: '', net_content: '', hsn_code: '', gst_rate: '', stock: 0, sort_order: 0, is_active: false, is_new: false, is_bestseller: false };
const EMPTY_CATEGORY = { name: '', slug: '', parent_id: '', tagline: '', image_url: '', sort_order: 0, is_active: true };
const EMPTY_VARIANT = { size: '', colour: '', colour_hex: '', sku: '', stock: 0, price_override: '', is_active: true, sort_order: 0 };

// The fields each form renders. A save error for one of these is shown beside
// it; anything else goes in the form's banner (catalogueFailureView).
const PRODUCT_FIELDS = (store) => ['name', 'slug', 'category_id', 'brand', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', ...(store === 'fashion' ? [] : ['stock']), 'sort_order', 'description'];
const CATEGORY_FIELDS = ['name', 'slug', 'parent_id', 'sort_order', 'tagline', 'image_url'];
const VARIANT_FIELDS = ['size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'sort_order'];
const IMAGE_FIELDS = ['public_url'];

/** One form's save outcome: errors beside fields, a banner, and whether it was a stale write. */
function useFormErrors(visible) {
  const [state, setState] = useState({ fields: {}, banner: '', stale: false });
  return {
    ...state,
    capture: (error) => setState(catalogueFailureView(error, visible)),
    reset: () => setState({ fields: {}, banner: '', stale: false }),
    clear: (field) => setState((old) => (old.fields[field] ? { ...old, fields: Object.fromEntries(Object.entries(old.fields).filter(([key]) => key !== field)) } : old)),
  };
}

function Field({ label, field, value, set, type = 'text', required = false, hint, min, max, step, multiline = false, errors, form = 'sc' }) {
  const error = errors?.fields?.[field];
  const errorId = error ? `${form}-${field}-error` : undefined;
  const change = (e) => { errors?.clear(field); set({ ...value, [field]: e.target.value }); };
  return <label className={`field sc-field${error ? ' sc-field--error' : ''}`}><span className="label">{label}</span>
    {multiline ? <textarea className="textarea" rows="4" aria-invalid={error ? true : undefined} aria-describedby={errorId} value={value[field] ?? ''} onChange={change} />
      : <input className="input" type={type} required={required} min={min} max={max} step={step} aria-invalid={error ? true : undefined} aria-describedby={errorId} value={value[field] ?? ''} onChange={change} />}
    {error && <span className="hint err" id={errorId}>{error}</span>}
    {hint && <span className="hint">{hint}</span>}
  </label>;
}
function Check({ label, field, value, set }) {
  return <label className="adm-checkrow"><input type="checkbox" checked={!!value[field]} onChange={(e) => set({ ...value, [field]: e.target.checked })} />{label}</label>;
}
function CategorySelect({ categories, value, onChange, label = 'Category / subcategory', optional = false, errors, field = 'category_id', form = 'sc' }) {
  const error = errors?.fields?.[field];
  const errorId = error ? `${form}-${field}-error` : undefined;
  return <label className={`field sc-field${error ? ' sc-field--error' : ''}`}><span className="label">{label}</span><select className="select" required={!optional} aria-invalid={error ? true : undefined} aria-describedby={errorId} value={value || ''} onChange={(e) => { errors?.clear(field); onChange(e.target.value); }}>
    <option value="">{optional ? 'Top-level category' : 'Choose a category'}</option>
    {categoryOptions(categories).map((row) => <option key={row.id} value={row.id}>{row.label}{row.is_active ? '' : ' (hidden)'}</option>)}
  </select>{error && <span className="hint err" id={errorId}>{error}</span>}</label>;
}
function Messages({ error, message, stale = false }) {
  return <>{error && <div className="adm-banner err" role="alert">{error}{stale && <button type="button" className="btn btn-sm btn-light sc-reload" onClick={() => window.location.reload()}>Reload and discard my edits</button>}</div>}{message && <div className="adm-banner ok" role="status">{message}</div>}</>;
}
function Upload({ store, onUpload, onBusy, onError, disabled = false }) {
  const [busy, setBusy] = useState(false);
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); onBusy(true); onError('');
    try { onUpload(await uploadStoreImage(store, file)); }
    catch (error) { onError(error.message || 'Image upload failed.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <label className="sc-upload"><span>{busy ? 'Uploading image…' : 'Upload image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || disabled} onChange={upload} /></label>;
}

/** Claim warnings: shown, never blocking (claimWarnings.js). */
function ClaimList({ warnings }) {
  return <ul className="sc-list sc-claims__list">{warnings.map((w, i) => <li key={`${w.field}-${w.kind}-${w.term}-${i}`}><strong>{CLAIM_KINDS[w.kind]}</strong> in {w.label.toLowerCase()}: “{w.term}” — <q>{w.excerpt}</q></li>)}</ul>;
}
function ClaimNotice({ warnings }) {
  if (!warnings?.length) return null;
  return <div className="adm-banner info sc-claims" role="status"><strong>Saved — check this copy before customers read it.</strong> SORA LIFE cannot back these claims without proof (a certificate, a courier promise, clinical evidence). This is a warning, not a block: edit the copy if it overstates.<ClaimList warnings={warnings} /></div>;
}

function CategoryEditor({ store, categories, initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_CATEGORY);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState('');
  const errors = useFormErrors(CATEGORY_FIELDS);
  async function save(e) {
    e.preventDefault(); if (busy || uploading) return;
    setBusy(true); errors.reset(); setUploadError('');
    // initial.updated_at is the version this form opened; a category saved elsewhere since is refused.
    try { await saveStoreCategory(store, initial?.id, form, initial?.updated_at); onSaved(); }
    catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  return <form className="surface sc-panel" onSubmit={save} noValidate><h2>{initial ? 'Edit category' : 'Add category'}</h2>
    <Messages error={errors.banner || uploadError} stale={errors.stale} />
    <fieldset disabled={busy || uploading}>
      <div className="adm-grid2">
        <Field form="cat" errors={errors} label="Category name" field="name" value={form} set={setForm} required />
        <Field form="cat" errors={errors} label="Slug" field="slug" value={form} set={setForm} hint={form.slug ? 'Changing a slug changes its storefront link.' : `Automatic: ${catalogueSlug(form.name) || 'category-name'}`} />
        <CategorySelect form="cat" errors={errors} field="parent_id" categories={categories.filter((row) => row.id !== initial?.id)} value={form.parent_id} optional label="Parent category (up to 3 levels)" onChange={(parent_id) => setForm({ ...form, parent_id })} />
        <Field form="cat" errors={errors} label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
      </div>
      <Field form="cat" errors={errors} label="Tagline" field="tagline" value={form} set={setForm} />
      <Field form="cat" errors={errors} label="Category image URL" field="image_url" value={form} set={setForm} />
    </fieldset>
    <Upload store={store} disabled={busy} onUpload={(image_url) => setForm((old) => ({ ...old, image_url }))} onBusy={setUploading} onError={setUploadError} />
    <fieldset disabled={busy || uploading}>
      <Check label="Visible on storefront" field="is_active" value={form} set={setForm} />
      <div className="sc-actions"><button className="btn btn-sm" type="submit">{busy ? 'Saving…' : 'Save category'}</button><button className="btn btn-outline btn-sm" type="button" onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </form>;
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// CSV bulk import — the wellness pattern: export, edit, choose the file, read
// the plan, apply. Nothing is written until Apply; storeCatalogueCsv.js plans,
// applyCatalogueImport writes each row through the editor's own save.
function CatalogueImport({ store, products, categories, onApplied }) {
  const [kind, setKind] = useState('products');
  const [overwrite, setOverwrite] = useState(false), [create, setCreate] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState(''), [failures, setFailures] = useState([]);
  const plan = useMemo(() => {
    if (!file || file.kind !== kind) return null;
    return kind === 'products'
      ? planProductImport(file.text, { store, products, categories, overwrite, create })
      : planVariantImport(file.text, { store, products, overwrite, create });
  }, [file, kind, store, products, categories, overwrite, create]);
  const noun = kind === 'products' ? 'products' : 'variants';
  const creates = plan?.changes?.filter((c) => c.kind === 'create').length || 0;
  const updates = (plan?.changes?.length || 0) - creates;
  async function choose(e) {
    const chosen = e.target.files?.[0]; e.target.value = '';
    if (!chosen) return;
    setMessage(''); setError(''); setFailures([]);
    try { setFile({ name: chosen.name, kind, text: await chosen.text() }); }
    catch { setError(`“${chosen.name}” could not be read.`); }
  }
  async function apply() {
    if (!plan?.changes?.length || busy) return;
    if (!window.confirm(`Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'} to ${CATALOGUE_STORES[store]} ${noun}?\n\n`
      + `${updates} to update, ${creates} to create${kind === 'products' && creates ? ' (as drafts)' : ''}.\n`
      + `${overwrite ? 'EXISTING VALUES WILL BE OVERWRITTEN.' : 'Fill-only: existing values are kept.'}`)) return;
    setBusy(true); setMessage(''); setError(''); setFailures([]);
    try {
      const { done, failed } = await applyCatalogueImport(store, plan, (n, total) => setProgress(`${n} of ${total}`));
      const created = done.filter((c) => c.kind === 'create').length;
      setMessage(`${done.length - created} ${noun} updated, ${created} created${kind === 'products' && created ? ' as drafts' : ''}.${failed.length ? ` ${failed.length} not applied — see below.` : ''}`);
      setFailures(failed);
      setFile(null);
      onApplied();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); setProgress(''); }
  }
  return <section className="surface sc-panel sc-import">
    <h2>Bulk import (CSV)</h2>
    <div className="adm-chipbar" aria-label="What to import">
      {[['products', 'Products'], ['variants', 'Sizes & colours (variants)']].map(([id, label]) => <button key={id} type="button" className={`adm-chip${kind === id ? ' active' : ''}`} aria-pressed={kind === id} disabled={busy} onClick={() => { setKind(id); setFile(null); setMessage(''); setFailures([]); }}>{label}</button>)}
    </div>
    <ol className="sc-steps">
      <li><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => downloadText(`sora-${store}-${noun}-${new Date().toISOString().slice(0, 10)}.csv`, kind === 'products' ? productsToCsv(products, categories) : variantsToCsv(products))}>Export current {noun} (CSV)</button></li>
      <li>Edit it in a spreadsheet. <strong>A blank cell leaves that field alone</strong> — it never clears it.{kind === 'products' ? ' Category is the path the export shows, e.g. clothing/shirts.' : ' Rows are matched on product_slug, size and colour.'}</li>
      <li><label className="sc-file"><span>Choose the edited file</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={choose} /></label> — you will see exactly what would change. Nothing is saved until you apply it.</li>
    </ol>
    <div className="sc-options">
      <label className="adm-checkrow"><input type="checkbox" checked={overwrite} disabled={busy} onChange={(e) => setOverwrite(e.target.checked)} /><span><strong>Overwrite existing values.</strong> Off (fill-only): a cell only fills an empty field. Prices, stock and flags always have a value, so changing them needs this.</span></label>
      <label className="adm-checkrow"><input type="checkbox" checked={create} disabled={busy} onChange={(e) => setCreate(e.target.checked)} /><span><strong>Create new {noun}</strong> for rows that match nothing{kind === 'products' ? ' — as drafts; publish each from its editor once it has images' : ''}.</span></label>
    </div>
    <Messages error={error || (plan && !plan.ok ? plan.reason : '')} message={message} />
    {!!failures.length && <div className="adm-banner err" role="alert"><strong>Not applied</strong><ul className="sc-list">{failures.map((f) => <li key={f.line}>Line {f.line}{f.key ? ` (${f.key})` : ''}: {f.reason}</li>)}</ul></div>}
    {plan?.ok && <div className="sc-plan">
      <p className="sc-plan__summary"><strong>{file.name}</strong> — {updates} to update · {creates} to create · {plan.kept.length} kept by fill-only · {plan.skipped.length} skipped{plan.changes.some((c) => c.warnings?.length) ? ` · ${plan.changes.filter((c) => c.warnings?.length).length} with claim warnings` : ''}</p>
      {!!plan.ignored.length && <p className="hint">Columns not imported: {plan.ignored.join(', ')}.</p>}
      {!!plan.changes.length && <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Line</th><th>{kind === 'products' ? 'Product' : 'Variant'}</th><th>What changes</th></tr></thead><tbody>
        {plan.changes.map((c) => <tr key={c.line}><td>{c.line}</td><td>{c.kind === 'create' && <span className="badge sc-new">New</span>} <strong>{kind === 'products' ? c.name : c.label}</strong>{kind === 'products' && <span className="hint"> {c.slug}</span>}</td><td><ul className="sc-diffs">{c.diffs.map((d) => <li key={d.field} className={d.skipped ? 'is-kept' : ''}>{describeDiff(d, categories)}{d.skipped ? ' — kept (fill-only)' : ''}</li>)}</ul>{!!c.warnings?.length && <div className="sc-claims sc-claims--row"><strong>Check before applying</strong> (a warning, not a block):<ClaimList warnings={c.warnings} /></div>}</td></tr>)}
      </tbody></table></div>}
      {!!plan.kept.length && <details className="sc-kept"><summary>{plan.kept.length} row{plan.kept.length === 1 ? '' : 's'} where every change was kept by fill-only</summary><ul className="sc-list">{plan.kept.map((c) => <li key={c.line}>Line {c.line} ({c.slug || c.label}): {c.diffs.map((d) => describeDiff(d, categories)).join('; ')}</li>)}</ul></details>}
      {!!plan.skipped.length && <div className="adm-banner err"><strong>{plan.skipped.length} row{plan.skipped.length === 1 ? '' : 's'} skipped — nothing from {plan.skipped.length === 1 ? 'it' : 'them'} will be written</strong><ul className="sc-list">{plan.skipped.map((s) => <li key={s.line}>Line {s.line}{s.key ? ` (${s.key})` : ''}: {s.reason}</li>)}</ul></div>}
      <div className="sc-actions"><button type="button" className="btn" disabled={busy || !plan.changes.length} onClick={apply}>{busy ? `Applying… ${progress}` : `Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setFile(null)}>Discard plan</button></div>
    </div>}
  </section>;
}

// "Delete demo rows" for one store: review exactly what goes and what stays
// (planDemoDelete), then delete — refused if the rows changed since review.
function DemoRows({ store, onClose, onDeleted }) {
  const [plan, setPlan] = useState(null), [busy, setBusy] = useState(true), [error, setError] = useState(''), [done, setDone] = useState(null);
  useEffect(() => {
    let current = true;
    previewStoreDemoDelete(store).then((p) => { if (current) setPlan(p); }).catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [store]);
  const nothing = plan && !plan.products.length && !plan.categories.length;
  async function remove() {
    if (!window.confirm(`Delete ${plan.products.length} demo product${plan.products.length === 1 ? '' : 's'} and ${plan.categories.length} demo categor${plan.categories.length === 1 ? 'y' : 'ies'} from ${CATALOGUE_STORES[store]}? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try { setDone(await deleteStoreDemoRows(store, plan)); onDeleted(); }
    catch (err) { setError(err.message); if (err.isStaleWrite) { try { setPlan(await previewStoreDemoDelete(store)); } catch { /* the error already says to review again */ } } }
    finally { setBusy(false); }
  }
  const keptList = (rows) => <ul className="sc-list">{rows.map((k) => <li key={k.id}><strong>{k.name}</strong> — kept: {k.reasons.join('; ')}.</li>)}</ul>;
  return <section className="surface sc-panel sc-demo-panel" aria-label="Demo rows">
    <h2>Demo rows in {CATALOGUE_STORES[store]}</h2>
    <Messages error={error} />
    {done ? <>
      <div className="adm-banner ok" role="status">Deleted {done.products} demo product{done.products === 1 ? '' : 's'} (with {done.variants} variant{done.variants === 1 ? '' : 's'} and {done.images} image{done.images === 1 ? '' : 's'}) and {done.categories} demo categor{done.categories === 1 ? 'y' : 'ies'}.</div>
      {!!done.kept.length && <>{keptList(done.kept)}</>}
    </> : busy && !plan ? <p role="status">Checking for demo rows…</p> : plan && <>
      {nothing ? <p className="adm-empty">No demo rows to delete in {CATALOGUE_STORES[store]}.</p> : <>
        <p>These go: the demo products with their variants and images, then the demo categories that hold nothing real.</p>
        {!!plan.products.length && <><h3>{plan.products.length} demo product{plan.products.length === 1 ? '' : 's'}</h3><ul className="sc-list">{plan.products.map((p) => <li key={p.id}>{p.name}{p.variants || p.images ? ` (${[p.variants && `${p.variants} variant${p.variants === 1 ? '' : 's'}`, p.images && `${p.images} image${p.images === 1 ? '' : 's'}`].filter(Boolean).join(', ')})` : ''}</li>)}</ul></>}
        {!!plan.categories.length && <><h3>{plan.categories.length} demo categor{plan.categories.length === 1 ? 'y' : 'ies'}</h3><ul className="sc-list">{plan.categories.map((c) => <li key={c.id}>{c.name}</li>)}</ul></>}
      </>}
      {!!plan.keptCategories.length && <><h3>Kept</h3><p className="hint">A category is never deleted while something real sits in it — that would leave the real product without a category.</p>{keptList(plan.keptCategories)}</>}
      {!!plan.demoVariantsOnRealProducts && <p className="hint">{plan.demoVariantsOnRealProducts} demo variant{plan.demoVariantsOnRealProducts === 1 ? '' : 's'} on real products {plan.demoVariantsOnRealProducts === 1 ? 'is' : 'are'} left alone.</p>}
      <p className="hint">Carts holding a deleted product drop it; past orders keep their own copy. Image files stay in storage.</p>
      <div className="sc-actions">{!nothing && <button type="button" className="btn sc-danger-btn" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete these demo rows'}</button>}<button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={onClose}>Close</button></div>
    </>}
    {done && <div className="sc-actions"><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button></div>}
  </section>;
}

function CatalogueList({ store }) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]), [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const tab = ['categories', 'import'].includes(params.get('tab')) ? params.get('tab') : 'products';
  const category = params.get('category') || '', search = params.get('q') || '';
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    Promise.all([listStoreCategories(store), listStoreProducts(store)]).then(([cats, rows]) => { if (current) { setCategories(cats); setProducts(rows); setLoaded(true); } })
      .catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [store, revision]);
  const update = (patch) => setParams((old) => { const next = new URLSearchParams(old); for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); } return next; }, { replace: true });
  const status = ['published', 'draft'].includes(params.get('status')) ? params.get('status') : '';
  const [demoOpen, setDemoOpen] = useState(false);
  const shown = products.filter((row) => (!category || row.category_id === category)
    && (!status || (status === 'published') === (row.is_active === true))
    && `${row.name} ${row.sku || ''} ${row.brand}`.toLowerCase().includes(search.toLowerCase()));
  const categoriesById = new Map(categoryOptions(categories).map((row) => [row.id, row.label]));
  return <>
    <div className="adm-chipbar" aria-label="Catalogue section">
      <button className={`adm-chip${tab === 'products' ? ' active' : ''}`} onClick={() => update({ tab: '' })}>Products</button>
      <button className={`adm-chip${tab === 'categories' ? ' active' : ''}`} onClick={() => update({ tab: 'categories' })}>Categories &amp; subcategories</button>
      <button className={`adm-chip${tab === 'import' ? ' active' : ''}`} onClick={() => update({ tab: 'import' })}>Bulk import (CSV)</button>
    </div>
    <Messages error={error} />
    {/* Only the first load replaces the page: a reload after an import keeps its result on screen. */}
    {loading && !loaded ? <p role="status">Loading catalogue…</p> : error && !loaded ? <button className="btn btn-outline" onClick={() => setRevision((n) => n + 1)}>Retry loading</button> : tab === 'import' ? <CatalogueImport store={store} products={products} categories={categories} onApplied={() => setRevision((n) => n + 1)} /> : tab === 'products' ? <>
      <div className="sc-toolbar">
        <label className="sc-field"><span className="label">Search products</span><input className="input" value={search} onChange={(e) => update({ q: e.target.value })} placeholder="Name, brand or SKU" /></label>
        <label className="sc-field"><span className="label">Category / subcategory</span><select className="select" value={category} onChange={(e) => update({ category: e.target.value })}><option value="">All categories</option>{categoryOptions(categories).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <label className="sc-field sc-field--narrow"><span className="label">Status</span><select className="select" value={status} onChange={(e) => update({ status: e.target.value })}><option value="">Published and drafts</option><option value="published">Published only</option><option value="draft">Drafts only</option></select></label>
        <Link className="btn btn-sm" to={`/admin/store-catalogue/${store}/new${category ? `?category=${encodeURIComponent(category)}` : ''}`}>+ Add product</Link>
        <button type="button" className="btn btn-outline btn-sm" aria-expanded={demoOpen} onClick={() => setDemoOpen((open) => !open)}>Remove demo rows…</button>
      </div>
      {demoOpen && <DemoRows store={store} onClose={() => setDemoOpen(false)} onDeleted={() => setRevision((n) => n + 1)} />}
      <p className="hint">{shown.length} of {products.length} products{status ? ` · ${status === 'published' ? 'published only' : 'drafts only'}` : ' · includes drafts'}</p>
      {!shown.length ? <div className="adm-empty">No products in this selection. Add a product, or choose another category.</div> : <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {shown.map((row) => {
          const variants = (row.variants || []).filter((v) => v.is_active !== false);
          const stock = store === 'fashion' || variants.length ? variants.reduce((n, v) => n + Number(v.stock || 0), 0) : row.stock;
          return <tr key={row.id}><td><div className="adm-row-name"><span className="adm-thumb">{row.images?.[0] && <img src={row.images[0]} alt="" loading="lazy" />}</span><div><strong>{row.name}</strong><span>{row.sku || row.slug}</span></div></div></td><td>{categoriesById.get(row.category_id) || 'Unassigned'}</td><td>{money(row.sale_price ?? row.mrp)}</td><td>{stock || 0}</td><td>{row.is_active ? 'Published' : 'Draft'}{row.is_demo && <span className="badge sc-demo" title="Placeholder from the store's seed data">Demo</span>}</td><td><Link className="inline-link" to={`/admin/store-catalogue/${store}/${row.id}`}>Edit</Link>{row.is_active && catalogueProductHref(store, row.slug) && <> · <a className="inline-link" href={catalogueProductHref(store, row.slug)} target="_blank" rel="noreferrer">View</a></>}</td></tr>;
        })}
      </tbody></table></div>}
    </> : <>
      <div className="sc-actions"><button className="btn btn-sm" disabled={!!editing} onClick={() => setEditing('new')}>+ Add category</button></div>
      {editing && <CategoryEditor key={editing === 'new' ? 'new' : editing.id} store={store} categories={categories} initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision((n) => n + 1); }} />}
      {!categories.length && <p className="adm-empty">Add your first category before adding products.</p>}
      <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Category</th><th>Products</th><th>Status</th><th></th></tr></thead><tbody>{categoryOptions(categories).map((row) => <tr key={row.id}><td>{row.label}</td><td>{products.filter((p) => p.category_id === row.id).length}</td><td>{row.is_active ? 'Visible' : 'Hidden'}</td><td><button className="btn btn-outline btn-sm" disabled={!!editing} onClick={() => setEditing(categories.find((cat) => cat.id === row.id))}>Edit</button></td></tr>)}</tbody></table></div>
    </>}
  </>;
}

function VariantsEditor({ store, product, onChanged }) {
  const [form, setForm] = useState(EMPTY_VARIANT), [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const errors = useFormErrors(VARIANT_FIELDS);
  async function remove(row) {
    const label = row.colour ? `${row.size} / ${row.colour}` : row.size;
    if (!window.confirm(`Delete the ${label} variant? This cannot be undone.\n\nCarts holding it will show it as no longer sold, and checkout will refuse it. Past orders keep their own copy.\n\nTo hide it for now instead, edit it and untick "Active variant".`)) return;
    setBusy(true); errors.reset(); setMessage('');
    try { await deleteStoreVariant(store, product.id, row.id, row.updated_at); if (editing === row.id) { setEditing(null); setForm(EMPTY_VARIANT); } await onChanged(); setMessage(`Variant ${label} deleted.`); }
    catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); errors.reset(); setMessage('');
    // form.updated_at is the version the Edit button loaded; a new variant has none and needs none.
    try { await saveStoreVariant(store, product.id, editing, form, editing ? form.updated_at : null); setForm(EMPTY_VARIANT); setEditing(null); await onChanged(); setMessage('Variant saved.'); }
    catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  return <section className="surface sc-panel"><h2>Sizes, colours &amp; stock</h2><p className="hint">{store === 'fashion' ? 'Fashion stock comes from these variants. For a single option use “One size” and its colour, or “Default”.' : 'Optional: add sizes or colours for this product. When active variants exist, their stock is used instead of product stock.'}</p>
    {store === 'grocery' && <p className="adm-banner info sc-note" role="note">{GROCERY_VARIANTS_UNREAD}</p>}
    <Messages error={errors.banner} message={message} stale={errors.stale} />
    {!!product.variants?.length && <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Size / option</th><th>Colour</th><th>Stock</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>{product.variants.map((row) => <tr key={row.id}><td>{row.size}</td><td>{row.colour || '—'}</td><td>{row.stock}</td><td>{row.price_override == null ? 'Product price' : money(row.price_override)}</td><td>{row.is_active ? 'Active' : 'Hidden'}</td><td><div className="sc-actions sc-actions--row"><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setEditing(row.id); setForm(row); setMessage(''); errors.reset(); }}>Edit</button><button type="button" className="btn btn-ghost btn-sm sc-danger" disabled={busy} onClick={() => remove(row)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    <form onSubmit={save} noValidate><fieldset disabled={busy}><h3>{editing ? 'Edit variant' : 'Add variant'}</h3><div className="adm-grid2">
      <Field form="var" errors={errors} label="Size / option" field="size" value={form} set={setForm} required />
      <Field form="var" errors={errors} label={`Colour${store === 'fashion' ? '' : ' (optional)'}`} field="colour" value={form} set={setForm} required={store === 'fashion'} />
      <Field form="var" errors={errors} label="Colour hex (optional)" field="colour_hex" value={form} set={setForm} hint="Example: #A9B48C" />
      <Field form="var" errors={errors} label="Variant SKU (optional)" field="sku" value={form} set={setForm} hint="Unique across every store, not just this one." />
      <Field form="var" errors={errors} label="Stock quantity" field="stock" type="number" min="0" step="1" value={form} set={setForm} required />
      <Field form="var" errors={errors} label="Price override ₹ (optional)" field="price_override" type="number" min="0.01" step="0.01" value={form} set={setForm} hint="Leave blank to use the product selling price." />
      <Field form="var" errors={errors} label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
    </div><Check label="Active variant" field="is_active" value={form} set={setForm} /><div className="sc-actions"><button className="btn btn-sm" type="submit">{busy ? 'Saving…' : 'Save variant'}</button>{editing && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditing(null); setForm(EMPTY_VARIANT); errors.reset(); }}>Cancel edit</button>}</div></fieldset></form>
  </section>;
}

// The gallery: several uploads at once (each made a WebP under 150 KB first),
// drag — or ← / → — to reorder, one primary, alt text per image. Every change
// goes through catalogue_product_media; the 0034 trigger rewrites images[].
const UPLOAD_STATUS = { converting: 'Converting to WebP…', uploading: 'Uploading…', added: 'Added', failed: 'Not added' };
const kb = (bytes) => `${Math.round(bytes / 1000)} KB`;
function galleryOrder(media) {
  return [...(media || [])].sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)));
}
/** The order after dropping `dragged` onto `target`: it takes the target's place. */
export function dropOrder(ids, dragged, target) {
  if (dragged === target || !ids.includes(dragged) || !ids.includes(target)) return ids;
  const next = ids.filter((id) => id !== dragged);
  next.splice(ids.indexOf(target), 0, dragged);
  return next;
}
function GalleryEditor({ store, product, onChanged }) {
  const media = galleryOrder(product.media);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]), [alts, setAlts] = useState({}), [over, setOver] = useState(null);
  const [urlForm, setUrlForm] = useState({ public_url: '', alt_text: '' });
  const errors = useFormErrors(IMAGE_FIELDS);
  const dragged = useRef(null);
  async function run(task, done) {
    if (busy) return;
    setBusy(true); errors.reset(); setMessage('');
    try { await task(); await onChanged(); if (done) setMessage(done); }
    catch (err) { errors.capture(err); await onChanged(); }
    finally { setBusy(false); }
  }
  async function upload(fileList) {
    const files = [...(fileList || [])];
    if (!files.length || busy) return;
    setQueue(files.map((file) => ({ name: file.name, status: 'converting' })));
    let results = [];
    await run(async () => {
      results = await addStoreImages(store, product.id, files, (index, state) => setQueue((old) => old.map((row, i) => (i === index ? state : row))));
    });
    if (!results.length) return;
    const added = results.filter((r) => r.ok).length, failed = results.length - added;
    setMessage(`${added} of ${results.length} image${results.length === 1 ? '' : 's'} added${failed ? ` — ${failed} not added (see below)` : ''}.`);
  }
  const persistOrder = (ids) => run(() => reorderStoreMedia(store, product.id, ids), 'Order saved.');
  const move = (id, delta) => {
    const ids = media.map((m) => m.id), at = ids.indexOf(id), to = at + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    return persistOrder(ids);
  };
  function drop(targetId) {
    const from = dragged.current; dragged.current = null; setOver(null);
    if (!from || from === targetId) return;
    return persistOrder(dropOrder(media.map((m) => m.id), from, targetId));
  }
  async function saveAlt(row) {
    const next = alts[row.id];
    if (next === undefined || next.trim() === (row.alt_text || '')) return;
    await run(() => saveStoreMediaAlt(store, product.id, row.id, next, row.updated_at), 'Alt text saved.');
    setAlts((old) => { const copy = { ...old }; delete copy[row.id]; return copy; });
  }
  function remove(row) {
    if (!window.confirm('Remove this image from the gallery? The original file will be kept.')) return;
    return run(() => removeStoreMedia(store, product.id, row.id), 'Image removed from gallery.');
  }
  async function addByUrl(e) {
    e.preventDefault();
    const next = media.length ? Math.max(...media.map((m) => Number(m.sort_order) || 0)) + 1 : 0;
    await run(async () => { await saveStoreMedia(store, product.id, null, { ...urlForm, alt_text: urlForm.alt_text || product.name, sort_order: next }); setUrlForm({ public_url: '', alt_text: '' }); }, 'Image saved.');
  }
  return <section className="surface sc-panel"><h2>Product images</h2>
    <p className="hint">Customers see the primary image first, then the others in this order. Drag an image onto another to move it there, or use ← and →.</p>
    <Messages error={errors.banner} message={message} stale={errors.stale} />
    <label className={`sc-drop${busy ? ' is-busy' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (dragged.current) return; e.preventDefault(); upload(e.dataTransfer?.files); }}>
      <strong>{busy ? 'Working…' : 'Add images'}</strong>
      <span className="hint">Choose or drop several at once: JPEG, PNG or WebP. Each is converted to WebP under 150 KB before it is uploaded.</span>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ''; upload(files); }} />
    </label>
    {!!queue.length && <ul className="sc-queue" aria-live="polite">{queue.map((row, i) => <li key={`${i}-${row.name}`} className={`sc-queue__item is-${row.status}`}><span>{row.name}</span><span>{UPLOAD_STATUS[row.status]}{row.bytes && row.status === 'added' ? ` · ${kb(row.bytes)} WebP` : ''}{row.error ? `: ${row.error}` : ''}</span></li>)}</ul>}
    {!media.length ? <p className="adm-empty">No images yet. Add at least one before publishing.</p> : <ol className="sc-gallery" aria-label="Gallery order">{media.map((row, i) => <li key={row.id} className={`sc-image${over === row.id ? ' is-over' : ''}`} draggable={!busy}
        onDragStart={(e) => { dragged.current = row.id; e.dataTransfer?.setData?.('text/plain', row.id); }} onDragEnd={() => { dragged.current = null; setOver(null); }}
        onDragOver={(e) => { if (dragged.current) { e.preventDefault(); setOver(row.id); } }} onDrop={(e) => { if (!dragged.current) return; e.preventDefault(); e.stopPropagation?.(); drop(row.id); }}>
      <img src={row.public_url} alt={row.alt_text || product.name} draggable={false} />
      <div className="sc-image__meta"><span className="sc-image__pos">{i + 1}</span>{row.is_primary ? <span className="badge sc-primary">Primary</span> : <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => setStoreMediaPrimary(store, product.id, row.id), 'Primary image changed.')}>Make primary</button>}</div>
      <label className="sc-field"><span className="label">Alt text, image {i + 1}</span><input className="input" value={alts[row.id] ?? row.alt_text ?? ''} disabled={busy} onChange={(e) => setAlts((old) => ({ ...old, [row.id]: e.target.value }))} onBlur={() => saveAlt(row)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAlt(row); } }} /></label>
      <div className="sc-actions"><button type="button" className="btn btn-light btn-sm" aria-label={`Move image ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => move(row.id, -1)}>←</button><button type="button" className="btn btn-light btn-sm" aria-label={`Move image ${i + 1} later`} disabled={busy || i === media.length - 1} onClick={() => move(row.id, 1)}>→</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => remove(row)}>Remove</button></div>
    </li>)}</ol>}
    <form onSubmit={addByUrl} noValidate><fieldset disabled={busy}>
      <h3>Add by URL</h3><p className="hint">For an image already hosted, or a bundled /img/… path. It is added as it is — not converted.</p>
      <div className="adm-grid2"><Field form="img" errors={errors} label="Image URL" field="public_url" value={urlForm} set={setUrlForm} required /><Field form="img" errors={errors} label="Image description / alt text" field="alt_text" value={urlForm} set={setUrlForm} /></div>
      <div className="sc-actions"><button className="btn btn-sm" type="submit">Save image</button></div>
    </fieldset></form>
  </section>;
}

function ProductEditor({ store, productId }) {
  const navigate = useNavigate(), [params] = useSearchParams(), location = useLocation();
  const isNew = productId === 'new';
  // Warnings from the last save (or from the draft this editor was just created as).
  const [claims, setClaims] = useState(() => location?.state?.claimWarnings || []);
  const [categories, setCategories] = useState([]), [product, setProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, category_id: params.get('category') || '' });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [loadError, setLoadError] = useState(''), [refreshError, setRefreshError] = useState('');
  const errors = useFormErrors(PRODUCT_FIELDS(store));
  // The version of the row this form is editing, and that row's editable
  // values. Refs, not state: neither is rendered, and the token must be
  // current inside an in-flight save.
  const base = useRef(null);
  useEffect(() => {
    let current = true;
    Promise.all([listStoreCategories(store), isNew ? Promise.resolve(null) : getStoreProduct(store, productId)]).then(([cats, row]) => {
      if (!current) return; setCategories(cats); setProduct(row); if (row) { setForm(row); base.current = row; }
    }).catch((err) => { if (current) setLoadError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [store, productId, isNew]);
  // After this editor's own gallery or variant write. A gallery write moves the
  // product's updated_at (the images[] cache trigger), so the token is adopted
  // from the fresh row — but only when nothing this form saves has changed
  // under it. If another admin saved the product meanwhile, the old token
  // stays and the next save here is refused instead of overwriting theirs.
  async function refresh() {
    try {
      const fresh = await getStoreProduct(store, productId);
      if (versionAfterOwnWrite(base.current, fresh) === fresh.updated_at) base.current = fresh;
      setProduct(fresh);
    } catch { setRefreshError('Changes were saved, but the updated product could not be loaded. Reload this page before making more changes.'); }
  }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); errors.reset(); setMessage(''); setRefreshError(''); setClaims([]);
    try {
      const row = await saveStoreProduct(store, isNew ? null : productId, form, isNew ? null : base.current?.updated_at);
      // Warn, never block: the save has already happened.
      const warnings = productClaimWarnings(row);
      if (isNew) { navigate(`/admin/store-catalogue/${store}/${row.id}`, { replace: true, state: warnings.length ? { claimWarnings: warnings } : undefined }); return; }
      setClaims(warnings);
      base.current = { ...base.current, ...row };
      setForm((old) => ({ ...old, ...row }));
      await refresh(); setMessage(row.is_active ? 'Published. Refresh the storefront to see your changes.' : 'Draft saved. Add images and stock/variants, then publish above.');
    } catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading product…</p>;
  if (loadError) return <Messages error={loadError} />;
  return <div className="adm-form sc-product">
    <div className="sc-actions"><Link className="inline-link" to={`/admin/store-catalogue/${store}`}>← Back to products</Link>{product?.is_active && catalogueProductHref(store, product.slug) && <a className="inline-link" href={catalogueProductHref(store, product.slug)} target="_blank" rel="noreferrer">View product ↗</a>}</div>
    <Messages error={errors.banner || refreshError} message={message} stale={errors.stale} />
    <ClaimNotice warnings={claims} />
    <form className="surface sc-panel" onSubmit={save} noValidate><h2>{isNew ? 'Add product' : product?.name}</h2><p className="hint">{isNew ? '1. Create a draft → 2. Add images and stock/variants → 3. Publish.' : `Status: ${product?.is_active ? 'Published' : 'Draft — not visible to customers'}. Images and variants have their own save buttons below.`}</p><fieldset disabled={busy}>
      <div className="adm-grid2">
        <Field form="prod" errors={errors} label="Product name" field="name" value={form} set={setForm} required />
        <Field form="prod" errors={errors} label="Slug" field="slug" value={form} set={setForm} hint={form.slug ? 'Changing a slug changes the product link.' : `Automatic: ${catalogueSlug(form.name) || 'product-name'}`} />
        <CategorySelect form="prod" errors={errors} categories={categories} value={form.category_id} onChange={(category_id) => setForm({ ...form, category_id })} />
        <Field form="prod" errors={errors} label="Brand" field="brand" value={form} set={setForm} />
        <Field form="prod" errors={errors} label="MRP ₹" field="mrp" type="number" min="0.01" step="0.01" value={form} set={setForm} required />
        <Field form="prod" errors={errors} label="Selling price ₹ (optional)" field="sale_price" type="number" min="0.01" max={form.mrp || undefined} step="0.01" value={form} set={setForm} hint="Leave blank to sell at MRP. Discount is calculated automatically." />
        <Field form="prod" errors={errors} label="Product SKU (optional)" field="sku" value={form} set={setForm} />
        <Field form="prod" errors={errors} label="Pack / dimensions (optional)" field="net_content" value={form} set={setForm} hint="Example: Set of 2 · 40 × 40 cm" />
        {store !== 'fashion' && <Field form="prod" errors={errors} label="Stock quantity (without variants)" field="stock" type="number" min="0" step="1" value={form} set={setForm} required />}
        <Field form="prod" errors={errors} label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
      </div>
      <h3>Tax</h3>
      <div className="adm-grid2">
        <Field form="prod" errors={errors} label="HSN code (optional)" field="hsn_code" value={form} set={setForm} hint="4, 6 or 8 digits. Example: 6302 (bed linen)." />
        <Field form="prod" errors={errors} label="GST rate % (optional)" field="gst_rate" type="number" min="0" max="100" step="0.01" value={form} set={setForm} hint="0 to 100. Leave blank if not yet known." />
      </div>
      <p className="adm-banner info sc-note" role="note">{gstNote(store)}</p>
      {!categories.length && <p className="hint"><Link to={`/admin/store-catalogue/${store}?tab=categories`}>Create a category first</Link>.</p>}
      <Field form="prod" errors={errors} label="Description" field="description" value={form} set={setForm} multiline />
      <div className="sc-actions"><Check label="New arrival" field="is_new" value={form} set={setForm} /><Check label="Bestseller" field="is_bestseller" value={form} set={setForm} />{!isNew && <Check label="Published / visible to customers" field="is_active" value={form} set={setForm} />}</div>
      <button className="btn" type="submit" disabled={!categories.length}>{busy ? 'Saving…' : isNew ? 'Create draft & continue' : 'Save product'}</button>
    </fieldset></form>
    {!isNew && product && <><GalleryEditor store={store} product={product} onChanged={refresh} /><VariantsEditor store={store} product={product} onChanged={refresh} /></>}
  </div>;
}

export default function StoreCatalogue() {
  const { store, productId } = useParams(), navigate = useNavigate();
  if (!Object.hasOwn(CATALOGUE_STORES, store)) return <div className="adm-empty">Choose a store: <Link to="/admin/store-catalogue/fashion">Fashion</Link> · <Link to="/admin/store-catalogue/homeliving">Home &amp; Living</Link> · <Link to="/admin/store-catalogue/grocery">Grocery</Link></div>;
  return <div className="adm-catalogue"><div className="adm__head"><div><h1>Store Products</h1><p>Manage products and categories for Fashion, Home &amp; Living and Grocery. Lifestyle brings Fashion and Home &amp; Living together.</p></div><Link className="btn btn-outline btn-sm" to="/admin/storefronts">Storefront design</Link></div>
    <div className="sc-toolbar"><label className="sc-field"><span className="label">Store</span><select className="select" value={store} disabled={!!productId} onChange={(e) => navigate(`/admin/store-catalogue/${e.target.value}`)}>{Object.entries(CATALOGUE_STORES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><a className="inline-link" href={`/${store}`} target="_blank" rel="noreferrer">View {CATALOGUE_STORES[store]} ↗</a>{store !== 'grocery' && <a className="inline-link" href="/lifestyle" target="_blank" rel="noreferrer">View Lifestyle ↗</a>}</div>
    {store === 'grocery' && <div className="adm-banner info" role="note"><strong>Not for sale yet.</strong> {GROCERY_NOT_SOLD}</div>}
    {productId ? <ProductEditor key={`${store}-${productId}`} store={store} productId={productId} /> : <CatalogueList key={store} store={store} />}
  </div>;
}
