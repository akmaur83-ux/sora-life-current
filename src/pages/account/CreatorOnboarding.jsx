import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import CopyButton from '../../components/CopyButton.jsx';
import { useCustomerAuth } from '../../lib/customerAuth.jsx';
import { getMyCreator, applyAsCreator, buildTrackingUrl } from '../../lib/creatorApi.js';

// ============================================================
// Account → "Become a SORA LIFE Creator"
//
// One tab, four states driven by the signed-in customer's own creator record
// (RLS-scoped to auth.uid()):
//   * none     -> the application form
//   * pending  -> "under review"
//   * paused/suspended/archived -> status notice
//   * active   -> a short dashboard + their default tracking link
//
// The form collects only display name, an optional link, an optional platform
// and consent. It never sends creatorId/userId/commissionRate/status — the
// apply_as_creator RPC derives all of those from the verified JWT.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');

export default function CreatorOnboarding() {
  const { user } = useCustomerAuth();
  const [state, setState] = useState('loading'); // loading | none | has
  const [creator, setCreator] = useState(null);
  const [form, setForm] = useState({ displayName: '', socialUrl: '', platform: '', agreed: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const me = await getMyCreator();
    if (me) { setCreator(me); setState('has'); }
    else { setState('none'); }
  }
  useEffect(() => {
    // Prefill the display name from the customer profile as a convenience.
    const full = user?.user_metadata?.full_name?.trim();
    if (full) setForm((f) => ({ ...f, displayName: f.displayName || full }));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.displayName.trim()) { setErr('Please enter the name you want to appear as.'); return; }
    if (!form.agreed) { setErr('Please agree to the creator terms to continue.'); return; }
    setBusy(true);
    try {
      const res = await applyAsCreator(form);
      if (!res.ok) {
        const map = {
          already_creator: 'You already have a creator account.',
          terms_not_accepted: 'Please agree to the creator terms to continue.',
          display_name_required: 'Please enter a display name.',
          not_authenticated: 'Please sign in again and retry.',
        };
        setErr(map[res.reason] || 'We could not submit your application. Please try again.');
      } else {
        await load();
      }
    } catch (e2) {
      setErr(e2.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return <div className="acct__panelhead"><h2>Creator Program</h2><p className="muted">Loading…</p></div>;
  }

  // ---- Already a creator: status-aware view ----
  if (state === 'has' && creator) {
    const s = creator.status;
    const defaultLink = buildTrackingUrl({ destination_path: '/' }, creator, null);

    return (
      <div className="crob">
        <div className="acct__panelhead">
          <h2>{s === 'active' ? 'Turn your SORA LIFE recommendations into rewards.' : 'SORA LIFE Creator'}</h2>
          <p className="muted">
            {s === 'active'
              ? 'Your creator account is active. Share your link and track the orders you help generate.'
              : 'Your creator account status and quick links.'}
          </p>
        </div>

        {s === 'pending' && (
          <div className="crob__status is-pending">
            <Icon name="clock" size={20} />
            <div>
              <strong>Application under review</strong>
              <p>Thanks for applying, {creator.display_name}. Our team is reviewing your application — you’ll be able to access your creator dashboard as soon as it’s approved.</p>
            </div>
          </div>
        )}

        {(s === 'paused' || s === 'suspended' || s === 'archived') && (
          <div className="crob__status is-paused">
            <Icon name="circleAlert" size={20} />
            <div>
              <strong>Your creator account is {s}</strong>
              <p>Please contact your SORA LIFE programme manager for details.</p>
            </div>
          </div>
        )}

        {s === 'active' && (
          <>
            <div className="crob__status is-active">
              <Icon name="checkCircle" size={20} />
              <div>
                <strong>You’re an active SORA LIFE creator</strong>
                <p>Share your link below, or open your full dashboard for campaigns and tracking links.</p>
              </div>
            </div>

            <div className="crob__linkcard">
              <span className="crob__linklabel">Your default creator link</span>
              <code className="crob__link">{defaultLink}</code>
              <div className="crob__linkactions">
                <CopyButton value={defaultLink} className="btn btn-sm" label="Copy link" />
                <ShareButton url={defaultLink} title={`Shop SORA LIFE with ${creator.display_name}`} />
              </div>
            </div>

            <Link to="/creator" className="btn btn-block" style={{ marginTop: 'var(--sp-4)' }}>
              <Icon name="externalLink" size={16} /> Open my Creator dashboard
            </Link>
          </>
        )}

        <dl className="crob__meta">
          <div><dt>Status</dt><dd><span className={`crp__pill is-${s === 'active' ? 'ok' : s === 'pending' ? 'warn' : 'bad'}`}>{s}</span></dd></div>
          <div><dt>Creator code</dt><dd><code>{creator.creator_code}</code></dd></div>
          <div><dt>Commission rate</dt><dd>{Number(creator.default_commission_rate)}%</dd></div>
          <div><dt>Joined</dt><dd>{fmtDate(creator.joined_at)}</dd></div>
        </dl>

        <div className="crob__soon">
          <Icon name="clock" size={15} />
          <span><strong>Earnings &amp; payouts</strong> aren’t available yet — they arrive in a later release. Your links are already live and every visit is recorded.</span>
        </div>
        <p className="crob__note">Your commission rate and status are managed by SORA LIFE.</p>
      </div>
    );
  }

  // ---- Not a creator: the application form ----
  return (
    <div className="crob">
      <div className="acct__panelhead">
        <h2>Become a SORA LIFE Creator</h2>
        <p className="muted">Turn your audience into rewards. Share products you love with your own tracking link.</p>
      </div>

      <ul className="crob__perks">
        <li><Icon name="tag" size={16} /> Your own SORA LIFE creator code &amp; link</li>
        <li><Icon name="sparkle" size={16} /> Campaigns tailored to how you promote</li>
        <li><Icon name="shield" size={16} /> Keep your existing account — nothing changes for your orders</li>
      </ul>

      {err && <div className="crob__err">{err}</div>}

      <form className="crob__form" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="crob-name">Display name<span className="crob__req">*</span></label>
          <input id="crob-name" className="input" required maxLength={120}
            placeholder="e.g. Anjali Sharma"
            value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
          <p className="hint">How you’ll appear to shoppers. This isn’t your login.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="crob-social">Social / profile link <span className="crob__opt">(optional)</span></label>
          <input id="crob-social" className="input" type="url" maxLength={300}
            placeholder="https://instagram.com/yourhandle"
            value={form.socialUrl} onChange={(e) => set('socialUrl', e.target.value)} />
        </div>

        <div className="field">
          <label className="label" htmlFor="crob-platform">Where will you promote? <span className="crob__opt">(optional)</span></label>
          <select id="crob-platform" className="select"
            value={form.platform} onChange={(e) => set('platform', e.target.value)}>
            <option value="">Select a platform / category</option>
            {['Instagram', 'YouTube', 'Facebook', 'WhatsApp', 'Blog / Website', 'Offline / In person', 'Other'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <label className="crob__agree">
          <input type="checkbox" checked={form.agreed} onChange={(e) => set('agreed', e.target.checked)} />
          <span>I agree to the SORA LIFE creator terms and understand my account remains a normal customer account.</span>
        </label>

        <p className="crob__note">
          We don’t collect any payout or bank details at this stage. Applications may be reviewed before approval.
        </p>

        <button className="btn btn-block" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}

// Uses the Web Share API where available (mobile), with a copy fallback.
function ShareButton({ url, title }) {
  const [shared, setShared] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  if (!canShare) return null;
  return (
    <button type="button" className="btn btn-sm btn-light" onClick={async () => {
      try { await navigator.share({ title, url }); setShared(true); } catch { /* cancelled */ }
    }}>
      <Icon name="externalLink" size={15} /> {shared ? 'Shared' : 'Share'}
    </button>
  );
}
