import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adminGetCreator, adminUpdateCreator, adminSetCreatorStatus, adminChangeCreatorCode,
  adminListCodeAliases, adminListCampaigns, adminCreateCampaign, adminUpdateCampaign,
  adminListLinks, adminCreateLink, adminSetLinkStatus, adminListAudit,
  adminListAttributionEvents, buildTrackingUrl, normalizeDestination,
  CREATOR_STATUSES, CAMPAIGN_STATUSES, DESTINATION_TYPES,
} from '../../lib/creatorApi.js';
import CopyButton from '../../components/CopyButton.jsx';

// ============================================================
// ADMIN — Creator Program › creator detail
//
// Profile, campaigns, tracking-link generator, internal notes and the audit
// trail for one creator. Earnings are deliberately absent: no commission
// exists in Part 1, so nothing here invents one.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const toInputDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const STATUS_BADGE = {
  active: 'badge-best', pending: 'badge-soft', paused: 'badge-soft',
  suspended: 'badge-sale', archived: 'badge-out', draft: 'badge-soft', ended: 'badge-out',
};

const blankCampaign = {
  name: '', campaign_code: '', description: '', status: 'draft',
  start_at: '', end_at: '', commission_rate_override: '', attribution_window_days: '',
};

const blankLink = { campaign_id: '', label: '', destination_type: 'homepage', destination_path: '/' };

export default function CreatorDetail() {
  const { id } = useParams();
  const [creator, setCreator] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [links, setLinks] = useState([]);
  const [audit, setAudit] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({});
  const [newCode, setNewCode] = useState('');
  const [campaignForm, setCampaignForm] = useState(null); // null | blank | row
  const [linkForm, setLinkForm] = useState(null);

  const load = useCallback(async () => {
    try {
      const c = await adminGetCreator(id);
      if (!c) { setErr('Creator not found.'); setLoading(false); return; }
      setCreator(c);
      const [al, cs, ls, au, ev] = await Promise.all([
        adminListCodeAliases(id), adminListCampaigns(id), adminListLinks(id),
        adminListAudit({ entityId: id, limit: 20 }), adminListAttributionEvents(id, 10),
      ]);
      setAliases(al); setCampaigns(cs); setLinks(ls); setAudit(au); setEvents(ev);
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2500); }
  async function run(fn, okMsg) {
    setBusy(true); setErr('');
    try { await fn(); await load(); if (okMsg) flash(okMsg); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="muted">Loading creator…</p>;
  if (!creator) return <div className="adm-banner err">{err || 'Creator not found.'}</div>;

  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  return (
    <div>
      <div className="adm__head">
        <div>
          <Link to="/admin/creators" className="adm-back">← Creators</Link>
          <h1>{creator.display_name}</h1>
          <p>
            <span className="adm-mono">{creator.creator_code}</span> ·{' '}
            <span className={`badge ${STATUS_BADGE[creator.status] || 'badge-soft'}`}>{creator.status}</span> ·{' '}
            {Number(creator.default_commission_rate)}% commission · {creator.default_attribution_window_days}-day window · joined {fmtDate(creator.joined_at)}
          </p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      {/* ---------------- Profile ---------------- */}
      <div className="surface">
        <div className="adm-order-block__head">
          <h2>Profile</h2>
          {!editing && (
            <button className="btn btn-sm btn-light" onClick={() => { setProfile({ ...creator }); setEditing(true); }}>Edit</button>
          )}
        </div>

        {!editing ? (
          <>
            <dl className="adm-kv">
              <div><dt>Display name</dt><dd>{creator.display_name}</dd></div>
              <div><dt>Legal name</dt><dd>{creator.legal_name || '—'}</dd></div>
              <div><dt>Email</dt><dd>{creator.email}</dd></div>
              <div><dt>Phone</dt><dd>{creator.phone || '—'}</dd></div>
              <div><dt>Portal account</dt><dd>{creator.user_id ? 'Linked' : 'Not yet claimed'}</dd></div>
              <div><dt>Payout eligible</dt><dd>{creator.payout_eligible ? 'Yes' : 'No'}</dd></div>
              <div><dt>Last updated</dt><dd>{fmtDateTime(creator.updated_at)}</dd></div>
            </dl>

            <div className="adm-rowacts" style={{ marginTop: 12 }}>
              {CREATOR_STATUSES.filter((s) => s !== creator.status).map((s) => (
                <button key={s} className="btn btn-sm btn-light" disabled={busy}
                  onClick={() => run(() => adminSetCreatorStatus(creator.id, s), `Status → ${s}`)}>
                  {s === 'active' ? 'Activate' : s === 'suspended' ? 'Suspend' : s === 'archived' ? 'Archive' : `Set ${s}`}
                </button>
              ))}
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <label className="label">Public creator code</label>
              <div className="adm-inline">
                <input className="input" placeholder={creator.creator_code} value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
                <button className="btn btn-sm" disabled={busy || !newCode.trim()}
                  onClick={() => run(async () => { await adminChangeCreatorCode(creator.id, newCode); setNewCode(''); }, 'Creator code changed')}>
                  Change code
                </button>
              </div>
              <p className="hint">
                Changing the code keeps the old one as an alias, so links already shared keep working.
                {aliases.length > 0 && <> Retired: {aliases.map((a) => a.code).join(', ')}</>}
              </p>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); run(() => adminUpdateCreator(creator.id, profile), 'Profile saved').then(() => setEditing(false)); }}>
            <div className="adm-grid2">
              <div className="field"><label className="label">Display name</label>
                <input className="input" required value={profile.display_name || ''} onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))} /></div>
              <div className="field"><label className="label">Legal name</label>
                <input className="input" value={profile.legal_name || ''} onChange={(e) => setProfile((p) => ({ ...p, legal_name: e.target.value }))} /></div>
            </div>
            <div className="adm-grid2">
              <div className="field"><label className="label">Email</label>
                <input className="input" type="email" required value={profile.email || ''} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} /></div>
              <div className="field"><label className="label">Phone</label>
                <input className="input" value={profile.phone || ''} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="adm-grid2">
              <div className="field"><label className="label">Commission rate (%)</label>
                <input className="input" type="number" min="0" max="100" step="0.5" value={profile.default_commission_rate ?? 0}
                  onChange={(e) => setProfile((p) => ({ ...p, default_commission_rate: e.target.value }))} /></div>
              <div className="field"><label className="label">Attribution window (days)</label>
                <input className="input" type="number" min="1" max="365" value={profile.default_attribution_window_days ?? 30}
                  onChange={(e) => setProfile((p) => ({ ...p, default_attribution_window_days: e.target.value }))} /></div>
            </div>
            <div className="adm-checkrow">
              <input type="checkbox" id="pe" checked={!!profile.payout_eligible} onChange={(e) => setProfile((p) => ({ ...p, payout_eligible: e.target.checked }))} />
              <label htmlFor="pe">Payout eligible (recorded for Part 3 — no payouts exist yet)</label>
            </div>
            <div className="field">
              <label className="label">Internal notes</label>
              <textarea className="input" rows={3} value={profile.notes || ''} onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))} />
              <p className="hint">Visible to admins only — never shown in the creator portal.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>Save</button>
              <button className="btn btn-outline" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ---------------- Campaigns ---------------- */}
      <div className="surface">
        <div className="adm-order-block__head">
          <h2>Campaigns</h2>
          {!campaignForm && <button className="btn btn-sm" onClick={() => setCampaignForm({ ...blankCampaign })}>New campaign</button>}
        </div>

        {campaignForm && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const payload = { ...campaignForm, start_at: campaignForm.start_at || null, end_at: campaignForm.end_at || null };
            run(() => (campaignForm.id ? adminUpdateCampaign(campaignForm.id, payload) : adminCreateCampaign(creator.id, payload)),
              campaignForm.id ? 'Campaign updated' : 'Campaign created').then(() => setCampaignForm(null));
          }} style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 10 }}>
            <div className="adm-grid2">
              <div className="field"><label className="label">Name</label>
                <input className="input" required placeholder="YouTube Review" value={campaignForm.name}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="field"><label className="label">Campaign code</label>
                <input className="input" placeholder="YT-SEABUCKTHORN (auto if blank)" value={campaignForm.campaign_code}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, campaign_code: e.target.value.toUpperCase() }))}
                  disabled={!!campaignForm.id} /></div>
            </div>
            <div className="field"><label className="label">Description</label>
              <input className="input" value={campaignForm.description || ''}
                onChange={(e) => setCampaignForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="adm-grid2">
              <div className="field"><label className="label">Status</label>
                <select className="select" value={campaignForm.status} onChange={(e) => setCampaignForm((f) => ({ ...f, status: e.target.value }))}>
                  {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="hint">An ended campaign stops attributing until an admin sets it active again.</p>
              </div>
              <div className="field"><label className="label">Attribution window override (days)</label>
                <input className="input" type="number" min="1" max="365" placeholder={`default ${creator.default_attribution_window_days}`}
                  value={campaignForm.attribution_window_days ?? ''}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, attribution_window_days: e.target.value }))} /></div>
            </div>
            <div className="adm-grid2">
              <div className="field"><label className="label">Starts</label>
                <input className="input" type="date" value={toInputDate(campaignForm.start_at)}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, start_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))} /></div>
              <div className="field"><label className="label">Ends</label>
                <input className="input" type="date" value={toInputDate(campaignForm.end_at)}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, end_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))} /></div>
            </div>
            <div className="field"><label className="label">Commission override (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" placeholder={`default ${creator.default_commission_rate}`}
                value={campaignForm.commission_rate_override ?? ''}
                onChange={(e) => setCampaignForm((f) => ({ ...f, commission_rate_override: e.target.value }))} />
              <p className="hint">Stored for the Part 2 commission engine. Nothing is calculated now.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy}>{campaignForm.id ? 'Save campaign' : 'Create campaign'}</button>
              <button className="btn btn-outline" type="button" onClick={() => setCampaignForm(null)}>Cancel</button>
            </div>
          </form>
        )}

        {campaigns.length === 0 ? (
          <div className="adm-empty">No campaigns yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Campaign</th><th>Code</th><th>Period</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong>{c.description && <span className="hint" style={{ display: 'block' }}>{c.description}</span>}</td>
                    <td className="adm-mono">{c.campaign_code}</td>
                    <td>{fmtDate(c.start_at)} → {c.end_at ? fmtDate(c.end_at) : 'open'}</td>
                    <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-soft'}`}>{c.status}</span></td>
                    <td>
                      <div className="adm-rowacts">
                        <button className="btn btn-sm btn-light" onClick={() => setCampaignForm({ ...c })} disabled={busy}>Edit</button>
                        {c.status !== 'active' && <button className="btn btn-sm btn-light" disabled={busy}
                          onClick={() => run(() => adminUpdateCampaign(c.id, { status: 'active' }), 'Campaign active')}>Activate</button>}
                        {c.status === 'active' && <button className="btn btn-sm btn-light" disabled={busy}
                          onClick={() => run(() => adminUpdateCampaign(c.id, { status: 'paused' }), 'Campaign paused')}>Pause</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Tracking links ---------------- */}
      <div className="surface">
        <div className="adm-order-block__head">
          <h2>Tracking links</h2>
          {!linkForm && <button className="btn btn-sm" onClick={() => setLinkForm({ ...blankLink })}>Create tracking link</button>}
        </div>

        {linkForm && (() => {
          const previewCampaign = campaignById[linkForm.campaign_id];
          const previewUrl = buildTrackingUrl(
            { destination_path: normalizeDestination(linkForm.destination_path, linkForm.destination_type), public_code: 'TRK-XXXXXX' },
            creator, previewCampaign,
          );
          return (
            <form onSubmit={(e) => {
              e.preventDefault();
              run(() => adminCreateLink(creator.id, linkForm), 'Tracking link created').then(() => setLinkForm(null));
            }} style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 10 }}>
              <div className="adm-grid2">
                <div className="field"><label className="label">Campaign</label>
                  <select className="select" value={linkForm.campaign_id}
                    onChange={(e) => setLinkForm((f) => ({ ...f, campaign_id: e.target.value }))}>
                    <option value="">— none (creator-level link) —</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.campaign_code})</option>)}
                  </select></div>
                <div className="field"><label className="label">Label (internal)</label>
                  <input className="input" placeholder="Instagram bio" value={linkForm.label}
                    onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))} /></div>
              </div>
              <div className="adm-grid2">
                <div className="field"><label className="label">Destination type</label>
                  <select className="select" value={linkForm.destination_type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setLinkForm((f) => ({ ...f, destination_type: t, destination_path: t === 'homepage' ? '/' : f.destination_path }));
                    }}>
                    {DESTINATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div className="field"><label className="label">Destination path</label>
                  <input className="input" value={linkForm.destination_path} disabled={linkForm.destination_type === 'homepage'}
                    placeholder="/product/biosash-sea-buckthorn-juice"
                    onChange={(e) => setLinkForm((f) => ({ ...f, destination_path: e.target.value }))} />
                  <p className="hint">Internal SORA LIFE paths only — external URLs are rejected.</p></div>
              </div>

              <div className="field">
                <label className="label">Preview</label>
                <code className="adm-preview-url">{previewUrl}</code>
                <p className="hint">The real link gets its own unique TRK code on creation.</p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" type="submit" disabled={busy}>Create link</button>
                <button className="btn btn-outline" type="button" onClick={() => setLinkForm(null)}>Cancel</button>
              </div>
            </form>
          );
        })()}

        {links.length === 0 ? (
          <div className="adm-empty">No tracking links yet.</div>
        ) : (
          <div className="adm-linklist">
            {links.map((l) => {
              const url = buildTrackingUrl(l, creator, campaignById[l.campaign_id]);
              return (
                <div key={l.id} className={`adm-linkrow ${l.status !== 'active' ? 'is-muted' : ''}`}>
                  <div className="adm-linkrow__main">
                    <div className="adm-linkrow__head">
                      <span className="adm-mono">{l.public_code}</span>
                      <span className={`badge ${l.status === 'active' ? 'badge-best' : 'badge-out'}`}>{l.status}</span>
                      {campaignById[l.campaign_id] && <span className="adm-chip">{campaignById[l.campaign_id].name}</span>}
                      {l.label && <span className="hint">{l.label}</span>}
                    </div>
                    <code className="adm-preview-url">{url}</code>
                  </div>
                  <div className="adm-rowacts">
                    <CopyButton value={url} className="btn btn-sm" />
                    {l.status === 'active'
                      ? <button className="btn btn-sm btn-light" disabled={busy} onClick={() => run(() => adminSetLinkStatus(l.id, 'paused'), 'Link deactivated')}>Deactivate</button>
                      : <button className="btn btn-sm btn-light" disabled={busy} onClick={() => run(() => adminSetLinkStatus(l.id, 'active'), 'Link activated')}>Activate</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- Activity (foundation only) ---------------- */}
      <div className="surface">
        <h2>Recent link activity</h2>
        <p className="hint" style={{ marginTop: -4 }}>
          Attribution foundation only — visits recorded under this creator’s links. No sale is attributed and no commission exists in this phase.
        </p>
        {events.length === 0 ? (
          <div className="adm-empty">No attribution events recorded yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Event</th><th>Matched code</th><th>Landing</th><th>When</th><th>Window ends</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.event_type}</td>
                    <td className="adm-mono">{e.matched_code || '—'}</td>
                    <td className="adm-mono">{e.landing_path || '—'}</td>
                    <td>{fmtDateTime(e.occurred_at)}</td>
                    <td>{fmtDate(e.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Audit ---------------- */}
      <div className="surface">
        <h2>Audit trail</h2>
        {audit.length === 0 ? (
          <div className="adm-empty">No recorded changes yet.</div>
        ) : (
          <ol className="adm-timeline">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="adm-timeline__label">{a.action.replace(/_/g, ' ')}</span>
                <span className="adm-timeline__at">
                  {fmtDateTime(a.created_at)}
                  {a.metadata?.from && a.metadata?.to && <> · {a.metadata.from} → {a.metadata.to}</>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
