import { useEffect, useState } from 'react';
import { adminListCategories, adminUpsertCategory, adminDeleteCategory, adminSeedDefaultCategories } from '../../lib/adminApi.js';

const TONES = ['forest', 'lime', 'amber', 'clay', 'moss', 'plum', 'rose', 'honey', 'teal', 'sky'];
const empty = { slug: '', name: '', tagline: '', blurb: '', tone: 'forest', image_url: '', is_active: true, sort_order: 0 };

export default function Categories() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // category object or 'new'
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setList(await adminListCategories()); } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function seedDefaults() {
    setSaving(true);
    try { await adminSeedDefaultCategories(); await load(); } catch (e) { setErr(e.message || String(e)); }
    setSaving(false);
  }

  function startEdit(cat) { setForm(cat ? { ...cat } : empty); setEditing(cat || 'new'); }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try { await adminUpsertCategory(form); setEditing(null); await load(); } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  async function remove(cat) {
    if (!window.confirm(`Delete category "${cat.name}"? Products keep their category text but this entry disappears from admin/homepage lists.`)) return;
    try { await adminDeleteCategory(cat.id); await load(); } catch (ex) { setErr(ex.message || String(ex)); }
  }

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Categories</h1>
          <p>{loading ? 'Loading…' : `${list.length} categories`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {list.length === 0 && !loading && <button className="btn btn-outline btn-sm" onClick={seedDefaults} disabled={saving}>Seed the 8 default categories</button>}
          <button className="btn btn-sm" onClick={() => startEdit(null)}>+ Add category</button>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}

      {editing && (
        <form className="surface pad-lg" onSubmit={save} style={{ marginBottom: 20, maxWidth: 640 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 14 }}>{editing === 'new' ? 'New category' : `Edit "${editing.name}"`}</h2>
          <div className="adm-grid2">
            <div className="field"><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="field"><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto from name" /></div>
          </div>
          <div className="field"><label className="label">Tagline</label><input className="input" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} /></div>
          <div className="field"><label className="label">Description / blurb</label><textarea className="textarea" value={form.blurb} onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))} /></div>
          <div className="adm-grid2">
            <div className="field">
              <label className="label">Tone</label>
              <select className="select" value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}>
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">Image URL (optional)</label><input className="input" value={form.image_url || ''} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} /></div>
          </div>
          <div className="adm-checkrow"><input type="checkbox" id="cat-active" checked={form.is_active !== false} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /><label htmlFor="cat-active">Active</label></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {!loading && list.length === 0 && !editing && (
        <div className="adm-empty">No categories yet. Seed the defaults above, or add one manually.</div>
      )}

      {list.length > 0 && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Tagline</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.slug}</td>
                  <td>{c.tagline}</td>
                  <td>{c.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="adm-actions">
                      <button className="btn btn-sm btn-light" onClick={() => startEdit(c)}>Edit</button>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-sale)' }} onClick={() => remove(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
