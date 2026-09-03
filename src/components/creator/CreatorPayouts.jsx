import { useState } from 'react';
import Icon from '../Icon.jsx';
import { money2 } from '../../lib/format.js';

// ============================================================
// Creator payouts + KYC (Part 3)
//
// The creator can NEVER move money. This screen only lets them (a) submit KYC
// for an admin to verify, and (b) *request* a payout during the monthly window.
// An admin verifies KYC and pays manually. Raw PAN / bank / UPI are never shown
// or stored — only the server-side masks come back.
//
// The withdrawal control is deliberately not always visible: it appears only on
// the window day, and only once KYC is verified and a minimum balance has cleared.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');

const nextWindowDate = (payoutDay) => {
  const t = new Date();
  const thisMonth = new Date(t.getFullYear(), t.getMonth(), payoutDay);
  return t.getDate() >= payoutDay ? new Date(t.getFullYear(), t.getMonth() + 1, payoutDay) : thisMonth;
};

const PAYOUT_TONE = {
  requested: 'warn', under_review: 'warn', approved: 'ok',
  paid: 'ok', rejected: 'bad', cancelled: 'bad',
};

const KYC_BADGE = {
  not_started: { tone: 'warn', label: 'Not started' },
  pending: { tone: 'warn', label: 'Under review' },
  verified: { tone: 'ok', label: 'Verified' },
  rejected: { tone: 'bad', label: 'Rejected' },
  needs_update: { tone: 'bad', label: 'Needs update' },
};

export default function CreatorPayouts({ creator, earnings, kyc, payouts, onSubmitKyc, onRequestPayout, onChanged }) {
  const status = kyc?.identity_status || 'not_started';
  const kycVerified = status === 'verified';

  return (
    <>
      <h1 className="serif crp__h1">Payouts</h1>
      <p className="crp__lede">
        Verify your details once, then request a payout during the monthly window. SORA LIFE
        reviews and pays every request manually — money is never released automatically.
      </p>

      <KycSection creator={creator} kyc={kyc} status={status} onSubmitKyc={onSubmitKyc} onChanged={onChanged} />

      <PayoutSection
        earnings={earnings}
        payouts={payouts}
        kycVerified={kycVerified}
        onRequestPayout={onRequestPayout}
        onChanged={onChanged}
      />

      <PayoutHistory payouts={payouts} />
    </>
  );
}

// ---------------------------------------------------------------
// KYC — submit / status / resubmit
// ---------------------------------------------------------------
function KycSection({ kyc, status, onSubmitKyc, onChanged }) {
  const badge = KYC_BADGE[status] || KYC_BADGE.not_started;
  const canEdit = status === 'not_started' || status === 'rejected' || status === 'needs_update';
  const [editing, setEditing] = useState(false);
  const showForm = canEdit || editing;

  return (
    <section className="crp__panel crp__kyc">
      <div className="crp__kyc-head">
        <h2 className="crp__panel-h" style={{ margin: 0 }}>Verification &amp; payout details</h2>
        <span className={`crp__pill is-${badge.tone}`}>{badge.label}</span>
      </div>

      {status === 'pending' && (
        <p className="crp__kyc-msg">
          <Icon name="clock" size={14} /> Your details are with our team for review. You’ll be able
          to request a payout once they’re verified. You can’t withdraw before then.
        </p>
      )}
      {status === 'verified' && (
        <p className="crp__kyc-msg is-ok">
          <Icon name="checkCircle" size={14} /> Verified by SORA LIFE. You’re all set to request payouts.
        </p>
      )}
      {status === 'rejected' && (
        <p className="crp__kyc-msg is-bad">
          <Icon name="circleAlert" size={14} /> Your details couldn’t be verified. Please check and resubmit.
        </p>
      )}
      {status === 'needs_update' && (
        <p className="crp__kyc-msg is-bad">
          <Icon name="circleAlert" size={14} /> We need updated details before we can pay you. Please resubmit below.
        </p>
      )}

      {/* Masked summary of what's on file (never raw). */}
      {kyc && (kyc.legal_name || kyc.pan_masked || kyc.payout_account_masked || kyc.upi_masked) && (
        <dl className="crp__kv crp__kv--2 crp__kyc-onfile">
          {kyc.legal_name && <div><dt>Legal name</dt><dd>{kyc.legal_name}</dd></div>}
          {kyc.pan_masked && <div><dt>PAN</dt><dd className="is-mono">{kyc.pan_masked}</dd></div>}
          {kyc.payout_method === 'bank' && <>
            <div><dt>Account holder</dt><dd>{kyc.payout_account_holder || '—'}</dd></div>
            <div><dt>Bank account</dt><dd className="is-mono">{kyc.payout_account_masked || '—'}</dd></div>
            <div><dt>IFSC</dt><dd className="is-mono">{kyc.ifsc_masked || '—'}</dd></div>
          </>}
          {kyc.payout_method === 'upi' && (
            <div><dt>UPI</dt><dd className="is-mono">{kyc.upi_masked || '—'}</dd></div>
          )}
        </dl>
      )}

      {showForm ? (
        <KycForm
          kyc={kyc}
          onSubmitKyc={onSubmitKyc}
          onDone={async () => { setEditing(false); await onChanged(); }}
          onCancel={editing ? () => setEditing(false) : null}
        />
      ) : (
        status === 'verified' && (
          <button className="btn btn-sm btn-light" onClick={() => setEditing(true)} style={{ marginTop: 'var(--sp-4)' }}>
            Update details
          </button>
        )
      )}
      {editing && status === 'verified' && (
        <p className="crp__foot-note">Note: editing your details sends them back for re-verification, which pauses payouts until re-approved.</p>
      )}
    </section>
  );
}

function KycForm({ kyc, onSubmitKyc, onDone, onCancel }) {
  const [legalName, setLegalName] = useState(kyc?.legal_name || '');
  const [pan, setPan] = useState('');
  const [method, setMethod] = useState(kyc?.payout_method || 'bank');
  const [accountHolder, setAccountHolder] = useState(kyc?.payout_account_holder || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!legalName.trim()) return setErr('Enter your legal name.');
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan.trim())) return setErr('Enter a valid 10-character PAN (e.g. ABCDE1234F).');
    if (method === 'bank') {
      if (!accountHolder.trim()) return setErr('Enter the account holder name.');
      if (!/^\d{6,18}$/.test(accountNumber.trim())) return setErr('Enter a valid bank account number.');
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim())) return setErr('Enter a valid IFSC code.');
    } else if (!/^[\w.\-]{2,}@[a-z]{2,}$/i.test(upi.trim())) {
      return setErr('Enter a valid UPI ID (e.g. name@bank).');
    }
    setBusy(true);
    try {
      const res = await onSubmitKyc({
        legalName: legalName.trim(), pan: pan.trim(), method,
        accountHolder: accountHolder.trim(), accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim(), upi: upi.trim(),
      });
      if (!res || res.ok === false) { setErr(friendlyKycError(res?.reason)); setBusy(false); return; }
      // Never keep the raw values around once submitted.
      setPan(''); setAccountNumber(''); setIfsc(''); setUpi('');
      await onDone();
    } catch (e2) {
      setErr('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form className="crp__form" onSubmit={submit} autoComplete="off">
      <p className="crp__form-note">
        <Icon name="lock" size={13} /> These details are encrypted and masked. Even SORA LIFE staff
        only ever see a masked version (e.g. <code>ABCDE****F</code>).
      </p>

      <fieldset className="ck-fieldset ck-tone-brand">
        <legend className="ck-fieldset__legend" data-step="01">Identity</legend>
        <p className="ck-fieldset__hint">Must match your PAN exactly — a mismatch is the most common reason verification is sent back.</p>

        <label className="crp__field">
          <span>Legal name (as on PAN)</span>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Full legal name" />
        </label>

        <label className="crp__field">
          <span>PAN</span>
          <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" className="is-mono" />
        </label>
      </fieldset>

      <fieldset className="ck-fieldset ck-tone-info">
        <legend className="ck-fieldset__legend" data-step="02">Payout method</legend>
        <p className="ck-fieldset__hint">Where we send your payout. You can change this later by resubmitting your details.</p>

        <div className="crp__field">
          <span>Payout method</span>
          <div className="crp__seg">
            <button type="button" className={method === 'bank' ? 'active' : ''} onClick={() => setMethod('bank')}>Bank transfer</button>
            <button type="button" className={method === 'upi' ? 'active' : ''} onClick={() => setMethod('upi')}>UPI</button>
          </div>
        </div>

        {method === 'bank' ? (
          <>
            <label className="crp__field">
              <span>Account holder name</span>
              <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Name on the bank account" />
            </label>
            <label className="crp__field">
              <span>Bank account number</span>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Account number" className="is-mono" />
            </label>
            <label className="crp__field">
              <span>IFSC code</span>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} placeholder="ABCD0123456" className="is-mono" />
            </label>
          </>
        ) : (
          <label className="crp__field">
            <span>UPI ID</span>
            <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" className="is-mono" />
          </label>
        )}
      </fieldset>

      {err && <p className="crp__form-err">{err}</p>}

      <div className="crp__form-actions">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit for verification'}</button>
        {onCancel && <button type="button" className="btn btn-light" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------
// Payout window + request
// ---------------------------------------------------------------
function PayoutSection({ earnings, payouts, kycVerified, onRequestPayout, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {tone, text}

  const payoutDay = Number(earnings?.payout_day ?? 1);
  const minPayout = Number(earnings?.min_payout ?? 500);
  const available = Number(earnings?.available ?? 0);

  const today = new Date();
  const isWindowDay = today.getDate() === payoutDay;
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const activeReq = (payouts || []).find((p) => ['requested', 'under_review', 'approved'].includes(p.status));
  const paidThisPeriod = (payouts || []).find((p) => p.payout_period === period && p.status === 'paid');
  const requestedThisPeriod = (payouts || []).find((p) => p.payout_period === period && ['requested', 'under_review', 'approved', 'paid'].includes(p.status));

  const doRequest = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await onRequestPayout(null); // null → full cleared balance (partial off by default)
      if (!res || res.ok === false) { setMsg({ tone: 'bad', text: friendlyPayoutError(res?.reason, { minPayout, payoutDay }) }); }
      else { setMsg({ tone: 'ok', text: `Payout request for ${money2(res.amount)} submitted. Our team will review and pay it manually.` }); await onChanged(); }
    } catch { setMsg({ tone: 'bad', text: 'Something went wrong. Please try again.' }); }
    setBusy(false);
  };

  // ---- Banner state machine ----
  let banner;
  if (!kycVerified) {
    banner = (
      <Banner tone="warn" icon="shield"
        title="Verify your details to withdraw"
        body="Complete verification above. Payouts open once SORA LIFE has verified your KYC." />
    );
  } else if (activeReq) {
    banner = (
      <Banner tone="ok" icon="checkCircle"
        title="Payout request submitted"
        body={`Your request for ${money2(activeReq.requested_amount)} is ${labelStatus(activeReq.status)}. We’ll pay it manually after review — you’ll see it move to “Paid” here.`} />
    );
  } else if (paidThisPeriod && !isWindowDay) {
    banner = (
      <Banner tone="ok" icon="card"
        title="This month’s payout is done"
        body={`${money2(paidThisPeriod.paid_amount ?? paidThisPeriod.requested_amount)} was paid on ${fmtDate(paidThisPeriod.paid_at)}. Next window: ${fmtDate(nextWindowDate(payoutDay))}.`} />
    );
  } else if (!isWindowDay) {
    banner = (
      <Banner tone="muted" icon="clock"
        title={`Next payout window: ${fmtDate(nextWindowDate(payoutDay))}`}
        body={`Requests can be made on the ${ordinal(payoutDay)} of each month. Your cleared balance keeps growing until then.`} />
    );
  } else if (requestedThisPeriod) {
    banner = (
      <Banner tone="ok" icon="checkCircle"
        title="Payout already requested this month"
        body="You’ve used this month’s request. The next window opens next month." />
    );
  } else if (available < minPayout) {
    banner = (
      <Banner tone="muted" icon="clock"
        title="Window is open — but below the minimum"
        body={`You need at least ${money2(minPayout)} cleared to request a payout. You currently have ${money2(available)} available.`} />
    );
  } else {
    banner = (
      <Banner tone="live" icon="sparkle"
        title="Your payout window is open"
        body={`You can request a payout of your cleared balance today.`}
        action={
          <button className="btn" onClick={doRequest} disabled={busy}>
            {busy ? 'Requesting…' : `Request payout · ${money2(available)}`}
          </button>
        } />
    );
  }

  return (
    <section className="crp__payout">
      <div className="crp__payout-bal">
        <div>
          <span className="crp__payout-bal-l">Available to withdraw</span>
          <span className="crp__payout-bal-v">{money2(available)}</span>
        </div>
        <div className="crp__payout-bal-meta">
          <span>Minimum {money2(minPayout)}</span>
          <span>·</span>
          <span>Window: {ordinal(payoutDay)} of each month</span>
        </div>
      </div>

      {banner}

      {msg && <p className={`crp__form-${msg.tone === 'ok' ? 'ok' : 'err'}`}>{msg.text}</p>}
    </section>
  );
}

function Banner({ tone, icon, title, body, action }) {
  return (
    <div className={`crp__banner is-${tone}`}>
      <span className="crp__banner-icon"><Icon name={icon} size={20} /></span>
      <div className="crp__banner-txt">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {action && <div className="crp__banner-action">{action}</div>}
    </div>
  );
}

function PayoutHistory({ payouts }) {
  if (!payouts || payouts.length === 0) return null;
  return (
    <section className="crp__panel" style={{ marginTop: 'var(--sp-5)' }}>
      <h2 className="crp__panel-h">Payout history</h2>
      <div className="crp__table-wrap">
        <table className="crp__table">
          <thead>
            <tr><th>Period</th><th>Requested</th><th className="ta-r">Amount</th><th>Status</th><th>Paid</th><th>Reference</th></tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td>{p.payout_period}</td>
                <td className="muted">{fmtDate(p.requested_at)}</td>
                <td className="ta-r">{money2(p.status === 'paid' ? (p.paid_amount ?? p.requested_amount) : p.requested_amount)}</td>
                <td><span className={`crp__pill is-${PAYOUT_TONE[p.status] || 'warn'}`}>{labelStatus(p.status)}</span></td>
                <td className="muted">{p.paid_at ? fmtDate(p.paid_at) : '—'}</td>
                <td className="muted is-mono">{p.payment_reference || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payouts.some((p) => p.status === 'rejected' && p.rejection_reason) && (
        <p className="crp__foot-note">
          A rejected request releases the reserved balance back to “Available”. Reason(s):{' '}
          {payouts.filter((p) => p.status === 'rejected' && p.rejection_reason).map((p) => p.rejection_reason).join('; ')}.
        </p>
      )}
    </section>
  );
}

// ---- helpers ----
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const labelStatus = (s) => ({
  requested: 'Requested', under_review: 'Under review', approved: 'Approved',
  paid: 'Paid', rejected: 'Rejected', cancelled: 'Cancelled',
}[s] || s);

function friendlyKycError(reason) {
  return ({
    not_a_creator: 'This account isn’t a creator account.',
    bad_status: 'Something went wrong with your submission.',
  }[reason]) || 'Couldn’t submit your details. Please check them and try again.';
}

function friendlyPayoutError(reason, { minPayout, payoutDay }) {
  return ({
    kyc_required: 'Your KYC needs to be verified before you can withdraw.',
    window_closed: `Payouts can only be requested on the ${ordinal(payoutDay)} of the month.`,
    already_requested: 'You’ve already requested a payout this month.',
    below_minimum: `You need at least ${money2(minPayout)} cleared to request a payout.`,
    no_balance: 'You don’t have any cleared earnings to withdraw yet.',
    exceeds_available: 'That’s more than your cleared balance.',
    // Until amount-level ledger allocations exist, a payout settles the whole
    // cleared balance — a partial request cannot be backed exactly.
    full_balance_required: 'Payouts currently withdraw your full cleared balance.',
    invalid_amount: 'That payout amount isn’t valid.',
    not_a_creator: 'This account isn’t a creator account.',
  }[reason]) || 'Couldn’t submit your payout request. Please try again.';
}
