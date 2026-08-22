import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';

export default function HomepageSettings() {
  const [notices, setNotices] = useState(['', '', '']);
  const [threshold, setThreshold] = useState(699);
  const [bsTitle, setBsTitle] = useState('Bestsellers');
  const [bsSub, setBsSub] = useState('Our most loved products by our customers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ann = await adminGetSetting('announcement');
        const hp = await adminGetSetting('homepage');
        if (ann) { setNotices(ann.notices || ['', '', '']); setThreshold(ann.free_shipping_threshold ?? 699); }
        if (hp) { setBsTitle(hp.bestseller_title || 'Bestsellers'); setBsSub(hp.bestseller_subtitle || ''); }
      } catch (e) { setErr(e.message || String(e)); }
      setLoading(false);
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    try {
      await adminSetSetting('announcement', { notices: notices.filter(Boolean), free_shipping_threshold: Number(threshold) || 0 });
      await adminSetSetting('homepage', { bestseller_title: bsTitle, bestseller_subtitle: bsSub });
      setMsg('Saved. Changes will appear on the public site on next page load.');
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form">
      <div className="adm__head"><div><h1>Homepage</h1><p>Announcement bar, free shipping threshold, and the Bestsellers section copy.</p></div></div>
      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <form onSubmit={save}>
        <div className="surface">
          <h2>Announcement bar</h2>
          {[0, 1, 2].map((i) => (
            <div className="field" key={i}>
              <label className="label">Notice {i + 1}</label>
              <input className="input" value={notices[i] || ''} onChange={(e) => setNotices((n) => { const c = [...n]; c[i] = e.target.value; return c; })} />
            </div>
          ))}
          <div className="field">
            <label className="label">Free shipping threshold (₹)</label>
            <input className="input" type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ maxWidth: 200 }} />
          </div>
        </div>

        <div className="surface">
          <h2>Bestsellers section</h2>
          <div className="field"><label className="label">Title</label><input className="input" value={bsTitle} onChange={(e) => setBsTitle(e.target.value)} /></div>
          <div className="field"><label className="label">Subtitle</label><input className="input" value={bsSub} onChange={(e) => setBsSub(e.target.value)} /></div>
        </div>

        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
