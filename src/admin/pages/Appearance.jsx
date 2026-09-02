import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TOKENS, GROUPS, DEFAULT_THEME, PRESET_LIST, TYPE_SCALES, OVERLAY_SCALES,
  HEX_RE, sanitizeTheme, overlayRgba,
} from '../../lib/theme.js';
import { adminGetTheme, adminSetTheme } from '../../lib/adminApi.js';

// ============================================================
// ADMIN — Storefront Appearance
//
// Edits the single `storefront_theme` object (site_settings) through the
// validating admin RPC. Nothing is stored until Save. With SORA Classic the
// saved object equals the defaults, so the storefront is byte-identical.
// ============================================================

const upperHex = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : v);
const isValid = (tok, v) => (
  tok.type === 'overlay' ? OVERLAY_SCALES.includes(v)
    : tok.type === 'scale' ? TYPE_SCALES.includes(v)
      : HEX_RE.test(v || ''));

// All --st-* vars for a full theme, so the preview always reflects the working
// values exactly (defaults included).
function previewVars(theme) {
  const style = {};
  for (const t of TOKENS) {
    if (!t.css) continue;
    const val = t.type === 'overlay' ? overlayRgba(theme[t.key]) : theme[t.key];
    for (const cssVar of t.css) style[cssVar] = val;
  }
  return style;
}

export default function Appearance() {
  const [saved, setSaved] = useState(null);
  const [working, setWorking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [openGroup, setOpenGroup] = useState('Homepage');

  const load = useCallback(async () => {
    setLoading(true);
    const t = await adminGetTheme();
    const clean = sanitizeTheme(t || DEFAULT_THEME);
    setSaved(clean); setWorking({ ...clean }); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2600); }
  const dirty = useMemo(() => (working && saved && TOKENS.some((t) => working[t.key] !== saved[t.key])), [working, saved]);
  const anyInvalid = useMemo(() => (working ? TOKENS.some((t) => !isValid(t, working[t.key])) : false), [working]);
  const activePreset = useMemo(() => {
    if (!working) return null;
    const hit = PRESET_LIST.find((p) => TOKENS.every((t) => p.theme[t.key] === working[t.key]));
    return hit ? hit.id : 'custom';
  }, [working]);

  const setToken = (key, value) => setWorking((w) => ({ ...w, [key]: value }));
  const resetToken = (key) => setToken(key, DEFAULT_THEME[key]);
  const applyPreset = (p) => { setWorking(sanitizeTheme(p.theme)); setErr(''); flash(`“${p.name}” loaded — review, then Save.`); };
  const cancel = () => { setWorking({ ...saved }); setErr(''); };
  const resetAll = () => { setWorking({ ...DEFAULT_THEME }); setErr(''); flash('Reset to SORA Classic — Save to apply.'); };

  async function save() {
    const bad = TOKENS.find((t) => !isValid(t, working[t.key]));
    if (bad) { setErr(`Invalid value for “${bad.label}”. Colors must be #RRGGBB.`); return; }
    setBusy(true); setErr('');
    try {
      const res = await adminSetTheme(working);
      if (!res || res.ok === false) { setErr(res?.reason || 'Could not save.'); setBusy(false); return; }
      const clean = sanitizeTheme(res.theme || working);
      setSaved(clean); setWorking({ ...clean });
      flash('Storefront appearance saved.');
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  if (loading || !working) return <div><div className="adm__head"><h1>Storefront Appearance</h1></div><p className="muted">Loading theme…</p></div>;

  const tokensByGroup = (g) => TOKENS.filter((t) => t.group === g);

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Storefront Appearance</h1>
          <p>Customize the storefront theme without touching code. {dirty ? <strong className="ap-dirty">● Unsaved changes</strong> : 'All changes saved.'}</p>
        </div>
        <div className="ap-head-actions">
          <button className="btn btn-sm btn-light" onClick={cancel} disabled={busy || !dirty}>Cancel</button>
          <button className="btn btn-sm" onClick={save} disabled={busy || !dirty || anyInvalid} title={anyInvalid ? 'Fix invalid colors first' : ''}>{busy ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      {/* Presets */}
      <div className="surface ap-presets">
        <span className="ap-presets__label">Preset</span>
        <div className="ap-presets__row">
          {PRESET_LIST.map((p) => (
            <button key={p.id} className={`ap-preset ${activePreset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>{p.name}</button>
          ))}
          <span className={`ap-preset is-custom ${activePreset === 'custom' ? 'active' : ''}`}>Custom</span>
        </div>
        <button className="btn btn-xs btn-light ap-resetall" onClick={resetAll}>Reset entire theme</button>
      </div>

      <div className="ap-layout">
        {/* Controls */}
        <div className="ap-controls">
          {GROUPS.map((g) => (
            <section key={g} className={`surface ap-group ${openGroup === g ? 'is-open' : ''}`}>
              <button className="ap-group__head" onClick={() => setOpenGroup((o) => (o === g ? '' : g))}>
                <span>{g}</span>
                <span className="ap-group__chev">{openGroup === g ? '−' : '+'}</span>
              </button>
              {openGroup === g && (
                <div className="ap-group__body">
                  {tokensByGroup(g).map((t) => (
                    <ThemeControl key={t.key} tok={t} value={working[t.key]} isDefault={working[t.key] === DEFAULT_THEME[t.key]}
                      onChange={(v) => setToken(t.key, v)} onReset={() => resetToken(t.key)} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Live preview */}
        <aside className="ap-preview-wrap">
          <div className="ap-preview-sticky">
            <h2 className="ap-preview-title">Live preview</h2>
            <StorefrontPreview theme={working} />
            <p className="hint" style={{ marginTop: 10 }}>Preview reflects unsaved edits. The real storefront updates only after you Save.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ThemeControl({ tok, value, isDefault, onChange, onReset }) {
  if (tok.type === 'scale' || tok.type === 'overlay') {
    const opts = tok.type === 'scale' ? TYPE_SCALES : OVERLAY_SCALES;
    return (
      <div className="ap-row">
        <label className="ap-row__label">{tok.label}{!isDefault && <span className="ap-changed" title="changed from default" />}</label>
        <div className="ap-seg">
          {opts.map((o) => (
            <button key={o} type="button" className={value === o ? 'active' : ''} onClick={() => onChange(o)}>{o}</button>
          ))}
        </div>
        <button type="button" className="ap-reset" title="Reset to default" onClick={onReset} disabled={isDefault}>↺</button>
      </div>
    );
  }
  const validHex = HEX_RE.test(value || '');
  return (
    <div className="ap-row">
      <label className="ap-row__label">{tok.label}{!isDefault && <span className="ap-changed" title="changed from default" />}</label>
      <span className="ap-swatch" style={{ background: validHex ? value : 'transparent' }} aria-hidden />
      <input type="color" className="ap-color" value={validHex ? value : '#000000'} onChange={(e) => onChange(upperHex(e.target.value))} aria-label={tok.label} />
      <input type="text" className={`ap-hex ${validHex ? '' : 'is-bad'}`} value={value} maxLength={7} spellCheck={false}
        onChange={(e) => { let v = e.target.value.trim(); if (v && !v.startsWith('#')) v = `#${v}`; onChange(upperHex(v)); }} />
      <button type="button" className="ap-reset" title="Reset to default" onClick={onReset} disabled={isDefault}>↺</button>
    </div>
  );
}

// A compact, representative slice of the storefront driven entirely by the
// working theme's --st-* vars (set on the container), so it mirrors real output.
function StorefrontPreview({ theme }) {
  const style = previewVars(theme);
  const cats = ['Wellness', 'Hair Care', 'Skin Care', 'Juices'];
  return (
    <div className="ap-pv" style={style} data-heading-scale={theme.heading_scale} data-body-scale={theme.body_scale}>
      <div className="ap-pv__annbar">
        <span className="ap-pv__annbar-acc">✦</span> FREE STANDARD SHIPPING
      </div>
      <div className="ap-pv__hdr">
        <strong>SORA LIFE</strong>
        <nav>Wellness · Skin · Hair</nav>
        <span className="ap-pv__hdr-ic">♡ ⌕ ⛬</span>
      </div>
      <div className="ap-pv__cats">
        {cats.map((c) => (
          <div key={c} className="ap-pv__cat">
            <span className="ap-pv__circle" />
            <span className="ap-pv__cat-name">{c}</span>
            <span className="ap-pv__cat-view">View all</span>
          </div>
        ))}
      </div>
      <div className="ap-pv__cardrow">
        <div className="ap-pv__card">
          <div className="ap-pv__card-media">
            <span className="ap-pv__badge-sale">20% OFF</span>
            <span className="ap-pv__badge-new">New</span>
          </div>
          <div className="ap-pv__card-body">
            <span className="ap-pv__pname">Sea Buckthorn Juice</span>
            <span className="ap-pv__price">₹1,800 <s className="ap-pv__mrp">₹2,500</s></span>
          </div>
        </div>
        <div className="ap-pv__btns">
          <span className="ap-pv__btn-primary">Add to cart</span>
          <span className="ap-pv__btn-secondary">Quick view</span>
        </div>
      </div>
      <div className="ap-pv__footer">
        <span>© SORA LIFE</span> <span className="ap-pv__footer-acc">Wellness · Support</span>
      </div>
    </div>
  );
}
