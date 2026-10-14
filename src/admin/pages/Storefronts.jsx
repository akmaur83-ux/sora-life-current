import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadStorefrontImage } from '../../lib/storeCatalogueAdminApi.js';
import { normalizeFashionStorefront, normalizeLifestyleStorefront } from '../../lib/storefrontCustomization.js';
import { validateStorefrontContent, STOREFRONT_LABELS, STOREFRONT_CONTENT_STORES, sectionSpec, sectionContent } from '../../lib/storefrontContent.js';
import { adminLoadStorefronts, adminSaveStorefrontDraft, publishStorefront } from '../../lib/storefrontContentApi.js';
import StorefrontSectionEditor from '../components/StorefrontSectionEditor.jsx';
import { SECTION_PAGES } from '../storefrontSections.js';

// ============================================================
// ADMIN — the storefronts: edit a draft, preview it, publish it. One record per
// store — the wellness homepage, Fashion (its home page, strips, and the women's,
// men's, saree and jewellery pages), Home & Living, Grocery and Lifestyle.
//
// A draft is saved against the version this page opened (migration 0037): a
// draft saved elsewhere since is refused, not overwritten. Every field is
// checked before saving — a bad value is refused beside its field, never
// replaced quietly. Publish copies the saved draft and rebuilds the site with
// it baked in, so visitors never see the old version first (live in 1–2
// minutes; if the rebuild fails, the current site stays as it is).
// ============================================================

// The Fashion and Lifestyle home pages keep their own forms (every field filled from the built-in
// content); every other section is sparse — an empty field is the built-in value.
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const STORES = {
  wellness: { form: (content) => ({ ...content }), path: '/' },
  fashion: { form: (content) => ({ ...content, ...normalizeFashionStorefront(content) }), path: '/fashion' },
  homeliving: { form: (content) => ({ ...content }), path: '/homeliving' },
  grocery: { form: (content) => ({ ...content }), path: '/grocery' },
  lifestyle: { form: (content) => normalizeLifestyleStorefront(content), path: '/lifestyle' },
};

/** The store's content with the value at a dotted section path replaced. */
function setIn(content, path, value) {
  const [key, ...rest] = path.split('.');
  const base = isObject(content) ? content : {};
  return { ...base, [key]: rest.length ? setIn(base[key], rest.join('.'), value) : value };
}

/** Every editable section of a store, page by page, each with a link to preview that page's saved draft. */
function SectionPages({ store, value, onChange, onUploading, errors, dirty }) {
  return SECTION_PAGES[store].map((page) => (
    <section key={page.title} className="adm-sf-page">
      <div className="adm-sf-page__head">
        <h2>{page.title}</h2>
        <a className={`btn btn-sm btn-outline${dirty ? ' is-disabled' : ''}`} href={`${page.href}?preview=draft`} target="_blank" rel="noreferrer" aria-disabled={dirty || undefined} onClick={(event) => { if (dirty) event.preventDefault(); }}>Preview this page</a>
      </div>
      {page.sections.map(({ path, defaults }) => (
        <StorefrontSectionEditor key={path} id={`${store}-${path.replace(/\./g, '-')}`} spec={sectionSpec(store, path)} path={path} value={sectionContent(value, path)} builtIn={defaults}
          errors={errors} onUploading={onUploading} onChange={(next) => onChange((current) => setIn(current, path, next))} />
      ))}
    </section>
  ));
}

function Field({ id, label, value, onChange, multiline = false, hint = '', error = '' }) {
  const control = multiline
    ? <textarea id={id} className="input" rows="3" value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
    : <input id={id} className="input" value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {control}
      {error && <p className="error-text" id={`${id}-error`} role="alert">{error}</p>}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function ImageField({ id, label, value, onChange, onUploading, error = '' }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const preview = safeVisualUrl(value);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setProblem(''); setNote(''); onUploading(1);
    try {
      const image = await uploadStorefrontImage(file);
      onChange(image.url);
      setNote(`Converted to WebP, ${Math.round(image.bytes / 1000)} KB.`);
    } catch (uploadError) { setProblem(uploadError.message || 'Upload failed.'); }
    finally { setBusy(false); onUploading(-1); }
  }
  return (
    <div className="field hp-admin-image">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} disabled={busy} aria-invalid={error ? true : undefined} onChange={(event) => { onChange(event.target.value); setProblem(''); setNote(''); }} />
      <div className="hp-admin-image__actions">
        <label className="btn btn-sm">{busy ? 'Converting and uploading…' : 'Upload image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} />
        </label>
        <button className="btn btn-sm" type="button" disabled={busy || !value} onClick={() => { onChange(''); setProblem(''); setNote(''); }}>Use built-in image</button>
      </div>
      <p className="hint">JPEG, PNG or WebP. Every upload is converted to a WebP under 150 KB first. Upload, save the draft, then publish.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      {problem && <p className="error-text" role="alert">{problem}</p>}
      {note && <p className="hint">{note}</p>}
      {preview && <img className="hp-admin-image__preview" src={preview} alt={`${label} preview`} />}
    </div>
  );
}

function FashionEditor({ value, onChange, onUploading, errors }) {
  const patch = (group, key, next) => onChange((current) => ({ ...current, [group]: { ...current[group], [key]: next } }));
  const f = (group, key, label, extra = {}) => <Field key={key} id={`fashion-${group}-${key}`} label={label} value={value[group][key]} onChange={(next) => patch(group, key, next)} error={errors[`${group}.${key}`]} {...extra} />;
  return (
    <>
      <section className="surface">
        <h2>Header</h2>
        <div className="adm-grid2">{f('header', 'tagline', 'Logo tagline')}{f('header', 'searchPlaceholder', 'Search placeholder')}</div>
      </section>
      <section className="surface">
        <h2>Hero</h2>
        <ImageField id="fashion-hero-image" label="Hero image" value={value.hero.image} onChange={(next) => patch('hero', 'image', next)} onUploading={onUploading} error={errors['hero.image']} />
        <div className="adm-grid2">
          {f('hero', 'eyebrow', 'Eyebrow')}{f('hero', 'title', 'Title')}{f('hero', 'subtitle', 'Subtitle')}{f('hero', 'note', 'Offer note')}
          {f('hero', 'ctaLabel', 'Button label')}{f('hero', 'ctaLink', 'Button route', { hint: 'A page of this site, starting with /.' })}
        </div>
      </section>
      <section className="surface">
        <h2>Section headings</h2>
        <div className="adm-grid2">
          {f('sections', 'categoriesTitle', 'Category heading')}{f('sections', 'categoriesCta', 'Category link label')}
          {f('sections', 'brandsTitle', 'Brand heading')}{f('sections', 'brandsCta', 'Brand link label')}{f('sections', 'productsTitle', 'Product heading')}
        </div>
      </section>
    </>
  );
}

const BANNER_FIELDS = [
  ['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'], ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'],
  ['subtitle', 'Subtitle'], ['note', 'Decorative note'], ['ctaLabel', 'Button label'], ['ctaLink', 'Button route'],
];

function LifestyleSlide({ index, value, onChange, onUploading, errors }) {
  const set = (key, next) => onChange((current) => ({ ...current, heroSlides: current.heroSlides.map((slide, i) => (i === index ? { ...slide, [key]: next } : slide)) }));
  const e = (key) => errors[`heroSlides.${index}.${key}`];
  return (
    <details className="surface adm-storefronts__slide" open={index === 0}>
      <summary>Hero slide {index + 1}: {value.headlineOne} {value.headlineTwo}</summary>
      <div className="adm-storefronts__imagegrid">
        <ImageField id={`lifestyle-slide-${index}-tall`} label="Mobile portrait image" value={value.tall} onChange={(next) => set('tall', next)} onUploading={onUploading} error={e('tall')} />
        <ImageField id={`lifestyle-slide-${index}-wide`} label="Desktop wide image" value={value.wide} onChange={(next) => set('wide', next)} onUploading={onUploading} error={e('wide')} />
      </div>
      <Field id={`lifestyle-slide-${index}-alt`} label="Image description" value={value.alt} onChange={(next) => set('alt', next)} error={e('alt')} />
      <div className="adm-grid2">
        {BANNER_FIELDS.map(([key, label]) => <Field key={key} id={`lifestyle-slide-${index}-${key}`} label={label} value={value[key]} onChange={(next) => set(key, next)} error={e(key)} hint={key === 'ctaLink' ? 'A page of this site, starting with /.' : ''} />)}
      </div>
    </details>
  );
}

function LifestyleEditor({ value, onChange, onUploading, errors }) {
  const patch = (group, key, next) => onChange((current) => ({ ...current, [group]: { ...current[group], [key]: next } }));
  const f = (group, key, label, extra = {}) => <Field key={key} id={`lifestyle-${group}-${key}`} label={label} value={value[group][key]} onChange={(next) => patch(group, key, next)} error={errors[`${group}.${key}`]} {...extra} />;
  return (
    <>
      <section className="surface"><h2>Header</h2>{f('header', 'tagline', 'Logo tagline')}</section>
      {value.heroSlides.map((slide, index) => <LifestyleSlide key={slide.id} index={index} value={slide} onChange={onChange} onUploading={onUploading} errors={errors} />)}
      <section className="surface">
        <h2>Fashion doorway banner</h2>
        <ImageField id="lifestyle-banner-image" label="Banner image" value={value.fashionBanner.image} onChange={(next) => patch('fashionBanner', 'image', next)} onUploading={onUploading} error={errors['fashionBanner.image']} />
        {f('fashionBanner', 'alt', 'Image description')}
        <div className="adm-grid2">{BANNER_FIELDS.map(([key, label]) => f('fashionBanner', key, label, key === 'ctaLink' ? { hint: 'A page of this site, starting with /.' } : {}))}</div>
      </section>
      <section className="surface">
        <h2>Section headings</h2>
        <div className="adm-grid2">
          {f('sections', 'fashionCategoriesTitle', 'Fashion category heading')}{f('sections', 'fashionCategoriesCta', 'Fashion category link label')}
          {f('sections', 'trendingTitle', 'Trending heading')}{f('sections', 'trendingCta', 'Trending link label')}
        </div>
      </section>
      <section className="surface">
        <h2>Home &amp; Living promo</h2>
        <ImageField id="lifestyle-promo-image" label="Promo image" value={value.promo.image} onChange={(next) => patch('promo', 'image', next)} onUploading={onUploading} error={errors['promo.image']} />
        <div className="adm-grid2">{f('promo', 'headline', 'Headline')}{f('promo', 'ctaLabel', 'Button label')}{f('promo', 'ctaLink', 'Button route', { hint: 'A page of this site, starting with /.' })}</div>
      </section>
    </>
  );
}

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function Storefronts() {
  const [tab, setTab] = useState('fashion');
  const [forms, setForms] = useState(() => Object.fromEntries(STOREFRONT_CONTENT_STORES.map((store) => [store, STORES[store].form({})])));
  const [savedForms, setSavedForms] = useState({});
  const [drafts, setDrafts] = useState({});
  const [published, setPublished] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [uploads, setUploads] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  async function load() {
    setLoading(true); setError(''); setStale(false);
    try {
      const loaded = await adminLoadStorefronts();
      const next = Object.fromEntries(Object.entries(STORES).map(([store, { form }]) => [store, form(isObject(loaded.drafts[store]?.content) ? loaded.drafts[store].content : {})]));
      setForms(next);
      setSavedForms(Object.fromEntries(Object.entries(next).map(([store, form]) => [store, JSON.stringify(form)])));
      setDrafts(loaded.drafts);
      setPublished(loaded.published);
    } catch (loadError) { setError(loadError.message || String(loadError)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const dirty = savedForms[tab] !== undefined && JSON.stringify(forms[tab]) !== savedForms[tab];
  const draft = drafts[tab];
  const live = published[tab];
  const upToDate = draft && live && Number(live.draft_version) === Number(draft.version);
  const setForm = (update) => { setErrors({}); setForms((all) => ({ ...all, [tab]: typeof update === 'function' ? update(all[tab]) : update })); };

  async function save(event) {
    event.preventDefault();
    if (uploads || busy || !draft) return;
    setMessage(''); setError(''); setStale(false);
    const { errors: found } = validateStorefrontContent(tab, forms[tab]);
    if (Object.keys(found).length) { setErrors(found); setError('Fix the fields marked below. Nothing was saved.'); return; }
    setBusy('save');
    try {
      const version = await adminSaveStorefrontDraft(tab, forms[tab], draft.version);
      setDrafts((all) => ({ ...all, [tab]: { ...all[tab], content: forms[tab], version } }));
      setSavedForms((all) => ({ ...all, [tab]: JSON.stringify(forms[tab]) }));
      setMessage(`Draft saved (version ${version}). Preview it, then publish when it is ready — visitors still see the published version.`);
    } catch (saveError) { setError(saveError.message || String(saveError)); setStale(!!saveError.isStaleWrite); }
    setBusy('');
  }

  async function publish() {
    if (busy || dirty || !draft) return;
    if (!window.confirm(`Publish the ${STOREFRONT_LABELS[tab]} storefront (draft version ${draft.version})?\n\nThe site rebuilds with it; visitors see it in 1–2 minutes. If the rebuild fails, the current site stays as it is.`)) return;
    setBusy('publish'); setMessage(''); setError(''); setStale(false);
    try {
      const result = await publishStorefront(tab, draft.version);
      setPublished((all) => ({ ...all, [tab]: { ...all[tab], draft_version: result.version, published_at: result.publishedAt } }));
      setMessage(`Published version ${result.version}. The site is rebuilding: it shows on ${STORES[tab].path} in 1–2 minutes. If the rebuild fails, the current site stays as it is.`);
    } catch (publishError) { setError(publishError.message || String(publishError)); setStale(!!publishError.isStaleWrite); }
    setBusy('');
  }

  if (loading) return <p className="muted">Loading…</p>;

  const Editor = { fashion: FashionEditor, lifestyle: LifestyleEditor }[tab];
  const uploading = (delta) => setUploads((count) => count + delta);
  return (
    <div className="adm-form adm-storefronts">
      <div className="adm__head">
        <div><h1>Storefronts</h1><p>Every store's copy, photographs, links and sections: edit a draft, preview it, then publish. Products, prices, cart and checkout are not touched.</p></div>
      </div>
      {error && <div className="adm-banner err" role="alert">{error}{stale && <> <button type="button" className="btn btn-sm btn-light" onClick={load}>Reload and discard my edits</button></>}</div>}
      {message && <div className="adm-banner ok" role="status">{message}</div>}
      <div className="surface sc-panel">
        <h2>Products &amp; categories</h2>
        <p>Add products to a specific category, manage images, prices, stock and variants. Lifestyle shows products from both stores.</p>
        <div className="sc-actions">
          <Link className="btn btn-sm" to="/admin/store-catalogue/fashion">Manage Fashion products</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/store-catalogue/homeliving">Manage Home &amp; Living products</Link>
        </div>
      </div>
      <div className="adm-chipbar" role="tablist" aria-label="Storefront editor">
        {Object.keys(STORES).map((store) => <button key={store} className={`adm-chip${tab === store ? ' active' : ''}`} type="button" role="tab" aria-selected={tab === store} disabled={!!busy} onClick={() => { setTab(store); setErrors({}); setMessage(''); setError(''); }}>{STOREFRONT_LABELS[store]}</button>)}
      </div>
      {draft && (
        <p className="hint adm-storefronts__status" role="status">
          Draft version {draft.version}{dirty ? ' — unsaved changes' : ''} · {live ? `Published version ${live.draft_version}${live.published_at ? `, ${when(live.published_at)}` : ''}` : 'Not published yet'}{!dirty && !upToDate && live ? ' · the draft has changes not yet published' : ''}
        </p>
      )}
      <form onSubmit={save} noValidate>
        {Editor && <Editor value={forms[tab]} onChange={setForm} onUploading={uploading} errors={errors} />}
        <SectionPages store={tab} value={forms[tab]} onChange={setForm} onUploading={uploading} errors={errors} dirty={dirty} />
        <div className="adm-storefronts__actions">
          <button className="btn" type="submit" disabled={!!busy || uploads > 0 || !draft}>{busy === 'save' ? 'Saving…' : uploads ? 'Uploading images…' : 'Save draft'}</button>
          <a className={`btn btn-outline${dirty ? ' is-disabled' : ''}`} href={`${STORES[tab].path}?preview=draft`} target="_blank" rel="noreferrer" aria-disabled={dirty || undefined} onClick={(event) => { if (dirty) event.preventDefault(); }}>Preview the saved draft</a>
          <button className="btn btn-outline" type="button" disabled={!!busy || dirty || uploads > 0 || !draft} onClick={publish}>{busy === 'publish' ? 'Publishing…' : upToDate ? 'Publish again' : 'Publish'}</button>
          <span className="hint">{dirty ? 'Save the draft before previewing or publishing.' : 'Preview shows the saved draft to you only; publishing makes it the live version.'}</span>
        </div>
      </form>
    </div>
  );
}
