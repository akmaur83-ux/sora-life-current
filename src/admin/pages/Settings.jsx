import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { supabase } from '../../lib/supabase.js';
import { POLICY_KEYS, SOCIAL_NETWORKS, validateCompanyForSave } from '../../lib/company.js';

const POLICY_LABELS = {
  privacy: 'Privacy policy',
  terms: 'Terms & conditions',
  shipping: 'Shipping policy',
  returns: 'Returns, refunds & cancellation',
};

export default function Settings() {
  const { session, signOut } = useAdminAuth();
  const [contact, setContact] = useState({
    legalName: '', phone: '', email: '', address: '', hours: '', social: {}, policies: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    adminGetSetting('contact').then((v) => {
      if (v) setContact((current) => ({ ...current, ...v, social: v.social || {}, policies: v.policies || {} }));
    }).catch((e) => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    try {
      const clean = validateCompanyForSave(contact);
      const next = { ...contact, ...clean, social: clean.social, policies: clean.policies };
      await adminSetSetting('contact', next);
      setContact(next);
      setMsg('Business information saved.');
    } catch (ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setPwMsg('Password must be at least 8 characters.'); return; }
    setPwSaving(true); setPwMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    setPwMsg(error ? error.message : 'Password updated.');
    if (!error) setNewPassword('');
  }

  return (
    <div className="adm-form">
      <div className="adm__head"><div><h1>Settings</h1><p>Account, session and contact information.</p></div></div>

      <div className="surface">
        <h2>Signed in as</h2>
        <p className="muted">{session?.user?.email}</p>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={signOut}>Log out</button>
      </div>

      <div className="surface">
        <h2>Change password</h2>
        <form onSubmit={changePassword} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button className="btn btn-sm" type="submit" disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update password'}</button>
        </form>
        {pwMsg && <p className="hint" style={{ marginTop: 8 }}>{pwMsg}</p>}
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      {!loading && (
        <form onSubmit={save} className="surface">
          <h2>Business &amp; support information</h2>
          <p className="muted" style={{ marginBottom: 20 }}>Only completed, valid fields appear publicly. Leave unknown details blank.</p>
          <div className="adm-formgrid">
            <div className="field"><label className="label">Business / legal name</label><input className="input" maxLength={120} value={contact.legalName || ''} onChange={(e) => setContact((c) => ({ ...c, legalName: e.target.value }))} /></div>
            <div className="field"><label className="label">Support email</label><input className="input" type="email" maxLength={200} value={contact.email || ''} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /></div>
            <div className="field"><label className="label">Support phone</label><input className="input" type="tel" maxLength={40} value={contact.phone || ''} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /></div>
            <div className="field"><label className="label">Support hours</label><input className="input" maxLength={160} placeholder="Publish only confirmed hours" value={contact.hours || ''} onChange={(e) => setContact((c) => ({ ...c, hours: e.target.value }))} /></div>
          </div>
          <div className="field"><label className="label">Registered / business address</label><textarea className="textarea" maxLength={400} rows={3} value={contact.address || ''} onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))} /></div>

          <div className="adm-settings-group">
            <h3>Official social profiles</h3>
            <p className="muted">Optional public HTTPS links. Empty networks stay hidden.</p>
            <div className="adm-formgrid">
              {SOCIAL_NETWORKS.map((network) => (
                <div className="field" key={network.key}>
                  <label className="label">{network.label}</label>
                  <input className="input" type="url" inputMode="url" placeholder="https://" value={contact.social?.[network.key] || ''}
                    onChange={(e) => setContact((c) => ({ ...c, social: { ...(c.social || {}), [network.key]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="adm-settings-group">
            <h3>Owner-approved policy text</h3>
            <p className="muted">Plain text only. Leave a policy blank until its business terms have been approved.</p>
            {POLICY_KEYS.map((key) => (
              <div className="field" key={key}>
                <label className="label">{POLICY_LABELS[key]}</label>
                <textarea className="textarea" rows={7} maxLength={20000} value={contact.policies?.[key] || ''}
                  onChange={(e) => setContact((c) => ({ ...c, policies: { ...(c.policies || {}), [key]: e.target.value } }))} />
              </div>
            ))}
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save business information'}</button>
        </form>
      )}
    </div>
  );
}
