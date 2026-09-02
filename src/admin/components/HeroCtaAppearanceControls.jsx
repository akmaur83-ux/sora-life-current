import { HERO_CTA_FIELDS, sanitizeHeroCta } from '../../lib/heroCtaAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';

const GROUPS = [
  ['Position', ['desktopPosition', 'x', 'y', 'mobilePosition', 'mobileX', 'mobileY']],
  ['Button', ['width', 'paddingX', 'paddingY', 'backgroundColor', 'textColor', 'borderColor', 'borderWidth', 'radius', 'fontSize', 'fontWeight', 'opacity', 'shadow']],
  ['Texture', ['textureUrl', 'textureOpacity', 'textureFit']],
  ['Icon', ['iconUrl', 'iconSide', 'iconSize']],
];

function VisualField({ name, field, value, onChange, onUploading, setError, disabled = false }) {
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploading(1); setError('');
    try {
      const url = await uploadHomepageImage(file);
      // Functional update prevents upload completion from reverting newer edits.
      onChange((latest) => ({ ...latest, [name]: url }));
    } catch (error) { setError(`Upload failed: ${error.message || error}`); }
    finally { onUploading(-1); e.target.value = ''; }
  }
  if (field.type === 'image') return <div className="field">
    <label className="label">{field.label}</label>
    {value && <img src={value} alt={`${field.label} preview`} style={{ display: 'block', maxWidth: 240, maxHeight: 100, objectFit: 'contain', marginBottom: 8 }} />}
    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
    <input className="input" style={{ marginTop: 8 }} value={value || ''} onChange={(e) => onChange((latest) => ({ ...latest, [name]: e.target.value }))} placeholder="or paste a public HTTPS image URL" />
    {value && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => onChange((latest) => ({ ...latest, [name]: '' }))}>Clear image</button>}
  </div>;
  if (field.type === 'select') return <div className="field"><label className="label">{field.label}</label><select className="select" value={value} onChange={(e) => onChange((latest) => ({ ...latest, [name]: field.options.includes(Number(e.target.value)) ? Number(e.target.value) : e.target.value }))}>{field.options.map((option) => <option key={option} value={option}>{option === 'auto' ? 'Auto — safe default' : option === 'custom' ? 'Custom — use X/Y below' : String(option).replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}</select></div>;
  if (field.type === 'color') return <div className="field"><label className="label">{field.label}</label><input className="input" value={value || ''} onChange={(e) => onChange((latest) => ({ ...latest, [name]: e.target.value }))} placeholder="#1E3A2F or leave blank" /></div>;
  return <div className="field" style={disabled ? { opacity: 0.48 } : undefined}><label className="label">{field.label}</label><input className="input" type="number" min={field.min} max={field.max} step={field.step} value={value} disabled={disabled} onChange={(e) => onChange((latest) => ({ ...latest, [name]: e.target.value }))} /></div>;
}

export default function HeroCtaAppearanceControls({ value, onChange, onUploading, setError }) {
  const appearance = { ...sanitizeHeroCta(), ...value };
  return <section className="surface" style={{ marginTop: 16, padding: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', marginBottom: 12 }}>
      <div><h3 style={{ margin: 0 }}>CTA appearance</h3><p className="hint" style={{ margin: '4px 0 0' }}>Safe settings saved only for this slide. Auto keeps text-led slides in flow and places artwork-only mobile CTAs lower.</p></div>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(sanitizeHeroCta())}>Reset defaults</button>
    </div>
    {GROUPS.map(([title, names]) => <fieldset key={title} style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0 0', padding: '12px 0 0' }}>
      <legend style={{ paddingRight: 8, fontWeight: 700 }}>{title}</legend>
      {title === 'Position' && <p className="hint">X runs left (0%) to right (100%); Y runs top (0%) to bottom (100%). Auto uses the safe default and ignores X/Y.</p>}
      <div className="adm-grid2">{names.map((name) => <VisualField key={name} name={name} field={HERO_CTA_FIELDS[name]} value={appearance[name]} onChange={onChange} onUploading={onUploading} setError={setError}
        disabled={(name === 'x' || name === 'y') ? appearance.desktopPosition !== 'custom' : (name === 'mobileX' || name === 'mobileY') ? appearance.mobilePosition !== 'custom' : false} />)}</div>
    </fieldset>)}
  </section>;
}
