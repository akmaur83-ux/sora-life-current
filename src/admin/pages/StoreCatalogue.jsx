import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money } from '../../lib/format.js';
import { CATALOGUE_STORES, catalogueSlug, categoryOptions, catalogueProductHref, catalogueFailureView, versionAfterOwnWrite, gstNote, GROCERY_NOT_SOLD, GROCERY_VARIANTS_UNREAD } from '../../lib/storeCatalogueAdmin.js';
import { listStoreCategories, listStoreProducts, getStoreProduct, saveStoreProduct, saveStoreCategory, saveStoreVariant, uploadStoreImage, saveStoreMedia, removeStoreMedia } from '../../lib/storeCatalogueAdminApi.js';

const EMPTY_PRODUCT = { name: '', slug: '', brand: '', description: '', category_id: '', mrp: '', sale_price: '', sku: '', net_content: '', hsn_code: '', gst_rate: '', stock: 0, sort_order: 0, is_active: false, is_new: false, is_bestseller: false };
const EMPTY_CATEGORY = { name: '', slug: '', parent_id: '', tagline: '', image_url: '', sort_order: 0, is_active: true };
const EMPTY_VARIANT = { size: '', colour: '', colour_hex: '', sku: '', stock: 0, price_override: '', is_active: true, sort_order: 0 };

// The fields each form renders. A save error for one of these is shown beside
// it; anything else goes in the form's banner (catalogueFailureView).
const PRODUCT_FIELDS = (store) => ['name', 'slug', 'category_id', 'brand', 'mrp', 'sale_price', 'sku', 'net_content', 'hsn_code', 'gst_rate', ...(store === 'fashion' ? [] : ['stock']), 'sort_order', 'description'];
const CATEGORY_FIELDS = ['name', 'slug', 'parent_id', 'sort_order', 'tagline', 'image_url'];
const VARIANT_FIELDS = ['size', 'colour', 'colour_hex', 'sku', 'stock', 'price_override', 'sort_order'];
const IMAGE_FIELDS = ['public_url', 'alt_text', 'sort_order'];

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

function CatalogueList({ store }) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]), [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const tab = params.get('tab') === 'categories' ? 'categories' : 'products';
  const category = params.get('category') || '', search = params.get('q') || '';
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    Promise.all([listStoreCategories(store), listStoreProducts(store)]).then(([cats, rows]) => { if (current) { setCategories(cats); setProducts(rows); } })
      .catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [store, revision]);
  const update = (patch) => setParams((old) => { const next = new URLSearchParams(old); for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); } return next; }, { replace: true });
  const shown = products.filter((row) => (!category || row.category_id === category) && `${row.name} ${row.sku || ''} ${row.brand}`.toLowerCase().includes(search.toLowerCase()));
  const categoriesById = new Map(categoryOptions(categories).map((row) => [row.id, row.label]));
  return <>
    <div className="adm-chipbar" aria-label="Catalogue section">
      <button className={`adm-chip${tab === 'products' ? ' active' : ''}`} onClick={() => update({ tab: '' })}>Products</button>
      <button className={`adm-chip${tab === 'categories' ? ' active' : ''}`} onClick={() => update({ tab: 'categories' })}>Categories &amp; subcategories</button>
    </div>
    <Messages error={error} />
    {loading ? <p role="status">Loading catalogue…</p> : error ? <button className="btn btn-outline" onClick={() => setRevision((n) => n + 1)}>Retry loading</button> : tab === 'products' ? <>
      <div className="sc-toolbar">
        <label className="sc-field"><span className="label">Search products</span><input className="input" value={search} onChange={(e) => update({ q: e.target.value })} placeholder="Name, brand or SKU" /></label>
        <label className="sc-field"><span className="label">Category / subcategory</span><select className="select" value={category} onChange={(e) => update({ category: e.target.value })}><option value="">All categories</option>{categoryOptions(categories).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <Link className="btn btn-sm" to={`/admin/store-catalogue/${store}/new${category ? `?category=${encodeURIComponent(category)}` : ''}`}>+ Add product</Link>
      </div>
      <p className="hint">{shown.length} of {products.length} products · includes drafts</p>
      {!shown.length ? <div className="adm-empty">No products in this selection. Add a product, or choose another category.</div> : <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {shown.map((row) => {
          const variants = (row.variants || []).filter((v) => v.is_active !== false);
          const stock = store === 'fashion' || variants.length ? variants.reduce((n, v) => n + Number(v.stock || 0), 0) : row.stock;
          return <tr key={row.id}><td><div className="adm-row-name"><span className="adm-thumb">{row.images?.[0] && <img src={row.images[0]} alt="" loading="lazy" />}</span><div><strong>{row.name}</strong><span>{row.sku || row.slug}</span></div></div></td><td>{categoriesById.get(row.category_id) || 'Unassigned'}</td><td>{money(row.sale_price ?? row.mrp)}</td><td>{stock || 0}</td><td>{row.is_active ? 'Published' : 'Draft'}</td><td><Link className="inline-link" to={`/admin/store-catalogue/${store}/${row.id}`}>Edit</Link>{row.is_active && catalogueProductHref(store, row.slug) && <> · <a className="inline-link" href={catalogueProductHref(store, row.slug)} target="_blank" rel="noreferrer">View</a></>}</td></tr>;
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
    {!!product.variants?.length && <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Size / option</th><th>Colour</th><th>Stock</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>{product.variants.map((row) => <tr key={row.id}><td>{row.size}</td><td>{row.colour || '—'}</td><td>{row.stock}</td><td>{row.price_override == null ? 'Product price' : money(row.price_override)}</td><td>{row.is_active ? 'Active' : 'Hidden'}</td><td><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setEditing(row.id); setForm(row); setMessage(''); errors.reset(); }}>Edit</button></td></tr>)}</tbody></table></div>}
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

function GalleryEditor({ store, product, onChanged }) {
  const empty = () => ({ public_url: '', alt_text: product.name, sort_order: Math.max(-1, ...(product.media || []).map((row) => row.sort_order)) + 1, is_primary: !product.media?.length });
  const [form, setForm] = useState(empty), [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState(''), [message, setMessage] = useState('');
  const errors = useFormErrors(IMAGE_FIELDS);
  async function save(e) {
    e.preventDefault(); if (busy || uploading) return;
    setBusy(true); errors.reset(); setUploadError(''); setMessage('');
    try { await saveStoreMedia(store, product.id, editing, form); await onChanged(); setForm({ ...empty(), sort_order: Number(form.sort_order) + 1, is_primary: false }); setEditing(null); setMessage('Image saved.'); }
    catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  async function remove(row) {
    if (!window.confirm('Remove this image from the gallery? The original file will be kept.')) return;
    setBusy(true); errors.reset(); setMessage('');
    try { await removeStoreMedia(store, product.id, row.id); await onChanged(); if (editing === row.id) { setEditing(null); setForm(empty()); } setMessage('Image removed from gallery.'); }
    catch (err) { errors.capture(err); }
    finally { setBusy(false); }
  }
  return <section className="surface sc-panel"><h2>Product images</h2><p className="hint">Upload an image or paste a public image URL, then save it. Choose a primary image for product cards.</p><Messages error={errors.banner || uploadError} message={message} />
    <div className="sc-gallery">{[...(product.media || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order).map((row) => <div key={row.id} className="sc-image"><img src={row.public_url} alt={row.alt_text || product.name} /><span className="hint">{row.is_primary ? 'Primary · ' : ''}Order {row.sort_order}</span><div className="sc-actions"><button type="button" className="btn btn-outline btn-sm" disabled={busy || uploading} onClick={() => { setEditing(row.id); setForm(row); setMessage(''); errors.reset(); }}>Edit</button><button type="button" className="btn btn-outline btn-sm" disabled={busy || uploading} onClick={() => remove(row)}>Remove</button></div></div>)}</div>
    <form onSubmit={save} noValidate><fieldset disabled={busy || uploading}>
      <h3>{editing ? 'Edit image' : 'Add image'}</h3>
      <Field form="img" errors={errors} label="Image URL" field="public_url" value={form} set={setForm} required />
    </fieldset>
      <Upload store={store} disabled={busy} onUpload={(public_url) => setForm((old) => ({ ...old, public_url }))} onBusy={setUploading} onError={setUploadError} />
      <fieldset disabled={busy || uploading}><div className="adm-grid2"><Field form="img" errors={errors} label="Image description / alt text" field="alt_text" value={form} set={setForm} /><Field form="img" errors={errors} label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} /></div>
        <Check label="Use as primary image" field="is_primary" value={form} set={setForm} /><div className="sc-actions"><button className="btn btn-sm" type="submit">{busy ? 'Saving…' : 'Save image'}</button>{editing && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditing(null); setForm(empty()); errors.reset(); }}>Cancel edit</button>}</div>
      </fieldset>
    </form>
  </section>;
}

function ProductEditor({ store, productId }) {
  const navigate = useNavigate(), [params] = useSearchParams();
  const isNew = productId === 'new';
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
    setBusy(true); errors.reset(); setMessage(''); setRefreshError('');
    try {
      const row = await saveStoreProduct(store, isNew ? null : productId, form, isNew ? null : base.current?.updated_at);
      if (isNew) { navigate(`/admin/store-catalogue/${store}/${row.id}`, { replace: true }); return; }
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
