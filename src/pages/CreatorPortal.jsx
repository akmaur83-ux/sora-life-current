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
  { id: 'profile', label: 'Profile', icon: 'user' },
];

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
                <section className="crp__hero">
                  <span className="crp__hero-eyebrow"><Icon name="sparkle" size={13} /> SORA LIFE Creator</span>
                  <h1 className="serif crp__hero-title">Your creator link is ready.</h1>
                  <p className="crp__hero-sub">Share it with your audience and track the orders you help generate.</p>
                  <code className="crp__url crp__hero-url">{defaultLink}</code>
                  <div className="crp__hero-actions">
                    <CopyButton value={defaultLink} className="btn" label="Copy link" />
                    <ShareButton url={defaultLink} title={`Shop SORA LIFE with ${creator.display_name}`} />
                    <Link to="/creator/links" className="btn btn-light"><Icon name="externalLink" size={15} /> Campaign links</Link>
                  </div>
                </section>
              ) : (
                <h1 className="serif crp__h1">Welcome, {creator.display_name.split(' ')[0]}</h1>
              )}
              <div className="crp__stats">
                <Stat label="Your creator code" value={creator.creator_code} mono copy />
                <Stat label="Status" value={creator.status} tone={STATUS_TONE[creator.status]} />
                <Stat label="Commission rate" value={`${Number(creator.default_commission_rate)}%`} />
                <Stat label="Attribution window" value={`${creator.default_attribution_window_days} days`} />
              </div>

              <div className="crp__cards">
                <div className="crp__card">
                  <h2>Campaigns</h2>
                  <p className="crp__big">{activeCampaigns.length}<span> active of {campaigns.length}</span></p>
                  <Link to="/creator/campaigns" className="btn btn-sm btn-light">View campaigns</Link>
                </div>
                <div className="crp__card">
                  <h2>Tracking links</h2>
                  <p className="crp__big">{activeLinks.length}<span> active of {links.length}</span></p>
                  <Link to="/creator/links" className="btn btn-sm btn-light">View links</Link>
                </div>
              </div>

              <p className="crp__foot-note">
                Earnings and payouts aren’t part of this release yet. Your links are live and every
                visit is being recorded, so nothing is lost in the meantime.
              </p>
            </>
          )}

          {tab === 'campaigns' && (
            <>
              <h1 className="serif crp__h1">My campaigns</h1>
              {campaigns.length === 0 ? (
                <div className="crp__empty">No campaigns yet. Your SORA LIFE contact will set these up for you.</div>
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
                <p className="crp__foot-note">
                  Campaign-specific links are set up with your SORA LIFE programme manager. Your default link above is always ready to share.
                </p>
              )}
            </>
          )}

          {tab === 'analytics' && (
            <>
              <h1 className="serif crp__h1">My analytics</h1>
              <p className="crp__lede">Attributed activity from your links. Figures update as orders qualify.</p>
              <div className="crp__stats">
                <Stat label="Link clicks" value={String(analytics?.clicks ?? 0)} />
                <Stat label="Attributed orders" value={String(analytics?.attributed_orders ?? 0)} />
                <Stat label="Products sold" value={String(analytics?.products_sold ?? 0)} />
                <Stat label="Attributed sales" value={money2(analytics?.attributed_sales ?? 0)} tone="ok" />
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
                <div className="crp__empty" style={{ marginTop: 'var(--sp-5)' }}>
                  No attributed orders yet. Share your links — qualifying orders will show up here.
                </div>
              )}

              <div className="crp__notice" style={{ marginTop: 'var(--sp-5)' }}>
                <strong>Earnings and payouts will be available in a future release.</strong> These figures are attributed
                sales, not commission. We never share your shoppers’ personal details with you.
              </div>
            </>
          )}

          {tab === 'earnings' && (
            <CreatorEarnings creator={creator} earnings={earnings} />
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
              <div className="crp__panel">
                <dl className="crp__kv">
                  <div><dt>Name</dt><dd>{creator.display_name}</dd></div>
                  <div><dt>Creator code</dt><dd><code>{creator.creator_code}</code></dd></div>
                  <div><dt>Email</dt><dd>{creator.email}</dd></div>
                  {creator.phone && <div><dt>Phone</dt><dd>{creator.phone}</dd></div>}
                  <div><dt>Status</dt><dd><span className={`crp__pill is-${STATUS_TONE[creator.status] || 'warn'}`}>{creator.status}</span></dd></div>
                  <div><dt>Commission rate</dt><dd>{Number(creator.default_commission_rate)}%</dd></div>
                  <div><dt>Attribution window</dt><dd>{creator.default_attribution_window_days} days</dd></div>
                  <div><dt>Joined</dt><dd>{fmtDate(creator.joined_at)}</dd></div>
                </dl>
                <p className="crp__foot-note">
                  Your commission rate and status are managed by SORA LIFE. Contact your programme
                  manager if something here looks wrong.
                </p>
              </div>
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
