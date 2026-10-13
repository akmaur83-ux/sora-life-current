import { bw as supabase, r as reactExports, bL as normalizeFashionStorefront, bM as normalizeLifestyleStorefront, j as jsxRuntimeExports, b as Link, bN as STOREFRONT_LABELS, bO as validateStorefrontContent, bz as safeVisualUrl } from '../bundle.js';
import { u as uploadStorefrontImage } from './storeCatalogueAdminApi.js';

// ============================================================
// Admin side of the storefront content (migration 0037): read the drafts and
// what is published, save a draft against the version the editor opened, and
// publish through the server, which starts the site's rebuild.
//
// Every write is an admin-checked database function or the admin-checked
// /api/admin/publish-storefront route; this module holds no secret. The deploy
// hook that rebuilds the site is known only to that server route.
// ============================================================

/** The draft moved since the editor opened it: nothing was saved. */
class StorefrontStaleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorefrontStaleError';
    this.isStaleWrite = true;
  }
}

/** { drafts: { store: { content, version, updated_at } }, published: { store: { draft_version, published_at } } } */
async function adminLoadStorefronts() {
  const [drafts, published] = await Promise.all([supabase.from('storefront_drafts').select('store, content, version, updated_at'), supabase.from('storefront_published').select('store, draft_version, published_at')]);
  if (drafts.error) throw drafts.error;
  if (published.error) throw published.error;
  if (!drafts.data?.length) throw new Error('No storefront drafts are readable. Sign in with an admin account; if you are one, migration 0037 has not been applied yet.');
  return {
    drafts: Object.fromEntries(drafts.data.map(row => [row.store, row])),
    published: Object.fromEntries((published.data || []).map(row => [row.store, row]))
  };
}

/** Save a draft; resolves with its new version. Refused (StorefrontStaleError) if it moved since `expectedVersion`. */
async function adminSaveStorefrontDraft(store, content, expectedVersion) {
  const {
    data,
    error
  } = await supabase.rpc('admin_save_storefront_draft', {
    p_store: store,
    p_content: content,
    p_expected_version: expectedVersion
  });
  if (error) {
    const message = String(error.message || '');
    if (/^stale/.test(message)) throw new StorefrontStaleError('This storefront was saved elsewhere since you opened it. Nothing was saved — reload to see that version, then reapply your changes.');
    if (/admin only/.test(message) || error.code === '42501') throw new Error('The database refused the save: this account is not an admin.');
    throw error;
  }
  return Number(data);
}

/** Publish a saved draft (by its version) and start the rebuild. Resolves with { version, publishedAt }. */
async function publishStorefront(store, version, {
  fetchImpl = globalThis.fetch
} = {}) {
  const {
    data
  } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your admin session has ended. Sign in again, then publish.');
  let response;
  try {
    response = await fetchImpl('/api/admin/publish-storefront', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        store,
        version
      })
    });
  } catch {
    throw new Error('Publishing could not reach the server. Nothing was changed; try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    const error = new Error(body.error || `Publishing failed (HTTP ${response.status}).`);
    if (response.status === 409) error.isStaleWrite = true;
    throw error;
  }
  return body;
}

const STORES = {
  fashion: {
    normalize: normalizeFashionStorefront,
    path: '/fashion'
  },
  lifestyle: {
    normalize: normalizeLifestyleStorefront,
    path: '/lifestyle'
  }
};
function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
  hint = '',
  error = ''
}) {
  const control = multiline ? /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
    id: id,
    className: "input",
    rows: "3",
    value: value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    onChange: event => onChange(event.target.value)
  }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
    id: id,
    className: "input",
    value: value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    onChange: event => onChange(event.target.value)
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: id,
      children: label
    }), control, error && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      id: `${id}-error`,
      role: "alert",
      children: error
    }), hint && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: hint
    })]
  });
}
function ImageField({
  id,
  label,
  value,
  onChange,
  onUploading,
  error = ''
}) {
  const [busy, setBusy] = reactExports.useState(false);
  const [problem, setProblem] = reactExports.useState('');
  const [note, setNote] = reactExports.useState('');
  const preview = safeVisualUrl(value);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setProblem('');
    setNote('');
    onUploading(1);
    try {
      const image = await uploadStorefrontImage(file);
      onChange(image.url);
      setNote(`Converted to WebP, ${Math.round(image.bytes / 1000)} KB.`);
    } catch (uploadError) {
      setProblem(uploadError.message || 'Upload failed.');
    } finally {
      setBusy(false);
      onUploading(-1);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field hp-admin-image",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: id,
      children: label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      id: id,
      className: "input",
      value: value,
      disabled: busy,
      "aria-invalid": error ? true : undefined,
      onChange: event => {
        onChange(event.target.value);
        setProblem('');
        setNote('');
      }
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "hp-admin-image__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "btn btn-sm",
        children: [busy ? 'Converting and uploading…' : 'Upload image', /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "file",
          accept: "image/png,image/jpeg,image/webp",
          disabled: busy,
          onChange: upload
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-sm",
        type: "button",
        disabled: busy || !value,
        onClick: () => {
          onChange('');
          setProblem('');
          setNote('');
        },
        children: "Use built-in image"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "JPEG, PNG or WebP. Every upload is converted to a WebP under 150 KB first. Upload, save the draft, then publish."
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: error
    }), problem && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: problem
    }), note && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: note
    }), preview && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
      className: "hp-admin-image__preview",
      src: preview,
      alt: `${label} preview`
    })]
  });
}
function FashionEditor({
  value,
  onChange,
  onUploading,
  errors
}) {
  const patch = (group, key, next) => onChange(current => ({
    ...current,
    [group]: {
      ...current[group],
      [key]: next
    }
  }));
  const f = (group, key, label, extra = {}) => /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
    id: `fashion-${group}-${key}`,
    label: label,
    value: value[group][key],
    onChange: next => patch(group, key, next),
    error: errors[`${group}.${key}`],
    ...extra
  }, key);
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Header"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [f('header', 'tagline', 'Logo tagline'), f('header', 'searchPlaceholder', 'Search placeholder')]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Hero"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "fashion-hero-image",
        label: "Hero image",
        value: value.hero.image,
        onChange: next => patch('hero', 'image', next),
        onUploading: onUploading,
        error: errors['hero.image']
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [f('hero', 'eyebrow', 'Eyebrow'), f('hero', 'title', 'Title'), f('hero', 'subtitle', 'Subtitle'), f('hero', 'note', 'Offer note'), f('hero', 'ctaLabel', 'Button label'), f('hero', 'ctaLink', 'Button route', {
          hint: 'A page of this site, starting with /.'
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Section headings"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [f('sections', 'categoriesTitle', 'Category heading'), f('sections', 'categoriesCta', 'Category link label'), f('sections', 'brandsTitle', 'Brand heading'), f('sections', 'brandsCta', 'Brand link label'), f('sections', 'productsTitle', 'Product heading')]
      })]
    })]
  });
}
const BANNER_FIELDS = [['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'], ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'], ['subtitle', 'Subtitle'], ['note', 'Decorative note'], ['ctaLabel', 'Button label'], ['ctaLink', 'Button route']];
function LifestyleSlide({
  index,
  value,
  onChange,
  onUploading,
  errors
}) {
  const set = (key, next) => onChange(current => ({
    ...current,
    heroSlides: current.heroSlides.map((slide, i) => i === index ? {
      ...slide,
      [key]: next
    } : slide)
  }));
  const e = key => errors[`heroSlides.${index}.${key}`];
  return /*#__PURE__*/jsxRuntimeExports.jsxs("details", {
    className: "surface adm-storefronts__slide",
    open: index === 0,
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("summary", {
      children: ["Hero slide ", index + 1, ": ", value.headlineOne, " ", value.headlineTwo]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-storefronts__imagegrid",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: `lifestyle-slide-${index}-tall`,
        label: "Mobile portrait image",
        value: value.tall,
        onChange: next => set('tall', next),
        onUploading: onUploading,
        error: e('tall')
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: `lifestyle-slide-${index}-wide`,
        label: "Desktop wide image",
        value: value.wide,
        onChange: next => set('wide', next),
        onUploading: onUploading,
        error: e('wide')
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
      id: `lifestyle-slide-${index}-alt`,
      label: "Image description",
      value: value.alt,
      onChange: next => set('alt', next),
      error: e('alt')
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-grid2",
      children: BANNER_FIELDS.map(([key, label]) => /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        id: `lifestyle-slide-${index}-${key}`,
        label: label,
        value: value[key],
        onChange: next => set(key, next),
        error: e(key),
        hint: key === 'ctaLink' ? 'A page of this site, starting with /.' : ''
      }, key))
    })]
  });
}
function LifestyleEditor({
  value,
  onChange,
  onUploading,
  errors
}) {
  const patch = (group, key, next) => onChange(current => ({
    ...current,
    [group]: {
      ...current[group],
      [key]: next
    }
  }));
  const f = (group, key, label, extra = {}) => /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
    id: `lifestyle-${group}-${key}`,
    label: label,
    value: value[group][key],
    onChange: next => patch(group, key, next),
    error: errors[`${group}.${key}`],
    ...extra
  }, key);
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Header"
      }), f('header', 'tagline', 'Logo tagline')]
    }), value.heroSlides.map((slide, index) => /*#__PURE__*/jsxRuntimeExports.jsx(LifestyleSlide, {
      index: index,
      value: slide,
      onChange: onChange,
      onUploading: onUploading,
      errors: errors
    }, slide.id)), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Fashion doorway banner"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "lifestyle-banner-image",
        label: "Banner image",
        value: value.fashionBanner.image,
        onChange: next => patch('fashionBanner', 'image', next),
        onUploading: onUploading,
        error: errors['fashionBanner.image']
      }), f('fashionBanner', 'alt', 'Image description'), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-grid2",
        children: BANNER_FIELDS.map(([key, label]) => f('fashionBanner', key, label, key === 'ctaLink' ? {
          hint: 'A page of this site, starting with /.'
        } : {}))
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Section headings"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [f('sections', 'fashionCategoriesTitle', 'Fashion category heading'), f('sections', 'fashionCategoriesCta', 'Fashion category link label'), f('sections', 'trendingTitle', 'Trending heading'), f('sections', 'trendingCta', 'Trending link label')]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Home & Living promo"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "lifestyle-promo-image",
        label: "Promo image",
        value: value.promo.image,
        onChange: next => patch('promo', 'image', next),
        onUploading: onUploading,
        error: errors['promo.image']
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [f('promo', 'headline', 'Headline'), f('promo', 'ctaLabel', 'Button label'), f('promo', 'ctaLink', 'Button route', {
          hint: 'A page of this site, starting with /.'
        })]
      })]
    })]
  });
}
const when = iso => iso ? new Date(iso).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
}) : '';
function Storefronts() {
  const [tab, setTab] = reactExports.useState('fashion');
  const [forms, setForms] = reactExports.useState({
    fashion: normalizeFashionStorefront(),
    lifestyle: normalizeLifestyleStorefront()
  });
  const [savedForms, setSavedForms] = reactExports.useState({});
  const [drafts, setDrafts] = reactExports.useState({});
  const [published, setPublished] = reactExports.useState({});
  const [errors, setErrors] = reactExports.useState({});
  const [loading, setLoading] = reactExports.useState(true);
  const [busy, setBusy] = reactExports.useState('');
  const [uploads, setUploads] = reactExports.useState(0);
  const [message, setMessage] = reactExports.useState('');
  const [error, setError] = reactExports.useState('');
  const [stale, setStale] = reactExports.useState(false);
  async function load() {
    setLoading(true);
    setError('');
    setStale(false);
    try {
      const loaded = await adminLoadStorefronts();
      const next = Object.fromEntries(Object.entries(STORES).map(([store, {
        normalize
      }]) => [store, normalize(loaded.drafts[store]?.content)]));
      setForms(next);
      setSavedForms(Object.fromEntries(Object.entries(next).map(([store, form]) => [store, JSON.stringify(form)])));
      setDrafts(loaded.drafts);
      setPublished(loaded.published);
    } catch (loadError) {
      setError(loadError.message || String(loadError));
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  const dirty = savedForms[tab] !== undefined && JSON.stringify(forms[tab]) !== savedForms[tab];
  const draft = drafts[tab];
  const live = published[tab];
  const upToDate = draft && live && Number(live.draft_version) === Number(draft.version);
  const setForm = update => {
    setErrors({});
    setForms(all => ({
      ...all,
      [tab]: typeof update === 'function' ? update(all[tab]) : update
    }));
  };
  async function save(event) {
    event.preventDefault();
    if (uploads || busy || !draft) return;
    setMessage('');
    setError('');
    setStale(false);
    const {
      errors: found
    } = validateStorefrontContent(tab, forms[tab]);
    if (Object.keys(found).length) {
      setErrors(found);
      setError('Fix the fields marked below. Nothing was saved.');
      return;
    }
    setBusy('save');
    try {
      const version = await adminSaveStorefrontDraft(tab, forms[tab], draft.version);
      setDrafts(all => ({
        ...all,
        [tab]: {
          ...all[tab],
          content: forms[tab],
          version
        }
      }));
      setSavedForms(all => ({
        ...all,
        [tab]: JSON.stringify(forms[tab])
      }));
      setMessage(`Draft saved (version ${version}). Preview it, then publish when it is ready — visitors still see the published version.`);
    } catch (saveError) {
      setError(saveError.message || String(saveError));
      setStale(!!saveError.isStaleWrite);
    }
    setBusy('');
  }
  async function publish() {
    if (busy || dirty || !draft) return;
    if (!window.confirm(`Publish the ${STOREFRONT_LABELS[tab]} storefront (draft version ${draft.version})?\n\nThe site rebuilds with it; visitors see it in 1–2 minutes. If the rebuild fails, the current site stays as it is.`)) return;
    setBusy('publish');
    setMessage('');
    setError('');
    setStale(false);
    try {
      const result = await publishStorefront(tab, draft.version);
      setPublished(all => ({
        ...all,
        [tab]: {
          ...all[tab],
          draft_version: result.version,
          published_at: result.publishedAt
        }
      }));
      setMessage(`Published version ${result.version}. The site is rebuilding: it shows on ${STORES[tab].path} in 1–2 minutes. If the rebuild fails, the current site stays as it is.`);
    } catch (publishError) {
      setError(publishError.message || String(publishError));
      setStale(!!publishError.isStaleWrite);
    }
    setBusy('');
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  const Editor = tab === 'fashion' ? FashionEditor : LifestyleEditor;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form adm-storefronts",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Fashion & Lifestyle"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Edit a draft, preview it, then publish. Products, prices, cart and checkout are not touched."
        })]
      })
    }), error && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: [error, stale && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [" ", /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: load,
          children: "Reload and discard my edits"
        })]
      })]
    }), message && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      role: "status",
      children: message
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface sc-panel",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Products & categories"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        children: "Add products to a specific category, manage images, prices, stock and variants. Lifestyle shows products from both stores."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-sm",
          to: "/admin/store-catalogue/fashion",
          children: "Manage Fashion products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/store-catalogue/homeliving",
          children: "Manage Home & Living products"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-chipbar",
      role: "tablist",
      "aria-label": "Storefront editor",
      children: Object.keys(STORES).map(store => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        className: `adm-chip${tab === store ? ' active' : ''}`,
        type: "button",
        role: "tab",
        "aria-selected": tab === store,
        disabled: !!busy,
        onClick: () => {
          setTab(store);
          setErrors({});
          setMessage('');
          setError('');
        },
        children: [STOREFRONT_LABELS[store], " Store"]
      }, store))
    }), draft && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "hint adm-storefronts__status",
      role: "status",
      children: ["Draft version ", draft.version, dirty ? ' — unsaved changes' : '', " \xB7 ", live ? `Published version ${live.draft_version}${live.published_at ? `, ${when(live.published_at)}` : ''}` : 'Not published yet', !dirty && !upToDate && live ? ' · the draft has changes not yet published' : '']
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      noValidate: true,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Editor, {
        value: forms[tab],
        onChange: setForm,
        onUploading: delta => setUploads(count => count + delta),
        errors: errors
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-storefronts__actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: !!busy || uploads > 0 || !draft,
          children: busy === 'save' ? 'Saving…' : uploads ? 'Uploading images…' : 'Save draft'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
          className: `btn btn-outline${dirty ? ' is-disabled' : ''}`,
          href: `${STORES[tab].path}?preview=draft`,
          target: "_blank",
          rel: "noreferrer",
          "aria-disabled": dirty || undefined,
          onClick: event => {
            if (dirty) event.preventDefault();
          },
          children: "Preview the saved draft"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline",
          type: "button",
          disabled: !!busy || dirty || uploads > 0 || !draft,
          onClick: publish,
          children: busy === 'publish' ? 'Publishing…' : upToDate ? 'Publish again' : 'Publish'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "hint",
          children: dirty ? 'Save the draft before previewing or publishing.' : 'Preview shows the saved draft to you only; publishing makes it the live version.'
        })]
      })]
    })]
  });
}

export { Storefronts as default };
//# sourceMappingURL=Storefronts.js.map
