import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { useStore } from '../lib/store.jsx';
import { products, productById } from '../data/products.js';
import { money } from '../lib/format.js';

const ORDERS = [
  { id: 'SORA-582104', date: '18 Aug 2026', status: 'Out for delivery', total: 1847, items: ['sk-vitc', 'nt-protein'], step: 2 },
  { id: 'SORA-573998', date: '02 Aug 2026', status: 'Delivered', total: 848, items: ['hc-argan', 'pc-neemsoap'], step: 3 },
  { id: 'SORA-560771', date: '21 Jul 2026', status: 'Delivered', total: 549, items: ['hw-ashwa'], step: 3 },
];
const TRACK = ['Order placed', 'Packed', 'Out for delivery', 'Delivered'];

const NAV = [
  { id: 'orders', label: 'My orders', icon: 'package' },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart' },
  { id: 'addresses', label: 'Addresses', icon: 'mapPin' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Account() {
  const { tab = 'orders' } = useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState('login');
  const { wishlist } = useStore();

  if (!authed) return <AuthView mode={mode} setMode={setMode} onAuth={() => setAuthed(true)} />;

  return (
    <>
      <div className="pagehead"><div className="container">
        <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Account</span></nav>
        <h1 className="serif">Hi, Aditi 👋</h1>
        <p className="muted">Welcome back to your Sora Life account.</p>
      </div></div>

      <div className="container section-sm" style={{ paddingTop: 'var(--sp-8)' }}>
        <div className="acct">
          <aside className="acct__nav">
            {NAV.map((n) => (
              <button key={n.id} className={`acct__navitem ${tab === n.id ? 'active' : ''}`} onClick={() => navigate(`/account/${n.id}`)}>
                <Icon name={n.icon} size={19} /> {n.label}
                {n.id === 'wishlist' && wishlist.length > 0 && <span className="acct__badge">{wishlist.length}</span>}
              </button>
            ))}
            <button className="acct__navitem acct__logout" onClick={() => setAuthed(false)}><Icon name="logout" size={19} /> Log out</button>
          </aside>

          <div className="acct__panel">
            {tab === 'orders' && <Orders />}
            {tab === 'wishlist' && <WishTab wishlist={wishlist} />}
            {tab === 'addresses' && <Addresses />}
            {tab === 'profile' && <Profile />}
            {tab === 'settings' && <Settings />}
          </div>
        </div>
      </div>
    </>
  );
}

function AuthView({ mode, setMode, onAuth }) {
  return (
    <div className="auth">
      <div className="auth__art">
        <div className="auth__art-in">
          <span className="eyebrow" style={{ color: 'var(--honey-300)' }}>Sora Life members</span>
          <h2 className="serif" style={{ color: '#FBF8F1', fontSize: 'var(--text-3xl)', margin: '12px 0' }}>Your rituals, remembered.</h2>
          <p style={{ color: 'rgba(251,248,241,0.82)' }}>Save favourites, track orders, reorder in a tap and unlock members-only drops.</p>
          <ul className="auth__perks">
            <li><Icon name="check" size={17} /> Faster, saved checkout</li>
            <li><Icon name="check" size={17} /> Order tracking &amp; history</li>
            <li><Icon name="check" size={17} /> Early access to new launches</li>
          </ul>
        </div>
      </div>

      <div className="auth__form">
        <div className="auth__card">
          <div className="auth__tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onAuth(); }}>
            {mode === 'signup' && (
              <div className="field"><label className="label">Full name</label><input className="input" placeholder="Your name" required /></div>
            )}
            <div className="field"><label className="label">Email</label><input className="input" type="email" placeholder="you@email.com" required /></div>
            <div className="field"><label className="label">Password</label><input className="input" type="password" placeholder="••••••••" required /></div>
            {mode === 'login' && <a href="#" className="auth__forgot">Forgot password?</a>}
            <button className="btn btn-lg btn-block" type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>

          <div className="auth__or"><span>or</span></div>
          <div className="auth__social">
            <button className="btn btn-light btn-block" onClick={onAuth}>Continue with Google</button>
            <button className="btn btn-light btn-block" onClick={onAuth}>Continue with Apple</button>
          </div>
          <p className="auth__guest"><Link to="/shop">Continue as guest →</Link></p>
        </div>
      </div>
    </div>
  );
}

function Orders() {
  const [track, setTrack] = useState(null);
  return (
    <div>
      <h2 className="serif acct__h">My orders</h2>
      <div className="orderlist">
        {ORDERS.map((o) => (
          <div key={o.id} className="ordercard">
            <div className="ordercard__head">
              <div><strong>{o.id}</strong><span className="muted"> · {o.date}</span></div>
              <span className={`badge ${o.status === 'Delivered' ? '' : 'badge-best'}`}>{o.status}</span>
            </div>
            <div className="ordercard__body">
              <div className="ordercard__thumbs">
                {o.items.map((id) => <span key={id} className="ordercard__thumb"><ProductImage product={productById[id]} /></span>)}
              </div>
              <div className="ordercard__meta">
                <span className="muted">{o.items.length} item{o.items.length > 1 ? 's' : ''}</span>
                <strong>{money(o.total)}</strong>
              </div>
              <div className="ordercard__actions">
                <button className="btn btn-sm btn-light" onClick={() => setTrack(track === o.id ? null : o.id)}>{track === o.id ? 'Hide tracking' : 'Track order'}</button>
                <button className="btn btn-sm btn-ghost">Reorder</button>
                <Link to={`/passport/${o.id}`} className="btn btn-sm btn-ghost">View Passport</Link>
              </div>
            </div>
            {track === o.id && (
              <div className="track">
                {TRACK.map((t, i) => (
                  <div key={t} className={`track__step ${i <= o.step ? 'done' : ''}`}>
                    <span className="track__dot">{i <= o.step ? <Icon name="check" size={12} /> : ''}</span>
                    <span className="track__lbl">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WishTab({ wishlist }) {
  const items = wishlist.map((id) => productById[id]).filter(Boolean);
  if (!items.length) return <EmptyPanel icon="heart" title="No saved items yet" text="Tap the heart on any product to save it here." cta="/shop" ctaLabel="Explore products" />;
  return (
    <div>
      <h2 className="serif acct__h">Wishlist ({items.length})</h2>
      <div className="acct__wishgrid">
        {items.map((p) => (
          <Link key={p.id} to={`/product/${p.slug}`} className="acct__wishcard">
            <ProductImage product={p} />
            <span className="acct__wishname">{p.name}</span>
            <span className="price"><span className="now" style={{ fontSize: 'var(--text-md)' }}>{money(p.price)}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Addresses() {
  const addrs = [
    { id: 1, name: 'Aditi Sharma', line: '204, Rosewood Residency, Indiranagar', city: 'Bengaluru 560038', phone: '+91 98765 43210', default: true },
    { id: 2, name: 'Aditi Sharma (Work)', line: 'WeWork Prestige, MG Road', city: 'Bengaluru 560001', phone: '+91 98765 43210', default: false },
  ];
  return (
    <div>
      <div className="acct__panelhead"><h2 className="serif acct__h">Saved addresses</h2><button className="btn btn-sm"><Icon name="plus" size={16} /> Add new</button></div>
      <div className="addrgrid">
        {addrs.map((a) => (
          <div key={a.id} className={`addrcard ${a.default ? 'default' : ''}`}>
            {a.default && <span className="badge badge-best">Default</span>}
            <strong>{a.name}</strong>
            <p className="muted">{a.line}<br />{a.city}<br />{a.phone}</p>
            <div className="addrcard__actions"><button className="linkbtn">Edit</button><button className="linkbtn linkbtn--danger">Remove</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profile() {
  return (
    <div>
      <h2 className="serif acct__h">Profile</h2>
      <div className="surface pad-lg" style={{ maxWidth: 560 }}>
        <div className="grid2">
          <div className="field"><label className="label">First name</label><input className="input" defaultValue="Aditi" /></div>
          <div className="field"><label className="label">Last name</label><input className="input" defaultValue="Sharma" /></div>
        </div>
        <div className="field"><label className="label">Email</label><input className="input" type="email" defaultValue="aditi@email.com" /></div>
        <div className="field"><label className="label">Phone</label><input className="input" type="tel" defaultValue="+91 98765 43210" /></div>
        <button className="btn" style={{ marginTop: 8 }}>Save changes</button>
      </div>
    </div>
  );
}

function Settings() {
  const rows = [
    ['Order updates', 'Delivery and shipping notifications', true],
    ['New launches', 'Be first to know about new products', true],
    ['Offers & promotions', 'Occasional deals and member perks', false],
    ['SMS updates', 'Get order texts on your phone', false],
  ];
  return (
    <div>
      <h2 className="serif acct__h">Settings</h2>
      <div className="surface pad-lg" style={{ maxWidth: 620 }}>
        <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 12 }}>Notifications</h3>
        {rows.map(([t, s, on]) => (
          <label key={t} className="toggle-row">
            <span><strong>{t}</strong><em>{s}</em></span>
            <span className={`switch ${on ? 'on' : ''}`}><i /></span>
          </label>
        ))}
        <hr className="hr" style={{ margin: '20px 0' }} />
        <button className="linkbtn linkbtn--danger"><Icon name="trash" size={15} /> Delete account</button>
      </div>
    </div>
  );
}

function EmptyPanel({ icon, title, text, cta, ctaLabel }) {
  return (
    <div className="state" style={{ padding: 'var(--sp-12) var(--sp-4)' }}>
      <span className="state-ic"><Icon name={icon} size={30} /></span>
      <h3>{title}</h3><p>{text}</p>
      <Link to={cta} className="btn">{ctaLabel}</Link>
    </div>
  );
}
