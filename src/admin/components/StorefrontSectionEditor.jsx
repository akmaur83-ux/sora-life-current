import { useState } from 'react';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadStorefrontImage } from '../../lib/storeCatalogueAdminApi.js';
import { claimWarnings, CLAIM_KINDS } from '../../lib/claimWarnings.js';
import { POSITION_LABELS } from '../../lib/storefrontContent.js';

// ============================================================
// ADMIN — one storefront section, edited field by field from its schema
// (storefrontContent.js): copy, links, photographs (phone and desktop, both
// through the WebP converter), a photograph's matched colour, the text
// position preset, and show/hide — for the section and for each tile.
//
// An empty field is the built-in value, shown greyed in it. Nothing here
// decides what is valid: the page checks the whole store with
// validateStorefrontContent before a save, and each refusal comes back to
// the field it belongs to (`errors`, keyed by the field's path). Copy is also
// read by the claim checker — a warning to judge, never a block.
// ============================================================

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function Claims({ text }) {
  const found = claimWarnings(text);
  if (!found.length) return null;
  return <p className="hint adm-sf-claim" role="note">Check before publishing — {found.map((f) => `${CLAIM_KINDS[f.kind] || f.kind}: “${f.term}” (${f.excerpt})`).join('; ')}.</p>;
}

function TextInput({ id, label, value, placeholder, error, onChange, hint }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="error-text" id={`${id}-error`} role="alert">{error}</p>}
      {hint && <p className="hint">{hint}</p>}
      <Claims text={value} />
    </div>
  );
}

/** One upload slot: the current file (or the built-in one, greyed), a button that converts and uploads. */
function UploadSlot({ id, label, value, builtIn, error, onChange, onUploading }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const preview = safeVisualUrl(value) || safeVisualUrl(builtIn);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setProblem(''); setNote(''); onUploading(1);
    try {
      const image = await uploadStorefrontImage(file);
      onChange(image.url);
      setNote(`Converted to WebP, ${Math.round(image.bytes / 1000)} KB, ${image.width}×${image.height}.`);
    } catch (uploadError) { setProblem(uploadError.message || 'Upload failed.'); }
    finally { setBusy(false); onUploading(-1); }
  }
  return (
    <div className="field adm-sf-slot">
      <span className="label" id={`${id}-label`}>{label}</span>
      {preview && <img className={`hp-admin-image__preview${value ? '' : ' is-builtin'}`} src={preview} alt="" />}
      <p className="hint">{value ? 'Uploaded.' : 'Built-in photograph.'}</p>
      <div className="hp-admin-image__actions">
        <label className="btn btn-sm" aria-labelledby={`${id}-label`}>{busy ? 'Converting and uploading…' : value ? 'Replace' : 'Upload'}
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} />
        </label>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {problem && <p className="error-text" role="alert">{problem}</p>}
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

/** Phone and desktop photographs together — and, for a `tone`, the background colour matched to them. */
function PhotoPair({ id, spec, value, builtIn, path, errors, onChange, onUploading }) {
  const v = isObject(value) ? value : {};
  const set = (key, next) => onChange({ ...v, [key]: next });
  const tone = spec.type === 'tone';
  const anySet = ['phone', 'desktop', ...(tone ? ['colour'] : [])].some((k) => v[k]);
  return (
    <fieldset className="adm-sf-photos">
      <legend className="label">{spec.label}</legend>
      <p className="hint">{tone
        ? 'Upload both photographs and pick the colour behind them together — the colour fills the space the photograph fades into. Every upload is converted to a WebP under 150 KB.'
        : 'Upload both: a phone photograph (portrait) and a desktop one (wide). Every upload is converted to a WebP under 150 KB.'}</p>
      <div className="adm-sf-photos__grid">
        <UploadSlot id={`${id}-phone`} label="Phone" value={v.phone || ''} builtIn={builtIn?.phone} error={errors[`${path}.phone`]} onChange={(next) => set('phone', next)} onUploading={onUploading} />
        <UploadSlot id={`${id}-desktop`} label="Desktop" value={v.desktop || ''} builtIn={builtIn?.desktop} error={errors[`${path}.desktop`]} onChange={(next) => set('desktop', next)} onUploading={onUploading} />
        {tone && (
          <div className="field">
            <label className="label" htmlFor={`${id}-colour`}>Background colour</label>
            <div className="adm-sf-colour">
              <input type="color" aria-label="Pick the colour" value={/^#[0-9a-fA-F]{6}$/.test(v.colour || '') ? v.colour : (builtIn?.colour || '#FDFBF8')} onChange={(e) => set('colour', e.target.value.toUpperCase())} />
              <input id={`${id}-colour`} className="input" value={v.colour || ''} placeholder="#F4EFE6" onChange={(e) => set('colour', e.target.value.trim())} />
            </div>
            {errors[`${path}.colour`] && <p className="error-text" role="alert">{errors[`${path}.colour`]}</p>}
          </div>
        )}
      </div>
      {errors[path] && <p className="error-text" role="alert">{errors[path]}</p>}
      {anySet && <button type="button" className="btn btn-sm btn-light" onClick={() => onChange(tone ? { colour: '', phone: '', desktop: '' } : { phone: '', desktop: '' })}>Use the built-in photograph{tone ? ' and colour' : ''}</button>}
    </fieldset>
  );
}

function Field({ id, name, spec, value, builtIn, path, errors, onChange, onUploading }) {
  const label = spec.label || name;
  switch (spec.type) {
    case 'bool':
      return (
        <label className="adm-sf-hide">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Hide it on the site
        </label>
      );
    case 'text':
      return <TextInput id={id} label={label} value={typeof value === 'string' ? value : ''} placeholder={builtIn || ''} error={errors[path]} onChange={onChange}
        hint={`Up to ${spec.max} characters. Empty: the built-in text.`} />;
    case 'link':
      return <TextInput id={id} label={label} value={typeof value === 'string' ? value : ''} placeholder={builtIn || 'The page’s own link'} error={errors[path]} onChange={onChange}
        hint="A page of this site, starting with / (e.g. /fashion/c/dresses). Empty: the built-in link." />;
    case 'enum':
      return (
        <div className="field">
          <label className="label" htmlFor={id}>{label}</label>
          <select id={id} className="input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Built-in ({POSITION_LABELS[builtIn] || builtIn || 'Left'})</option>
            {spec.options.map((o) => <option key={o} value={o}>{POSITION_LABELS[o] || o}</option>)}
          </select>
          <p className="hint">Where the copy sits over the photograph on wide screens. A phone keeps its own layout.</p>
          {errors[path] && <p className="error-text" role="alert">{errors[path]}</p>}
        </div>
      );
    case 'lines': {
      const lines = Array.isArray(value) ? value : [];
      const set = (i, next) => { const out = Array.from({ length: spec.length }, (_, k) => (typeof lines[k] === 'string' ? lines[k] : '')); out[i] = next; onChange(out); };
      return (
        <fieldset className="adm-sf-lines">
          <legend className="label">{label}</legend>
          <div className="adm-grid2">
            {Array.from({ length: spec.length }, (_, i) => (
              <TextInput key={i} id={`${id}-${i}`} label={`Line ${i + 1}`} value={typeof lines[i] === 'string' ? lines[i] : ''} placeholder={builtIn?.[i] || ''} error={errors[`${path}.${i}`]} onChange={(next) => set(i, next)} />
            ))}
          </div>
          {errors[path] && <p className="error-text" role="alert">{errors[path]}</p>}
        </fieldset>
      );
    }
    case 'pic':
    case 'tone':
      return <PhotoPair id={id} spec={spec} value={value} builtIn={builtIn} path={path} errors={errors} onChange={onChange} onUploading={onUploading} />;
    case 'group':
      return <Group id={id} spec={spec} value={value} builtIn={builtIn} path={path} errors={errors} onChange={onChange} onUploading={onUploading} />;
    case 'list': {
      const items = Array.isArray(value) ? value : [];
      const base = Array.isArray(builtIn) ? builtIn : [];
      const set = (i, next) => { const out = Array.from({ length: Math.max(items.length, i + 1) }, (_, k) => (isObject(items[k]) ? items[k] : {})); out[i] = next; onChange(out); };
      const itemSpec = { type: 'group', fields: spec.fields };
      return (
        <div className="adm-sf-list">
          <p className="label">{label}</p>
          {base.slice(0, spec.length).map((def, i) => {
            const name = def.title ? (Array.isArray(def.title) ? def.title.filter(Boolean).join(' ') : def.title) : def.name || def.line1 || '';
            const off = items[i]?.hidden === true;
            return (
              <details key={i} className="adm-sf-item">
                <summary>{spec.itemLabel || 'Item'} {i + 1}{name ? `: ${name}` : ''}{off ? ' — hidden' : ''}</summary>
                <Group id={`${id}-${i}`} spec={itemSpec} value={items[i]} builtIn={def} path={`${path}.${i}`} errors={errors} onChange={(next) => set(i, next)} onUploading={onUploading} />
              </details>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}

function Group({ id, spec, value, builtIn, path, errors, onChange, onUploading }) {
  const v = isObject(value) ? value : {};
  return (
    <div className="adm-sf-group">
      {Object.entries(spec.fields).map(([key, field]) => (
        <Field key={key} id={`${id}-${key}`} name={key} spec={field} value={v[key]} builtIn={builtIn?.[key]} path={`${path}.${key}`} errors={errors}
          onChange={(next) => onChange({ ...v, [key]: next })} onUploading={onUploading} />
      ))}
    </div>
  );
}

/** A section's panel: its name, whether it is hidden, and every field under it. */
export default function StorefrontSectionEditor({ id, spec, path, value, builtIn, errors, onChange, onUploading }) {
  const marked = Object.keys(errors).some((key) => key === path || key.startsWith(`${path}.`));
  const hidden = isObject(value) && value.hidden === true;
  return (
    <details className={`surface adm-sf-section${marked ? ' has-errors' : ''}`} open={marked || undefined}>
      <summary><strong>{spec.label}</strong>{hidden ? <span className="adm-sf-badge">Hidden</span> : null}{marked ? <span className="adm-sf-badge is-error">Check the marked fields</span> : null}</summary>
      <Group id={id} spec={spec} value={value} builtIn={builtIn} path={path} errors={errors} onChange={onChange} onUploading={onUploading} />
    </details>
  );
}
