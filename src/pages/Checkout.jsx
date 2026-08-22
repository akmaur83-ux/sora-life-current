import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Logo from '../components/Logo.jsx';
import OrderCelebration from '../components/OrderCelebration.jsx';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';

const STEPS = ['Contact', 'Shipping', 'Delivery', 'Payment'];
const DELIVERY = [
  { id: 'std', label: 'Standard', eta: '3–5 business days', price: 0, note: 'Free' },
  { id: 'exp', label: 'Express', eta: '1–2 business days', price: 79 },
  { id: 'sched', label: 'Scheduled', eta: 'Pick a date at doorstep', price: 49 },
];

export default function Checkout() {
  const { cartDetailed, subtotal, savings, dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState('std');
  const [pay, setPay] = useState('upi');
  const [placed, setPlaced] = useState(false);
  // Generated once when the order is placed. It used to be computed inline
  // during render, which meant any re-render (including the celebration's
  // own particle cleanup) silently produced a different order number.
  const [orderNo, setOrderNo] = useState(null);
  // Drives the one-time celebration. Added a frame after the confirmation
  // mounts and removed once the sequence is over, so the confirmation always
  // settles back to its plain, fully-visible, interactive base state.
  const [celebrate, setCelebrate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!placed) return;
    const raf = requestAnimationFrame(() => setCelebrate(true));
    const done = setTimeout(() => setCelebrate(false), 2400);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [placed]);

  const deliveryFee = DELIVERY.find((d) => d.id === delivery)?.price || 0;
  const shipBase = subtotal >= 699 ? 0 : deliveryFee;
  const total = Math.max(0, subtotal + shipBase);

  if (placed) {
    return (
      <div className="container section">
        <div className={`confirm confirm__enter ${celebrate ? 'confirm--celebrate' : ''}`}>
          <OrderCelebration />
          <span className="eyebrow confirm__reveal" style={{ '--d': '400ms' }}>Order confirmed</span>
          <h1 className="serif confirm__reveal" style={{ '--d': '480ms' }}>Thank you — your ritual is on its way.</h1>
          <p className="muted confirm__reveal" style={{ '--d': '550ms' }}>A confirmation has been sent to your email. Order <strong>#SORA-{orderNo}</strong>.</p>
          <div className="confirm__card confirm__reveal" style={{ '--d': '620ms' }}>
            <div className="confirm__row"><span>Estimated delivery</span><strong>{DELIVERY.find((d) => d.id === delivery)?.eta}</strong></div>
            <div className="confirm__row"><span>Total paid</span><strong>{money(total)}</strong></div>
            <div className="confirm__row"><span>Payment</span><strong>{pay === 'cod' ? 'Cash on delivery' : pay.toUpperCase()}</strong></div>
          </div>
          <div className="confirm__actions">
            <Link to="/account/orders" className="btn confirm__reveal confirm__reveal--btn" style={{ '--d': '700ms' }}>Track my order</Link>
            <Link to="/shop" className="btn btn-outline confirm__reveal confirm__reveal--btn" style={{ '--d': '780ms' }}>Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cartDetailed.length) {
    return (
      <div className="container section">
        <div className="state">
          <span className="state-ic"><Icon name="bag" size={32} /></span>
          <h3>Your cart is empty</h3>
          <p>Add a few essentials before checking out.</p>
          <Link to="/shop" className="btn">Browse products</Link>
        </div>
      </div>
    );
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const placeOrder = () => {
    setOrderNo(Math.floor(100000 + Math.random() * 900000));
    dispatch({ type: 'CLEAR_CART' });
    setPlaced(true);
    window.scrollTo(0, 0);
  };

  return (
    <div className="checkout">
      <div className="checkout__bar">
        <div className="container checkout__bar-in">
          <Logo />
          <span className="checkout__secure"><Icon name="lock" size={15} /> Secure checkout</span>
        </div>
      </div>

      <div className="container checkout__grid">
        <div className="checkout__main">
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li key={s} className={`stepper__item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <span className="stepper__num">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
                <span className="stepper__lbl">{s}</span>
              </li>
            ))}
          </ol>

          {/* Step content */}
          {step === 0 && (
            <section className="cform">
              <h2 className="serif">Contact information</h2>
              <p className="muted">We'll use this to send order updates. <Link to="/account" className="inline-link">Log in</Link> for faster checkout.</p>
              <div className="field"><label className="label">Email address</label><input className="input" type="email" placeholder="you@email.com" /></div>
              <div className="field"><label className="label">Phone number</label><input className="input" type="tel" placeholder="+91 98765 43210" /></div>
              <label className="check"><input type="checkbox" defaultChecked /><span className="check__box"><Icon name="check" size={13} /></span><span>Email me with news and offers</span></label>
              <button className="btn btn-lg" onClick={next}>Continue to shipping <Icon name="arrowRight" size={18} /></button>
            </section>
          )}

          {step === 1 && (
            <section className="cform">
              <h2 className="serif">Shipping address</h2>
              <div className="grid2">
                <div className="field"><label className="label">First name</label><input className="input" placeholder="First name" /></div>
                <div className="field"><label className="label">Last name</label><input className="input" placeholder="Last name" /></div>
              </div>
              <div className="field"><label className="label">Address</label><input className="input" placeholder="House no, street, area" /></div>
              <div className="field"><label className="label">Apartment, landmark (optional)</label><input className="input" placeholder="Apartment, landmark" /></div>
              <div className="grid3">
                <div className="field"><label className="label">City</label><input className="input" placeholder="City" /></div>
                <div className="field"><label className="label">State</label><input className="input" placeholder="State" /></div>
                <div className="field"><label className="label">PIN code</label><input className="input" placeholder="560001" /></div>
              </div>
              <div className="cform__nav">
                <button className="btn btn-ghost" onClick={() => setStep(0)}><Icon name="chevronLeft" size={18} /> Back</button>
                <button className="btn btn-lg" onClick={next}>Continue to delivery <Icon name="arrowRight" size={18} /></button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="cform">
              <h2 className="serif">Delivery method</h2>
              <div className="optlist">
                {DELIVERY.map((d) => (
                  <label key={d.id} className={`opt ${delivery === d.id ? 'active' : ''}`}>
                    <input type="radio" name="delivery" checked={delivery === d.id} onChange={() => setDelivery(d.id)} />
                    <span className="opt__radio" />
                    <span className="opt__body"><strong>{d.label}</strong><em>{d.eta}</em></span>
                    <span className="opt__price">{d.price === 0 ? 'Free' : money(d.price)}</span>
                  </label>
                ))}
              </div>
              <div className="cform__nav">
                <button className="btn btn-ghost" onClick={() => setStep(1)}><Icon name="chevronLeft" size={18} /> Back</button>
                <button className="btn btn-lg" onClick={next}>Continue to payment <Icon name="arrowRight" size={18} /></button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="cform">
              <h2 className="serif">Payment</h2>
              <p className="muted"><Icon name="lock" size={14} /> This is a design prototype — no real payment is processed.</p>
              <div className="optlist">
                {[['upi', 'UPI', 'Pay by any UPI app'], ['card', 'Card', 'Credit or debit card'], ['cod', 'Cash on delivery', 'Pay when it arrives']].map(([id, label, note]) => (
                  <label key={id} className={`opt ${pay === id ? 'active' : ''}`}>
                    <input type="radio" name="pay" checked={pay === id} onChange={() => setPay(id)} />
                    <span className="opt__radio" />
                    <span className="opt__body"><strong>{label}</strong><em>{note}</em></span>
                    <Icon name={id === 'cod' ? 'truck' : id === 'card' ? 'card' : 'phone'} size={20} />
                  </label>
                ))}
              </div>
              {pay === 'card' && (
                <div className="paycard">
                  <div className="field"><label className="label">Card number</label><input className="input" placeholder="•••• •••• •••• ••••" inputMode="numeric" /></div>
                  <div className="grid2">
                    <div className="field"><label className="label">Expiry</label><input className="input" placeholder="MM / YY" /></div>
                    <div className="field"><label className="label">CVV</label><input className="input" placeholder="•••" inputMode="numeric" /></div>
                  </div>
                </div>
              )}
              {pay === 'upi' && (
                <div className="paycard"><div className="field"><label className="label">UPI ID</label><input className="input" placeholder="yourname@upi" /></div></div>
              )}
              <div className="cform__nav">
                <button className="btn btn-ghost" onClick={() => setStep(2)}><Icon name="chevronLeft" size={18} /> Back</button>
                <button className="btn btn-accent btn-lg" onClick={placeOrder}><Icon name="lock" size={17} /> Place order · {money(total)}</button>
              </div>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="checkout__aside">
          <div className="summary">
            <h3>Order summary</h3>
            <div className="checkout__items">
              {cartDetailed.map((l) => (
                <div key={l.key} className="checkout__item">
                  <span className="checkout__thumb"><ProductImage product={l.product} /><i className="checkout__qty">{l.qty}</i></span>
                  <span className="checkout__meta"><strong>{l.product.name}</strong>{l.variant && <em>{l.variant}</em>}</span>
                  <span className="checkout__lp">{money(l.product.price * l.qty)}</span>
                </div>
              ))}
            </div>
            <dl className="summary__lines">
              <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              {savings > 0 && <div className="is-save"><dt>Savings</dt><dd>−{money(savings)}</dd></div>}
              <div><dt>Shipping</dt><dd>{shipBase === 0 ? <span className="free">Free</span> : money(shipBase)}</dd></div>
            </dl>
            <div className="summary__total"><span>Total</span><span className="serif">{money(total)}</span></div>
            <Link to="/cart" className="summary__continue">Edit cart</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
