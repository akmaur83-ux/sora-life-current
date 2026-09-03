import { useState } from 'react';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';

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
// ============================================================
function ImageRow({ label, hint, value, onChange, onBusy }) {
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
      </div>
    </div>
  );
}

export default function DiscoveryImageControls({ categories, concerns, value, onChange, onBusy }) {
  const set = (group, key) => (url) => onChange({
    ...value,
    [group]: { ...(value?.[group] || {}), [key]: url },
  });

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
          The image shown on each concern card. A concern only appears on the
          homepage when the catalogue actually has products behind it, so some
          rows here may not be visible on the storefront yet.
        </p>
        {concerns.map((c) => (
          <ImageRow
            key={c.id}
            label={c.label}
            hint={c.group}
            value={value?.concerns?.[c.id] || ''}
            onChange={set('concerns', c.id)}
            onBusy={onBusy}
          />
        ))}
      </div>
    </>
  );
}
