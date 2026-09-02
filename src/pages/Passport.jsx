import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import { lookupPassport, lookupPassportForUser, NOT_AVAILABLE } from '../data/passport.js';
import { money } from '../lib/format.js';
import { contact } from '../lib/settings.js';

const sessionKey = (orderNumber) => `sora_passport:${orderNumber}`;

const SIDE_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/account' },
  { id: 'orders', label: 'Orders', icon: 'bag', to: '/account/orders' },
  { id: 'passports', label: 'Purchase Passports', icon: 'package', to: '/passport', active: true },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart', to: '/wishlist' },
  { id: 'addresses', label: 'Addresses', icon: 'mapPin', to: '/account/addresses' },
  { id: 'settings', label: 'Account Settings', icon: 'settings', to: '/account/settings' },
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'delivery', label: 'Order Status', icon: 'package' },
];

export default function Passport() {
  const { passportId } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useCustomerAuth();

  // 'gate' -> asking for order number + email (guests only), 'loading' ->
  // verifying, 'ready' -> Passport view, 'denied' -> authenticated user does
  // not own this order.
  const [phase, setPhase] = useState('gate');
  const [passport, setPassport] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const runLookup = async ({ orderNumber, email }, { silent = false } = {}) => {
    setPhase('loading');
    if (!silent) setLookupError('');
    try {
      const data = await lookupPassport({ orderNumber, email });
      try { sessionStorage.setItem(sessionKey(data.passportId), email); } catch { /* storage unavailable */ }
      setPassport(data);
      setPhase('ready');
      if (!passportId || passportId !== data.passportId) {
        navigate(`/passport/${data.passportId}`, { replace: true });
      }
    } catch (err) {
      // A silent (session-remembered) retry that fails just falls back
      // to the gate quietly — no scary error for something the user
      // didn't just do.
      try { sessionStorage.removeItem(sessionKey(orderNumber)); } catch { /* storage unavailable */ }
      if (!silent) setLookupError(err.message || 'We could not find that order.');
      setPhase('gate');
    }
  };

  // Authenticated owner path: fetch the customer's OWN order directly via
  // RLS (no email gate). A non-owned/absent order number resolves to a safe
  // "denied" state — never a fallback to email verification.
  const runAuthedLookup = async (orderNumber) => {
    setPhase('loading');
    try {
      const data = await lookupPassportForUser(orderNumber);
      setPassport(data);
      setPhase('ready');
    } catch {
      setPhase('denied');
    }
  };

  // Decide how to open the Passport once the session state is known:
  //   authenticated -> open the user's own order directly (ownership via RLS)
  //   guest         -> try the email remembered for this tab, else the gate
  // (sessionStorage only — never from the URL, never persisted beyond this tab)
  useEffect(() => {
    if (!passportId) return;
    if (authLoading) return; // wait until we know whether there's a session
    if (session) {
      runAuthedLookup(passportId);
      return;
    }
    let storedEmail = null;
    try { storedEmail = sessionStorage.getItem(sessionKey(passportId.toUpperCase())); } catch { /* storage unavailable */ }
    if (storedEmail) runLookup({ orderNumber: passportId, email: storedEmail }, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId, session, authLoading]);

  const copyId = async () => {
    try { await navigator.clipboard.writeText(passport.passportId); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const printPassport = () => window.print();

  if (phase !== 'ready' || !passport) {
    // Session not resolved yet — neutral loading, never the email gate.
    if (authLoading) {
      return (
        <div className="psp">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} member={{ name: 'SORA LIFE', tier: 'Loading…', tierIcon: 'checkCircle' }} />
          {sidebarOpen && <div className="psp__side-scrim open" onClick={() => setSidebarOpen(false)} />}
          <div className="psp__topbar">
            <button className="iconbtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <strong>SORA LIFE</strong>
          </div>
          <main className="psp__main"><div className="psp__inner"><p className="muted">Loading…</p></div></main>
        </div>
      );
    }

    // Authenticated: open the user's OWN order directly (ownership via RLS).
    // Never the email gate, never "Guest / Not Verified".
    if (session) {
      const authedName = session.user?.user_metadata?.full_name?.trim() || session.user?.email?.split('@')[0] || 'Your account';
      return (
        <div className="psp">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} member={{ name: authedName, tier: phase === 'denied' ? 'No access' : 'Verifying…', tierIcon: phase === 'denied' ? 'lock' : 'checkCircle' }} />
          {sidebarOpen && <div className="psp__side-scrim open" onClick={() => setSidebarOpen(false)} />}
          <div className="psp__topbar">
            <button className="iconbtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <strong>SORA LIFE</strong>
          </div>
          <main className="psp__main">
            <div className="psp__inner" style={{ maxWidth: 480 }}>
              {!passportId ? (
                <div className="surface pad-lg" style={{ textAlign: 'center' }}>
                  <h2 className="serif" style={{ fontSize: 'var(--text-xl)' }}>Purchase Passports</h2>
                  <p className="muted" style={{ marginTop: 8 }}>Open a Passport from any order in your order history.</p>
                  <Link to="/account/orders" className="btn" style={{ marginTop: 16 }}>Go to my orders</Link>
                </div>
              ) : phase === 'denied' ? (
                <div className="surface pad-lg" style={{ textAlign: 'center' }}>
                  <h2 className="serif" style={{ fontSize: 'var(--text-xl)' }}><Icon name="lock" size={20} /> Order not found</h2>
                  <p className="muted" style={{ marginTop: 8 }}>We couldn't find this order on your account, or you don't have access to it.</p>
                  <Link to="/account/orders" className="btn" style={{ marginTop: 16 }}>Back to my orders</Link>
                </div>
              ) : (
                <p className="muted">Opening your Purchase Passport…</p>
              )}
            </div>
          </main>
        </div>
      );
    }

    // Guest: existing order-number + checkout-email verification gate — unchanged.
    return (
      <div className="psp">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} member={{ name: 'Guest', tier: 'Not Verified', tierIcon: 'lock' }} />
        {sidebarOpen && <div className="psp__side-scrim open" onClick={() => setSidebarOpen(false)} />}
        <div className="psp__topbar">
          <button className="iconbtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <strong>SORA LIFE</strong>
        </div>
        <LookupGate
          passportId={passportId}
          loading={phase === 'loading'}
          error={lookupError}
          onSubmit={(vals) => runLookup(vals)}
        />
      </div>
    );
  }

  const cards = {
    delivery: <DeliveryDetailsCard passport={passport} />,
  };
  const currentStatus = passport.fulfillment?.label || passport.status;

  return (
    <div className="psp">
      {sidebarOpen && <div className="psp__side-scrim open" onClick={() => setSidebarOpen(false)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} member={passport.member} />

      <div className="psp__topbar">
        <button className="iconbtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <strong>SORA LIFE</strong>
      </div>

      <main className="psp__main">
        <div className="psp__inner">
          <header className="psp__head">
            <div className="psp__headline">
              <h1 className="serif psp__title psp-metal">Your Purchase Passport</h1>
              <p>Verified details from your order.</p>
            </div>

            <span className="psp__head-rule" aria-hidden="true" />

            {/* Official SORA LIFE brand lockup (real asset), foil-lit. */}
            <div className="psp__brandlock" role="img" aria-label="SORA LIFE — Health and Wellness">
              <img src="/assets/sora-life-logo.png" alt="" />
            </div>

            <div className="psp__head-right">
              <div className="psp__idblock">
                <span className="lbl">Passport ID</span>
                <span className="psp__idrow">
                  {passport.passportId}
                  <span style={{ position: 'relative' }}>
                    <button type="button" className="psp__copybtn" onClick={copyId} aria-label="Copy passport ID"><Icon name="copy" /></button>
                    {copied && <span className="psp__copied">Copied</span>}
                  </span>
                </span>
              </div>
              <button type="button" className="btn psp__download no-print" onClick={printPassport}>
                <Icon name="download" size={16} /> Print / Save as PDF
              </button>
            </div>
          </header>

          <div className="psp__herowrap">
            <ProductHero product={passport.product} order={passport.order} />
          </div>

          <DeliveryTimeline timeline={passport.timeline} />

          <nav className="psp__tabs" role="tablist" aria-label="Purchase Passport sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={activeTab === t.id}
                className={`psp__tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' ? (
            <div className="psp__summary psp__summary--single">
              <SummaryCard icon="truck" title="Order Status" cta="View status" onCta={() => setActiveTab('delivery')}>
                <SummaryRow label="Current status" value={currentStatus} />
                <SummaryRow label="Order date" value={passport.order.date} />
              </SummaryCard>
            </div>
          ) : (
            <div className="psp__grid psp__grid--single">{cards[activeTab]}</div>
          )}
        </div>
      </main>

    </div>
  );
}

function LookupGate({ passportId, loading, error, onSubmit }) {
  const [orderNumber, setOrderNumber] = useState(passportId || '');
  const [email, setEmail] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    onSubmit({ orderNumber, email });
  };

  return (
    <main className="psp__main">
      <div className="psp__inner" style={{ maxWidth: 440 }}>
        <header className="psp__head" style={{ marginBottom: 'var(--sp-8)' }}>
          <div>
            <h1 className="serif psp__title"><Icon name="shield" size={26} /> Your Purchase Passport</h1>
            <p>{passportId
              ? `Confirm it's you — enter the email used at checkout for order ${passportId}.`
              : 'Enter your order number and the email used at checkout to view your Passport.'}</p>
          </div>
        </header>

        <form className="surface pad-lg" onSubmit={submit}>
          {!passportId && (
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label">Order number</label>
              <input className="input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="SORA-XXXXXXXXX" required autoFocus />
            </div>
          )}
          <div className={`field ${error ? 'field-error' : ''}`} style={{ marginBottom: 16 }}>
            <label className="label">Email used at checkout</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required autoFocus={Boolean(passportId)} />
            {error && <span className="error-text">{error}</span>}
          </div>
          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? 'Looking up…' : 'View Passport'}
          </button>
        </form>
      </div>
    </main>
  );
}

function Sidebar({ open, onClose, member }) {
  const email = typeof contact?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) ? contact.email.trim() : '';
  const phone = typeof contact?.phone === 'string' ? contact.phone.replace(/[^\d+]/g, '') : '';
  const support = email ? { href: `mailto:${email}`, label: 'Email support' }
    : phone.replace(/\D/g, '').length >= 7 ? { href: `tel:${phone}`, label: 'Call support' } : null;
  return (
    <aside className={`psp__side ${open ? 'open' : ''}`} aria-label="Primary">
      <div className="psp__side-brand">
        <img className="psp__side-logo" src="/assets/sora-life-logo.png" alt="SORA LIFE — Health and Wellness" />
      </div>

      <div className="psp__profile">
        <span className="psp__avatar">{member.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>
        <strong>{member.name}</strong>
        <span className="psp__tier"><Icon name={member.tierIcon || 'award'} size={12} /> {member.tier}</span>
      </div>

      <nav className="psp__nav">
        {SIDE_NAV.map((n) => {
          const inner = (
            <>
              <Icon name={n.icon} size={18} /> <span className="psp__navlabel">{n.label}</span>
              {n.active && <Icon name="chevronRight" size={15} className="psp__navchev" />}
            </>
          );
          return <Link key={n.id} to={n.to} className={`psp__navitem ${n.active ? 'active' : ''}`} onClick={onClose}>{inner}</Link>;
        })}
      </nav>

      {support && <div className="psp__side-promo">
        <div className="psp__promocard psp__helpcard">
          <span className="psp__helpic"><Icon name="chat" size={19} /></span>
          <span>
            <strong className="serif">Need Help?</strong>
            <p><a href={support.href}>{support.label}</a></p>
          </span>
        </div>
      </div>}
    </aside>
  );
}

function ProductHero({ product, order }) {
  const fields = [
    { icon: 'clock', label: 'Order Date', value: order.date },
    { icon: 'package', label: 'Quantity', value: String(product.qty) },
    { icon: 'card', label: 'Amount Paid', value: money(order.amount) },
    { icon: 'lock', label: 'Payment Method', value: order.paymentMethod },
    { icon: 'mapPin', label: 'Delivery Address', value: order.address },
  ];
  return (
    <div className="psp__hero" data-cat={product.category || 'wellness'}>
      <div className="psp__hero-media">
        {/* Premium product stage: soft spotlight, pedestal shadow and rim
            light around the untouched product artwork. */}
        <span className="psp__stage-glow" aria-hidden="true" />
        <div className="psp__stage"><ProductImage product={product} /></div>
        <span className="psp__stage-plinth" aria-hidden="true" />
      </div>
      <div className="psp__hero-body">
        <span className="psp__hero-eyebrow">Verified order</span>
        <h2 className="serif psp__hero-title">{product.name}</h2>
        <span className="psp__hero-underline" />
        <p className="psp__hero-sub">
          {product.shortDescription || 'Order details from your verified purchase.'}
          {product.extraItemsCount > 0 && ` · +${product.extraItemsCount} more item${product.extraItemsCount > 1 ? 's' : ''} in this order`}
        </p>
        <div className="psp__fields">
          {fields.map((f) => (
            <div className="psp__field" key={f.label}>
              <Icon name={f.icon} size={17} />
              <span>
                <span className="lbl">{f.label}</span>
                <span className="val">{f.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeliveryTimeline({ timeline }) {
  return (
    <section className={`psp__timeline ${timeline.length === 1 ? 'psp__timeline--single' : ''}`} aria-label="Order timeline">
      <ol className="psp__tl-track">
        {timeline.map((s) => (
          <li key={s.key} className={`psp__tl-node ${s.done ? 'is-done' : ''} ${s.current ? 'is-current' : ''}`} aria-current={s.current ? 'step' : undefined}>
            <span className="psp__tl-connector" aria-hidden="true" />
            <span className="psp__tl-dot">
              {s.done ? <Icon name="check" size={s.current ? 18 : 15} /> : <Icon name="package" size={15} />}
            </span>
            <span className="psp__tl-step">{s.short}</span>
            <span className="psp__tl-date">{s.date || 'Pending'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* Compact overview summary card (the row of six under the tabs). */
function SummaryCard({ icon, title, cta, onCta, children }) {
  return (
    <div className="psp-sum">
      <h3 className="serif psp-sum__title"><Icon name={icon} size={17} /> {title}</h3>
      <div className="psp-sum__body">{children}</div>
      <button type="button" className="psp-sum__cta" onClick={onCta}>{cta} <Icon name="arrowRight" size={14} /></button>
    </div>
  );
}

/* label + value pair; falls back to the honest "not available" copy when the
   order schema genuinely has no value for it (never invents data). */
function SummaryRow({ label, value }) {
  return (
    <span className="psp-sum__row">
      <span className="psp-sum__lbl">{label}</span>
      <span className="psp-sum__val">{value || NOT_AVAILABLE}</span>
    </span>
  );
}

function CardShell({ icon, title, subtitle, children }) {
  return (
    <div className="psp-card">
      <div className="psp-card__head">
        <h3 className="serif">{icon && <Icon name={icon} size={18} />} {title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function DeliveryDetailsCard({ passport }) {
  const fulfillment = passport.fulfillment;
  const facts = [
    ['Carrier', fulfillment?.carrierName],
    ['Tracking number', fulfillment?.trackingNumber],
    ['Shipped', fulfillment?.shippedAt ? new Date(fulfillment.shippedAt).toLocaleString('en-IN') : null],
    ['Delivered', fulfillment?.deliveredAt ? new Date(fulfillment.deliveredAt).toLocaleString('en-IN') : null],
  ].filter(([, value]) => Boolean(value));
  return (
    <CardShell
      icon="truck" title={fulfillment ? 'Fulfillment & tracking' : 'Order Status'} subtitle="Status recorded for this order"
    >
      <div className="psp-highlight">
        <Icon name="package" size={20} />
        <span>
          <span className="lbl">Current status</span>
          <span className="val">{fulfillment?.label || passport.status}</span>
        </span>
      </div>
      {facts.length > 0 && (
        <dl className="psp-kv psp-kv--tracking">
          {facts.map(([label, value]) => <div className="psp-kv__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      <div className="psp-vt">
        {passport.timeline.map((s) => (
          <div key={s.key} className={`psp-vt__row ${s.done ? 'done' : ''}`}>
            <span className="psp-vt__rail">
              <span className="psp-vt__dot">{s.done && <Icon name="check" size={11} />}</span>
              <span className="psp-vt__line" />
            </span>
            <span className="psp-vt__body">
              <span className="psp-vt__title">{s.label}</span>
              <span className="psp-vt__time">{s.time || NOT_AVAILABLE}</span>
            </span>
          </div>
        ))}
      </div>
      {fulfillment?.trackingUrl && (
        <a className="btn btn-outline btn-sm psp__tracking-link" href={fulfillment.trackingUrl} target="_blank" rel="noopener noreferrer">
          Track on carrier website <Icon name="externalLink" size={15} />
        </a>
      )}
    </CardShell>
  );
}
