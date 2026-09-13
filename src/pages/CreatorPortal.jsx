import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { SparrowMark } from '../components/Logo.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import {
  claimCreatorAccount, getMyCreator, getMyCampaigns, getMyLinks, buildTrackingUrl,
  getMyCreatorAnalytics,
  getMyCreatorEarnings, getMyKyc, submitKyc, uploadKycDocument, requestPayout, getMyPayouts,
  getMyCreatorStanding, getMyCreatorRewards, claimLevelReward, getCreatorLeaderboard, getMyActivitySeries, getMyRecentClicks, getLevelRewardsCatalog,
  getCreatorTerms, termsArePublished, getMyTermsAcceptance, acceptCreatorTerms,
} from '../lib/creatorApi.js';
import { money2 } from '../lib/format.js';
import CreatorEarnings from '../components/creator/CreatorEarnings.jsx';
import CreatorHowItWorks from '../components/creator/CreatorHowItWorks.jsx';
import { Empty, Band, Cell, CountUp } from '../components/creator/CreatorUI.jsx';
import CreatorDashboard from '../components/creator/CreatorDashboard.jsx';
import CreatorPayouts from '../components/creator/CreatorPayouts.jsx';
import { TierStanding, WithdrawalsNotice } from '../components/creator/CreatorTier.jsx';
import CreatorTierPage from '../components/creator/CreatorTierPage.jsx';
import CreatorProfilePage, { initialsOf } from '../components/creator/CreatorProfilePage.jsx';
import { rankSlot } from '../lib/creatorTiers.js';
import { rangeSeries, DEFAULT_RANGE } from '../lib/creatorSeries.js';
import { buildActivity } from '../lib/creatorActivity.js';

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

// `soon` marks the item with a badge while withdrawals are closed.
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'campaigns', label: 'Campaigns', icon: 'sparkle' },
  { id: 'links', label: 'Links', icon: 'externalLink' },
  { id: 'analytics', label: 'Analytics', icon: 'award' },
  { id: 'earnings', label: 'Earnings', icon: 'card' },
  { id: 'tier', label: 'My Tier', icon: 'crown' },
  { id: 'payouts', label: 'Payouts', icon: 'package', soon: true },
  { id: 'how-it-works', label: 'How you earn', icon: 'circleAlert' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

// ---- Copy helpers -------------------------------------------------------
// Every sentence that quotes a live figure is a plain function; none of
// these invent a value — each falls back to wording that makes no claim.
const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');

const STATUS_TONE = {
  active: 'ok', pending: 'warn', paused: 'warn', suspended: 'bad', archived: 'bad',
  draft: 'warn', ended: 'bad',
};

export default function CreatorPortal({ initial = null }) {
  const { tab = 'dashboard' } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useCustomerAuth();

  const [state, setState] = useState(initial ? 'ready' : 'loading'); // loading | none | ready
  const [creator, setCreator] = useState(initial?.creator || null);
  const [campaigns, setCampaigns] = useState(initial?.campaigns || []);
  const [links, setLinks] = useState(initial?.links || []);
  const [analytics, setAnalytics] = useState(initial?.analytics || null);
  const [earnings, setEarnings] = useState(initial?.earnings || null);
  const [kyc, setKyc] = useState(initial?.kyc || null);
  const [payouts, setPayouts] = useState(initial?.payouts || []);
  const [standing, setStanding] = useState(initial?.standing || null);
  const [rewards, setRewards] = useState(initial?.rewards || null);
  const [leaderboard, setLeaderboard] = useState(initial?.leaderboard || []);
  // Activity series by range ('7d' drives the dashboard, '90d' the sparklines
  // on the other tabs). Fetched on demand and kept for the session.
  const [seriesByRange, setSeriesByRange] = useState(initial?.seriesByRange || {});
  const [range, setRange] = useState(initial?.range || DEFAULT_RANGE);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [recentClicks, setRecentClicks] = useState(initial?.recentClicks || []);
  const [catalog, setCatalog] = useState(initial?.catalog || []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [terms, setTerms] = useState(initial?.terms || null);
  const [termsAccepted, setTermsAccepted] = useState(null);   // null = unknown
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const navRef = useRef(null);

  // Reload just the money surfaces (earnings buckets, KYC, payout history)
  // after an action, without re-fetching the whole portal.
  const reloadMoney = useCallback(async () => {
    const [en, ky, po, st, rw] = await Promise.all([
      getMyCreatorEarnings(), getMyKyc(), getMyPayouts(), getMyCreatorStanding(), getMyCreatorRewards(),
    ]);
    setEarnings(en && en.ok ? en : null);
    setKyc(ky || null);
    setPayouts(Array.isArray(po) ? po : []);
    setStanding(st && st.ok ? st : null);
    setRewards(rw && rw.ok ? rw : null);
  }, []);

  // Terms load separately from the portal's own data. They are public-read
  // and optional, so a failure — or a database where 0026 has not been applied
  // — must leave the portal working with the terms section simply absent.
  useEffect(() => {
    let live = true;
    getCreatorTerms()
      .then((t) => { if (live) setTerms(t); })
      .catch(() => { if (live) setTerms(null); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!creator?.id || !terms || !termsArePublished(terms)) { setTermsAccepted(null); return; }
    let live = true;
    getMyTermsAcceptance(creator.id, terms.version)
      .then((a) => { if (live) setTermsAccepted(!!a); })
      .catch(() => { if (live) setTermsAccepted(null); });
    return () => { live = false; };
  }, [creator?.id, terms]);

  const onAcceptTerms = useCallback(async () => {
    setAcceptingTerms(true);
    const res = await acceptCreatorTerms();
    if (res?.ok) setTermsAccepted(true);
    setAcceptingTerms(false);
  }, []);

  const loadRange = useCallback(async (r) => {
    setSeriesLoading(true);
    try {
      const sr = await getMyActivitySeries(r);
      setSeriesByRange((cur) => ({ ...cur, [r]: sr && sr.ok ? sr : null }));
    } catch { setSeriesByRange((cur) => ({ ...cur, [r]: null })); }
    finally { setSeriesLoading(false); }
  }, []);
  const onRange = useCallback((r) => {
    setRange(r);
    setSeriesByRange((cur) => { if (!(r in cur)) loadRange(r); return cur; });
  }, [loadRange]);

  const load = useCallback(async () => {
    // Try to link this signed-in account to a creator record (matched on the
    // verified email, server-side). A customer with no creator record simply
    // gets "no_match" and stays a customer.
    await claimCreatorAccount();
    const me = await getMyCreator();
    if (!me) { setState('none'); return; }
    setCreator(me);
    const [cs, ls, an, en, ky, po, st, rw, lb] = await Promise.all([
      getMyCampaigns(me.id), getMyLinks(me.id), getMyCreatorAnalytics(),
      getMyCreatorEarnings(), getMyKyc(), getMyPayouts(),
      getMyCreatorStanding(), getMyCreatorRewards(), getCreatorLeaderboard(),
    ]);
    for (const r of [DEFAULT_RANGE, '90d']) loadRange(r);
    getMyRecentClicks().then((c) => setRecentClicks(Array.isArray(c) ? c : [])).catch(() => setRecentClicks([]));
    getLevelRewardsCatalog().then((c) => setCatalog(Array.isArray(c) ? c : [])).catch(() => setCatalog([]));
    setCampaigns(cs);
    setLinks(ls);
    setAnalytics(an && an.ok ? an : null);
    setEarnings(en && en.ok ? en : null);
    setKyc(ky || null);
    setPayouts(Array.isArray(po) ? po : []);
    setStanding(st && st.ok ? st : null);
    setRewards(rw && rw.ok ? rw : null);
    setLeaderboard(Array.isArray(lb) ? lb : []);
    setState('ready');
  }, []);

  useEffect(() => {
    if (initial) return;
    if (authLoading) return;
    if (!session) { setState('none'); return; }
    load();
  }, [authLoading, session, load, initial]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nav = navRef.current;
      const active = nav?.querySelector('.cs-nav__item.is-on');
      if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;

      const inset = 12;
      const visibleLeft = nav.scrollLeft + inset;
      const visibleRight = nav.scrollLeft + nav.clientWidth - inset;
      const itemLeft = active.offsetLeft;
      const itemRight = itemLeft + active.offsetWidth;

      if (itemLeft < visibleLeft) nav.scrollTo({ left: Math.max(0, itemLeft - inset) });
      else if (itemRight > visibleRight) nav.scrollTo({ left: itemRight - nav.clientWidth + inset });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, state]);

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

  const rank = rankSlot(standing?.rank);
  const weekly = rangeSeries(seriesByRange['90d'], '90d');
  const dash = rangeSeries(seriesByRange[range], range);
  const isZero = (v) => !(Number(v) > 0);
  const withdrawalsOpen = !!standing?.withdrawals_open;
  const activity = buildActivity({ creator, clicks: recentClicks, payouts, rewards, kyc, now: initial?.now ? new Date(initial.now) : new Date() });
  const initials = initialsOf(creator.display_name);

  return (
    <div className="crp crp--studio" data-rank={rank}>
      <aside className="cs-side">
        <Link to="/" className="cs-brand" aria-label="SORA LIFE home">
          <span className="cs-brand__mark"><SparrowMark size={34} light /></span>
          <span className="cs-brand__txt"><strong>SORA LIFE</strong><em>Creator Program</em></span>
        </Link>
        <nav ref={navRef} className="cs-nav" aria-label="Creator portal">
          {NAV.map((n) => (
            <Link key={n.id} to={`/creator/${n.id}`} className={`cs-nav__item${tab === n.id ? ' is-on' : ''}`} aria-current={tab === n.id ? 'page' : undefined}>
              <Icon name={n.icon} size={17} />
              <span>{n.label}</span>
              {n.soon && !withdrawalsOpen && <em className="cs-nav__soon">Soon</em>}
            </Link>
          ))}
        </nav>
        <div className="cs-side__foot">
          <p className="cs-side__eyebrow">SORA LIFE</p>
          <p className="cs-side__tag serif">Wellness <br />for a Brighter <br />Tomorrow</p>
          <Link to="/creator/tier" className="cs-side__chip"><Icon name="sparkle" size={15} /><span>You’re creating <br />real impact</span><Icon name="chevronRight" size={15} /></Link>
        </div>
      </aside>

      <div className="cs-main">
        <header className="cs-top">
          <PortalSearch campaigns={campaigns} links={links} onGo={(to) => navigate(to)} />
          <div className="cs-top__right">
            <div className="cs-user">
              <span className="cs-user__avatar" aria-hidden="true">{initials}</span>
              <span className="cs-user__txt">
                <strong>{creator.display_name}</strong>
                {standing?.rank ? <em>{standing.rank} · Level {standing.level}</em> : <em>{creator.status}</em>}
              </span>
              <button type="button" className="cs-user__more" aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Account menu" onClick={() => setMenuOpen((v) => !v)}>
                <Icon name="chevronDown" size={16} />
              </button>
              {menuOpen && (
                <div className="cs-user__menu" role="menu">
                  <Link to="/creator/profile" role="menuitem" onClick={() => setMenuOpen(false)}>Profile</Link>
                  <Link to="/creator/tier" role="menuitem" onClick={() => setMenuOpen(false)}>My Tier</Link>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); signOut(); navigate('/'); }}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="crp__main cs-content">
          {!isLive && (
            <div className="crp__notice">
              Your creator account is <strong>{creator.status}</strong>. Your links won’t attribute
              visits until an admin activates it.
            </div>
          )}

          {tab === 'dashboard' && (
            <CreatorDashboard
              creator={creator}
              analytics={analytics}
              earnings={earnings}
              standing={standing}
              series={dash}
              range={range}
              onRange={onRange}
              seriesLoading={seriesLoading}
              activity={activity}
              hour={initial?.hour}
            />
          )}

          {tab === 'campaigns' && (
            <>
              <h1 className="serif crp__h1">My campaigns</h1>
              {campaigns.length === 0 ? (
                <Empty
                  tone="brand"
                  icon="sparkle"
                  eyebrow="Campaign status"
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
              <Band>
                <Cell label="Link clicks" value={<CountUp value={analytics?.clicks ?? 0} format={(n) => String(Math.round(n))} />} tone="info" spark={weekly.clicks} zero={isZero(analytics?.clicks)}
                  hint="Visits that arrived through one of your links." />
                <Cell label="Attributed orders" value={<CountUp value={analytics?.attributed_orders ?? 0} format={(n) => String(Math.round(n))} />} tone="info" spark={weekly.orders} zero={isZero(analytics?.attributed_orders)}
                  hint="Orders matched to you inside your attribution window." />
                <Cell label="Products sold" value={<CountUp value={analytics?.products_sold ?? 0} format={(n) => String(Math.round(n))} />} tone="info" spark={weekly.products} zero={isZero(analytics?.products_sold)}
                  hint="Individual units across your attributed orders." />
                <Cell label="Attributed sales" value={<CountUp value={analytics?.attributed_sales ?? 0} format={money2} />} tone="ok" spark={weekly.sales} zero={isZero(analytics?.attributed_sales)}
                  hint="Eligible sale value, before commission." />
              </Band>
              <p className="ck-band__caption">{weekly.available ? 'Sparklines show the last 12 weeks.' : 'Sparklines fill in week by week as activity is recorded.'}</p>

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
                  eyebrow="Analytics status"
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
              <WithdrawalsNotice open={!!standing?.withdrawals_open} />
              <CreatorEarnings creator={creator} earnings={earnings} standing={standing} weekly={weekly} />
              <TierStanding standing={standing} compact holdDays={Number(earnings?.settlement_hold_days ?? 7)} />
              <CreatorHowItWorks creator={creator} earnings={earnings} standing={standing} />
            </>
          )}

          {tab === 'tier' && (
            <CreatorTierPage
              standing={standing}
              rewards={rewards}
              catalog={catalog}
              leaderboard={leaderboard}
              series={weekly}
              holdDays={Number(earnings?.settlement_hold_days ?? 7)}
              onClaim={claimLevelReward}
              onChanged={reloadMoney}
              noticeDismissed={!!initial?.noticeDismissed}
            />
          )}

          {tab === 'how-it-works' && (
            <CreatorHowItWorks creator={creator} earnings={earnings} standing={standing} />
          )}

          {tab === 'payouts' && (
            <CreatorPayouts
              creator={creator}
              earnings={earnings}
              kyc={kyc}
              payouts={payouts}
              withdrawalsOpen={!!standing?.withdrawals_open}
              onSubmitKyc={submitKyc}
              onUploadKycDocument={({ kind, file }) => uploadKycDocument({ creatorId: creator.id, kind, file })}
              onRequestPayout={requestPayout}
              onChanged={reloadMoney}
            />
          )}

          {tab === 'profile' && (
            <CreatorProfilePage
              creator={creator}
              standing={standing}
              kyc={kyc}
              terms={terms}
              termsAccepted={termsAccepted}
              acceptingTerms={acceptingTerms}
              onAcceptTerms={onAcceptTerms}
              termsPublished={termsArePublished(terms)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// The top-bar search: a quick jump. Enter goes to the best match among the
// portal's sections, campaigns and links. It searches nothing it cannot open.
function PortalSearch({ campaigns = [], links = [], onGo }) {
  const [q, setQ] = useState('');
  const targets = [
    ...NAV.map((n) => ({ label: n.label, to: `/creator/${n.id}` })),
    ...campaigns.map((c) => ({ label: c.name, to: '/creator/campaigns' })),
    ...links.map((l) => ({ label: l.label || l.public_code, to: '/creator/links' })),
  ];
  const needle = q.trim().toLowerCase();
  const hits = needle ? targets.filter((t) => String(t.label || '').toLowerCase().includes(needle)).slice(0, 5) : [];
  const go = (e) => { e.preventDefault(); if (hits[0]) { onGo(hits[0].to); setQ(''); } };
  return (
    <form className="cs-search" role="search" onSubmit={go}>
      <Icon name="search" size={16} />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns, links, resources…" aria-label="Search the portal" />
      {hits.length > 0 && (
        <ul className="cs-search__hits" role="listbox">
          {hits.map((h, i) => <li key={i}><Link to={h.to} onClick={() => setQ('')}>{h.label}</Link></li>)}
        </ul>
      )}
    </form>
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
    <div className="crp crp--plain crp--studio" data-rank="neutral">
      <div className="container" style={{ padding: 'var(--sp-10) 0', maxWidth: 560 }}>{children}</div>
    </div>
  );
}
