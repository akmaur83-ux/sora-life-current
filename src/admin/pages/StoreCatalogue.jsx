import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { money } from '../../lib/format.js';
import { CATALOGUE_STORES, catalogueSlug, categoryOptions, catalogueProductHref } from '../../lib/storeCatalogueAdmin.js';
import { listStoreCategories, listStoreProducts, getStoreProduct, saveStoreProduct, saveStoreCategory, saveStoreVariant, uploadStoreImage, saveStoreMedia, removeStoreMedia } from '../../lib/storeCatalogueAdminApi.js';

const EMPTY_PRODUCT = { name: '', slug: '', brand: '', description: '', category_id: '', mrp: '', sale_price: '', sku: '', net_content: '', stock: 0, sort_order: 0, is_active: false, is_new: false, is_bestseller: false };
const EMPTY_CATEGORY = { name: '', slug: '', parent_id: '', tagline: '', image_url: '', sort_order: 0, is_active: true };
const EMPTY_VARIANT = { size: '', colour: '', colour_hex: '', sku: '', stock: 0, price_override: '', is_active: true, sort_order: 0 };

function Field({ label, field, value, set, type = 'text', required = false, hint, min, max, step, multiline = false }) {
  return <label className="field sc-field"><span className="label">{label}</span>
    {multiline ? <textarea className="textarea" rows="4" value={value[field] ?? ''} onChange={(e) => set({ ...value, [field]: e.target.value })} />
      : <input className="input" type={type} required={required} min={min} max={max} step={step} value={value[field] ?? ''} onChange={(e) => set({ ...value, [field]: e.target.value })} />}
    {hint && <span className="hint">{hint}</span>}
  </label>;
}
function Check({ label, field, value, set }) {
  return <label className="adm-checkrow"><input type="checkbox" checked={!!value[field]} onChange={(e) => set({ ...value, [field]: e.target.checked })} />{label}</label>;
}
function CategorySelect({ categories, value, onChange, label = 'Category / subcategory', optional = false }) {
  return <label className="field sc-field"><span className="label">{label}</span><select className="select" required={!optional} value={value || ''} onChange={(e) => onChange(e.target.value)}>
    <option value="">{optional ? 'Top-level category' : 'Choose a category'}</option>
    {categoryOptions(categories).map((row) => <option key={row.id} value={row.id}>{row.label}{row.is_active ? '' : ' (hidden)'}</option>)}
  </select></label>;
}
function Messages({ error, message }) {
  return <>{error && <div className="adm-banner err" role="alert">{error}</div>}{message && <div className="adm-banner ok" role="status">{message}</div>}</>;
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
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  async function save(e) {
    e.preventDefault(); if (busy || uploading) return;
    setBusy(true); setError('');
    try { await saveStoreCategory(store, initial?.id, form); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="surface sc-panel" onSubmit={save}><h2>{initial ? 'Edit category' : 'Add category'}</h2>
    <Messages error={error} />
    <fieldset disabled={busy || uploading}>
      <div className="adm-grid2">
        <Field label="Category name" field="name" value={form} set={setForm} required />
        <Field label="Slug" field="slug" value={form} set={setForm} hint={form.slug ? 'Changing a slug changes its storefront link.' : `Automatic: ${catalogueSlug(form.name) || 'category-name'}`} />
        <CategorySelect categories={categories.filter((row) => row.id !== initial?.id)} value={form.parent_id} optional label="Parent category (up to 3 levels)" onChange={(parent_id) => setForm({ ...form, parent_id })} />
        <Field label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
      </div>
      <Field label="Tagline" field="tagline" value={form} set={setForm} />
      <Field label="Category image URL" field="image_url" value={form} set={setForm} />
    </fieldset>
    <Upload store={store} disabled={busy} onUpload={(image_url) => setForm((old) => ({ ...old, image_url }))} onBusy={setUploading} onError={setError} />
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
          return <tr key={row.id}><td><div className="adm-row-name"><span className="adm-thumb">{row.images?.[0] && <img src={row.images[0]} alt="" loading="lazy" />}</span><div><strong>{row.name}</strong><span>{row.sku || row.slug}</span></div></div></td><td>{categoriesById.get(row.category_id) || 'Unassigned'}</td><td>{money(row.sale_price ?? row.mrp)}</td><td>{stock || 0}</td><td>{row.is_active ? 'Published' : 'Draft'}</td><td><Link className="inline-link" to={`/admin/store-catalogue/${store}/${row.id}`}>Edit</Link>{row.is_active && <> · <a className="inline-link" href={catalogueProductHref(store, row.slug)} target="_blank" rel="noreferrer">View</a></>}</td></tr>;
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
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await saveStoreVariant(store, product.id, editing, form); setForm(EMPTY_VARIANT); setEditing(null); await onChanged(); setMessage('Variant saved.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="surface sc-panel"><h2>Sizes, colours &amp; stock</h2><p className="hint">{store === 'fashion' ? 'Fashion stock comes from these variants. For a single option use “One size” and its colour, or “Default”.' : 'Optional: add sizes or colours for this product. When active variants exist, their stock is used instead of product stock.'}</p>
    <Messages error={error} message={message} />
    {!!product.variants?.length && <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Size / option</th><th>Colour</th><th>Stock</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>{product.variants.map((row) => <tr key={row.id}><td>{row.size}</td><td>{row.colour || '—'}</td><td>{row.stock}</td><td>{row.price_override == null ? 'Product price' : money(row.price_override)}</td><td>{row.is_active ? 'Active' : 'Hidden'}</td><td><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setEditing(row.id); setForm(row); setMessage(''); }}>Edit</button></td></tr>)}</tbody></table></div>}
    <form onSubmit={save}><fieldset disabled={busy}><h3>{editing ? 'Edit variant' : 'Add variant'}</h3><div className="adm-grid2">
      <Field label="Size / option" field="size" value={form} set={setForm} required />
      <Field label={`Colour${store === 'homeliving' ? ' (optional)' : ''}`} field="colour" value={form} set={setForm} required={store === 'fashion'} />
      <Field label="Colour hex (optional)" field="colour_hex" value={form} set={setForm} hint="Example: #A9B48C" />
      <Field label="Variant SKU (optional)" field="sku" value={form} set={setForm} />
      <Field label="Stock quantity" field="stock" type="number" min="0" step="1" value={form} set={setForm} required />
      <Field label="Price override ₹ (optional)" field="price_override" type="number" min="0.01" step="0.01" value={form} set={setForm} hint="Leave blank to use the product selling price." />
      <Field label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
    </div><Check label="Active variant" field="is_active" value={form} set={setForm} /><div className="sc-actions"><button className="btn btn-sm" type="submit">{busy ? 'Saving…' : 'Save variant'}</button>{editing && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditing(null); setForm(EMPTY_VARIANT); }}>Cancel edit</button>}</div></fieldset></form>
  </section>;
}

function GalleryEditor({ store, product, onChanged }) {
  const empty = () => ({ public_url: '', alt_text: product.name, sort_order: Math.max(-1, ...(product.media || []).map((row) => row.sort_order)) + 1, is_primary: !product.media?.length });
  const [form, setForm] = useState(empty), [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault(); if (busy || uploading) return;
    setBusy(true); setError(''); setMessage('');
    try { await saveStoreMedia(store, product.id, editing, form); await onChanged(); setForm({ ...empty(), sort_order: Number(form.sort_order) + 1, is_primary: false }); setEditing(null); setMessage('Image saved.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(row) {
    if (!window.confirm('Remove this image from the gallery? The original file will be kept.')) return;
    setBusy(true); setError(''); setMessage('');
    try { await removeStoreMedia(store, product.id, row.id); await onChanged(); if (editing === row.id) { setEditing(null); setForm(empty()); } setMessage('Image removed from gallery.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="surface sc-panel"><h2>Product images</h2><p className="hint">Upload an image or paste a public image URL, then save it. Choose a primary image for product cards.</p><Messages error={error} message={message} />
    <div className="sc-gallery">{[...(product.media || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order).map((row) => <div key={row.id} className="sc-image"><img src={row.public_url} alt={row.alt_text || product.name} /><span className="hint">{row.is_primary ? 'Primary · ' : ''}Order {row.sort_order}</span><div className="sc-actions"><button type="button" className="btn btn-outline btn-sm" disabled={busy || uploading} onClick={() => { setEditing(row.id); setForm(row); setMessage(''); }}>Edit</button><button type="button" className="btn btn-outline btn-sm" disabled={busy || uploading} onClick={() => remove(row)}>Remove</button></div></div>)}</div>
    <form onSubmit={save}><fieldset disabled={busy || uploading}>
      <h3>{editing ? 'Edit image' : 'Add image'}</h3>
      <Field label="Image URL" field="public_url" value={form} set={setForm} required />
    </fieldset>
      <Upload store={store} disabled={busy} onUpload={(public_url) => setForm((old) => ({ ...old, public_url }))} onBusy={setUploading} onError={setError} />
      <fieldset disabled={busy || uploading}><div className="adm-grid2"><Field label="Image description / alt text" field="alt_text" value={form} set={setForm} /><Field label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} /></div>
        <Check label="Use as primary image" field="is_primary" value={form} set={setForm} /><div className="sc-actions"><button className="btn btn-sm" type="submit">{busy ? 'Saving…' : 'Save image'}</button>{editing && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditing(null); setForm(empty()); }}>Cancel edit</button>}</div>
      </fieldset>
    </form>
  </section>;
}

function ProductEditor({ store, productId }) {
  const navigate = useNavigate(), [params] = useSearchParams();
  const isNew = productId === 'new';
  const [categories, setCategories] = useState([]), [product, setProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, category_id: params.get('category') || '' });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [loadError, setLoadError] = useState('');
  useEffect(() => {
    let current = true;
    Promise.all([listStoreCategories(store), isNew ? Promise.resolve(null) : getStoreProduct(store, productId)]).then(([cats, row]) => {
      if (!current) return; setCategories(cats); setProduct(row); if (row) setForm(row);
    }).catch((err) => { if (current) setLoadError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [store, productId, isNew]);
  async function refresh() {
    try { setProduct(await getStoreProduct(store, productId)); }
    catch { setError('Changes were saved, but the updated product could not be loaded. Reload this page before making more changes.'); }
  }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const row = await saveStoreProduct(store, isNew ? null : productId, form);
      if (isNew) { navigate(`/admin/store-catalogue/${store}/${row.id}`, { replace: true }); return; }
      setForm((old) => ({ ...old, ...row }));
      await refresh(); setMessage(row.is_active ? 'Published. Refresh the storefront to see your changes.' : 'Draft saved. Add images and stock/variants, then publish above.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading product…</p>;
  if (loadError) return <Messages error={loadError} />;
  return <div className="adm-form sc-product">
    <div className="sc-actions"><Link className="inline-link" to={`/admin/store-catalogue/${store}`}>← Back to products</Link>{product?.is_active && <a className="inline-link" href={catalogueProductHref(store, product.slug)} target="_blank" rel="noreferrer">View product ↗</a>}</div>
    <Messages error={error} message={message} />
    <form className="surface sc-panel" onSubmit={save}><h2>{isNew ? 'Add product' : product?.name}</h2><p className="hint">{isNew ? '1. Create a draft → 2. Add images and stock/variants → 3. Publish.' : `Status: ${product?.is_active ? 'Published' : 'Draft — not visible to customers'}. Images and variants have their own save buttons below.`}</p><fieldset disabled={busy}>
      <div className="adm-grid2">
        <Field label="Product name" field="name" value={form} set={setForm} required />
        <Field label="Slug" field="slug" value={form} set={setForm} hint={form.slug ? 'Changing a slug changes the product link.' : `Automatic: ${catalogueSlug(form.name) || 'product-name'}`} />
        <CategorySelect categories={categories} value={form.category_id} onChange={(category_id) => setForm({ ...form, category_id })} />
        <Field label="Brand" field="brand" value={form} set={setForm} />
        <Field label="MRP ₹" field="mrp" type="number" min="0.01" step="0.01" value={form} set={setForm} required />
        <Field label="Selling price ₹ (optional)" field="sale_price" type="number" min="0.01" max={form.mrp || undefined} step="0.01" value={form} set={setForm} hint="Leave blank to sell at MRP. Discount is calculated automatically." />
        <Field label="Product SKU (optional)" field="sku" value={form} set={setForm} />
        <Field label="Pack / dimensions (optional)" field="net_content" value={form} set={setForm} hint="Example: Set of 2 · 40 × 40 cm" />
        {store === 'homeliving' && <Field label="Stock quantity (without variants)" field="stock" type="number" min="0" step="1" value={form} set={setForm} required />}
        <Field label="Display order" field="sort_order" type="number" step="1" value={form} set={setForm} />
      </div>
      {!categories.length && <p className="hint"><Link to={`/admin/store-catalogue/${store}?tab=categories`}>Create a category first</Link>.</p>}
      <Field label="Description" field="description" value={form} set={setForm} multiline />
      <div className="sc-actions"><Check label="New arrival" field="is_new" value={form} set={setForm} /><Check label="Bestseller" field="is_bestseller" value={form} set={setForm} />{!isNew && <Check label="Published / visible to customers" field="is_active" value={form} set={setForm} />}</div>
      <button className="btn" type="submit" disabled={!categories.length}>{busy ? 'Saving…' : isNew ? 'Create draft & continue' : 'Save product'}</button>
    </fieldset></form>
    {!isNew && product && <><GalleryEditor store={store} product={product} onChanged={refresh} /><VariantsEditor store={store} product={product} onChanged={refresh} /></>}
  </div>;
}

export default function StoreCatalogue() {
  const { store, productId } = useParams(), navigate = useNavigate();
  if (!Object.hasOwn(CATALOGUE_STORES, store)) return <div className="adm-empty">Choose a store: <Link to="/admin/store-catalogue/fashion">Fashion</Link> · <Link to="/admin/store-catalogue/homeliving">Home &amp; Living</Link></div>;
  return <div className="adm-catalogue"><div className="adm__head"><div><h1>Store Products</h1><p>Manage products and categories for Fashion and Home &amp; Living. Lifestyle brings both stores together.</p></div><Link className="btn btn-outline btn-sm" to="/admin/storefronts">Storefront design</Link></div>
    <div className="sc-toolbar"><label className="sc-field"><span className="label">Store</span><select className="select" value={store} disabled={!!productId} onChange={(e) => navigate(`/admin/store-catalogue/${e.target.value}`)}>{Object.entries(CATALOGUE_STORES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><a className="inline-link" href={`/${store}`} target="_blank" rel="noreferrer">View {CATALOGUE_STORES[store]} ↗</a><a className="inline-link" href="/lifestyle" target="_blank" rel="noreferrer">View Lifestyle ↗</a></div>
    {productId ? <ProductEditor key={`${store}-${productId}`} store={store} productId={productId} /> : <CatalogueList key={store} store={store} />}
  </div>;
}
