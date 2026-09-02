import { useEffect, useState } from 'react';
import {
  adminListPromotions, adminUpsertPromotion, adminDeletePromotion,
  adminSetPromotionActive, adminReorderPromotions, uploadPromoImage,
} from '../../lib/adminApi.js';
import { normalizePromo } from '../../lib/promotions.js';
import PromoPoster from '../../components/promo/PromoPoster.jsx';
import PromoOfferCard from '../../components/promo/PromoOfferCard.jsx';

const THEME_OPTIONS = [
  ['forest', 'Forest'],
  ['cream', 'Warm Cream'],
  ['orange', 'Orange Accent'],
  ['dark', 'Dark Luxe'],
  ['minimal', 'Minimal'],
];
const PLACEMENT_OPTIONS = [
  ['home', 'Homepage'],
  ['pdp', 'Product page'],
  ['cart', 'Cart'],
];

const EMPTY = {
  type: 'poster', title: '', subtitle: '', coupon_code: '', cta_text: '', cta_url: '',
  badge_text: '', image_url: '', theme_variant: 'forest', text_align: 'left',
  placements: ['home'], is_active: true, starts_at: '', ends_at: '', sort_order: 0,
};

// ISO <-> <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export default function Promotions() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | row | null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [notMigrated, setNotMigrated] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      setList(await adminListPromotions());
      setNotMigrated(false);
    } catch (e) {
      const msg = e.message || String(e);
      if (/does not exist yet/i.test(msg)) { setNotMigrated(true); setList([]); }
      else setErr(msg);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const togglePlacement = (p) => setForm((f) => ({
    ...f,
    placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p],
  }));

  function startEdit(row) {
    if (row) {
      setForm({
        ...EMPTY, ...row,
        coupon_code: row.coupon_code || '', cta_text: row.cta_text || '', cta_url: row.cta_url || '',
        badge_text: row.badge_text || '', image_url: row.image_url || '',
        placements: Array.isArray(row.placements) ? row.placements : [],
        starts_at: toLocalInput(row.starts_at), ends_at: toLocalInput(row.ends_at),
      });
      setEditing(row);
    } else {
      setForm({ ...EMPTY, sort_order: list.length });
      setEditing('new');
    }
    setErr('');
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await adminUpsertPromotion({
        ...form,
        id: editing === 'new' ? undefined : editing.id,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        sort_order: Number(form.sort_order) || 0,
      });
      setEditing(null);
      await load();
    } catch (ex) {
      if (ex.savedPromotion) { setEditing(null); await load(); }
      // A saved replacement can still need old-image cleanup. Show that warning
      // after reload, which otherwise clears the error banner.
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }

  async function remove(row) {
    if (!window.confirm(`Delete promotion "${row.title || 'untitled'}" and its uploaded promo image (unless shared with another promotion)?`)) return;
    try { await adminDeletePromotion(row.id); await load(); }
    catch (ex) {
      if (ex.imageRemoved) await load();
      setErr(ex.message || String(ex));
    }
  }

  async function toggleActive(row) {
    try { await adminSetPromotionActive(row.id, !row.is_active); await load(); } catch (ex) { setErr(ex.message || String(ex)); }
  }

  async function move(row, dir) {
    const idx = list.findIndex((x) => x.id === row.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    try { await adminReorderPromotions(next.map((x) => x.id)); } catch (ex) { setErr(ex.message || String(ex)); }
  }

  async function onImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr('');
    try { set('image_url', await uploadPromoImage(file)); }
    catch (ex) { setErr('Upload failed: ' + (ex.message || String(ex))); }
    setUploading(false);
  }

  const preview = normalizePromo({ ...form });

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Promotions</h1>
          <p>{loading ? 'Loading…' : `${list.length} promotion${list.length === 1 ? '' : 's'}`} · posters &amp; offer cards for Home, PDP and Cart</p>
        </div>
        {!notMigrated && <button className="btn btn-sm" onClick={() => startEdit(null)}>+ New promotion</button>}
      </div>

      {notMigrated && (
        <div className="adm-banner info">
          The <code>promotions</code> table has not been created yet. Run{' '}
          <strong>supabase/migrations/0017_promotions.sql</strong> in the Supabase SQL editor,
          then reload this page. The storefront keeps working without it.
        </div>
      )}
      {err && <div className="adm-banner err" role="alert">{err}</div>}

      {editing && (
        <form className="surface pad-lg" onSubmit={save} style={{ marginBottom: 20, maxWidth: 760 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 14 }}>
            {editing === 'new' ? 'New promotion' : `Edit "${editing.title || 'untitled'}"`}
          </h2>

          <div className="adm-grid2">
            <div className="field">
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="poster">Poster (large visual card)</option>
                <option value="offer">Compact offer card</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Visual style</label>
              <select className="select" value={form.theme_variant} onChange={(e) => set('theme_variant', e.target.value)}>
                {THEME_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field"><label className="label">Title</label>
              <input className="input" required value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} aria-describedby="promo-display-notice" /></div>
            <div className="field"><label className="label">Badge text (optional)</label>
              <input className="input" value={form.badge_text} onChange={(e) => set('badge_text', e.target.value)} placeholder="Limited time" maxLength={40} aria-describedby="promo-display-notice" /></div>
          </div>

          <div className="field"><label className="label">Subtitle</label>
            <input className="input" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={320} aria-describedby="promo-display-notice" /></div>

          <div className="adm-banner info" id="promo-display-notice" role="note" style={{ color: 'var(--forest-800)' }}>
            <strong>Display &amp; copy only.</strong>{' '}
            Promotions created here do not automatically change checkout totals. Only publish discount claims that are fulfilled by an approved checkout offer.
          </div>

          <div className="adm-grid2">
            <div className="field"><label className="label">Coupon code (display / copy only — not applied at checkout)</label>
              <input className="input" value={form.coupon_code} onChange={(e) => set('coupon_code', e.target.value.toUpperCase())} placeholder="Approved offer code" maxLength={40} aria-describedby="promo-display-notice" /></div>
            <div className="field"><label className="label">Text alignment</label>
              <select className="select" value={form.text_align} onChange={(e) => set('text_align', e.target.value)}>
                <option value="left">Left</option><option value="center">Center</option>
              </select></div>
          </div>

          <div className="adm-grid2">
            <div className="field"><label className="label">CTA button text (optional)</label>
              <input className="input" value={form.cta_text} onChange={(e) => set('cta_text', e.target.value)} placeholder="Explore SORA LIFE" maxLength={60} /></div>
            <div className="field"><label className="label">CTA link (internal path or https URL)</label>
              <input className="input" value={form.cta_url} onChange={(e) => set('cta_url', e.target.value)} placeholder="/shop" maxLength={500} /></div>
          </div>

          <div className="field">
            <label className="label">Image (optional — poster art or offer icon)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={onImage} disabled={uploading} />
            <input className="input" style={{ marginTop: 8 }} value={form.image_url}
              onChange={(e) => set('image_url', e.target.value)} placeholder="or paste an image URL" />
            {uploading && <p className="hint">Uploading…</p>}
          </div>

          <div className="field">
            <label className="label">Show on</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {PLACEMENT_OPTIONS.map(([v, l]) => (
                <label key={v} className="adm-checkrow" style={{ padding: 0 }}>
                  <input type="checkbox" checked={form.placements.includes(v)} onChange={() => togglePlacement(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="adm-grid3">
            <div className="field"><label className="label">Starts at (optional)</label>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></div>
            <div className="field"><label className="label">Ends at (optional)</label>
              <input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></div>
            <div className="field"><label className="label">Sort order</label>
              <input className="input" type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></div>
          </div>

          <div className="adm-checkrow">
            <input type="checkbox" id="promo-active" checked={form.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="promo-active">Active (visible on the storefront while within its date window)</label>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label className="label">Live preview</label>
            <div className="adm-promo-preview">
              {preview.type === 'poster'
                ? <PromoPoster promo={preview} />
                : <PromoOfferCard promo={preview} />}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-sm" type="submit" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save promotion'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {!loading && !notMigrated && list.length === 0 && !editing && (
        <div className="adm-empty">No promotions yet. Create one to show posters and offer cards on the storefront.</div>
      )}

      <div className="adm-slide-list">
        {list.map((p) => (
          <div key={p.id} className="adm-slide-card">
            <div className="adm-slide-thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-400)' }}>
              {p.image_url ? <img src={p.image_url} alt="" /> : <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.type}</span>}
            </div>
            <div>
              <strong>{p.title || 'Untitled'}</strong>{' '}
              {!p.is_active && <span className="badge badge-out">Hidden</span>}
              <div className="hint">
                {p.type} · {p.theme_variant}
                {p.coupon_code ? ` · code ${p.coupon_code}` : ''}
                {p.cta_url ? ` · → ${p.cta_url}` : ''}
              </div>
              <div className="adm-promo-chips" style={{ marginTop: 6 }}>
                {(p.placements || []).length
                  ? p.placements.map((pl) => <span key={pl} className="adm-promo-chip">{pl}</span>)
                  : <span className="hint">no placement</span>}
                {p.ends_at && <span className="adm-promo-chip" style={{ background: 'var(--honey-100)', color: 'var(--honey-700)' }}>ends {new Date(p.ends_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="adm-actions">
              <button className="btn btn-sm btn-light" onClick={() => move(p, -1)} aria-label="Move up">↑</button>
              <button className="btn btn-sm btn-light" onClick={() => move(p, 1)} aria-label="Move down">↓</button>
              <button className="btn btn-sm btn-light" onClick={() => toggleActive(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
              <button className="btn btn-sm btn-light" onClick={() => startEdit(p)}>Edit</button>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-sale)' }} onClick={() => remove(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
