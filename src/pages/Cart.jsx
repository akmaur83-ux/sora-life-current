import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { getBestsellers } from '../data/products.js';

const COUPONS = { SORA10: 0.1, WELCOME: 0.15 };

export default function Cart() {
  const { cartDetailed, savedDetailed, dispatch, subtotal, savings, toast } = useStore();
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(null);
  const [couponErr, setCouponErr] = useState('');

  const applyCoupon = (e) => {
    e.preventDefault();
    const code = coupon.trim().toUpperCase();
    if (COUPONS[code]) { setApplied({ code, rate: COUPONS[code] }); setCouponErr(''); toast(`Coupon ${code} applied`); }
    else { setApplied(null); setCouponErr('That code is not valid.'); }
  };

  const discount = applied ? Math.round(subtotal * applied.rate) : 0;
  const shipping = subtotal === 0 ? 0 : subtotal - discount >= 699 ? 0 : 49;
  const total = Math.max(0, subtotal - discount + shipping);

  if (!cartDetailed.length) {
    return (
      <div className="container section">
        <div className="state">
          <span className="state-ic"><Icon name="bag" size={32} /></span>
          <h3>Your cart is empty</h3>
          <p>Looks like you haven't added anything yet. Let's fix that.</p>
          <Link to="/shop" className="btn">Start shopping <Icon name="arrowRight" size={18} /></Link>
        </div>
        {savedDetailed.length > 0 && <SavedList saved={savedDetailed} dispatch={dispatch} />}
      </div>
    );
  }

  return (
    <>
      <div className="pagehead"><div className="container">
        <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Cart</span></nav>
        <h1 className="serif">Your cart</h1>
        <p className="muted">{cartDetailed.length} {cartDetailed.length === 1 ? 'item' : 'items'} ready for a healthier routine.</p>
      </div></div>

      <div className="container section-sm" style={{ paddingTop: 'var(--sp-8)' }}>
        <div className="cartlayout">
          <div className="cartlayout__main">
            <div className="cartlist">
              {cartDetailed.map((l) => (
                <div key={l.key} className="cartrow">
                  <Link to={`/product/${l.product.slug}`} className="cartrow__media"><ProductImage product={l.product} /></Link>
                  <div className="cartrow__info">
                    <div className="cartrow__top">
                      <div>
                        <Link to={`/product/${l.product.slug}`} className="cartrow__name serif">{l.product.name}</Link>
                        {l.variant && <span className="cartrow__variant">{l.variant}</span>}
                        <span className="cartrow__form muted">{l.product.form}</span>
                      </div>
                      <div className="cartrow__price">{money(l.product.price * l.qty)}
                        {l.product.mrp > l.product.price && <s>{money(l.product.mrp * l.qty)}</s>}
                      </div>
                    </div>
                    <div className="cartrow__actions">
                      <div className="qty qty--sm">
                        <button onClick={() => dispatch({ type: 'SET_QTY', key: l.key, qty: l.qty - 1 })} aria-label="Decrease"><Icon name="minus" size={15} /></button>
                        <span>{l.qty}</span>
                        <button onClick={() => dispatch({ type: 'SET_QTY', key: l.key, qty: l.qty + 1 })} aria-label="Increase"><Icon name="plus" size={15} /></button>
                      </div>
                      <button className="linkbtn" onClick={() => dispatch({ type: 'SAVE_LATER', key: l.key })}><Icon name="heart" size={15} /> Save for later</button>
                      <button className="linkbtn linkbtn--danger" onClick={() => dispatch({ type: 'REMOVE', key: l.key })}><Icon name="trash" size={15} /> Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {savedDetailed.length > 0 && <SavedList saved={savedDetailed} dispatch={dispatch} inline />}
          </div>

          {/* Summary */}
          <aside className="cartlayout__aside">
            <div className="summary">
              <h3>Order summary</h3>
              <form className="summary__coupon" onSubmit={applyCoupon}>
                <div className="searchbox" style={{ flex: 1 }}>
                  <Icon name="tag" />
                  <input className="input" placeholder="Coupon code (try SORA10)" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                </div>
                <button className="btn btn-light" type="submit">Apply</button>
              </form>
              {couponErr && <p className="error-text">{couponErr}</p>}
              {applied && <p className="summary__applied"><Icon name="checkCircle" size={15} /> {applied.code} — {applied.rate * 100}% off</p>}

              <dl className="summary__lines">
                <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
                {savings > 0 && <div className="is-save"><dt>Product savings</dt><dd>−{money(savings)}</dd></div>}
                {discount > 0 && <div className="is-save"><dt>Coupon ({applied.code})</dt><dd>−{money(discount)}</dd></div>}
                <div><dt>Shipping</dt><dd>{shipping === 0 ? <span className="free">Free</span> : money(shipping)}</dd></div>
              </dl>
              {shipping > 0 && <p className="summary__ship-hint"><Icon name="truck" size={15} /> Add {money(699 - (subtotal - discount))} more for free delivery</p>}
              <div className="summary__total"><span>Total</span><span className="serif">{money(total)}</span></div>
              <Link to="/checkout" className="btn btn-lg btn-block">Checkout <Icon name="arrowRight" size={18} /></Link>
              <Link to="/shop" className="summary__continue">or continue shopping</Link>
              <div className="summary__badges">
                <span><Icon name="lock" size={14} /> Secure</span>
                <span><Icon name="return" size={14} /> Easy returns</span>
                <span><Icon name="truck" size={14} /> Fast delivery</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ProductRail eyebrow="Add a little extra" title="Recommended for you" products={getBestsellers()} link="/shop" />
    </>
  );
}

function SavedList({ saved, dispatch, inline }) {
  return (
    <div className={`savedlist ${inline ? 'savedlist--inline' : ''}`}>
      <h3 className="serif" style={{ fontSize: 'var(--text-xl)', margin: 'var(--sp-8) 0 var(--sp-4)' }}>Saved for later ({saved.length})</h3>
      <div className="savedlist__grid">
        {saved.map((l) => (
          <div key={l.key} className="savedcard">
            <Link to={`/product/${l.product.slug}`} className="savedcard__media"><ProductImage product={l.product} /></Link>
            <div className="savedcard__body">
              <Link to={`/product/${l.product.slug}`} className="savedcard__name">{l.product.name}</Link>
              <span className="price"><span className="now" style={{ fontSize: 'var(--text-md)' }}>{money(l.product.price)}</span></span>
              <div className="savedcard__actions">
                <button className="btn btn-sm btn-light" onClick={() => dispatch({ type: 'MOVE_TO_CART', key: l.key })}>Move to cart</button>
                <button className="linkbtn linkbtn--danger" onClick={() => dispatch({ type: 'REMOVE_SAVED', key: l.key })} aria-label="Remove"><Icon name="trash" size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
