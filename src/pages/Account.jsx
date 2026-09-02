import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { useStore } from '../lib/store.jsx';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import CreatorOnboarding from './account/CreatorOnboarding.jsx';
import { supabase } from '../lib/supabase.js';
import { listAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '../lib/customerData.js';
import { enabledOAuthProviders, signInWithProvider, PROVIDER_LABELS } from '../lib/oauth.js';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../lib/authRecovery.js';
import { products, productById } from '../data/products.js';
import { money } from '../lib/format.js';
import { fulfillmentStatusLabel, safeTrackingUrl } from '../lib/orderFulfillment.js';

// Format an ISO timestamp the same way the rest of the app does (en-IN).
function fmtOrderDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

// A human payment/order status label derived only from real order columns.
function orderStatusLabel(o) {
  if (o.status === 'cancelled') return 'Cancelled';
  if (o.payment_status === 'failed') return 'Payment failed';
  if (o.payment_status === 'paid') return 'Paid';
  if (o.payment_method === 'cod') return 'Order placed · COD';
  return 'Pending payment';
}

// The order line stores biosash_id (catalogue key) or product_id (numeric
// DB id); the storefront catalogue is keyed by biosash_id || id.
function productForLine(line) {
  const key = line?.biosash_id ?? line?.product_id;
  return key != null ? productById[key] : undefined;
}

const NAV = [
  { id: 'orders', label: 'My orders', icon: 'package' },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart' },
  { id: 'addresses', label: 'Addresses', icon: 'mapPin' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'creator', label: 'Creator Program', icon: 'award' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Account() {
  const { tab = 'orders' } = useParams();
  const navigate = useNavigate();
  const { session, user, loading, signOut, recovery } = useCustomerAuth();
  const { wishlist } = useStore();

  // While the persisted session is being resolved, avoid flashing the
  // sign-in screen before the panel (or vice-versa).
  if (loading) {
    return (
      <div className="container section-sm" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <p className="muted">Loading your account…</p>
      </div>
    );
  }

  // A password-recovery landing takes priority over everything else. The
  // recovery link produces an ordinary signed-in session, so without this the
  // customer would land on their account with no way to actually set a new
  // password — which is exactly what the reset email invited them to do.
  if (recovery) return <SetNewPasswordView />;

  // Self-gated inline: no real session → show the sign-in / sign-up card.
  if (!session) return <AuthView />;

  const firstName =
    user?.user_metadata?.full_name?.trim().split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there';

  return (
    <>
      <div className="pagehead"><div className="container">
        <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Account</span></nav>
        <h1 className="serif">Hi, {firstName} 👋</h1>
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
            <button className="acct__navitem acct__logout" onClick={() => signOut()}><Icon name="logout" size={19} /> Log out</button>
          </aside>

          <div className="acct__panel">
            {tab === 'orders' && <Orders />}
            {tab === 'wishlist' && <WishTab wishlist={wishlist} />}
            {tab === 'addresses' && <Addresses />}
            {tab === 'profile' && <Profile />}
            {tab === 'creator' && <CreatorOnboarding />}
            {tab === 'settings' && <Settings />}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The landing a customer reaches from the "reset your password" email.
 *
 * Shown INSTEAD of the account panel while a recovery is in progress, so the
 * only available action is choosing a new password. On success the recovery
 * gate clears and <Account/> re-renders straight into the normal signed-in
 * account — no second login required, because the recovery session is real.
 */
function SetNewPasswordView() {
  const { updatePassword, clearRecovery, signOut } = useCustomerAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validateNewPassword(password, confirm);
    if (invalid) { setError(invalid); return; }

    setBusy(true); setError('');
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err.message || 'We could not update your password. Please request a new reset link.');
        return;
      }
      setDone(true);
      // The recovery fragment has served its purpose; leaving it in the URL
      // means a refresh re-enters this screen.
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (ex) {
      setError(ex.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__art">
        <div className="auth__art-in">
          <span className="eyebrow" style={{ color: 'var(--honey-300)' }}>Sora Life members</span>
          <h2 className="serif" style={{ color: '#FBF8F1', fontSize: 'var(--text-3xl)', margin: '12px 0' }}>Choose a new password.</h2>
          <p style={{ color: 'rgba(251,248,241,0.82)' }}>Pick something you don’t use anywhere else. You’ll stay signed in on this device.</p>
        </div>
      </div>

      <div className="auth__form">
        <div className="auth__card">
          <h3 className="serif" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>Set a new password</h3>

          {done ? (
            <>
              <p role="status" style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--text-sm)', color: 'var(--color-success)', background: 'var(--forest-50)', padding: '10px 12px', borderRadius: 'var(--r-md)' }}>
                Your password has been updated.
              </p>
              <button className="btn btn-lg btn-block" type="button" onClick={clearRecovery}>Go to my account</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field"><label className="label">New password</label>
                <input className="input" type="password" autoComplete="new-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} /></div>
              <div className="field"><label className="label">Confirm new password</label>
                <input className="input" type="password" autoComplete="new-password" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} /></div>
              <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>At least {MIN_PASSWORD_LENGTH} characters.</p>
              {error && <p className="error-text" role="alert" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>}
              <button className="btn btn-lg btn-block" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}

          {!done && (
            <p className="auth__guest">
              <button type="button" onClick={async () => { await signOut(); clearRecovery(); }}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>
                ← Cancel and log in instead
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthView() {
  const { signIn, signUp, resetPassword } = useCustomerAuth();
  // 'login' | 'signup' | 'forgot'. The two tabs cover login/signup; the
  // "Forgot password?" link switches into the forgot sub-view.
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Fixed for the life of the build — no need to recompute per render.
  const [socialProviders] = useState(() => enabledOAuthProviders());

  const switchMode = (m) => { setMode(m); setError(''); setInfo(''); };

  const startOAuth = async (provider) => {
    if (busy) return;
    setBusy(true); setError('');
    // On success the browser navigates away to the provider, so `busy` is
    // only reset when the flow could not start at all.
    const { error: err } = await signInWithProvider(provider);
    if (err) { setError(err.message || 'Could not start that sign-in. Please try again.'); setBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'login') {
        const { error: err } = await signIn({ email, password });
        // On success the provider's session updates and <Account/>
        // re-renders straight to the panel — nothing more to do here.
        if (err) setError(err.message || 'Could not log in. Check your details and try again.');
      } else if (mode === 'signup') {
        const { error: err, needsConfirmation } = await signUp({ email, password, fullName });
        if (err) setError(err.message || 'Could not create your account. Please try again.');
        else if (needsConfirmation) setInfo('Almost there — check your email to confirm your account, then log in.');
      } else {
        const { error: err } = await resetPassword(email);
        // The SAME answer either way. Surfacing Supabase's error here would
        // turn this form into an account-enumeration oracle: "user not
        // found" versus a silent success tells an attacker which addresses
        // are registered. Real faults are logged, never shown.
        if (err) console.warn('[auth] reset request failed:', err.message);
        setInfo('If an account exists for that email, a password reset link is on its way.');
      }
    } catch (ex) {
      setError(ex.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Create account' : 'Log in';

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
          {mode !== 'forgot' ? (
            <div className="auth__tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Create account</button>
            </div>
          ) : (
            <h3 className="serif" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>{heading}</h3>
          )}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <div className="field"><label className="label">Full name</label>
                <input className="input" placeholder="Your name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            )}
            <div className="field"><label className="label">Email</label>
              <input className="input" type="email" placeholder="you@email.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            {mode !== 'forgot' && (
              <div className="field"><label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            )}
            {mode === 'login' && (
              <button type="button" className="auth__forgot" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => switchMode('forgot')}>Forgot password?</button>
            )}
            {mode === 'forgot' && (
              <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>Enter your email and we'll send you a link to reset your password.</p>
            )}
            {error && <p className="error-text" role="alert" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>}
            {info && <p role="status" style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--color-success)', background: 'var(--forest-50)', padding: '10px 12px', borderRadius: 'var(--r-md)' }}>{info}</p>}
            <button className="btn btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : (mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link')}
            </button>
          </form>

          {mode === 'forgot' ? (
            <p className="auth__guest">
              <button type="button" onClick={() => switchMode('login')} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>← Back to log in</button>
            </p>
          ) : (
            <>
              {/* Social buttons render ONLY for providers this build has
                  opted into (VITE_OAUTH_PROVIDERS), because a provider works
                  only once it is configured in the Supabase Dashboard. The
                  previous permanently-disabled "Coming soon" buttons
                  advertised sign-in methods that did not exist. */}
              {socialProviders.length > 0 && (
                <>
                  <div className="auth__or"><span>or</span></div>
                  <div className="auth__social">
                    {socialProviders.map((provider) => (
                      <button key={provider} type="button" className="btn btn-light btn-block"
                        disabled={busy} onClick={() => startOAuth(provider)}>
                        {PROVIDER_LABELS[provider]}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="auth__guest"><Link to="/shop">Continue as guest →</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState(null); // null = loading, [] = none
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS ("orders customer read") scopes this to the signed-in user's
      // own orders automatically — we never filter by email and never see
      // anyone else's rows. Only the columns My Orders renders are selected.
      const { data, error: err } = await supabase
        .from('orders')
        .select('order_number, created_at, status, payment_status, payment_method, amount_paise, items, fulfillment_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) { setError('We could not load your orders right now.'); setOrders([]); return; }
      setOrders(Array.isArray(data) ? data : []);
    })();
    return () => { cancelled = true; };
  }, []);

  if (orders === null) {
    return (
      <div>
        <h2 className="serif acct__h">My orders</h2>
        <p className="muted" style={{ padding: 'var(--sp-6) 0' }}>Loading your orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="serif acct__h">My orders</h2>
        <p className="error-text" role="alert" style={{ padding: 'var(--sp-4) 0' }}>{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyPanel icon="package" title="No orders yet" text="When you place an order, its verified status will appear here." cta="/shop" ctaLabel="Start shopping" />;
  }

  return (
    <div>
      <h2 className="serif acct__h">My orders</h2>
      <div className="orderlist">
        {orders.map((o) => {
          const items = Array.isArray(o.items) ? o.items : [];
          const count = items.reduce((n, l) => n + (Number(l?.qty) || 0), 0) || items.length;
          const isPaid = o.payment_status === 'paid';
          const fulfillmentLabel = fulfillmentStatusLabel(o.fulfillment_status);
          const trackingUrl = safeTrackingUrl(o.tracking_url);
          return (
            <div key={o.order_number} className="ordercard">
              <div className="ordercard__head">
                <div><strong>{o.order_number}</strong><span className="muted"> · {fmtOrderDate(o.created_at)}</span></div>
                <span className={`badge ${isPaid ? 'badge-best' : ''}`}>{orderStatusLabel(o)}</span>
              </div>
              <div className="ordercard__body">
                <div className="ordercard__thumbs">
                  {items.slice(0, 4).map((l, i) => (
                    <span key={`${o.order_number}-${i}`} className="ordercard__thumb"><ProductImage product={productForLine(l)} /></span>
                  ))}
                </div>
                <div className="ordercard__meta">
                  <span className="muted">{count} item{count === 1 ? '' : 's'}</span>
                  <strong>{money((Number(o.amount_paise) || 0) / 100)}</strong>
                  {fulfillmentLabel && <span className="muted">{fulfillmentLabel}</span>}
                </div>
                <div className="ordercard__actions">
                  {/* Real order number → both views resolve it for the
                      authenticated owner via RLS. Never a mock id. */}
                  <Link to={`/invoice/${o.order_number}`} className="btn btn-sm">
                    <Icon name="card" size={15} /> View Invoice
                  </Link>
                  <Link to={`/passport/${o.order_number}`} className="btn btn-sm btn-light btn-goldhover">View Passport</Link>
                  {trackingUrl && (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light">
                      Track shipment <Icon name="externalLink" size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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

const EMPTY_ADDR = {
  label: '', firstName: '', lastName: '', phone: '',
  address: '', apartment: '', landmark: '', city: '', state: '', pin: '', isDefault: false,
};

// Map a customerData error to a message the customer can act on.
function friendlyAddrError(err) {
  if (err?.code === 'AUTH_REQUIRED') return 'Please sign in again to manage addresses.';
  if (err?.code === 'NOT_FOUND') return 'That address no longer exists.';
  if (err?.code === 'BAD_REQUEST') return err.message;
  return 'Something went wrong. Please try again.';
}

function addressLines(a) {
  const cityLine = [a.city, a.state].filter(Boolean).join(', ');
  const cityPin = [cityLine, a.pin].filter(Boolean).join(' - ');
  return [a.address, a.apartment, a.landmark, cityPin].filter(Boolean);
}

function Addresses() {
  const { toast } = useStore();
  const [list, setList] = useState(null);       // null = loading, [] = none
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState(null);        // null | 'add' | <addressId> (editing)
  const [form, setForm] = useState(EMPTY_ADDR);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);       // disables buttons during any write
  const [confirmDelete, setConfirmDelete] = useState(null); // address id pending delete
  const submitting = useRef(false);              // synchronous double-submit guard

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setList(await listAddresses());
    } catch {
      setLoadError('We could not load your addresses. Please try again.');
      setList([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_ADDR); setFormError(''); setConfirmDelete(null); setMode('add'); };
  const openEdit = (a) => {
    setForm({
      label: a.label || '', firstName: a.first_name || '', lastName: a.last_name || '',
      phone: a.phone || '', address: a.address || '', apartment: a.apartment || '',
      landmark: a.landmark || '', city: a.city || '', state: a.state || '', pin: a.pin || '',
      isDefault: !!a.is_default,
    });
    setFormError(''); setConfirmDelete(null); setMode(a.id);
  };
  const closeForm = () => { setMode(null); setFormError(''); };
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!form.firstName.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim()) {
      setFormError('Please fill in name, address, city and state.'); return;
    }
    if (!/^\d{6}$/.test(form.pin.trim())) { setFormError('Enter a valid 6-digit PIN code.'); return; }
    submitting.current = true; setBusy(true); setFormError('');
    try {
      if (mode === 'add') {
        await createAddress(form);            // handles isDefault internally
        toast('Address added');
      } else {
        await updateAddress(mode, form);
        if (form.isDefault) await setDefaultAddress(mode); // updateAddress ignores is_default
        toast('Address updated');
      }
      await load();
      setMode(null);
    } catch (err) {
      setFormError(friendlyAddrError(err));
    } finally {
      submitting.current = false; setBusy(false);
    }
  };

  const makeDefault = async (id) => {
    if (busy) return;
    setBusy(true);
    try { await setDefaultAddress(id); await load(); toast('Default address updated'); }
    catch (err) { toast(friendlyAddrError(err)); }
    finally { setBusy(false); }
  };

  const doDelete = async (id) => {
    if (busy) return;
    setBusy(true);
    try { await deleteAddress(id); await load(); toast('Address removed'); }
    catch (err) { toast(friendlyAddrError(err)); }
    finally { setBusy(false); setConfirmDelete(null); }
  };

  const formOpen = mode !== null;

  return (
    <div>
      <div className="acct__panelhead">
        <h2 className="serif acct__h">Saved addresses</h2>
        {!formOpen && (
          <button className="btn btn-sm" onClick={openAdd}><Icon name="plus" size={16} /> Add new</button>
        )}
      </div>

      {formOpen && (
        <form className="surface pad-lg" onSubmit={submit} style={{ marginBottom: 'var(--sp-5)' }}>
          <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sp-4)' }}>{mode === 'add' ? 'Add a new address' : 'Edit address'}</h3>
          <div className="field"><label className="label">Label (optional)</label>
            <input className="input" placeholder="Home / Work / Other" value={form.label} onChange={setField('label')} /></div>
          <div className="grid2">
            <div className="field"><label className="label">First name</label>
              <input className="input" placeholder="First name" value={form.firstName} onChange={setField('firstName')} /></div>
            <div className="field"><label className="label">Last name</label>
              <input className="input" placeholder="Last name" value={form.lastName} onChange={setField('lastName')} /></div>
          </div>
          <div className="field"><label className="label">Phone</label>
            <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={setField('phone')} /></div>
          <div className="field"><label className="label">Address</label>
            <input className="input" placeholder="House no, street, area" value={form.address} onChange={setField('address')} /></div>
          <div className="field"><label className="label">Apartment, suite, etc. (optional)</label>
            <input className="input" placeholder="Apartment, floor, unit" value={form.apartment} onChange={setField('apartment')} /></div>
          <div className="field"><label className="label">Landmark (optional)</label>
            <input className="input" placeholder="Nearby landmark" value={form.landmark} onChange={setField('landmark')} /></div>
          <div className="grid3">
            <div className="field"><label className="label">City</label>
              <input className="input" placeholder="City" value={form.city} onChange={setField('city')} /></div>
            <div className="field"><label className="label">State</label>
              <input className="input" placeholder="State" value={form.state} onChange={setField('state')} /></div>
            <div className="field"><label className="label">PIN code</label>
              <input className="input" inputMode="numeric" placeholder="560001" value={form.pin} onChange={setField('pin')} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
            <span>Set as default address</span>
          </label>
          {formError && <p className="error-text" role="alert" style={{ marginBottom: 'var(--sp-3)' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : (mode === 'add' ? 'Save address' : 'Save changes')}</button>
            <button className="btn btn-ghost" type="button" onClick={closeForm} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {list === null ? (
        <p className="muted" style={{ padding: 'var(--sp-4) 0' }}>Loading your addresses…</p>
      ) : loadError ? (
        <p className="error-text" role="alert" style={{ padding: 'var(--sp-4) 0' }}>{loadError}</p>
      ) : list.length === 0 && !formOpen ? (
        <div className="state" style={{ padding: 'var(--sp-12) var(--sp-4)' }}>
          <span className="state-ic"><Icon name="mapPin" size={30} /></span>
          <h3>No saved addresses yet</h3><p>Add an address to check out faster next time.</p>
          <button className="btn" onClick={openAdd}><Icon name="plus" size={16} /> Add address</button>
        </div>
      ) : (
        <div className="addrgrid">
          {list.map((a) => {
            const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Address';
            const pendingDelete = confirmDelete === a.id;
            return (
              <div key={a.id} className={`addrcard ${a.is_default ? 'default' : ''}`}>
                {a.is_default && <span className="badge badge-best">Default</span>}
                {a.label && <span className="hint" style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{a.label}</span>}
                <strong>{name}</strong>
                <p className="muted">
                  {addressLines(a).map((ln, i) => <span key={i}>{ln}<br /></span>)}
                  {a.phone && <span>{a.phone}</span>}
                </p>
                {pendingDelete ? (
                  <div className="addrcard__actions">
                    <span className="hint" style={{ marginRight: 'auto' }}>Delete this address?</span>
                    <button className="linkbtn linkbtn--danger" onClick={() => doDelete(a.id)} disabled={busy}>Yes, delete</button>
                    <button className="linkbtn" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</button>
                  </div>
                ) : (
                  <div className="addrcard__actions">
                    <button className="linkbtn" onClick={() => openEdit(a)} disabled={busy}>Edit</button>
                    {!a.is_default && <button className="linkbtn" onClick={() => makeDefault(a.id)} disabled={busy}>Set as default</button>}
                    <button className="linkbtn linkbtn--danger" onClick={() => setConfirmDelete(a.id)} disabled={busy}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
