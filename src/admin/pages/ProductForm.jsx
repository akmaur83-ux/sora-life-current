import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { adminListProducts, adminCreateProduct, adminUpdateProduct } from '../../lib/adminApi.js';
import MediaGallery from '../components/MediaGallery.jsx';
import { categories as staticCategories } from '../../data/categories.js';
import { money } from '../../lib/format.js';
import { mediaFailureMessage } from '../../lib/productMediaOperations.js';

const DISCOUNT_TIERS = [0, 10, 15, 18, 20];
const empty = {
  name: '', slug: '', description: '', category: staticCategories[0]?.slug || '',
  image: '', gallery: [], originalPrice: '', discountPercent: 10, form: '', inStock: true,
  permalink: '', isNew: false, isBestseller: false, isFeatured: false, rating: 0, reviewCount: 0, isActive: true,
};

export default function ProductForm() {
  const { dbId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!dbId;
  const [values, setValues] = useState(empty);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [customDiscount, setCustomDiscount] = useState(false);
  const mediaRef = useRef(null);

  // Surface a partial-upload warning carried over after creating a product.
  useEffect(() => { if (location.state?.mediaWarning) setErr(location.state.mediaWarning); }, [location.state]);

  // The Media Gallery owns the images; it reports the current primary URL so the
  // product row's image_url (used by the grid, cart, wishlist, passport) stays
  // in sync. Blob previews from the New-Product staging flow are ignored — the
  // real URL is written by commitStaged() after the product row exists.
  // MUST be stable (useCallback): the gallery's load effect depends on this
  // identity; an inline function re-created every render caused an infinite
  // load→setState→render→load loop.
  const onPrimaryChange = useCallback((url) => {
    if (typeof url === 'string' && !url.startsWith('blob:')) setValues((s) => (s.image === url ? s : { ...s, image: url }));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminListProducts().then((list) => {
      // products.id is a numeric Supabase column, so dbId on each product
      // is a JS number — but useParams() always returns route params as
      // strings, regardless of the underlying column type. Compare as
      // strings so this works whether dbId is numeric, text, or a UUID.
      const p = list.find((x) => String(x.dbId) === String(dbId));
      if (!p) { setErr('Product not found.'); setLoading(false); return; }
      setValues({
        name: p.name, slug: p.slug, description: p.description, category: p.category,
        image: p.image || '', gallery: p.gallery || [], originalPrice: p.originalPrice, discountPercent: p.discountPercent,
        form: p.form || '', inStock: p.inStock !== undefined ? p.inStock : p.stock > 0, permalink: p.permalink || '',
        isNew: p.isNew, isBestseller: p.isBestseller, isFeatured: p.isFeatured,
        rating: p.rating, reviewCount: p.reviewCount, isActive: p.isActive,
      });
      if (!DISCOUNT_TIERS.includes(p.discountPercent)) setCustomDiscount(true);
      setLoading(false);
    }).catch((e) => { setErr(e.message || String(e)); setLoading(false); });
  }, [dbId, isEdit]);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const original = Number(values.originalPrice) || 0;
  const discount = Number(values.discountPercent) || 0;
  const salePrice = original > 0 ? Math.round(original * (1 - discount / 100)) : 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (mediaRef.current?.isBusy?.()) { setErr('Wait for the current media operation to finish before saving.'); return; }
    // The `min` attribute alone is a hint the browser can be talked out of.
    // A product saved at zero renders "Price coming soon" and can never be
    // bought — the server refuses the line at checkout — so refuse it here.
    if (!(original > 0)) {
      setErr('Enter an original price of at least ₹1 — a product with no price cannot be purchased.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim() || slugify(values.name),
        description: values.description,
        category: values.category,
        // Never persist a transient blob: preview as the image URL — the real
        // primary is written by the gallery (live) or commitStaged (new).
        image: values.image && !values.image.startsWith('blob:') ? values.image : '',
        gallery: values.gallery,
        originalPrice: original,
        discountPercent: discount,
        form: values.form,
        inStock: values.inStock,
        permalink: values.permalink,
        isNew: values.isNew, isBestseller: values.isBestseller, isFeatured: values.isFeatured,
        rating: Number(values.rating) || 0, reviewCount: Number(values.reviewCount) || 0,
        isActive: values.isActive,
      };
      if (isEdit) {
        await adminUpdateProduct(dbId, payload);
      } else {
        const created = await adminCreateProduct(payload);
        // Commit any images staged during creation against the new product id.
        // Partial upload failures don't roll back the product — the admin lands
        // on the live editor to retry just the failed images.
        if (mediaRef.current?.hasStaged?.()) {
          let result;
          try { result = await mediaRef.current.commitStaged(created.dbId); }
          catch (error) { result = { ok: false, primaryError: error.message || 'Could not finish media uploads.' }; }
          if (!result?.ok) {
            navigate(`/admin/products/${created.dbId}/edit`, {
              state: { mediaWarning: `Product created; media needs attention. ${result?.created?.length || 0} image(s) saved. ${mediaFailureMessage(result || {})}`, mediaCleanupPending: result?.cleanupPending || [] },
            });
            setSaving(false);
            return;
          }
        }
      }
      navigate('/admin/products');
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form">
      <div className="adm__head">
        <div>
          <h1>{isEdit ? 'Edit product' : 'Add product'}</h1>
          <p>{isEdit ? values.name : 'Create a new Sora Life product'}</p>
        </div>
        <Link to="/admin/products" className="btn btn-outline btn-sm">← Back to products</Link>
      </div>

      {err && <div className="adm-banner err">{err}</div>}

      <form onSubmit={onSubmit}>
        <div className="surface">
          <h2>Basics</h2>
          <div className="field">
            <label className="label">Product name</label>
            <input className="input" required value={values.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="adm-grid2">
            <div className="field">
              <label className="label">Slug (URL)</label>
              <input className="input" value={values.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated from name" />
            </div>
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={values.category} onChange={(e) => set('category', e.target.value)}>
                {staticCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea className="textarea" value={values.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Size / form (e.g. "100 ml")</label>
            <input className="input" value={values.form} onChange={(e) => set('form', e.target.value)} />
          </div>
        </div>

        <MediaGallery
          key={dbId || 'new'}
          ref={mediaRef}
          productId={isEdit ? Number(dbId) : null}
          productName={values.name}
          legacyGalleryUrls={values.gallery}
          initialCleanupPending={location.state?.mediaCleanupPending || []}
          onPrimaryChange={onPrimaryChange}
        />

        <div className="surface">
          <h2>Pricing</h2>
          <div className="adm-grid2">
            <div className="field">
              <label className="label">Original price / MRP (₹)</label>
              <input className="input" type="number" min="1" step="1" required value={values.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} />
              {/* min="0" let a product be published at zero: the storefront
                  then showed "Price coming soon" and the server refused the
                  line at checkout. A published product needs a real price. */}
              <p className="hint">Must be at least ₹1. A product with no price cannot be purchased.</p>
            </div>
            <div className="field">
              <label className="label">Discount</label>
              {!customDiscount ? (
                <select className="select" value={values.discountPercent} onChange={(e) => e.target.value === 'custom' ? setCustomDiscount(true) : set('discountPercent', Number(e.target.value))}>
                  {DISCOUNT_TIERS.map((d) => <option key={d} value={d}>{d === 0 ? 'No discount' : `${d}%`}</option>)}
                  <option value="custom">Custom…</option>
                </select>
              ) : (
                <input className="input" type="number" min="0" max="90" value={values.discountPercent} onChange={(e) => set('discountPercent', Number(e.target.value))} />
              )}
            </div>
          </div>
          <div className="adm-preview-price">
            <span className="now">{money(salePrice)}</span>
            {discount > 0 && <span className="was">{money(original)}</span>}
            {discount > 0 && <span className="off">{discount}% OFF</span>}
            <span className="hint">— live preview, calculated automatically</span>
          </div>
        </div>

        <div className="surface">
          <h2>Inventory &amp; source</h2>
          <div className="adm-grid2">
            <div className="field">
              <label className="label">Availability</label>
              <div className="adm-checkrow"><input type="checkbox" id="f-instock" checked={values.inStock} onChange={(e) => set('inStock', e.target.checked)} /><label htmlFor="f-instock">In stock</label></div>
            </div>
            <div className="field">
              <label className="label">Official source URL</label>
              <input className="input" value={values.permalink} onChange={(e) => set('permalink', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="surface">
          <h2>Flags &amp; visibility</h2>
          <div className="adm-checkrow"><input type="checkbox" id="f-new" checked={values.isNew} onChange={(e) => set('isNew', e.target.checked)} /><label htmlFor="f-new">New arrival</label></div>
          <div className="adm-checkrow"><input type="checkbox" id="f-best" checked={values.isBestseller} onChange={(e) => set('isBestseller', e.target.checked)} /><label htmlFor="f-best">Bestseller</label></div>
          <div className="adm-checkrow"><input type="checkbox" id="f-feat" checked={values.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /><label htmlFor="f-feat">Featured</label></div>
          <div className="adm-checkrow"><input type="checkbox" id="f-active" checked={values.isActive} onChange={(e) => set('isActive', e.target.checked)} /><label htmlFor="f-active">Active (visible on storefront)</label></div>
          <div className="adm-grid2" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label">Rating (0–5, demo value)</label>
              <input className="input" type="number" min="0" max="5" step="0.1" value={values.rating} onChange={(e) => set('rating', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Review count (demo value)</label>
              <input className="input" type="number" min="0" value={values.reviewCount} onChange={(e) => set('reviewCount', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}</button>
          <Link to="/admin/products" className="btn btn-outline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
