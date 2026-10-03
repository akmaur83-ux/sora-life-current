import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';
import { announceHomepageSaved } from '../../lib/homepageVisualSync.js';
import {
  mergeStorefrontCustomization,
  normalizeFashionStorefront,
  normalizeLifestyleStorefront,
} from '../../lib/storefrontCustomization.js';

function Field({ id, label, value, onChange, multiline = false, hint = '' }) {
  const control = multiline
    ? <textarea id={id} className="input" rows="3" value={value} onChange={(event) => onChange(event.target.value)} />
    : <input id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)} />;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {control}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function ImageField({ id, label, value, onChange, onUploading }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = safeVisualUrl(value);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); onUploading(1);
    try { onChange(await uploadHomepageImage(file)); }
    catch (uploadError) { setError(uploadError.message || 'Upload failed.'); }
    finally { setBusy(false); onUploading(-1); }
  }
  return (
    <div className="field hp-admin-image">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} disabled={busy} onChange={(event) => { onChange(event.target.value); setError(''); }} />
      <div className="hp-admin-image__actions">
        <label className="btn btn-sm">{busy ? 'Uploading…' : 'Upload image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} />
        </label>
        <button className="btn btn-sm" type="button" disabled={busy || !value} onClick={() => { onChange(''); setError(''); }}>Use built-in image</button>
      </div>
      <p className="hint">PNG, JPEG or WebP, up to 6 MB. Upload first, then save the storefront.</p>
      {value && !preview && <p className="error-text" role="alert">Enter a public HTTPS image URL or a local image path.</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {preview && <img className="hp-admin-image__preview" src={preview} alt={`${label} preview`} />}
    </div>
  );
}

function FashionEditor({ value, onChange, onUploading }) {
  const patch = (group, key, next) => onChange((current) => ({ ...current, [group]: { ...current[group], [key]: next } }));
  return (
    <>
      <section className="surface">
        <h2>Header</h2>
        <div className="adm-grid2">
          <Field id="fashion-tagline" label="Logo tagline" value={value.header.tagline} onChange={(next) => patch('header', 'tagline', next)} />
          <Field id="fashion-search" label="Search placeholder" value={value.header.searchPlaceholder} onChange={(next) => patch('header', 'searchPlaceholder', next)} />
        </div>
      </section>
      <section className="surface">
        <h2>Hero</h2>
        <ImageField id="fashion-hero-image" label="Hero image" value={value.hero.image} onChange={(next) => patch('hero', 'image', next)} onUploading={onUploading} />
        <div className="adm-grid2">
          <Field id="fashion-hero-eyebrow" label="Eyebrow" value={value.hero.eyebrow} onChange={(next) => patch('hero', 'eyebrow', next)} />
          <Field id="fashion-hero-title" label="Title" value={value.hero.title} onChange={(next) => patch('hero', 'title', next)} />
          <Field id="fashion-hero-subtitle" label="Subtitle" value={value.hero.subtitle} onChange={(next) => patch('hero', 'subtitle', next)} />
          <Field id="fashion-hero-note" label="Offer note" value={value.hero.note} onChange={(next) => patch('hero', 'note', next)} />
          <Field id="fashion-hero-cta" label="Button label" value={value.hero.ctaLabel} onChange={(next) => patch('hero', 'ctaLabel', next)} />
          <Field id="fashion-hero-link" label="Button route" value={value.hero.ctaLink} onChange={(next) => patch('hero', 'ctaLink', next)} hint="Use an internal route beginning with /." />
        </div>
      </section>
      <section className="surface">
        <h2>Section headings</h2>
        <div className="adm-grid2">
          <Field id="fashion-category-title" label="Category heading" value={value.sections.categoriesTitle} onChange={(next) => patch('sections', 'categoriesTitle', next)} />
          <Field id="fashion-category-cta" label="Category link label" value={value.sections.categoriesCta} onChange={(next) => patch('sections', 'categoriesCta', next)} />
          <Field id="fashion-brand-title" label="Brand heading" value={value.sections.brandsTitle} onChange={(next) => patch('sections', 'brandsTitle', next)} />
          <Field id="fashion-brand-cta" label="Brand link label" value={value.sections.brandsCta} onChange={(next) => patch('sections', 'brandsCta', next)} />
          <Field id="fashion-product-title" label="Product heading" value={value.sections.productsTitle} onChange={(next) => patch('sections', 'productsTitle', next)} />
        </div>
      </section>
    </>
  );
}

function LifestyleSlide({ index, value, onChange, onUploading }) {
  const set = (key, next) => onChange((current) => ({
    ...current,
    heroSlides: current.heroSlides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, [key]: next } : slide)),
  }));
  return (
    <details className="surface adm-storefronts__slide" open={index === 0}>
      <summary>Hero slide {index + 1}: {value.headlineOne} {value.headlineTwo}</summary>
      <div className="adm-storefronts__imagegrid">
        <ImageField id={`lifestyle-slide-${index}-tall`} label="Mobile portrait image" value={value.tall} onChange={(next) => set('tall', next)} onUploading={onUploading} />
        <ImageField id={`lifestyle-slide-${index}-wide`} label="Desktop wide image" value={value.wide} onChange={(next) => set('wide', next)} onUploading={onUploading} />
      </div>
      <Field id={`lifestyle-slide-${index}-alt`} label="Image description" value={value.alt} onChange={(next) => set('alt', next)} />
      <div className="adm-grid2">
        {[
          ['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'],
          ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'],
          ['subtitle', 'Subtitle'], ['note', 'Decorative note'],
          ['ctaLabel', 'Button label'], ['ctaLink', 'Button route'],
        ].map(([key, label]) => <Field key={key} id={`lifestyle-slide-${index}-${key}`} label={label} value={value[key]} onChange={(next) => set(key, next)} hint={key === 'ctaLink' ? 'Use an internal route beginning with /.' : ''} />)}
      </div>
    </details>
  );
}

function LifestyleEditor({ value, onChange, onUploading }) {
  const patch = (group, key, next) => onChange((current) => ({ ...current, [group]: { ...current[group], [key]: next } }));
  return (
    <>
      <section className="surface">
        <h2>Header</h2>
        <Field id="lifestyle-tagline" label="Logo tagline" value={value.header.tagline} onChange={(next) => patch('header', 'tagline', next)} />
      </section>
      {value.heroSlides.map((slide, index) => <LifestyleSlide key={slide.id} index={index} value={slide} onChange={onChange} onUploading={onUploading} />)}
      <section className="surface">
        <h2>Fashion doorway banner</h2>
        <ImageField id="lifestyle-banner-image" label="Banner image" value={value.fashionBanner.image} onChange={(next) => patch('fashionBanner', 'image', next)} onUploading={onUploading} />
        <Field id="lifestyle-banner-alt" label="Image description" value={value.fashionBanner.alt} onChange={(next) => patch('fashionBanner', 'alt', next)} />
        <div className="adm-grid2">
          {[
            ['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'],
            ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'],
            ['subtitle', 'Subtitle'], ['note', 'Decorative note'],
            ['ctaLabel', 'Button label'], ['ctaLink', 'Button route'],
          ].map(([key, label]) => <Field key={key} id={`lifestyle-banner-${key}`} label={label} value={value.fashionBanner[key]} onChange={(next) => patch('fashionBanner', key, next)} hint={key === 'ctaLink' ? 'Use an internal route beginning with /.' : ''} />)}
        </div>
      </section>
      <section className="surface">
        <h2>Section headings</h2>
        <div className="adm-grid2">
          <Field id="lifestyle-category-title" label="Fashion category heading" value={value.sections.fashionCategoriesTitle} onChange={(next) => patch('sections', 'fashionCategoriesTitle', next)} />
          <Field id="lifestyle-category-cta" label="Fashion category link label" value={value.sections.fashionCategoriesCta} onChange={(next) => patch('sections', 'fashionCategoriesCta', next)} />
          <Field id="lifestyle-trending-title" label="Trending heading" value={value.sections.trendingTitle} onChange={(next) => patch('sections', 'trendingTitle', next)} />
          <Field id="lifestyle-trending-cta" label="Trending link label" value={value.sections.trendingCta} onChange={(next) => patch('sections', 'trendingCta', next)} />
        </div>
      </section>
      <section className="surface">
        <h2>Home &amp; Living promo</h2>
        <ImageField id="lifestyle-promo-image" label="Promo image" value={value.promo.image} onChange={(next) => patch('promo', 'image', next)} onUploading={onUploading} />
        <div className="adm-grid2">
          <Field id="lifestyle-promo-title" label="Headline" value={value.promo.headline} onChange={(next) => patch('promo', 'headline', next)} />
          <Field id="lifestyle-promo-cta" label="Button label" value={value.promo.ctaLabel} onChange={(next) => patch('promo', 'ctaLabel', next)} />
          <Field id="lifestyle-promo-link" label="Button route" value={value.promo.ctaLink} onChange={(next) => patch('promo', 'ctaLink', next)} hint="Use an internal route beginning with /." />
        </div>
      </section>
    </>
  );
}

export default function Storefronts() {
  const [tab, setTab] = useState('fashion');
  const [fashion, setFashion] = useState(() => normalizeFashionStorefront());
  const [lifestyle, setLifestyle] = useState(() => normalizeLifestyleStorefront());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const homepage = await adminGetSetting('homepage');
        setFashion(normalizeFashionStorefront(homepage?.fashion_storefront));
        setLifestyle(normalizeLifestyleStorefront(homepage?.lifestyle_storefront));
      } catch (loadError) { setError(loadError.message || String(loadError)); }
      setLoading(false);
    })();
  }, []);

  async function save(event) {
    event.preventDefault();
    if (uploads) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const current = await adminGetSetting('homepage');
      const next = mergeStorefrontCustomization(current, fashion, lifestyle);
      await adminSetSetting('homepage', next);
      setFashion(next.fashion_storefront);
      setLifestyle(next.lifestyle_storefront);
      announceHomepageSaved(next);
      setMessage('Saved. Open storefront tabs update automatically.');
    } catch (saveError) { setError(saveError.message || String(saveError)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form adm-storefronts">
      <div className="adm__head">
        <div><h1>Fashion &amp; Lifestyle</h1><p>Customize storefront copy and campaign images without changing products, prices or commerce behavior.</p></div>
        <div className="adm-storefronts__preview">
          <a className="btn btn-outline btn-sm" href="/fashion" target="_blank" rel="noreferrer">Preview Fashion</a>
          <a className="btn btn-outline btn-sm" href="/lifestyle" target="_blank" rel="noreferrer">Preview Lifestyle</a>
        </div>
      </div>
      {error && <div className="adm-banner err">{error}</div>}
      {message && <div className="adm-banner ok">{message}</div>}
      <div className="surface sc-panel">
        <h2>Products &amp; categories</h2>
        <p>Add products to a specific category, manage images, prices, stock and variants. Lifestyle shows products from both stores.</p>
        <div className="sc-actions">
          <Link className="btn btn-sm" to="/admin/store-catalogue/fashion">Manage Fashion products</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/store-catalogue/homeliving">Manage Home &amp; Living products</Link>
        </div>
      </div>
      <div className="adm-chipbar" role="tablist" aria-label="Storefront editor">
        <button className={`adm-chip${tab === 'fashion' ? ' active' : ''}`} type="button" role="tab" aria-selected={tab === 'fashion'} onClick={() => setTab('fashion')}>Fashion Store</button>
        <button className={`adm-chip${tab === 'lifestyle' ? ' active' : ''}`} type="button" role="tab" aria-selected={tab === 'lifestyle'} onClick={() => setTab('lifestyle')}>Lifestyle Store</button>
      </div>
      <form onSubmit={save}>
        {tab === 'fashion'
          ? <FashionEditor value={fashion} onChange={setFashion} onUploading={(delta) => setUploads((count) => count + delta)} />
          : <LifestyleEditor value={lifestyle} onChange={setLifestyle} onUploading={(delta) => setUploads((count) => count + delta)} />}
        <div className="adm-storefronts__actions">
          <button className="btn" type="submit" disabled={saving || uploads > 0}>{saving ? 'Saving…' : uploads ? 'Uploading images…' : 'Save both storefronts'}</button>
          <span className="hint">Saving keeps catalogue, pricing, cart and checkout data untouched.</span>
        </div>
      </form>
    </div>
  );
}
