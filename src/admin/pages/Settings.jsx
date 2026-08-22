import { useEffect, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { supabase } from '../../lib/supabase.js';

export default function Settings() {
  const { session, signOut } = useAdminAuth();
  const [contact, setContact] = useState({ phone: '', email: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    adminGetSetting('contact').then((v) => { if (v) setContact(v); }).catch((e) => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    try { await adminSetSetting('contact', contact); setMsg('Saved.'); } catch (ex) { setErr(ex.message || String(ex)); }
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
          <h2>Store contact information</h2>
          <div className="field"><label className="label">Phone</label><input className="input" value={contact.phone || ''} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /></div>
          <div className="field"><label className="label">Email</label><input className="input" value={contact.email || ''} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /></div>
          <div className="field"><label className="label">Address</label><textarea className="textarea" value={contact.address || ''} onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))} /></div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </form>
      )}
    </div>
  );
}
