import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Logo from '../components/Logo.jsx';
import OrderCelebration from '../components/OrderCelebration.jsx';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { loadRazorpayScript, createPaymentOrder, verifyPayment } from '../lib/payments.js';

const STEPS = ['Contact', 'Shipping', 'Delivery', 'Payment'];
const DELIVERY = [
  { id: 'std', label: 'Standard', eta: '3–5 business days', price: 0, note: 'Free' },
  { id: 'exp', label: 'Express', eta: '1–2 business days', price: 79 },
  { id: 'sched', label: 'Scheduled', eta: 'Pick a date at doorstep', price: 49 },
];

const EMPTY_FORM = {
  email: '', phone: '', firstName: '', lastName: '',
  address: '', apartment: '', landmark: '', city: '', state: '', pin: '',
};

export default function Checkout() {
  const { cart, cartDetailed, subtotal, savings, dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState('std');
  const [pay, setPay] = useState('online');
  // Controlled so the entered details survive moving between steps and a
  // cancelled payment (each step unmounts, so uncontrolled inputs would
  // lose their values), and so they can be sent with the order.
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const setField = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  // A physical-product store must have complete delivery details. These are
  // validated before the customer can leave each step, and again defensively
  // before payment. apartment + landmark stay optional.
  function validateContact() {
    const e = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function validateShipping() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.address.trim()) e.address = 'Enter your street address.';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.state.trim()) e.state = 'Required';
    if (!/^\d{6}$/.test(form.pin.trim())) e.pin = 'Enter a 6-digit PIN code.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  // Payment UX state
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState('');
  const [payNotice, setPayNotice] = useState('');
  // Synchronous in-flight lock. `processing` state (and the button's
  // disabled attribute) only take effect after a re-render, so several
  // clicks fired in the same tick would all slip past a state-based guard
  // and create duplicate orders. A ref flips immediately.
  const inFlight = useRef(false);
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
          <p className="muted confirm__reveal" style={{ '--d': '550ms' }}>A confirmation has been sent to your email. Order <strong>#{orderNo}</strong>.</p>
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
  // Reached ONLY after the server has confirmed the order is genuinely
  // paid (or is a recorded COD order). This is the single place the cart is
  // cleared and the confirmation/celebration is shown.
  const completeOrder = (orderNumber) => {
    inFlight.current = false;
    setOrderNo(orderNumber);
    dispatch({ type: 'CLEAR_CART' });
    setPlaced(true);
    window.scrollTo(0, 0);
  };

  const placeOrder = async () => {
    if (inFlight.current) return; // double-click / duplicate-submit guard
    // Defensive: never start a payment without complete delivery details,
    // even if the user somehow reached this step. Send them back to fix it.
    if (!validateShipping()) { setStep(1); return; }
    inFlight.current = true;
    setProcessing(true);
    setPayError('');
    setPayNotice('');

    try {
      // The server prices the cart itself; we only send ids + quantities.
      const created = await createPaymentOrder({
        items: cart,
        delivery,
        customer: form,
        paymentMethod: pay === 'cod' ? 'cod' : 'online',
      });

      if (created.paymentMethod === 'cod') {
        completeOrder(created.orderNumber);
        return;
      }

      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) {
        throw new Error('We could not load the payment window. Check your connection and try again.');
      }

      const rzp = new window.Razorpay({
        key: created.keyId,           // public key id, safe in the browser
        order_id: created.razorpayOrderId,
        amount: created.amountPaise,  // server-computed, in paise
        currency: created.currency,
        name: 'Sora Life',
        description: `Order ${created.orderNumber}`,
        theme: { color: '#1E3A2F' },
        prefill: {
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          contact: form.phone,
        },
        // Razorpay says the payment succeeded — but only our server decides.
        handler: async (response) => {
          try {
            const result = await verifyPayment(response);
            if (result?.verified) {
              completeOrder(result.orderNumber);
            } else {
              inFlight.current = false; setProcessing(false);
              setPayError('We could not verify this payment. Your order has not been placed.');
            }
          } catch (err) {
            inFlight.current = false; setProcessing(false);
            setPayError(err.message || 'We could not confirm your payment. Please contact support before paying again.');
          }
        },
        modal: {
          // User closed the Razorpay window: nothing is charged, nothing is
          // placed, and their cart and details are kept exactly as they were.
          ondismiss: () => {
            inFlight.current = false; setProcessing(false);
            setPayNotice('Payment cancelled. Your cart and details have been kept.');
          },
        },
      });

      rzp.on('payment.failed', (resp) => {
        inFlight.current = false; setProcessing(false);
        setPayError(
          resp?.error?.description
            ? `Payment wasn't completed: ${resp.error.description}`
            : "Payment wasn't completed. Your order has not been placed."
        );
      });

      rzp.open();
    } catch (err) {
      inFlight.current = false; setProcessing(false);
      setPayError(err.message || 'We could not start your payment. Please try again.');
    }
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
              <div className={`field ${errors.email ? 'field-error' : ''}`}><label className="label">Email address</label><input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={setField('email')} />{errors.email && <span className="error-text">{errors.email}</span>}</div>
              <div className={`field ${errors.phone ? 'field-error' : ''}`}><label className="label">Phone number</label><input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={setField('phone')} />{errors.phone && <span className="error-text">{errors.phone}</span>}</div>
              <label className="check"><input type="checkbox" defaultChecked /><span className="check__box"><Icon name="check" size={13} /></span><span>Email me with news and offers</span></label>
              <button className="btn btn-lg" onClick={() => validateContact() && next()}>Continue to shipping <Icon name="arrowRight" size={18} /></button>
            </section>
          )}

          {step === 1 && (
            <section className="cform">
              <h2 className="serif">Shipping address</h2>
              <p className="muted">We deliver physical products, so a complete address is required.</p>
              <div className="grid2">
                <div className={`field ${errors.firstName ? 'field-error' : ''}`}><label className="label">First name</label><input className="input" placeholder="First name" value={form.firstName} onChange={setField('firstName')} />{errors.firstName && <span className="error-text">{errors.firstName}</span>}</div>
                <div className={`field ${errors.lastName ? 'field-error' : ''}`}><label className="label">Last name</label><input className="input" placeholder="Last name" value={form.lastName} onChange={setField('lastName')} />{errors.lastName && <span className="error-text">{errors.lastName}</span>}</div>
              </div>
              <div className={`field ${errors.address ? 'field-error' : ''}`}><label className="label">Address</label><input className="input" placeholder="House no, street, area" value={form.address} onChange={setField('address')} />{errors.address && <span className="error-text">{errors.address}</span>}</div>
              <div className="field"><label className="label">Apartment, suite, etc. (optional)</label><input className="input" placeholder="Apartment, floor, unit" value={form.apartment} onChange={setField('apartment')} /></div>
              <div className="field"><label className="label">Landmark (optional)</label><input className="input" placeholder="Nearby landmark for the delivery agent" value={form.landmark} onChange={setField('landmark')} /></div>
              <div className="grid3">
                <div className={`field ${errors.city ? 'field-error' : ''}`}><label className="label">City</label><input className="input" placeholder="City" value={form.city} onChange={setField('city')} />{errors.city && <span className="error-text">{errors.city}</span>}</div>
                <div className={`field ${errors.state ? 'field-error' : ''}`}><label className="label">State</label><input className="input" placeholder="State" value={form.state} onChange={setField('state')} />{errors.state && <span className="error-text">{errors.state}</span>}</div>
                <div className={`field ${errors.pin ? 'field-error' : ''}`}><label className="label">PIN code</label><input className="input" placeholder="560001" inputMode="numeric" value={form.pin} onChange={setField('pin')} />{errors.pin && <span className="error-text">{errors.pin}</span>}</div>
              </div>
              <div className="cform__nav">
                <button className="btn btn-ghost" onClick={() => setStep(0)}><Icon name="chevronLeft" size={18} /> Back</button>
                <button className="btn btn-lg" onClick={() => validateShipping() && next()}>Continue to delivery <Icon name="arrowRight" size={18} /></button>
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
              <p className="muted"><Icon name="lock" size={14} /> Payments are processed securely by Razorpay. Sora Life never sees or stores your card details.</p>
              <div className="optlist">
                {[
                  ['online', 'Pay online', 'UPI, cards, net banking & wallets', 'card'],
                  ['cod', 'Cash on delivery', 'Pay when it arrives', 'truck'],
                ].map(([id, label, note, icon]) => (
                  <label key={id} className={`opt ${pay === id ? 'active' : ''}`}>
                    <input type="radio" name="pay" checked={pay === id} onChange={() => setPay(id)} disabled={processing} />
                    <span className="opt__radio" />
                    <span className="opt__body"><strong>{label}</strong><em>{note}</em></span>
                    <Icon name={icon} size={20} />
                  </label>
                ))}
              </div>

              {payError && (
                <div className="paystate paystate--error">
                  <strong>Payment wasn't completed</strong>
                  <p>{payError}</p>
                  <p className="muted">Your order has not been placed and your cart has been kept.</p>
                  <div className="paystate__actions">
                    <button className="btn btn-sm" onClick={placeOrder} disabled={processing}>Try again</button>
                    <Link to="/cart" className="btn btn-sm btn-outline">Back to cart</Link>
                  </div>
                </div>
              )}
              {payNotice && !payError && (
                <div className="paystate paystate--notice">
                  <strong>Payment cancelled</strong>
                  <p>{payNotice}</p>
                </div>
              )}

              <div className="cform__nav">
                <button className="btn btn-ghost" onClick={() => setStep(2)} disabled={processing}><Icon name="chevronLeft" size={18} /> Back</button>
                <button className="btn btn-accent btn-lg" onClick={placeOrder} disabled={processing}>
                  {processing
                    ? <><span className="spinner" /> Processing…</>
                    : pay === 'cod'
                      ? <><Icon name="lock" size={17} /> Place order · {money(total)}</>
                      : <><Icon name="lock" size={17} /> Pay {money(total)}</>}
                </button>
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
