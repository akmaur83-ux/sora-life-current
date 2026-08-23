import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { lookupPassport, NOT_AVAILABLE } from '../data/passport.js';
import { money } from '../lib/format.js';

const sessionKey = (orderNumber) => `sora_passport:${orderNumber}`;

const SIDE_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/account' },
  { id: 'orders', label: 'Orders', icon: 'bag', to: '/account/orders' },
  { id: 'passports', label: 'Purchase Passports', icon: 'package', to: '/passport', active: true },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart', to: '/wishlist' },
  { id: 'addresses', label: 'Addresses', icon: 'mapPin', to: '/account/addresses' },
  { id: 'care', label: 'Sora Life Care', icon: 'leaf', to: '#' },
  { id: 'rewards', label: 'Rewards', icon: 'award', to: '#' },
  { id: 'reviews', label: 'My Reviews', icon: 'star', to: '#' },
  { id: 'settings', label: 'Account Settings', icon: 'settings', to: '/account/settings' },
  { id: 'support', label: 'Support', icon: 'chat', to: '#' },
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'delivery', label: 'Delivery', icon: 'truck' },
  { id: 'care', label: 'Product Care', icon: 'droplet' },
  { id: 'returns', label: 'Returns & Support', icon: 'return' },
  { id: 'identity', label: 'Product Identity', icon: 'shield' },
  { id: 'experience', label: 'My Experience', icon: 'heartHand' },
];

export default function Passport() {
  const { passportId } = useParams();
  const navigate = useNavigate();
  const { toast } = useStore();

  // 'gate' -> asking for order number + email, 'loading' -> verifying,
  // 'ready' -> ordinal Passport view, 'error' -> lookup failed.
  const [phase, setPhase] = useState('gate');
  const [passport, setPassport] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [face, setFace] = useState(null);
  const [chips, setChips] = useState([]);
  const [reminder, setReminder] = useState(14);

  const runLookup = async ({ orderNumber, email }, { silent = false } = {}) => {
    setPhase('loading');
    if (!silent) setLookupError('');
    try {
      const data = await lookupPassport({ orderNumber, email });
      try { sessionStorage.setItem(sessionKey(data.passportId), email); } catch { /* storage unavailable */ }
      setPassport(data);
      setReminder(data.reminder.selected);
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

  // On landing with an order number already in the URL, try the email
  // remembered for this session (sessionStorage only — never the URL,
  // never persisted beyond this tab) before asking again.
  useEffect(() => {
    if (!passportId) return;
    let storedEmail = null;
    try { storedEmail = sessionStorage.getItem(sessionKey(passportId.toUpperCase())); } catch { /* storage unavailable */ }
    if (storedEmail) runLookup({ orderNumber: passportId, email: storedEmail }, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const copyId = async () => {
    try { await navigator.clipboard.writeText(passport.passportId); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    toast('PDF export is coming soon');
  };

  const toggleChip = (c) => setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const shareExperience = () => {
    if (!face) return;
    toast('Thanks for sharing your experience');
  };

  const setReminderChoice = (v) => {
    setReminder(v);
    toast(v === 'none' ? 'Reminder turned off' : `Reminder set for ${v} days`);
  };

  if (phase !== 'ready' || !passport) {
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
        <Toasts />
      </div>
    );
  }

  const cards = {
    delivery: <DeliveryDetailsCard passport={passport} />,
    care: <ProductCareCard care={passport.care} />,
    returns: <ReturnsSupportCard returns={passport.returns} />,
    identity: <ProductIdentityCard identity={passport.identity} />,
    experience: (
      <MyExperienceCard
        experience={passport.experience}
        face={face} setFace={setFace}
        chips={chips} toggleChip={toggleChip}
        onSubmit={shareExperience}
      />
    ),
  };

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
            <div>
              <h1 className="serif psp__title"><Icon name="shield" size={26} /> Your Purchase Passport</h1>
              <p>Every detail. Every step. Always with you.</p>
            </div>
            <div className="psp__head-right">
              <div className="psp__idblock">
                <span className="lbl">Passport ID</span>
                <span className="psp__idrow">
                  {passport.passportId}
                  <span style={{ position: 'relative' }}>
                    <button className="psp__copybtn" onClick={copyId} aria-label="Copy passport ID"><Icon name="copy" /></button>
                    {copied && <span className="psp__copied">Copied</span>}
                  </span>
                </span>
              </div>
              <button className="btn btn-light" onClick={download}>
                <Icon name="download" size={17} /> Download Passport
              </button>
            </div>
          </header>

          <div className="psp__herowrap">
            <ProductHero product={passport.product} order={passport.order} eta={passport.eta} />
            <StatusCard status={passport.status} eta={passport.eta} delivered={!!passport.deliveredOn} deliveredOn={passport.deliveredOn} />
          </div>

          <DeliveryTimeline timeline={passport.timeline} />

          <nav className="psp__tabs" role="tablist" aria-label="Purchase Passport sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                className={`psp__tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' ? (
            <>
              <div className="psp__grid">
                <DeliveryDetailsCard passport={passport} />
                <ProductCareCard care={passport.care} />
                <ReturnsSupportCard returns={passport.returns} />
                <ProductIdentityCard identity={passport.identity} />
                <MyExperienceCard
                  experience={passport.experience}
                  face={face} setFace={setFace}
                  chips={chips} toggleChip={toggleChip}
                  onSubmit={shareExperience}
                />
                <ReorderRemindersCard reminder={passport.reminder} selected={reminder} onSelect={setReminderChoice} />
                <PromoCardWide />
              </div>
              <PromoBand />
            </>
          ) : (
            <div className="psp__grid psp__grid--single">{cards[activeTab]}</div>
          )}
        </div>
      </main>

      <Toasts />
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
  return (
    <aside className={`psp__side ${open ? 'open' : ''}`} aria-label="Primary">
      <div className="psp__side-brand">
        <span className="psp__mark"><Icon name="leaf" size={19} /></span>
        <strong className="serif">SORA LIFE</strong>
        <span>Health &amp; Wellness</span>
      </div>

      <div className="psp__profile">
        <span className="psp__avatar">{member.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>
        <strong>{member.name}</strong>
        <span className="psp__tier"><Icon name={member.tierIcon || 'checkCircle'} size={12} /> {member.tier}</span>
      </div>

      <nav className="psp__nav">
        {SIDE_NAV.map((n) => (
          n.to === '#'
            ? <a key={n.id} href="#" className={`psp__navitem ${n.active ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onClose(); }}>
                <Icon name={n.icon} size={19} /> <span className="psp__navlabel">{n.label}</span>
              </a>
            : <Link key={n.id} to={n.to} className={`psp__navitem ${n.active ? 'active' : ''}`} onClick={onClose}>
                <Icon name={n.icon} size={19} /> <span className="psp__navlabel">{n.label}</span>
              </Link>
        ))}
      </nav>

      <div className="psp__side-promo">
        <div className="psp__promocard">
          <strong className="serif">Sora Life Care</strong>
          <ul>
            <li><Icon name="check" size={13} /> Priority support</li>
            <li><Icon name="check" size={13} /> Smart reminders</li>
            <li><Icon name="check" size={13} /> Member rewards</li>
          </ul>
          <a href="#" className="btn btn-gold btn-outline btn-sm btn-block" onClick={(e) => e.preventDefault()}>Explore Care →</a>
        </div>
        <div className="psp__promocard">
          <strong className="serif">Need Help?</strong>
          <p>We're here for you</p>
          <a href="#" className="btn btn-gold btn-outline btn-sm btn-block" onClick={(e) => e.preventDefault()}>Contact Us</a>
        </div>
      </div>

      <div className="psp__side-foot"><Icon name="lock" size={13} /> <span>Secure · Reliable · Transparent</span></div>
    </aside>
  );
}

function ProductHero({ product, order, eta }) {
  const fields = [
    { icon: 'clock', label: 'Order Date', value: order.date },
    { icon: 'package', label: 'Quantity', value: String(product.qty) },
    { icon: 'card', label: 'Amount Paid', value: money(order.amount) },
    { icon: 'lock', label: 'Payment Method', value: order.paymentMethod },
    { icon: 'mapPin', label: 'Delivery Address', value: order.address },
    { icon: 'truck', label: 'Estimated Delivery', value: eta.display },
  ];
  return (
    <div className="psp__hero">
      <div className="psp__hero-media">
        <ProductImage product={product} />
        <span className="psp__hero-verify"><Icon name="leaf" size={18} /></span>
      </div>
      <div className="psp__hero-body">
        <h2 className="serif psp__hero-title">{product.name}</h2>
        <span className="psp__hero-underline" />
        <p className="psp__hero-sub">
          {product.shortDescription || 'Your order, verified and ready to track.'}
          {product.extraItemsCount > 0 && ` · +${product.extraItemsCount} more item${product.extraItemsCount > 1 ? 's' : ''} in this order`}
        </p>
        <div className="psp__fields">
          {fields.map((f) => (
            <div className="psp__field" key={f.label}>
              <Icon name={f.icon} size={19} />
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

function StatusCard({ status, eta, delivered, deliveredOn }) {
  return (
    <div className="psp__status">
      <span className="ic"><Icon name="truck" size={19} /></span>
      <span className="lbl">Passport Status</span>
      <div className="stat serif">{status}</div>
      {delivered ? (
        <>
          <div className="eta-lbl">Delivered on</div>
          <div className="eta-val">{deliveredOn}</div>
        </>
      ) : (
        <>
          <div className="eta-lbl">Estimated Delivery</div>
          <div className="eta-val">{eta.display}</div>
        </>
      )}
    </div>
  );
}

function DeliveryTimeline({ timeline }) {
  const icons = { ordered: 'check', packed: 'check', shipped: 'truck', out_for_delivery: 'package', delivered: 'mail' };
  return (
    <section className="psp__timeline" aria-label="Delivery timeline">
      <ol className="psp__tl-track">
        {timeline.map((s) => (
          <li key={s.key} className={`psp__tl-node ${s.done ? 'is-done' : ''} ${s.current ? 'is-current' : ''}`} aria-current={s.current ? 'step' : undefined}>
            <span className="psp__tl-connector" aria-hidden="true" />
            <span className="psp__tl-dot">
              {s.done ? <Icon name="check" size={s.current ? 18 : 15} /> : <Icon name={icons[s.key] || 'package'} size={15} />}
            </span>
            <span className="psp__tl-step">{s.short}</span>
            <span className="psp__tl-date">{s.date || 'Pending'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CardShell({ icon, title, subtitle, seal, footer, children, singleCol }) {
  return (
    <div className="psp-card">
      {seal && <span className="psp-card__seal"><Icon name="award" size={26} /></span>}
      <div className="psp-card__head">
        <h3 className="serif">{icon && <Icon name={icon} size={18} />} {title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="psp-card__foot">{footer}</div>}
    </div>
  );
}

function DeliveryDetailsCard({ passport }) {
  return (
    <CardShell
      icon="truck" title="Delivery Details" subtitle="Track where your order is right now"
      footer={<a href="#" className="btn btn-outline btn-sm btn-block" onClick={(e) => e.preventDefault()}><Icon name="externalLink" size={15} /> Track on Courier Website</a>}
    >
      <div className="psp-highlight">
        <Icon name="truck" size={20} />
        <span>
          <span className="lbl">Estimated delivery</span>
          <span className="val">{passport.eta.display}</span>
        </span>
      </div>
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
    </CardShell>
  );
}

function ProductCareCard({ care }) {
  return (
    <CardShell
      icon="droplet" title="Product Care Guide" subtitle="Get the most from your product"
      footer={<a href="#" className="btn btn-outline btn-sm btn-block" onClick={(e) => e.preventDefault()}>View Detailed Guide <Icon name="arrowRight" size={15} /></a>}
    >
      <div className="psp-guidelist">
        {care.map((c) => (
          <div className="psp-guide" key={c.title}>
            <span className="psp-guide__ic"><Icon name={c.icon} size={17} /></span>
            <span>
              <span className="psp-guide__title">{c.title}</span>
              <span className="psp-guide__desc">{c.desc}</span>
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function ReturnsSupportCard({ returns }) {
  return (
    <CardShell icon="return" title="Returns & Support" subtitle="We're here to help">
      <div className="psp-highlight">
        <Icon name="clock" size={20} />
        <span>
          <span className="lbl">{returns.windowDate ? 'Return window valid till' : 'Return window'}</span>
          <span className="val">{returns.windowDate || NOT_AVAILABLE}</span>
        </span>
      </div>
      <div>
        {returns.actions.map((a) => (
          <button key={a.title} className="psp-actionrow" onClick={() => {}}>
            <span className="psp-actionrow__ic"><Icon name={a.icon} size={16} /></span>
            <span>
              <span className="psp-actionrow__title" style={{ display: 'block' }}>{a.title}</span>
              <span className="psp-actionrow__sub">{a.sub}</span>
            </span>
            <span className="psp-actionrow__chev"><Icon name="chevronRight" size={16} /></span>
          </button>
        ))}
      </div>
      <div className="psp-genuine">
        <Icon name="shield" size={22} />
        <span>
          <strong>100% Genuine Products</strong>
          <span>Sourced directly. Quality assured.</span>
        </span>
      </div>
    </CardShell>
  );
}

function ProductIdentityCard({ identity }) {
  return (
    <CardShell icon="shield" title="Product Identity" subtitle="Authenticity you can trust" seal>
      <dl className="psp-kv">
        <div className="psp-kv__row"><dt>Brand</dt><dd>{identity.brand}</dd></div>
        <div className="psp-kv__row"><dt>Batch No.</dt><dd>{identity.batch || NOT_AVAILABLE}</dd></div>
        <div className="psp-kv__row"><dt>Mfg. Date</dt><dd>{identity.mfgDate || NOT_AVAILABLE}</dd></div>
        <div className="psp-kv__row"><dt>Expiry Date</dt><dd>{identity.expiryDate || NOT_AVAILABLE}</dd></div>
      </dl>
      <div className="psp-qr">
        <span className="psp-qr__box"><Icon name="qrCode" size={30} /></span>
        <span>
          <strong>Scan to verify authenticity</strong>
          <span>Use the QR code to view product details</span>
        </span>
      </div>
    </CardShell>
  );
}

const FACE_PATH = {
  loved: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M8.5 9h.01M15.5 9h.01"/>',
  good: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 1 3.5 1 3.5-1 3.5-1"/><path d="M8.5 9h.01M15.5 9h.01"/>',
  unsure: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7"/><path d="M8.5 9h.01M15.5 9h.01"/>',
  not_for_me: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5s1.2-1 3.5-1 3.5 1 3.5 1"/><path d="M8.5 9h.01M15.5 9h.01"/>',
  bad: '<circle cx="12" cy="12" r="9"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/><path d="M8.5 9h.01M15.5 9h.01"/>',
};

function MyExperienceCard({ experience, face, setFace, chips, toggleChip, onSubmit }) {
  return (
    <CardShell
      icon="heartHand" title="My Experience" subtitle="Your experience helps us serve you better"
      footer={<button className="btn btn-block" disabled={!face} onClick={onSubmit}><Icon name="gift" size={17} /> Share Experience</button>}
    >
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="hint" style={{ marginBottom: 10 }}>How was your experience with this product?</legend>
        <div className="psp-faces" role="radiogroup" aria-label="Rate your experience">
          {experience.faces.map((f) => (
            <button
              key={f.key} type="button" role="radio" aria-checked={face === f.key}
              className={`psp-face ${face === f.key ? 'active' : ''}`}
              onClick={() => setFace(f.key)}
            >
              <span className="psp-face__ring">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: FACE_PATH[f.key] }} />
              </span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <p className="hint" style={{ marginBottom: 8 }}>What did you like?</p>
        <div className="psp-chiprow">
          {experience.chips.map((c) => (
            <button key={c} type="button" className={`chip ${chips.includes(c) ? 'active' : ''}`} aria-pressed={chips.includes(c)} onClick={() => toggleChip(c)}>{c}</button>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function ReorderRemindersCard({ reminder, selected, onSelect }) {
  return (
    <CardShell icon="refresh" title="Reorder & Reminders" subtitle="Never run out of what you love"
      footer={<button className="btn btn-block" onClick={() => onSelect(selected)}>Set Reminder</button>}
    >
      <div className="psp-highlight">
        <Icon name="tag" size={20} />
        <span>
          <span className="lbl">You purchased this</span>
          <span className="val">{reminder.purchasedDaysAgo != null ? `${reminder.purchasedDaysAgo} day${reminder.purchasedDaysAgo === 1 ? '' : 's'} ago` : NOT_AVAILABLE}</span>
        </span>
      </div>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="hint" style={{ marginBottom: 4 }}>Set a reminder</legend>
        <div className="psp-reminder" role="radiogroup" aria-label="Set a reminder">
          {reminder.options.map((o) => (
            <label key={o.value} className={`psp-reminder__row ${selected === o.value ? 'checked' : ''}`}>
              <Icon name="bell" size={16} className="bell" />
              <span className="psp-reminder__label">{o.label}</span>
              <input type="radio" name="reminder" className="sr-only" checked={selected === o.value} onChange={() => onSelect(o.value)} />
              <span className="psp-radio" aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
    </CardShell>
  );
}

function PromoBand() {
  return (
    <div className="psp-promoband">
      <div style={{ maxWidth: 340 }}>
        <h3 className="serif psp-promoband__title">Exclusively for You</h3>
        <p>Because you love wellness</p>
        <a href="#" className="btn btn-gold btn-outline btn-sm" onClick={(e) => e.preventDefault()}>Explore Recommendations →</a>
        <div className="psp-promoband__feats">
          <span className="psp-promofeat"><Icon name="sparkle" size={15} /> Early Access</span>
          <span className="psp-promofeat"><Icon name="heartHand" size={15} /> Premium Support</span>
          <span className="psp-promofeat"><Icon name="award" size={15} /> Member Rewards</span>
          <span className="psp-promofeat"><Icon name="tag" size={15} /> Special Offers</span>
        </div>
      </div>
      <div className="psp-promoband__card">
        <strong>SORA LIFE CLUB</strong>
        <p>You're a valued part of our wellness family.</p>
      </div>
    </div>
  );
}

function PromoCardWide() {
  return (
    <div className="psp-promocard-wide">
      <h3 className="serif">More Than a Purchase. It's a Relationship.</h3>
      <p>Sora Life Care is with you at every step of your wellness journey.</p>
      <div className="psp-promocard-wide__feats">
        <span className="psp-promofeat"><Icon name="users" size={15} /> Personalized Guidance</span>
        <span className="psp-promofeat"><Icon name="bell" size={15} /> Smart Reminders</span>
        <span className="psp-promofeat"><Icon name="chat" size={15} /> Priority Support</span>
        <span className="psp-promofeat"><Icon name="sparkle" size={15} /> Exclusive Benefits</span>
        <span className="psp-promofeat"><Icon name="award" size={15} /> Member Rewards</span>
      </div>
      <a href="#" className="btn btn-gold btn-outline" style={{ alignSelf: 'flex-start' }} onClick={(e) => e.preventDefault()}>Explore Sora Life Care →</a>
    </div>
  );
}
