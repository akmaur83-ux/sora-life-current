import { useState } from 'react';
import { HOMEPAGE_VISUAL_FIELDS, safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';

function ImageControl({ id, label, value, onChange, onUploading }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = safeVisualUrl(value);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); onUploading(1); setError('');
    try { onChange(await uploadHomepageImage(file)); }
    catch (e) { setError(e.message || 'Upload failed.'); }
    finally { setBusy(false); onUploading(-1); }
  }
  return <div className="field hp-admin-image">
    <label className="label" htmlFor={id}>{label}</label>
    <input id={id} className="input" value={value} placeholder="https://… or /public/…" disabled={busy}
      onChange={(e) => { onChange(e.target.value); setError(''); }} aria-describedby={`${id}-help`} />
    <div className="hp-admin-image__actions">
      <label className="btn btn-sm">{busy ? 'Uploading…' : 'Upload image'}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} />
      </label>
      <button className="btn btn-sm" type="button" disabled={busy || !value} onClick={() => { onChange(''); setError(''); }}>Clear image</button>
    </div>
    <p className="hint" id={`${id}-help`}>PNG, JPEG or WebP, up to 6 MB. Public HTTPS or local image path. Upload stores the file; Save publishes its appearance. Clear removes the reference, not the shared file.</p>
    {value && !preview && <p className="error-text" role="alert">Enter a public HTTPS image URL or a local path. Private hosts, scripts, SVG and HTML are not allowed.</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {preview && <img key={preview} className="hp-admin-image__preview" src={preview} alt={`${label} preview`} onError={() => setError('Image could not load. Check its public URL.')} />}
  </div>;
}

export default function HomepageVisualControls({ value, onChange, onUploading }) {
  return <div className="hp-admin-visuals">
    {Object.entries(HOMEPAGE_VISUAL_FIELDS).map(([group, fields]) => <section className="surface" key={group}>
      <h2>{group === 'categoryStrip' ? 'Category strip appearance' : 'Offers appearance'}</h2>
      <p className="hint">{group === 'categoryStrip'
        ? 'Decorate the strip behind the existing category images and links. Enable the background to show images and decorations. Height always follows the categories.'
        : 'Style the curated Homepage promotions gallery. Only existing active, in-window Homepage promotions appear; these settings never create offers or change prices.'}</p>
      <div className="hp-admin-fields">
        {Object.entries(fields).map(([key, field]) => {
          const id = `homepage-${group}-${key}`;
          const current = value[group][key];
          // An upload may finish after other fields change; patch the latest state.
          const change = (next) => onChange((latest) => ({ ...latest, [group]: { ...latest[group], [key]: next } }));
          if (field.type === 'image') return <ImageControl key={key} id={id} label={field.label} value={current} onChange={change} onUploading={onUploading} />;
          return <div className="field" key={key}>
            {field.type === 'boolean' ? <label className="hp-admin-check" htmlFor={id}>
              <input id={id} type="checkbox" checked={current} onChange={(e) => change(e.target.checked)} />{field.label}
            </label> : <>
              <label className="label" htmlFor={id}>{field.label}</label>
              {field.type === 'select' ? <select id={id} className="input" value={current} onChange={(e) => change(typeof field.value === 'number' ? Number(e.target.value) : e.target.value)}>
                {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
              </select> : <input id={id} className="input" type={field.type} value={current}
                min={field.min} max={field.max} step={field.step}
                onChange={(e) => change(field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} />}
            </>}
          </div>;
        })}
      </div>
    </section>)}
  </div>;
}
