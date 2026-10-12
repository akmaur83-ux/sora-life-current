import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import HomepageVisualControls from '../components/HomepageVisualControls.jsx';
import DiscoveryCardControls from '../components/DiscoveryCardControls.jsx';
import { normalizeDiscovery, discoveryPayload } from '../../lib/homeDiscovery.js';
import { products } from '../../data/products.js';
import { HOMEPAGE_VISUAL_FIELDS, mergeHomepageVisuals, safeVisualUrl, sanitizeHomepageVisuals } from '../../lib/homepageAppearance.js';
import { announceHomepageSaved } from '../../lib/homepageVisualSync.js';

export default function HomepageSettings() {
  const [notices, setNotices] = useState(['', '', '']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [visuals, setVisuals] = useState(() => sanitizeHomepageVisuals());
  const [uploads, setUploads] = useState(0);
  // The two discovery rails, as ordered card lists under `homepage.discovery`.
  // Before an admin has saved anything these are the built-in rails expressed
  // as cards, so the editor opens on exactly what the homepage is showing.
  const [categoryCards, setCategoryCards] = useState(() => normalizeDiscovery({}).categoryCards);
  const [concernCards, setConcernCards] = useState(() => normalizeDiscovery({}).concernCards);

  useEffect(() => {
    (async () => {
      try {
        const ann = await adminGetSetting('announcement');
        const hp = await adminGetSetting('homepage');
        if (ann) { setNotices(ann.notices || ['', '', '']); }
        if (hp) {
          setVisuals(sanitizeHomepageVisuals(hp.visuals));
          const cards = normalizeDiscovery(hp.discovery);
          setCategoryCards(cards.categoryCards);
          setConcernCards(cards.concernCards);
        }
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
      const [currentAnnouncement, savedHomepage] = await Promise.all([adminGetSetting('announcement'), adminGetSetting('homepage')]);
      // `free_shipping_threshold` is retired — shipping is a flat per-method
      // fee with no basket-value threshold. It is dropped rather than
      // preserved, so saving this page scrubs the stale key that migration
      // 0001 seeded into site_settings.
      const { free_shipping_threshold: _retiredThreshold, ...keptAnnouncement } = currentAnnouncement || {};
      await adminSetSetting('announcement', { ...keptAnnouncement, notices: notices.filter(Boolean) });
      // Retired controls write nothing a page reads, so their stored values are
      // dropped here too (every visitor downloads this record): the Bestsellers
      // title and subtitle, and the Hero Slides page's per-slide button styling.
      // The category strip's visuals go with the sanitiser below, which keeps
      // only the Offers group.
      const { bestseller_title: _bt, bestseller_subtitle: _bs, heroCtas: _hc, ...currentHomepage } = savedHomepage || {};
      // Sanitised on the way out too: an unusable image URL, a malformed id,
      // a duplicate or a slug that is not a product never reaches storage.
      const cleanDiscovery = discoveryPayload(categoryCards, concernCards);
      const next = mergeHomepageVisuals({ ...currentHomepage, discovery: cleanDiscovery }, visuals);
      await adminSetSetting('homepage', next);
      setVisuals(next.visuals);
      setCategoryCards(cleanDiscovery.categoryCards);
      setConcernCards(cleanDiscovery.concernCards);
      announceHomepageSaved(next);
      setMsg('Saved. Homepage appearance is live; open storefront tabs update automatically.');
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="adm-form">
      <div className="adm__head"><div><h1>Homepage</h1><p>The announcement bar, the offers gallery’s appearance and the two discovery rails.</p></div></div>
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
        </div>

        <HomepageVisualControls value={visuals} onChange={setVisuals} onUploading={(delta) => setUploads((n) => n + delta)} />

        <DiscoveryCardControls
          categoryCards={categoryCards}
          concernCards={concernCards}
          onCategoryCardsChange={setCategoryCards}
          onConcernCardsChange={setConcernCards}
          catalogue={products}
          onBusy={(delta) => setUploads((n) => n + delta)}
        />
        <button className="btn" type="submit" disabled={saving || uploads > 0}>{saving ? 'Saving…' : uploads ? 'Uploading images…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
