import { useEffect, useMemo, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';
import BulkPackshotImport from '../components/BulkPackshotImport.jsx';
import CategorySpotlight from '../../components/category/CategorySpotlight.jsx';
import { categories } from '../../data/categories.js';
import { products } from '../../data/products.js';
import {
  categoryExperiencePayload, normalizeCategoryExperience, sanitizeCategoryConfig,
  categoryToneTheme, makeSpotlightId, isSpotlightEligible, safeColor, safeGradient,
  MIN_INTERVAL_MS, MAX_INTERVAL_MS, categoryIsReadyButOff,
  MIN_ITEM_SCALE, MAX_ITEM_SCALE, DEFAULT_ITEM_SCALE, ITEM_OFFSET_LIMIT,
} from '../../lib/categoryExperience.js';

// ============================================================
// ADMIN — CATEGORY EXPERIENCE
//
// Pick a category, decide which of ITS products headline the spotlight stage,
// and give each one a background and (optionally) a short line of your own
// copy. Stored under the existing `homepage` setting as `categoryExperience`,
// so there is no migration and no new table.
//
// The product picker only ever offers products from the selected category,
// and only ones the storefront would actually sell — so a category cannot be
// configured to spotlight something a customer cannot buy.
// ============================================================

export default function CategoryExperience() {
  const [slug, setSlug] = useState(categories[0]?.slug || '');
  const [bySlug, setBySlug] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // A category can now hold every one of its products — Wellness has 46 —
  // so the editor needs a way to reach one row without scrolling past forty.
  const [filter, setFilter] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  async function reloadFromSettings() {
    try {
      const hp = (await adminGetSetting('homepage')) || {};
      setBySlug(normalizeCategoryExperience(hp.categoryExperience).categories);
    } catch (ex) {
      setErr(ex.message || 'Could not load settings.');
    }
  }

  useEffect(() => {
    (async () => {
      await reloadFromSettings();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = useMemo(
    () => sanitizeCategoryConfig(bySlug[slug], slug),
    [bySlug, slug],
  );

  // Only this category's sellable products may be spotlighted. Filtering here
  // rather than in the picker means the rule holds however the list is used.
  const eligible = useMemo(
    () => products
      .filter((p) => (p.categories || [p.category]).includes(slug))
      .filter(isSpotlightEligible),
    [slug],
  );
  const chosen = new Set(cfg.items.map((i) => i.productSlug));
  const available = eligible.filter((p) => !chosen.has(p.slug));

  const patch = (fields) => setBySlug((prev) => ({ ...prev, [slug]: { ...cfg, ...fields } }));
  const patchItems = (items) => patch({ items });

  const addItem = (productSlug) => {
    if (!productSlug) return;
    patchItems([...cfg.items, {
      id: makeSpotlightId(productSlug, cfg.items.map((i) => i.id)),
      productSlug, spotlightImage: '', headline: '', subline: '',
      background: '', gradient: '', enabled: true,
    }]);
  };
  const patchItem = (i, fields) => patchItems(cfg.items.map((it, n) => (n === i ? { ...it, ...fields } : it)));
  const removeItem = (i) => patchItems(cfg.items.filter((_, n) => n !== i));
  const moveItem = (i, delta) => {
    const to = i + delta;
    if (to < 0 || to >= cfg.items.length) return;
    const next = [...cfg.items];
    [next[i], next[to]] = [next[to], next[i]];
    patchItems(next);
  };

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      // Read-modify-write the whole homepage object so a concurrent edit to
      // discovery or the visuals is not clobbered by this save.
      const current = (await adminGetSetting('homepage')) || {};
      const next = { ...current, categoryExperience: categoryExperiencePayload({ ...bySlug, [slug]: cfg }) };
      await adminSetSetting('homepage', next);
      setBySlug(normalizeCategoryExperience(next.categoryExperience).categories);
      setMsg('Saved. The category page updates on next load.');
    } catch (ex) {
      setErr(ex.message || 'Could not save.');
    }
    setSaving(false);
  };

  // Rows stay collapsed (<details>) and are filtered by product name, so a
  // 46-item category is a short searchable list rather than a wall of forms.
  // The original INDEX travels with each row, so Move up/down and Remove keep
  // acting on the real list while a filter is applied.
  const visibleItems = cfg.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      const product = products.find((pr) => pr.slug === item.productSlug);
      return `${product?.name || ''} ${item.productSlug}`.toLowerCase().includes(q);
    });

  const readyButOff = categoryIsReadyButOff(cfg);

  if (loading) return <div className="adm__head"><h1>Category Experience</h1><p>Loading…</p></div>;

  const tone = categoryToneTheme(slug);

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Category Experience</h1>
          <p>
            The animated product stage at the top of a category page. Choose which products
            appear and how they look. Leave the list empty and the stage fills itself from
            the category’s own products.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label className="label" htmlFor="cx-cat">Category</label>
          <select id="cx-cat" className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <p className="hint">{eligible.length} product{eligible.length === 1 ? '' : 's'} in this category can be spotlighted.</p>
        </div>

        {/* Publish state, said plainly. The spotlight is off until the owner
            turns it on, so a category with packshots already assigned needs to
            look ready rather than broken. */}
        <p className={`adm-cx__state adm-cx__state--${cfg.enabled ? 'live' : (readyButOff ? 'ready' : 'off')}`}>
          {cfg.enabled
            ? 'LIVE — customers see this spotlight.'
            : readyButOff
              ? `READY — NOT LIVE. ${cfg.items.length} product${cfg.items.length === 1 ? '' : 's'} assigned. Turn it on below when you are happy with it.`
              : 'NOT LIVE. Nothing is shown on this category page yet.'}
        </p>

        <div className="adm-cx__row">
          <label className="check">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="check__box" /> Show the spotlight on this category
          </label>
          <label className="check">
            <input type="checkbox" checked={cfg.autoRotate} onChange={(e) => patch({ autoRotate: e.target.checked })} />
            <span className="check__box" /> Rotate automatically
          </label>
        </div>

        <div className="field">
          <label className="label" htmlFor="cx-int">
            Time on each product — {(cfg.intervalMs / 1000).toFixed(1)}s
          </label>
          <input
            id="cx-int" type="range" className="input"
            min={MIN_INTERVAL_MS} max={MAX_INTERVAL_MS} step={100}
            value={cfg.intervalMs}
            onChange={(e) => patch({ intervalMs: Number(e.target.value) })}
            disabled={!cfg.autoRotate}
          />
          <p className="hint">Rotation always pauses while a customer is looking at or using the stage.</p>
        </div>
      </div>

      <div className="card">
        <h2 className="adm-cx__h2">Category background</h2>
        <p className="hint">Used for any product that has no background of its own.</p>
        <ThemeFields
          theme={cfg.theme}
          fallback={tone}
          onChange={(theme) => patch({ theme })}
          idPrefix="cx-cat-theme"
        />
      </div>

      <div className="card">
        <h2 className="adm-cx__h2">
          Spotlight products{cfg.items.length > 0 && <span className="adm-cx__count"> · {cfg.items.length}</span>}
        </h2>
        {cfg.items.length === 0 && (
          <p className="hint">
            Nothing chosen yet — the stage will show every one of this category’s
            {' '}{eligible.length} sellable products automatically, in catalogue order.
            Add products below to control the order and the look.
          </p>
        )}

        {cfg.items.length > 6 && (
          <div className="field adm-cx__filter">
            <label className="label sr-only" htmlFor="cx-filter">Find a product in this list</label>
            <input
              id="cx-filter" className="input" type="search" value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Find one of the ${cfg.items.length} products…`}
            />
            {filter && (
              <p className="hint">
                {visibleItems.length} of {cfg.items.length} shown.
                {' '}Ordering moves the product within the full list, not the filtered view.
              </p>
            )}
          </div>
        )}

        {visibleItems.map(({ item, index: i }) => {
          const product = eligible.find((p) => p.slug === item.productSlug)
            || products.find((p) => p.slug === item.productSlug);
          const stale = !product || !isSpotlightEligible(product)
            || !(product.categories || [product.category]).includes(slug);
          return (
            <details key={item.id} className={`adm-dc${item.enabled ? '' : ' adm-dc--off'}`}>
              <summary className="adm-dc__sum">
                <span className="adm-dc__title">
                  {i + 1}. {product?.name || item.productSlug}
                </span>
                {!item.enabled && <span className="adm-dc__badge">Hidden</span>}
                {stale && <span className="adm-dc__badge">Not shown</span>}
              </summary>
              <div className="adm-dc__body">
                {stale && (
                  <p className="hint err">
                    This product is no longer sellable in this category, so the stage skips it.
                    Remove it, or fix the product.
                  </p>
                )}

                <label className="check">
                  <input type="checkbox" checked={item.enabled} onChange={(e) => patchItem(i, { enabled: e.target.checked })} />
                  <span className="check__box" /> Include this product
                </label>

                <SpotlightImageField
                  value={item.spotlightImage}
                  name={product?.name || item.productSlug}
                  onChange={(spotlightImage) => patchItem(i, { spotlightImage })}
                  onBusy={(d) => setUploads((n) => n + d)}
                />

                {/* Packshots are not framed alike — some fill their canvas,
                    others float in blank space. These two nudge one product's
                    visual without disturbing any other, and without touching
                    the stage geometry that every product shares. */}
                <div className="adm-cx__fit">
                  <div className="field">
                    <label className="label" htmlFor={`cx-scale-${item.id}`}>
                      Visual size — {Number(item.visualScale ?? DEFAULT_ITEM_SCALE).toFixed(2)}×
                    </label>
                    <input
                      id={`cx-scale-${item.id}`} type="range" className="input"
                      min={MIN_ITEM_SCALE} max={MAX_ITEM_SCALE} step={0.01}
                      value={item.visualScale ?? DEFAULT_ITEM_SCALE}
                      onChange={(e) => patchItem(i, { visualScale: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`cx-offset-${item.id}`}>
                      Nudge up / down — {item.verticalOffset ?? 0}px
                    </label>
                    <input
                      id={`cx-offset-${item.id}`} type="range" className="input"
                      min={-ITEM_OFFSET_LIMIT} max={ITEM_OFFSET_LIMIT} step={1}
                      value={item.verticalOffset ?? 0}
                      onChange={(e) => patchItem(i, { verticalOffset: Number(e.target.value) })}
                    />
                  </div>
                  <button
                    type="button" className="btn btn-sm btn-light"
                    onClick={() => patchItem(i, { visualScale: DEFAULT_ITEM_SCALE, verticalOffset: 0 })}
                    disabled={(item.visualScale ?? DEFAULT_ITEM_SCALE) === DEFAULT_ITEM_SCALE
                      && (item.verticalOffset ?? 0) === 0}
                  >
                    Reset fit
                  </button>
                </div>
                <p className="hint">Use the preview below to see the effect before you save.</p>

                <div className="field">
                  <label className="label" htmlFor={`cx-h-${item.id}`}>Headline (optional)</label>
                  <input
                    id={`cx-h-${item.id}`} className="input" maxLength={60}
                    value={item.headline}
                    onChange={(e) => patchItem(i, { headline: e.target.value })}
                    placeholder="A short line above the product name"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor={`cx-s-${item.id}`}>Subline (optional)</label>
                  <input
                    id={`cx-s-${item.id}`} className="input" maxLength={90}
                    value={item.subline}
                    onChange={(e) => patchItem(i, { subline: e.target.value })}
                    placeholder="One short supporting line"
                  />
                  <p className="hint">
                    Your own words, shown exactly as written. Do not describe results or benefits
                    the product has not been approved to claim.
                  </p>
                </div>

                <ThemeFields
                  theme={{ background: item.background, gradient: item.gradient }}
                  fallback={{
                    background: item.autoTheme?.background || cfg.theme.background,
                    gradient: item.autoTheme?.gradient
                      || (item.autoTheme?.background ? '' : cfg.theme.gradient),
                  }}
                  optional
                  onChange={({ background, gradient }) => patchItem(i, { background, gradient })}
                  idPrefix={`cx-item-${item.id}`}
                />
                {item.autoTheme?.background && (
                  <p className="hint">Automatic theme sampled from this imported packshot. Enter either field above to override it.</p>
                )}

                <div className="adm-dc__foot">
                  <button type="button" className="btn btn-sm btn-light" onClick={() => moveItem(i, -1)} disabled={i === 0}>
                    ↑ Move up
                  </button>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => moveItem(i, 1)} disabled={i === cfg.items.length - 1}>
                    ↓ Move down
                  </button>
                  <button type="button" className="linkbtn linkbtn--danger" onClick={() => removeItem(i)}>
                    Remove
                  </button>
                </div>
              </div>
            </details>
          );
        })}

        <div className="adm-dc__add">
          <label className="label" htmlFor="cx-add">Add a product</label>
          <select
            id="cx-add" className="input" value=""
            disabled={!available.length}
            onChange={(e) => addItem(e.target.value)}
          >
            <option value="">
              {available.length ? 'Choose a product…' : 'Every eligible product is already added'}
            </option>
            {available.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}{p.form ? ` · ${p.form}` : ''}</option>
            ))}
          </select>
          <p className="hint">Only products from {categories.find((c) => c.slug === slug)?.name} that are active, priced and in stock.</p>
        </div>
      </div>

      {/* Preview renders the REAL CategorySpotlight with the configuration
          currently being edited, so there is no second implementation to keep
          in step — and no need to publish a category just to look at it. */}
      <div className="card">
        <h2 className="adm-cx__h2">Preview</h2>
        <p className="hint">
          Exactly what the category page would show, using the settings above — including
          unsaved changes. Visible only here; turning the spotlight on is what publishes it.
        </p>
        <button type="button" className="btn btn-light" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
        {showPreview && (
          <div className="adm-cx__preview">
            <CategorySpotlight
              key={`${slug}-${cfg.items.length}-${cfg.theme.background}`}
              category={categories.find((c) => c.slug === slug)}
              products={products.filter((p) => (p.categories || [p.category]).includes(slug))}
              configOverride={cfg}
              preview
            />
          </div>
        )}
      </div>

      {/* Sits after the per-category editor: the owner curates here, and when
          they have a folder of packshots ready the importer below assigns them
          all in one pass rather than one upload at a time. It re-reads and
          rewrites the same `homepage` setting, so it reloads this page's state
          when it finishes. */}
      <BulkPackshotImport onImported={reloadFromSettings} />

      {msg && <p className="hint ok">{msg}</p>}
      {err && <p className="hint err">{err}</p>}
      <button className="btn" onClick={save} disabled={saving || uploads > 0}>
        {saving ? 'Saving…' : uploads > 0 ? 'Waiting for upload…' : 'Save Category Experience'}
      </button>
    </div>
  );
}

/** Background colour + optional gradient, with live validation feedback. */
function ThemeFields({ theme, fallback, onChange, idPrefix, optional = false }) {
  const bgOk = !theme.background || Boolean(safeColor(theme.background));
  const gradOk = !theme.gradient || Boolean(safeGradient(theme.gradient));
  const shownBg = safeColor(theme.background) || fallback.background;
  const shownGrad = safeGradient(theme.gradient) || (theme.background ? '' : fallback.gradient);

  return (
    <div className="adm-cx__theme">
      <div className="adm-cx__theme-fields">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-bg`}>Background colour</label>
          <input
            id={`${idPrefix}-bg`} className="input"
            value={theme.background || ''}
            onChange={(e) => onChange({ background: e.target.value, gradient: theme.gradient || '' })}
            placeholder={optional ? `Leave empty to use ${fallback.background}` : fallback.background}
          />
          {!bgOk && <p className="hint err">Not a colour we can use — it will be ignored.</p>}
        </div>
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-grad`}>Gradient (optional)</label>
          <input
            id={`${idPrefix}-grad`} className="input"
            value={theme.gradient || ''}
            onChange={(e) => onChange({ background: theme.background || '', gradient: e.target.value })}
            placeholder="linear-gradient(168deg, #F4EFF5 0%, #E6DCEA 100%)"
          />
          {!gradOk && <p className="hint err">Only a plain linear/radial/conic gradient is accepted.</p>}
        </div>
      </div>
      <div className="adm-cx__swatch" style={{ background: shownGrad || shownBg }} aria-hidden="true" />
    </div>
  );
}

/** Optional cutout asset. Reuses the homepage image upload path unchanged. */
function SpotlightImageField({ value, name, onChange, onBusy }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); onBusy(1); setErr('');
    try {
      onChange(await uploadHomepageImage(file));
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
    setBusy(false); onBusy(-1);
  }

  return (
    <div className="field">
      <label className="label">Spotlight packshot</label>
      <input
        className="input" value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave empty to use the product's own image"
        aria-label={`Spotlight packshot URL for ${name}`}
      />
      <p className="hint">
        <strong>Use a packshot: the product on its own, with nothing behind it.</strong> A
        cut-out PNG on a transparent background is ideal; a clean white-background
        studio shot also works. The spotlight floats this image directly on the
        category colour, so it is not a photo frame — a lifestyle photo, a banner,
        or a shot with a room, table or props behind the product will show its
        rectangular edges against the background and look wrong here.
      </p>
      <p className="hint">
        Leave this empty and the product’s normal catalogue image is used instead.
        That still works, but if that image is a lifestyle photo the stage will
        show its edges — which is why a packshot here is worth uploading.
      </p>
      {err && <p className="hint err">{err}</p>}
      <div className="adm-disc-row__actions">
        <input
          type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy}
          aria-label={`Upload a spotlight image for ${name}`}
        />
        {value && (
          <button type="button" className="btn btn-sm btn-light" onClick={() => onChange('')}>
            Use product image
          </button>
        )}
        {busy && <span className="hint">Uploading…</span>}
      </div>
    </div>
  );
}
