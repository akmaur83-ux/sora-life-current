import { useState } from 'react';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';
import ConcernProductPicker from './ConcernProductPicker.jsx';

// ============================================================
// Admin control for the two homepage discovery rails' artwork.
//
// One row per category and per concern: upload a file, or paste a URL, or
// clear it. Values are stored in the existing `homepage` site_settings row
// under `discovery`, so nothing new is provisioned and there is no migration.
//
// Leaving a row empty is a valid, supported state — the storefront falls back
// to its built-in artwork (see homeDiscovery.js). Nothing here can produce a
// broken card.
//
// A concern row carries one extra control: which products its card opens.
// That lives in the same row because it is the same decision — what this
// card is — and splitting it into a second list keyed by name would make
// the two drift apart.
// ============================================================
function ImageRow({ label, hint, value, onChange, onBusy, children }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const preview = safeVisualUrl(value);
  const invalid = !!value && !preview;

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
    <div className="adm-disc-row">
      <div className="adm-disc-row__thumb">
        {preview
          ? <img src={preview} alt="" />
          : <span className="adm-disc-row__empty">Default</span>}
      </div>
      <div className="adm-disc-row__body">
        <label className="label">{label}</label>
        {hint && <p className="hint">{hint}</p>}
        <input
          className="input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Leave empty to use the built-in image"
          aria-label={`${label} image URL`}
        />
        {invalid && <p className="hint err">Not a usable image URL — it will be ignored.</p>}
        {err && <p className="hint err">{err}</p>}
        <div className="adm-disc-row__actions">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy}
            aria-label={`Upload an image for ${label}`} />
          {value && (
            <button type="button" className="btn btn-sm btn-light" onClick={() => onChange('')}>
              Use default
            </button>
          )}
          {busy && <span className="hint">Uploading…</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DiscoveryImageControls({
  categories, concerns, value, onChange, onBusy,
  catalogue = [], concernProducts = {}, onConcernProductsChange,
}) {
  const set = (group, key) => (url) => onChange({
    ...value,
    [group]: { ...(value?.[group] || {}), [key]: url },
  });

  // An emptied selection is removed outright rather than stored as [], so
  // "no manual choice" has exactly one representation and the storefront's
  // fallback is reached the same way whether a concern was never curated or
  // was curated and then cleared.
  const setProducts = (id) => (slugs) => {
    const next = { ...concernProducts };
    if (slugs.length) next[id] = slugs; else delete next[id];
    onConcernProductsChange(next);
  };

  return (
    <>
      <div className="surface">
        <h2>Shop by Category images</h2>
        <p className="hint">
          The image shown on each category card. Leave a row empty to keep the
          built-in category artwork.
        </p>
        {categories.map((c) => (
          <ImageRow
            key={c.slug}
            label={c.name}
            value={value?.categories?.[c.slug] || ''}
            onChange={set('categories', c.slug)}
            onBusy={onBusy}
          />
        ))}
      </div>

      <div className="surface">
        <h2>Shop by Concerns images</h2>
        <p className="hint">
          The image on each concern card, and the products its card opens.
          Choose products to control the result exactly; leave the list empty
          and the card keeps matching the catalogue automatically. A concern
          with nothing behind it either way stays off the homepage.
        </p>
        {concerns.map((c) => (
          <ImageRow
            key={c.id}
            label={c.label}
            hint={c.group}
            value={value?.concerns?.[c.id] || ''}
            onChange={set('concerns', c.id)}
            onBusy={onBusy}
          >
            <ConcernProductPicker
              label={c.label}
              catalogue={catalogue}
              value={concernProducts?.[c.id] || []}
              onChange={setProducts(c.id)}
            />
          </ImageRow>
        ))}
      </div>
    </>
  );
}
