import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting, uploadImage } from '../../lib/adminApi.js';

export default function Branding() {
  const [form, setForm] = useState({ logo_url: '', site_name: '', tagline: '', primary_color: '#1E3A2F', accent_color: '#E8B04B', favicon_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    adminGetSetting('branding').then((v) => { if (v) setForm((f) => ({ ...f, ...v })); }).catch((e) => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onFile(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try { set(field, await uploadImage(file, 'branding')); }
    catch (ex) { setErr('Upload failed: ' + (ex.message || String(ex))); }
    setUploading('');
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    try {
      await adminSetSetting('branding', form);
      setMsg('Saved. Reload the storefront to see logo/color changes (they apply at page load).');
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form">
      <div className="adm__head"><div><h1>Branding</h1><p>Logo, site name, tagline, favicon and brand colors.</p></div></div>
      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <form onSubmit={save}>
        <div className="surface">
          <h2>Logo</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="adm-thumb-lg" style={{ background: '#fff' }}>{form.logo_url && <img src={form.logo_url} alt="" />}</div>
            <div style={{ flex: 1 }}>
              <div className="field">
                <label className="label">Upload logo (transparent PNG recommended)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => onFile(e, 'logo_url')} disabled={!!uploading} />
              </div>
              <div className="field"><label className="label">Or paste logo URL</label><input className="input" value={form.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} /></div>
            </div>
          </div>
        </div>

        <div className="surface">
          <h2>Wordmark &amp; tagline</h2>
          <div className="adm-grid2">
            <div className="field"><label className="label">Site name</label><input className="input" value={form.site_name} onChange={(e) => set('site_name', e.target.value)} /></div>
            <div className="field"><label className="label">Tagline</label><input className="input" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
          </div>
        </div>

        <div className="surface">
          <h2>Brand colors</h2>
          <div className="adm-grid2">
            <div className="field">
              <label className="label">Primary color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} style={{ width: 44, height: 40, border: 'none', background: 'none' }} />
                <input className="input" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label">Accent color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} style={{ width: 44, height: 40, border: 'none', background: 'none' }} />
                <input className="input" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="surface">
          <h2>Favicon</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="adm-thumb-lg" style={{ width: 48, height: 48 }}>{form.favicon_url && <img src={form.favicon_url} alt="" />}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => onFile(e, 'favicon_url')} disabled={!!uploading} />
          </div>
        </div>

        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</button>
      </form>
    </div>
  );
}
