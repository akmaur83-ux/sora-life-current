import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import {
  claimCreatorAccount, getMyCreator, getMyCampaigns, getMyLinks, buildTrackingUrl,
  getMyCreatorAnalytics,
  getMyCreatorEarnings, getMyKyc, submitKyc, requestPayout, getMyPayouts,
} from '../lib/creatorApi.js';
import { money2 } from '../lib/format.js';
import CreatorEarnings from '../components/creator/CreatorEarnings.jsx';
import CreatorHowItWorks from '../components/creator/CreatorHowItWorks.jsx';
import { Metric, Section, Empty, Pill, Step } from '../components/creator/CreatorUI.jsx';
import CreatorPayouts from '../components/creator/CreatorPayouts.jsx';

// ============================================================
// SORA LIFE Creator Program — creator portal (Part 1 foundation)
//
// Uses the EXISTING customer auth session; there is no separate creator login.
// Being signed in is not enough: the account must be linked to a creator
// record, and every query below is RLS-scoped to that creator, so a normal
// customer reaching this URL sees the "not a creator" state and the database
// returns them nothing.
//
// Earnings, withdrawals and payouts are deliberately absent — they belong to
// Parts 2 and 3, and showing a zero here would be inventing data.
// ============================================================

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'campaigns', label: 'Campaigns', icon: 'sparkle' },
  { id: 'links', label: 'Links', icon: 'externalLink' },
  { id: 'analytics', label: 'Analytics', icon: 'award' },
  { id: 'earnings', label: 'Earnings', icon: 'crown' },
  { id: 'payouts', label: 'Payouts', icon: 'card' },
  { id: 'how-it-works', label: 'How you earn', icon: 'circleAlert' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

// ---- Dashboard copy helpers -------------------------------------------
// Extracted so the JSX stays legible and so every sentence that quotes a
// live figure is a plain function that can be asserted in tests. None of
// these invent a value: each falls back to wording that makes no claim.
const initialsOf = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const SHARE_TITLE = (creator) => `Shop SORA LIFE with ${creator.display_name}`;

const ordinalDay = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  const suffix = ['th', 'st', 'nd', 'rd'];
  const k = v % 100;
  return `${v}${suffix[(k - 20) % 10] || suffix[k] || suffix[0]}`;
};

const ratePct = (creator) => {
  const r = Number(creator?.default_commission_rate);
  return Number.isFinite(r) ? `${r}%` : '—';
};

const windowLabel = (creator) => {
  const d = Number(creator?.default_attribution_window_days);
  return Number.isFinite(d) && d > 0 ? `${d} days` : '—';
};

const holdHint = (earnings) => {
  const d = Number(earnings?.settlement_hold_days);
  return Number.isFinite(d) && d > 0
    ? `Clears ${d} days after each sale qualifies.`
    : 'Clears once each sale passes the settlement hold.';
};

const hasAnyCommission = (earnings) =>
  Number(earnings?.paid ?? 0) > 0
  || Number(earnings?.available ?? 0) > 0
  || Number(earnings?.held ?? 0) > 0
  || Number(earnings?.reserved ?? 0) > 0;

const activationHint = (creator) =>
  `Your account is ${creator?.status || 'pending'}. Links won’t attribute visits until an admin activates it.`;

const clicksHint = (analytics) => {
  const c = Number(analytics?.clicks ?? 0);
  if (c > 0) return `${c} visit${c === 1 ? '' : 's'} have arrived through your links.`;
  return 'Post your link or code where your audience already is. Visits show up here automatically.';
};

const payoutHint = (earnings) => {
  const min = Number(earnings?.min_payout);
  const day = ordinalDay(earnings?.payout_day);
  if (Number.isFinite(min) && min > 0 && day) {
    return `Requests open on the ${day} of each month, once your available balance reaches ${money2(min)}.`;
  }
  return 'Requests open on the configured payout day each month, once your available balance reaches the minimum.';
};

const totalLabel = (n, tail) => `${n} ${tail}`;
const linksHint = (n) => `${n} campaign link${n === 1 ? '' : 's'}, plus your default link.`;

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');

const STATUS_TONE = {
  active: 'ok', pending: 'warn', paused: 'warn', suspended: 'bad', archived: 'bad',
  draft: 'warn', ended: 'bad',
};

export default function CreatorPortal() {
  const { tab = 'dashboard' } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useCustomerAuth();

  const [state, setState] = useState('loading'); // loading | none | ready
  const [creator, setCreator] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [links, setLinks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [payouts, setPayouts] = useState([]);

  // Reload just the money surfaces (earnings buckets, KYC, payout history)
  // after an action, without re-fetching the whole portal.
  const reloadMoney = useCallback(async () => {
    const [en, ky, po] = await Promise.all([getMyCreatorEarnings(), getMyKyc(), getMyPayouts()]);
    setEarnings(en && en.ok ? en : null);
    setKyc(ky || null);
    setPayouts(Array.isArray(po) ? po : []);
  }, []);

  const load = useCallback(async () => {
    // Try to link this signed-in account to a creator record (matched on the
    // verified email, server-side). A customer with no creator record simply
    // gets "no_match" and stays a customer.
    await claimCreatorAccount();
    const me = await getMyCreator();
    if (!me) { setState('none'); return; }
    setCreator(me);
    const [cs, ls, an, en, ky, po] = await Promise.all([
      getMyCampaigns(me.id), getMyLinks(me.id), getMyCreatorAnalytics(),
      getMyCreatorEarnings(), getMyKyc(), getMyPayouts(),
    ]);
    setCampaigns(cs);
    setLinks(ls);
    setAnalytics(an && an.ok ? an : null);
    setEarnings(en && en.ok ? en : null);
    setKyc(ky || null);
    setPayouts(Array.isArray(po) ? po : []);
    setState('ready');
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setState('none'); return; }
    load();
  }, [authLoading, session, load]);

  if (authLoading || state === 'loading') {
    return <Shell><p className="muted">Loading your creator portal…</p></Shell>;
  }

  if (!session) {
    return (
      <Shell>
        <h1 className="serif crp__empty-h">Creator sign in</h1>
        <p className="muted">Sign in with the email address your SORA LIFE creator account was set up with.</p>
        <Link to="/account" className="btn" style={{ marginTop: 'var(--sp-5)' }}>Go to sign in</Link>
      </Shell>
    );
  }

  if (state === 'none') {
    return (
      <Shell>
        <h1 className="serif crp__empty-h">Not a creator account</h1>
        <p className="muted">
          This account isn’t part of the SORA LIFE Creator Program. If you’ve just been onboarded,
          make sure you’re signed in with the email address you gave us.
        </p>
        <Link to="/account" className="btn" style={{ marginTop: 'var(--sp-5)' }}>Back to my account</Link>
      </Shell>
    );
  }

  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const activeLinks = links.filter((l) => l.status === 'active');
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const isLive = creator.status === 'active';
  const defaultLink = buildTrackingUrl({ destination_path: '/' }, creator, null);

  return (
    <div className="crp">
      <header className="crp__top">
        <div className="container crp__top-in">
          <Link to="/" className="crp__brand">
            <span className="crp__brand-mark">SL</span>
            <span>
              <strong>SORA LIFE</strong>
              <em>Creator Program</em>
            </span>
          </Link>
          <div className="crp__top-right">
            <span className="crp__who">{creator.display_name}</span>
            <button className="btn btn-sm btn-light" onClick={() => { signOut(); navigate('/'); }}>Log out</button>
          </div>
        </div>
      </header>

      <div className="container crp__body">
        <nav className="crp__nav" aria-label="Creator portal">
          {NAV.map((n) => (
            <Link key={n.id} to={`/creator/${n.id}`}
              className={`crp__navitem ${tab === n.id ? 'active' : ''}`}>
              <Icon name={n.icon} size={16} /> {n.label}
            </Link>
          ))}
        </nav>

        <main className="crp__main">
          {!isLive && (
            <div className="crp__notice">
              Your creator account is <strong>{creator.status}</strong>. Your links won’t attribute
              visits until an admin activates it.
            </div>
          )}

          {tab === 'dashboard' && (
            <>
              {isLive ? (
                <section className="ck-share">
                  <span className="ck-share__eyebrow"><Icon name="sparkle" size={13} /> SORA LIFE Creator</span>
                  <h1 className="serif ck-share__title">Your link is live, {creator.display_name.split(' ')[0]}.</h1>
                  <p className="ck-share__sub">
                    Share this anywhere. Every visit through it is recorded against your account for{' '}
                    {creator.default_attribution_window_days} days, and any order in that window earns you commission.
                  </p>
                  <code className="ck-share__url">{defaultLink}</code>
                  <div className="ck-share__actions">
                    <CopyButton value={defaultLink} className="btn" label="Copy link" />
                    <ShareButton url={defaultLink} title={SHARE_TITLE(creator)} />
                    <Link to="/creator/links" className="btn btn-light"><Icon name="externalLink" size={15} /> All links</Link>
                  </div>
                  <span className="ck-share__code">
                    Your code <code>{creator.creator_code}</code>
                    <CopyButton value={creator.creator_code} className="btn btn-xs btn-light" label="Copy" />
                  </span>
                </section>
              ) : (
                <h1 className="serif crp__h1">Welcome, {creator.display_name.split(' ')[0]}</h1>
              )}

              <Section
                title="Performance"
                sub="Attributed activity from your links. Figures update as orders qualify."
                action={<Link to="/creator/analytics" className="ck-section__link">Full analytics</Link>}
              >
                <div className="ck-metrics">
                  <Metric label="Link clicks" value={String(analytics?.clicks ?? 0)} tone="info" icon="externalLink"
                    hint="Every visit that arrived through one of your links." />
                  <Metric label="Attributed orders" value={String(analytics?.attributed_orders ?? 0)} tone="brand" icon="package"
                    hint="Orders matched to you inside your attribution window." />
                  <Metric label="Products sold" value={String(analytics?.products_sold ?? 0)} tone="hold" icon="bag"
                    hint="Individual units across your attributed orders." />
                  <Metric label="Attributed sales" value={money2(analytics?.attributed_sales ?? 0)} tone="ok" icon="tag"
                    hint="Eligible sale value, before commission." />
                </div>
              </Section>

              <Section
                title="Earnings"
                sub="Commission is calculated on eligible sale value and clears after the hold period."
                action={<Link to="/creator/earnings" className="ck-section__link">Earnings detail</Link>}
              >
                <div className="ck-metrics ck-metrics--bento">
                  <Metric hero label="Available to withdraw" value={money2(earnings?.available ?? 0)} tone="ok" icon="card"
                    hint="Cleared commission. This is what a payout request withdraws." />
                  <Metric label="Held" value={money2(earnings?.held ?? 0)} tone="hold" icon="clock"
                    hint={holdHint(earnings)} />
                  <Metric label="In payout" value={money2(earnings?.reserved ?? 0)} tone="brand" icon="shield"
                    hint="Reserved against a payout request that is being processed." />
                  <Metric label="Paid out" value={money2(earnings?.paid ?? 0)} tone="ok" icon="check" />
                </div>
              </Section>

              <Section title="What to do next" sub="Based on your account right now.">
                <ol className="ck-steps">
                  <Step index={1} done={isLive} tone="brand"
                    title="Get your account activated"
                    body={isLive
                      ? 'Your creator account is active and your links attribute visits.'
                      : activationHint(creator)} />
                  <Step index={2} done={Number(analytics?.clicks ?? 0) > 0} tone="brand"
                    title="Share your link"
                    body={clicksHint(analytics)} />
                  <Step index={3} done={hasAnyCommission(earnings)} tone="hold"
                    title="Earn your first commission"
                    body="When an attributed order is paid, commission is created and enters the hold period." />
                  <Step index={4} done={kyc?.identity_status === 'verified'} tone="info"
                    title="Verify your payout details"
                    body={kyc?.identity_status === 'verified'
                      ? 'Your details are verified. You can request a payout when your balance clears.'
                      : 'Submit your KYC and payout details once. An admin verifies them before your first withdrawal.'} />
                  <Step index={5} done={Number(earnings?.paid ?? 0) > 0} tone="ok"
                    title="Request a payout"
                    body={payoutHint(earnings)} />
                </ol>
              </Section>

              <Section title="Your programme" sub="The terms your commission is calculated on.">
                <div className="ck-metrics ck-metrics--3">
                  <Metric label="Commission rate" value={ratePct(creator)} tone="brand" icon="crown"
                    hint="Applied to eligible sale value and locked in when a sale qualifies." />
                  <Metric label="Attribution window" value={windowLabel(creator)} tone="brand" icon="clock"
                    hint="How long after a visit a purchase still counts as yours." />
                  <Metric label="Account status" value={creator.status} tone={isLive ? 'ok' : 'hold'} icon="shield" />
                </div>
              </Section>

              <Section
                title="Campaigns and links"
                action={<Link to="/creator/campaigns" className="ck-section__link">Campaigns</Link>}
              >
                <div className="ck-metrics ck-metrics--2">
                  <Metric label="Active campaigns" value={String(activeCampaigns.length)} tone="brand" icon="sparkle"
                    hint={totalLabel(campaigns.length, 'total on your account.')} />
                  <Metric label="Active tracking links" value={String(activeLinks.length)} tone="brand" icon="externalLink"
                    hint={linksHint(links.length)} />
                </div>
              </Section>
            </>
          )}


          {tab === 'campaigns' && (
            <>
              <h1 className="serif crp__h1">My campaigns</h1>
              {campaigns.length === 0 ? (
                <Empty
                  tone="brand"
                  icon="sparkle"
                  title="No campaigns running yet"
                  body="Campaigns are seasonal pushes SORA LIFE builds for creators — a launch, a festive edit, a category focus. Your programme manager sets them up; you don’t create them yourself."
                  points={[
                    'A campaign link of your own, tracked separately from your default link',
                    'Its own commission rate when the campaign carries one',
                    'Performance you can see split out in Analytics',
                  ]}
                >
                  <Link to="/creator/links" className="btn btn-light">Use my default link</Link>
                </Empty>
              ) : (
                <div className="crp__list">
                  {campaigns.map((c) => (
                    <article key={c.id} className="crp__item">
                      <div className="crp__item-main">
                        <h3>{c.name}</h3>
                        <p className="crp__meta">
                          <code>{c.campaign_code}</code> · {fmtDate(c.start_at)} → {c.end_at ? fmtDate(c.end_at) : 'open'}
                        </p>
                        {c.description && <p className="crp__desc">{c.description}</p>}
                      </div>
                      <span className={`crp__pill is-${STATUS_TONE[c.status] || 'warn'}`}>{c.status}</span>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'links' && (
            <>
              <h1 className="serif crp__h1">My tracking links</h1>
              <p className="crp__lede">Share these anywhere. Every visit through them is recorded against your account.</p>

              <div className="crp__list">
                {/* Default creator link — always available from the code, even
                    before any campaign link exists. */}
                <LinkCard
                  campaignLabel="Default creator link"
                  destination="Homepage"
                  status="active"
                  statusText="always on"
                  code={creator.creator_code}
                  createdLabel={null}
                  url={defaultLink}
                  isDefault
                />

                {links.map((l) => (
                  <LinkCard
                    key={l.id}
                    campaignLabel={campaignById[l.campaign_id]?.name || 'Creator link'}
                    destination={destinationLabel(l)}
                    status={l.status}
                    code={l.public_code}
                    createdLabel={fmtDate(l.created_at)}
                    url={buildTrackingUrl(l, creator, campaignById[l.campaign_id])}
                  />
                ))}
              </div>

              {links.length === 0 && (
                <Empty
                  tone="brand"
                  icon="externalLink"
                  title="No campaign links yet"
                  body="Campaign links are created alongside a campaign by your SORA LIFE programme manager. You don’t need one to start — your default link above is always ready and always attributes."
                />
              )}
            </>
          )}

          {tab === 'analytics' && (
            <>
              <h1 className="serif crp__h1">My analytics</h1>
              <p className="crp__lede">Attributed activity from your links. Figures update as orders qualify.</p>
              <div className="ck-metrics ck-metrics--bento">
                <Metric hero label="Attributed sales" value={money2(analytics?.attributed_sales ?? 0)} tone="ok" icon="tag"
                  hint="Eligible sale value your links generated, before commission." />
                <Metric label="Link clicks" value={String(analytics?.clicks ?? 0)} tone="info" icon="externalLink"
                  hint="Visits that arrived through one of your links." />
                <Metric label="Attributed orders" value={String(analytics?.attributed_orders ?? 0)} tone="brand" icon="package"
                  hint="Orders matched to you inside your attribution window." />
                <Metric label="Products sold" value={String(analytics?.products_sold ?? 0)} tone="hold" icon="bag"
                  hint="Individual units across your attributed orders." />
              </div>

              {Array.isArray(analytics?.top_products) && analytics.top_products.length > 0 ? (
                <div className="crp__panel" style={{ marginTop: 'var(--sp-5)' }}>
                  <h2 style={{ marginTop: 0, fontSize: 15 }}>Top products</h2>
                  <div className="crp__list">
                    {analytics.top_products.map((p, i) => (
                      <article key={i} className="crp__item">
                        <div className="crp__item-main"><h3>{p.name || 'Product'}</h3>
                          <p className="crp__meta">{p.qty} sold</p></div>
                        <span className="crp__stat-v is-ok">{money2(p.sales)}</span>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty
                  tone="info"
                  icon="award"
                  title="No attributed orders yet"
                  body="These figures fill in on their own once someone shops through your link. Nothing here is estimated — every number is a real, matched order."
                  points={[
                    'A visit through your link is recorded immediately',
                    'It stays attributed to you for your full attribution window',
                    'Once that order is paid, it appears here and commission is created',
                  ]}
                >
                  <Link to="/creator/how-it-works" className="btn btn-light">How earning works</Link>
                </Empty>
              )}

              <div className="crp__notice" style={{ marginTop: 'var(--sp-5)' }}>
                <strong>These figures are attributed sales, not commission.</strong> Your commission is in{' '}
                <Link to="/creator/earnings">My earnings</Link>, and you can request a payout from{' '}
                <Link to="/creator/payouts">Payouts</Link> once it clears. We never share your shoppers’
                personal details with you.
              </div>
            </>
          )}

          {tab === 'earnings' && (
            <>
              <CreatorEarnings creator={creator} earnings={earnings} />
              <CreatorHowItWorks creator={creator} earnings={earnings} />
            </>
          )}

          {tab === 'how-it-works' && (
            <CreatorHowItWorks creator={creator} earnings={earnings} />
          )}

          {tab === 'payouts' && (
            <CreatorPayouts
              creator={creator}
              earnings={earnings}
              kyc={kyc}
              payouts={payouts}
              onSubmitKyc={submitKyc}
              onRequestPayout={requestPayout}
              onChanged={reloadMoney}
            />
          )}

          {tab === 'profile' && (
            <>
              <h1 className="serif crp__h1">My profile</h1>
              <p className="crp__lede">Your creator identity and the terms your commission runs on.</p>

              <section className="ck-idcard">
                <span className="ck-idcard__avatar" aria-hidden="true">{initialsOf(creator.display_name)}</span>
                <div className="ck-idcard__main">
                  <h2 className="ck-idcard__name">{creator.display_name}</h2>
                  <p className="ck-idcard__email">{creator.email}</p>
                  {creator.phone && <p className="ck-idcard__email">{creator.phone}</p>}
                  <div className="ck-idcard__tags">
                    <Pill tone={isLive ? 'ok' : 'hold'}>{creator.status}</Pill>
                    <span className="ck-idcard__code">
                      <code>{creator.creator_code}</code>
                      <CopyButton value={creator.creator_code} className="btn btn-xs btn-light" label="Copy" />
                    </span>
                  </div>
                </div>
              </section>

              <Section title="Programme terms" sub="Set by SORA LIFE — these are not editable here.">
                <div className="ck-metrics ck-metrics--3">
                  <Metric label="Commission rate" value={ratePct(creator)} tone="brand" icon="crown"
                    hint="Applied to eligible sale value and locked in when a sale qualifies." />
                  <Metric label="Attribution window" value={windowLabel(creator)} tone="brand" icon="clock"
                    hint="How long after a visit a purchase still counts as yours." />
                  <Metric label="Creator since" value={fmtDate(creator.joined_at)} tone="neutral" icon="award" />
                </div>
              </Section>

              <p className="crp__foot-note">
                Your commission rate and status are managed by SORA LIFE. Contact your programme
                manager if something here looks wrong.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// A human label for where a tracking link points.
function destinationLabel(l) {
  const type = l?.destination_type || 'homepage';
  if (type === 'homepage') return 'Homepage';
  const path = l?.destination_path || '/';
  const noun = type === 'product' ? 'Product' : type === 'category' ? 'Category' : 'Page';
  return `${noun} · ${path}`;
}

// One tracking-link card with a clear information hierarchy:
// campaign → destination → status/created → tracking code → url → copy.
function LinkCard({ campaignLabel, destination, status, statusText, code, createdLabel, url, isDefault }) {
  const tone = status === 'active' ? 'ok' : 'bad';
  return (
    <article className={`crp__lc ${isDefault ? 'crp__lc--default' : ''} ${status !== 'active' ? 'is-off' : ''}`}>
      <div className="crp__lc-head">
        <h3 className="crp__lc-campaign">{campaignLabel}</h3>
        <span className={`crp__pill is-${tone}`}>{statusText || status}</span>
      </div>
      <dl className="crp__lc-meta">
        <div><dt>Destination</dt><dd>{destination}</dd></div>
        {createdLabel && <div><dt>Created</dt><dd>{createdLabel}</dd></div>}
        <div><dt>Tracking code</dt><dd><code>{code}</code></dd></div>
      </dl>
      <code className="crp__url">{url}</code>
      <div className="crp__lc-actions">
        <CopyButton value={url} className="btn btn-sm" label="Copy link" />
        <ShareButton url={url} title="Shop SORA LIFE" small />
      </div>
    </article>
  );
}

// Web Share API where available (mobile), otherwise renders nothing (Copy stays).
function ShareButton({ url, title, small }) {
  const [shared, setShared] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  if (!canShare) return null;
  return (
    <button type="button" className={`btn ${small ? 'btn-sm' : ''} btn-light`} onClick={async () => {
      try { await navigator.share({ title, url }); setShared(true); } catch { /* cancelled */ }
    }}>
      <Icon name="externalLink" size={small ? 15 : 16} /> {shared ? 'Shared' : 'Share'}
    </button>
  );
}

function Stat({ label, value, mono, tone, copy }) {
  return (
    <div className="crp__stat">
      <span className="crp__stat-l">{label}</span>
      <span className={`crp__stat-v ${mono ? 'is-mono' : ''} ${tone ? `is-${tone}` : ''}`}>{value}</span>
      {copy && <CopyButton value={value} className="btn btn-xs btn-light" label="Copy" />}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="crp crp--plain">
      <div className="container" style={{ padding: 'var(--sp-10) 0', maxWidth: 560 }}>{children}</div>
    </div>
  );
}
