import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';

// ============================================================
// Creator Programme terms & conditions.
//
// One markdown document in site_settings.creator_terms, authored here and
// rendered to creators on the Creator Programme page and during onboarding.
//
// Ships EMPTY. Nothing seeds legal copy, and nothing generates it — an unsaved
// or blank document simply means the terms section stays hidden storefront-side
// until someone writes them.
//
// `version` is the thing acceptances point at, so it is bumped DELIBERATELY,
// never as a side effect of saving. Fixing a typo should not invalidate every
// creator's acceptance; a material change should. Only the person writing the
// change knows which it is, so the control is theirs.
// ============================================================
const EMPTY = { body: '', version: 1, updated_at: null };

export default function CreatorTerms() {
  const [form, setForm] = useState(EMPTY);
  const [loadedVersion, setLoadedVersion] = useState(1);
  const [bumpVersion, setBumpVersion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    adminGetSetting('creator_terms')
      .then((v) => {
        if (!v) return;                       // migration not applied yet
        setForm({ ...EMPTY, ...v });
        setLoadedVersion(Number(v.version) || 1);
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    try {
      const version = bumpVersion ? loadedVersion + 1 : loadedVersion;
      const next = {
        body: form.body || '',
        version,
        updated_at: new Date().toISOString(),
      };
      await adminSetSetting('creator_terms', next);
      setForm(next);
      setLoadedVersion(version);
      setBumpVersion(false);
      setMsg(bumpVersion
        ? `Saved as version ${version}. Creators who accepted an earlier version will be asked to accept again.`
        : `Saved. Still version ${version}, so existing acceptances stand.`);
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  const published = (form.body || '').trim().length > 0;

  return (
    <div className="adm-form">
      <div className="adm__head">
        <div>
          <h1>Creator terms</h1>
          <p>The terms creators read and accept. Markdown; shown on the Creator Programme page and at signup.</p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}
      {!published && (
        <div className="adm-banner">
          No terms published yet. While this is empty, creators see no terms section and the
          signup checkbox is not shown.
        </div>
      )}

      <form onSubmit={save}>
        <div className="surface">
          <h2>Terms &amp; conditions</h2>
          <div className="field">
            <label className="label" htmlFor="creator-terms-body">Terms (markdown)</label>
            <textarea
              id="creator-terms-body"
              className="textarea"
              rows={22}
              value={form.body || ''}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder={'## Creator Programme Terms\n\nWrite the terms here.'}
            />
          </div>
        </div>

        <div className="surface">
          <h2>Version</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Current version <strong>{loadedVersion}</strong>
            {form.updated_at
              ? <> · last updated {new Date(form.updated_at).toLocaleString('en-IN')}</>
              : <> · never published</>}
          </p>
          <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={bumpVersion}
              onChange={(e) => setBumpVersion(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>This is a material change — publish as version {loadedVersion + 1}.</strong>
              <br />
              <span className="muted">
                Every creator will be asked to accept the new version. Leave unticked for
                typos and formatting, which keep existing acceptances valid.
              </span>
            </span>
          </label>
        </div>

        <div className="adm-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save terms'}
          </button>
        </div>
      </form>
    </div>
  );
}
