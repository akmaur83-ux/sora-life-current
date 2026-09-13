import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import CopyButton from '../CopyButton.jsx';
import CreatorTermsPanel, { TermsUpdatedLine } from './CreatorTermsPanel.jsx';
import { RankMedallion } from './CreatorTierPage.jsx';
import { rankSlot } from '../../lib/creatorTiers.js';

// ============================================================
// My Profile — the studio page.
//
// Identity from the creator record, the rate from the tier system, the
// standing from status + KYC, the payouts card from withdrawals_open. Nothing
// on this page is editable by the creator, and the copy says so.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');
// null is "not set", never 0 — Number(null) would print a 0% rate.
const num = (v) => (v == null || v === '' ? NaN : Number(v));
export const initialsOf = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const STATUS = {
  active: { tone: 'ok', label: 'Active' },
  pending: { tone: 'hold', label: 'Pending' },
  paused: { tone: 'hold', label: 'Paused' },
  suspended: { tone: 'bad', label: 'Suspended' },
  archived: { tone: 'neutral', label: 'Archived' },
};

// Account standing: what the status and the KYC state add up to, in words.
export function standingFor(creator, kyc) {
  const status = creator?.status || 'pending';
  const verified = kyc?.identity_status === 'verified';
  if (status === 'active' && verified) return { tone: 'ok', title: 'Profile verified', body: 'Your account is active and in good standing. Keep creating and sharing wellness!' };
  if (status === 'active') return { tone: 'ok', title: 'Account active', body: 'Your links attribute visits. Verify your payout details under Payouts before your first withdrawal.' };
  if (status === 'pending') return { tone: 'hold', title: 'Awaiting activation', body: 'An admin activates your account before your links attribute visits.' };
  if (status === 'paused') return { tone: 'hold', title: 'Account paused', body: 'Your links are not attributing visits right now. Contact your programme manager.' };
  if (status === 'suspended') return { tone: 'bad', title: 'Account suspended', body: 'Contact your programme manager about the standing of your account.' };
  return { tone: 'neutral', title: 'Account archived', body: 'This account is no longer part of the programme.' };
}

export default function CreatorProfilePage({
  creator, standing = null, kyc = null, terms = null, termsAccepted = null, acceptingTerms = false, onAcceptTerms = null, termsPublished = false,
}) {
  const st = STATUS[creator?.status] || STATUS.pending;
  const rate = standing?.rate != null ? num(standing.rate) : num(creator?.default_commission_rate);
  const windowDays = num(creator?.default_attribution_window_days);
  const since = creator?.joined_at || creator?.created_at || null;
  const acct = standingFor(creator, kyc);
  const open = !!standing?.withdrawals_open;

  return (
    <div className="cp" data-rank={rankSlot(standing?.rank)}>
      <span className="cp-leaf cp-leaf--tr" aria-hidden="true" />

      <div className="cp-head">
        <div className="cp-head__txt">
          <p className="cp-eyebrow">Creator Program</p>
          <h1 className="crp__h1 serif">My profile</h1>
          <p className="crp__lede">Your creator identity and the terms your commission runs on.</p>
        </div>
        <p className="cp-script serif" aria-hidden="true">More Wellness<br />More Goodness<span className="cp-rule" /></p>
        <p className="cp-caps" aria-hidden="true"><span>People</span><span>Wellness</span><span>A brighter</span><span>Tomorrow</span></p>
      </div>

      <section className="cp-id" aria-label="Your identity">
        <span className="cp-id__leaf" aria-hidden="true" />
        <div className="cp-id__avatar-wrap">
          <span className="cp-id__avatar" aria-hidden="true">{initialsOf(creator?.display_name)}</span>
          {standing?.rank && <span className="cp-id__badge"><RankMedallion rank={standing.rank} size={44} /></span>}
        </div>
        <div className="cp-id__main">
          <h2 className="cp-id__name serif">{creator?.display_name}</h2>
          <p className="cp-id__email">{creator?.email}</p>
          {creator?.phone && <p className="cp-id__email">{creator.phone}</p>}
          <div className="cp-id__tags">
            <span className={`cp-pill is-${st.tone}`}><i aria-hidden="true" />{st.label}</span>
            <span className="cp-id__sep" aria-hidden="true" />
            <code className="cp-id__code">{creator?.creator_code}</code>
            <CopyButton value={creator?.creator_code || ''} className="cp-copy" label="Copy" />
          </div>
        </div>
        <div className="cp-id__aside">
          <p className="serif">Creators today.<br />A healthier tomorrow.</p>
          <span className="cp-rule" aria-hidden="true" />
        </div>
      </section>

      <div className="cp-sec">
        <h2 className="cp-sec__h serif">Programme terms</h2>
        <p className="cp-sec__sub">Set by SORA LIFE — not editable here.</p>
      </div>

      <div className="cp-terms">
        <article className="cp-term" data-tone="ok">
          <span className="cp-term__tile" aria-hidden="true"><span className="cp-term__glyph">%</span></span>
          <div>
            <span className="cp-term__label">Commission rate</span>
            <div className="cp-term__fig serif">{Number.isFinite(rate) ? `${rate}%` : '—'}</div>
            <p className="cp-term__line">
              {Number.isFinite(rate) ? `You earn ${rate}% commission on eligible sales.` : 'Your commission rate is set by your tier.'}
              {standing?.rank ? ` ${standing.rank} · Level ${standing.level}.` : ''}
            </p>
          </div>
        </article>
        <article className="cp-term" data-tone="hold">
          <span className="cp-term__tile" aria-hidden="true"><Icon name="clock" size={22} /></span>
          <div>
            <span className="cp-term__label">Attribution window</span>
            <div className="cp-term__fig serif">{Number.isFinite(windowDays) && windowDays > 0 ? `${windowDays} days` : '—'}</div>
            <p className="cp-term__line">{Number.isFinite(windowDays) && windowDays > 0 ? `Sales are attributed to you for ${windowDays} days after someone clicks your link.` : 'Sales are attributed to you for your attribution window after a click.'}</p>
          </div>
        </article>
        <article className="cp-term" data-tone="ok">
          <span className="cp-term__tile" aria-hidden="true"><Icon name="leaf" size={22} /></span>
          <div>
            <span className="cp-term__label">Creator since</span>
            <div className="cp-term__fig serif">{fmtDate(since)}</div>
            <p className="cp-term__line">{since ? `You’ve been part of SORA LIFE since ${fmtDate(since)}.` : 'Your join date will appear once your account is activated.'}</p>
          </div>
        </article>
      </div>

      <section className="cp-standing" aria-label="Account standing and payouts">
        <div className="cp-standing__half" data-tone={acct.tone}>
          <span className="cp-term__tile" aria-hidden="true"><Icon name="shield" size={22} /></span>
          <div>
            <span className="cp-term__label">Account standing</span>
            <h3 className="cp-standing__h serif">{acct.title}</h3>
            <p className="cp-term__line">{acct.body}</p>
          </div>
        </div>
        <div className="cp-standing__half" data-tone={open ? 'ok' : 'hold'} data-withdrawals={open ? 'open' : 'closed'}>
          <span className="cp-term__tile" aria-hidden="true"><Icon name="card" size={22} /></span>
          <div>
            <span className="cp-term__label">Payouts</span>
            <h3 className="cp-standing__h serif">{open ? 'Payouts open' : 'Payouts currently closed'}</h3>
            <p className="cp-term__line">{open ? 'Request a payout on the window day once your KYC is verified and your balance has cleared.' : 'Payouts will be available after tax registration completes. Your commission keeps accruing.'}</p>
          </div>
          <Link to="/creator/payouts" className="cp-btn is-ghost">{open ? 'Go to payouts' : 'Learn more'} <Icon name="externalLink" size={15} /></Link>
        </div>
      </section>

      {termsPublished && terms && (
        <section className="cp-panel cp-tc" aria-labelledby="cp-tc-h">
          <h2 className="cp-sec__h serif" id="cp-tc-h">Terms &amp; conditions</h2>
          <p className="cp-sec__sub">The terms your participation in the programme runs on.</p>
          <TermsUpdatedLine terms={terms} />
          <CreatorTermsPanel terms={terms} />
          {termsAccepted === true && <p className="ck-terms__accepted">You accepted version {terms.version}.</p>}
          {termsAccepted === false && (
            <div className="ck-terms__accept">
              <p>These terms have been updated since you last accepted them. Please read and accept the current version.</p>
              <button type="button" className="btn btn-sm" onClick={onAcceptTerms} disabled={acceptingTerms}>
                {acceptingTerms ? 'Recording…' : `I accept version ${terms.version}`}
              </button>
            </div>
          )}
        </section>
      )}

      <footer className="cp-help">
        <span className="cp-help__ic" aria-hidden="true"><Icon name="chat" size={26} /></span>
        <div className="cp-help__txt">
          <strong>Need help?</strong>
          <span>Your commission rate and status are managed by SORA LIFE. Contact your programme manager if something here looks wrong.</span>
        </div>
        <Link to="/contact" className="cp-btn is-ghost"><Icon name="mail" size={16} /> Contact support</Link>
      </footer>
    </div>
  );
}
