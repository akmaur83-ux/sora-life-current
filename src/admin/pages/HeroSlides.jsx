import { useEffect, useState } from 'react';
import { adminListHeroSlides, adminUpsertHeroSlide, adminDeleteHeroSlide, adminReorderHeroSlides, adminSeedDefaultHeroSlides, uploadImage, uploadHeroVideo } from '../../lib/adminApi.js';

const empty = { kind: 'image', image_url: '', video_url: '', poster_url: '', kicker: '', title: '', subtitle: '', lede: '', cta_label: 'SHOP NOW', cta_link: '/shop', is_active: true };

export default function HeroSlides() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [videoUpload, setVideoUpload] = useState(null); // { name, status: 'uploading'|'done'|'error', url? }

  async function load() {
    setLoading(true);
    try { setList(await adminListHeroSlides()); } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function seedDefaults() {
    setSaving(true);
    try { await adminSeedDefaultHeroSlides(); await load(); } catch (e) { setErr(e.message || String(e)); }
    setSaving(false);
  }

  function startEdit(slide) { setForm(slide ? { ...slide } : empty); setEditing(slide || 'new'); setVideoUpload(null); setErr(''); }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try { await adminUpsertHeroSlide(form); setEditing(null); await load(); } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  async function remove(slide) {
    if (!window.confirm(`Delete the "${slide.title}" slide?`)) return;
    try { await adminDeleteHeroSlide(slide.id); await load(); } catch (ex) { setErr(ex.message || String(ex)); }
  }

  async function move(slide, dir) {
    const idx = list.findIndex((x) => x.id === slide.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const next = [...list];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setList(next);
    try { await adminReorderHeroSlides(next.map((x) => x.id)); } catch (ex) { setErr(ex.message || String(ex)); }
  }

  async function onFile(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(file, 'hero'); setForm((f) => ({ ...f, [field]: url })); }
    catch (ex) { setErr('Upload failed: ' + (ex.message || String(ex))); }
    setUploading(false);
  }

  async function onVideoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setVideoUpload({ name: file.name, status: 'uploading' });
    setUploading(true);
    try {
      const url = await uploadHeroVideo(file);
      setForm((f) => ({ ...f, video_url: url }));
      setVideoUpload({ name: file.name, status: 'done', url });
    } catch (ex) {
      setVideoUpload({ name: file.name, status: 'error' });
      setErr('Video upload failed: ' + (ex.message || String(ex)));
    }
    setUploading(false);
  }

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Hero Slides</h1>
          <p>{loading ? 'Loading…' : `${list.length} slides`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {list.length === 0 && !loading && <button className="btn btn-outline btn-sm" onClick={seedDefaults} disabled={saving}>Seed current 2 slides</button>}
          <button className="btn btn-sm" onClick={() => startEdit(null)}>+ Add slide</button>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}

      {editing && (
        <form className="surface pad-lg" onSubmit={save} style={{ marginBottom: 20, maxWidth: 680 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 14 }}>{editing === 'new' ? 'New slide' : `Edit "${editing.title}"`}</h2>
          <div className="field">
            <label className="label">Type</label>
            <select className="select" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          {form.kind === 'image' ? (
            <div className="field">
              <label className="label">Slide image</label>
              <input type="file" accept="image/*" onChange={(e) => onFile(e, 'image_url')} disabled={uploading} />
              <input className="input" style={{ marginTop: 8 }} value={form.image_url || ''} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="or paste an image URL" />
            </div>
          ) : (
            <>
              <div className="field">
                <label className="label">Upload video</label>
                <input type="file" accept="video/*" onChange={onVideoFile} disabled={uploading} />
                {videoUpload && (
                  <div className={`adm-banner ${videoUpload.status === 'error' ? 'err' : videoUpload.status === 'done' ? 'ok' : 'info'}`} style={{ marginTop: 10, marginBottom: 0 }}>
                    {videoUpload.status === 'uploading' && <>Uploading <strong>{videoUpload.name}</strong>…</>}
                    {videoUpload.status === 'done' && <>Uploaded <strong>{videoUpload.name}</strong> — public URL saved below.</>}
                    {videoUpload.status === 'error' && <>Failed to upload <strong>{videoUpload.name}</strong>. See error above.</>}
                  </div>
                )}
                <input className="input" style={{ marginTop: 8 }} value={form.video_url || ''} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} placeholder="or paste a video URL" />
                {form.video_url && (
                  <video src={form.video_url} muted controls style={{ marginTop: 10, width: '100%', maxWidth: 320, borderRadius: 8, background: '#000' }} />
                )}
              </div>
              <div className="field">
                <label className="label">Poster image (shown while the video loads, or if it fails)</label>
                <input type="file" accept="image/*" onChange={(e) => onFile(e, 'poster_url')} disabled={uploading} />
                <input className="input" style={{ marginTop: 8 }} value={form.poster_url || ''} onChange={(e) => setForm((f) => ({ ...f, poster_url: e.target.value }))} placeholder="or paste a poster image URL" />
              </div>
            </>
          )}
          <div className="adm-grid2">
            <div className="field"><label className="label">Eyebrow / kicker</label><input className="input" value={form.kicker} onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))} /></div>
            <div className="field"><label className="label">Title</label><input className="input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          </div>
          <div className="field"><label className="label">Subtitle</label><input className="input" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} /></div>
          <div className="field"><label className="label">Supporting line (lede)</label><input className="input" value={form.lede} onChange={(e) => setForm((f) => ({ ...f, lede: e.target.value }))} /></div>
          <div className="adm-grid2">
            <div className="field"><label className="label">CTA button text</label><input className="input" value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} /></div>
            <div className="field"><label className="label">CTA link</label><input className="input" value={form.cta_link} onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))} placeholder="/category/wellness" /></div>
          </div>
          <div className="adm-checkrow"><input type="checkbox" id="slide-active" checked={form.is_active !== false} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /><label htmlFor="slide-active">Active (shown in carousel)</label></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-sm" type="submit" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save slide'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {!loading && list.length === 0 && !editing && <div className="adm-empty">No hero slides yet. Seed the current 2, or add a new one.</div>}

      <div className="adm-slide-list">
        {list.map((s) => (
          <div key={s.id} className="adm-slide-card">
            <div className="adm-slide-thumb">
              {s.kind === 'video'
                ? <video src={s.video_url} muted />
                : s.image_url && <img src={s.image_url} alt="" />}
            </div>
            <div>
              <strong>{s.title}</strong> {!s.is_active && <span className="badge badge-out">Hidden</span>}
              <div className="hint">{s.kicker} · {s.cta_label} → {s.cta_link}</div>
            </div>
            <div className="adm-actions">
              <button className="btn btn-sm btn-light" onClick={() => move(s, -1)}>↑</button>
              <button className="btn btn-sm btn-light" onClick={() => move(s, 1)}>↓</button>
              <button className="btn btn-sm btn-light" onClick={() => startEdit(s)}>Edit</button>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-sale)' }} onClick={() => remove(s)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
