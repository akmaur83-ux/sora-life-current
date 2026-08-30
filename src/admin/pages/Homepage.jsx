import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import HomepageVisualControls from '../components/HomepageVisualControls.jsx';
import { HOMEPAGE_VISUAL_FIELDS, mergeHomepageVisuals, safeVisualUrl, sanitizeHomepageVisuals } from '../../lib/homepageAppearance.js';
import { announceHomepageSaved } from '../../lib/homepageVisualSync.js';

export default function HomepageSettings() {
  const [notices, setNotices] = useState(['', '', '']);
  const [threshold, setThreshold] = useState(699);
  const [bsTitle, setBsTitle] = useState('Bestsellers');
  const [bsSub, setBsSub] = useState('Our most loved products by our customers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [visuals, setVisuals] = useState(() => sanitizeHomepageVisuals());
  const [uploads, setUploads] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const ann = await adminGetSetting('announcement');
        const hp = await adminGetSetting('homepage');
        if (ann) { setNotices(ann.notices || ['', '', '']); setThreshold(ann.free_shipping_threshold ?? 699); }
        if (hp) { setBsTitle(hp.bestseller_title || 'Bestsellers'); setBsSub(hp.bestseller_subtitle || ''); setVisuals(sanitizeHomepageVisuals(hp.visuals)); }
      } catch (e) { setErr(e.message || String(e)); }
      setLoading(false);
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    if (uploads) return;
    for (const [group, fields] of Object.entries(HOMEPAGE_VISUAL_FIELDS)) {
      for (const [key, field] of Object.entries(fields)) {
        if (field.type === 'image' && visuals[group][key] && !safeVisualUrl(visuals[group][key])) {
          setErr(`Please correct or clear ${field.label.toLowerCase()} before saving.`);
          return;
        }
      }
    }
    setSaving(true); setErr(''); setMsg('');
    try {
      // Preserve existing story/editorial/unknown keys instead of replacing the
      // entire homepage JSON with just the fields this editor knows about.
      const [currentAnnouncement, currentHomepage] = await Promise.all([adminGetSetting('announcement'), adminGetSetting('homepage')]);
      await adminSetSetting('announcement', { ...currentAnnouncement, notices: notices.filter(Boolean), free_shipping_threshold: Number(threshold) || 0 });
      const next = mergeHomepageVisuals({ ...currentHomepage, bestseller_title: bsTitle, bestseller_subtitle: bsSub }, visuals);
      await adminSetSetting('homepage', next);
      setVisuals(next.visuals);
      announceHomepageSaved(next);
      setMsg('Saved. Homepage appearance is live; open storefront tabs update automatically.');
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form">
      <div className="adm__head"><div><h1>Homepage</h1><p>Homepage copy, category strip appearance and the offers gallery.</p></div></div>
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

        <HomepageVisualControls value={visuals} onChange={setVisuals} onUploading={(delta) => setUploads((n) => n + delta)} />
        <button className="btn" type="submit" disabled={saving || uploads > 0}>{saving ? 'Saving…' : uploads ? 'Uploading images…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
