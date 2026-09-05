import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import CopyButton from '../../components/CopyButton.jsx';
import { useCustomerAuth } from '../../lib/customerAuth.jsx';
import {
  getMyCreator, applyAsCreator, buildTrackingUrl,
  getCreatorTerms, termsArePublished, acceptCreatorTerms,
} from '../../lib/creatorApi.js';
import CreatorTermsPanel, { TermsUpdatedLine } from '../../components/creator/CreatorTermsPanel.jsx';

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

  // The published terms, if any. Loaded separately from the creator record so
  // a database without 0026 applied still shows a working application form —
  // just without a terms document to read.
  const [terms, setTerms] = useState(null);
  useEffect(() => {
    let live = true;
    getCreatorTerms().then((t) => { if (live) setTerms(t); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const hasTerms = termsArePublished(terms);

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
        // Record WHICH version was accepted. apply_as_creator already stores an
        // agreed_at, but not the version — and a timestamp alone cannot answer
        // "which terms did they agree to" once the document changes.
        //
        // Deliberately after a successful application and deliberately not
        // fatal: the creator record exists either way, and the portal asks for
        // acceptance again if this did not land. Failing the whole application
        // because a follow-up write failed would be the worse outcome.
        if (hasTerms) {
          try { await acceptCreatorTerms(); } catch { /* portal re-prompts */ }
        }
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

        <div className="ck-band" style={{ marginTop: 'var(--sp-4)' }}>
          <div className="ck-band__cell" data-tone="brand">
            <span className="ck-band__label">Creator code</span>
            <div className="ck-band__fig" style={{ fontSize: 18, fontFamily: 'ui-monospace, Menlo, monospace' }}>{creator.creator_code}</div>
          </div>
          <div className="ck-band__cell" data-tone="brand">
            <span className="ck-band__label">Commission</span>
            <div className="ck-band__fig">{Number(creator.default_commission_rate)}%</div>
          </div>
          <div className="ck-band__cell" data-tone={s === 'active' ? 'ok' : 'hold'}>
            <span className="ck-band__label">Status</span>
            <div className="ck-band__fig" style={{ fontSize: 18 }}>{s}</div>
          </div>
          <div className="ck-band__cell">
            <span className="ck-band__label">Joined</span>
            <div className="ck-band__fig" style={{ fontSize: 18 }}>{fmtDate(creator.joined_at)}</div>
          </div>
        </div>

        <div className="crob__next">
          <Icon name="crown" size={15} />
          <span>
            <strong>Earnings and payouts are live.</strong> Track cleared commission, verify your payout
            details and request a withdrawal from{' '}
            <Link to="/creator/earnings">Earnings</Link> and <Link to="/creator/payouts">Payouts</Link>.
          </span>
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

        {/* The terms themselves, so the checkbox refers to something the
            applicant can actually read rather than to a document they have
            never seen. Hidden entirely until an admin publishes one. */}
        {hasTerms && (
          <div className="crob__terms">
            <h3 className="crob__terms-h">Creator terms</h3>
            <TermsUpdatedLine terms={terms} />
            <div className="crob__terms-body">
              <CreatorTermsPanel terms={terms} />
            </div>
          </div>
        )}

        <label className="crob__agree">
          <input type="checkbox" checked={form.agreed} onChange={(e) => set('agreed', e.target.checked)} />
          <span>
            {hasTerms
              ? `I have read and agree to the SORA LIFE creator terms (version ${terms.version}), and understand my account remains a normal customer account.`
              : 'I agree to the SORA LIFE creator terms and understand my account remains a normal customer account.'}
          </span>
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
