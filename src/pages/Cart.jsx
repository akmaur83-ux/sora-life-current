import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductRail from '../components/ProductRail.jsx';
import { useStore } from '../lib/store.jsx';
import PriceSummary from '../components/PriceSummary.jsx';
import PromoRail from '../components/promo/PromoRail.jsx';
import { money } from '../lib/format.js';
import { getBestsellers } from '../data/products.js';
import { promotionsSource } from '../lib/promotions.js';

// ============================================================
// WHY THERE IS NO COUPON FIELD HERE
//
// There used to be one, backed by a hard-coded map:
//   const COUPONS = { SORA10: 0.1, WELCOME: 0.15 }
// Neither code existed in the coupons table, the API, or any migration. The
// cart subtracted the percentage locally, so a ₹51,429 basket displayed
// ₹43,715 with WELCOME and then charged ₹51,429 at checkout — the discount
// was never real and was never sent anywhere.
//
// Coupons ARE implemented, correctly, on the server: create-order accepts a
// `couponCode`, resolves it with the service-role key, applies the discount,
// and consumes it (api/razorpay/create-order.js). None of that is touched.
//
// What is missing is a way to VALIDATE a code before the customer commits.
// migration 0006 is deliberate about this: "No public read: a customer must
// not be able to enumerate every coupon." So the browser cannot price a code,
// and the only server call that can is create-order — which already creates
// the order row, and for COD completes the purchase outright. There is no
// quote step to show a validated total in.
//
// Rather than ship a second, fake pricing engine in the client, the entry
// point is removed until a real pre-order validation path exists. The cart
// now shows only totals it can prove. See PromoRail for the matching copy.
// ============================================================

export default function Cart() {
  const { cartDetailed, savedDetailed, dispatch, subtotal, mrpTotal, cartCount, blockedCartLines } = useStore();

  // Cart has no delivery-method selector; its estimate mirrors the default
  // Standard option used by Checkout and the server (free shipping).
  const shipping = 0;

  if (!cartDetailed.length) {
    return (
      <div className="v2-cart-root">
        <div className="v2-wrap v2-cart-empty">
        <div className="state">
          <span className="state-ic"><Icon name="bag" size={32} /></span>
          {/* The page still needs its one heading when the cart is empty. It
              was an <h3>, so /cart had no h1 at all in this state. Same words,
              same size — the class keeps the visual weight the state design
              was built around. */}
          <h1 className="state__h">Your cart is empty</h1>
          <p>Looks like you haven't added anything yet. Let's fix that.</p>
          <Link to="/shop" className="btn">Start shopping <Icon name="arrowRight" size={18} /></Link>
        </div>
        {savedDetailed.length > 0 && <SavedList saved={savedDetailed} dispatch={dispatch} />}
        </div>
      </div>
    );
  }

  return (
    <div className="v2-cart-root">
      <div className="pagehead v2-cart-head"><div className="v2-wrap">
        <nav className="crumbs v2-crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Cart</span></nav>
        <h1 className="serif">Your cart</h1>
        {/* Both numbers, named. This line used to say "3 items" while the
            header badge said 8 — it was counting distinct products and the
            badge was counting units. Neither was wrong; calling them both
            "items" was. The badge semantics are unchanged. */}
        <p className="muted">
          {cartDetailed.length} {cartDetailed.length === 1 ? 'product' : 'products'}
          {cartCount !== cartDetailed.length && <> · {cartCount} {cartCount === 1 ? 'item' : 'items'}</>}
          {' '}in your cart.
        </p>
      </div></div>

      <div className="v2-wrap section-sm v2-cart-body">
        <div className="cartlayout">
          <div className="cartlayout__main">
            <div className="cartlist">
              {cartDetailed.map((l) => {
                // Four "Remove" buttons in a row tell a screen-reader user
                // nothing. Naming the product — and the pack size when two
                // lines are the same product — makes each control unique.
                const who = l.variantLabel ? `${l.product.name}, ${l.variantLabel}` : l.product.name;
                return (
                <div key={l.key} className={`cartrow ${l.purchasable ? '' : 'cartrow--blocked'}`}>
                  <Link to={`/product/${l.product.slug}`} className="cartrow__media v2-cartrow__media"><ProductImage product={l.product} frame="v2" /></Link>
                  <div className="cartrow__info">
                    <div className="cartrow__top">
                      <div>
                        <Link to={`/product/${l.product.slug}`} className="cartrow__name serif">{l.product.name}</Link>
                        {/* Pack size is the variant; quantity is how many of
                            that pack. They are shown separately so "750 ml x 2"
                            can never be misread as "2 units of the base size". */}
                        {(l.variantLabel || l.product.form) && (
                          <span className="cartrow__variant">{l.variantLabel || l.product.form}</span>
                        )}
                        {/* The amount stays in price-green and the word "each"
                            stays muted, so the per-pack price reads as money
                            rather than as supporting caption text. A retired
                            pack size has no price we can honestly state, so it
                            says so instead of showing the base pack's price. */}
                        <span className="cartrow__unit">
                          {l.unitPrice == null ? (
                            <span className="muted">Price unavailable</span>
                          ) : (
                            <>
                              <span className="cartrow__unitprice">{money(l.unitPrice)}</span>
                              <span className="muted"> each</span>
                              {l.unitMrp > l.unitPrice && <s>{money(l.unitMrp)}</s>}
                            </>
                          )}
                        </span>
                      </div>
                      {l.unitPrice != null && (
                        <div className="cartrow__price">{money(l.lineTotal)}
                          {l.unitMrp > l.unitPrice && <s>{money(l.unitMrp * l.qty)}</s>}
                        </div>
                      )}
                    </div>
                    {/* Named on the row itself, so the customer knows WHICH
                        item to fix without matching it against a summary
                        message further down the page. */}
                    {l.unavailableReason && (
                      <p className="cartrow__unavailable">
                        <Icon name="circleAlert" size={14} /> {l.unavailableReason}
                      </p>
                    )}
                    <div className="cartrow__actions">
                      <div className="qty qty--sm">
                        {/* The clamp already prevented 0; the button just sat
                            there doing nothing when pressed. Same fix the PDP
                            got, so the two controls now behave alike. */}
                        <button
                          onClick={() => dispatch({ type: 'SET_QTY', key: l.key, qty: l.qty - 1 })}
                          aria-label={`Decrease quantity for ${who}`}
                          disabled={l.qty <= 1}
                        ><Icon name="minus" size={15} /></button>
                        <span aria-live="polite">{l.qty}</span>
                        <button
                          onClick={() => dispatch({ type: 'SET_QTY', key: l.key, qty: l.qty + 1 })}
                          aria-label={`Increase quantity for ${who}`}
                        ><Icon name="plus" size={15} /></button>
                      </div>
                      <button className="linkbtn" aria-label={`Save ${who} for later`} onClick={() => dispatch({ type: 'SAVE_LATER', key: l.key })}><Icon name="heart" size={15} /> Save for later</button>
                      <button className="linkbtn linkbtn--danger" aria-label={`Remove ${who} from cart`} onClick={() => dispatch({ type: 'REMOVE', key: l.key })}><Icon name="trash" size={15} /> Remove</button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {savedDetailed.length > 0 && <SavedList saved={savedDetailed} dispatch={dispatch} inline />}
          </div>

          {/* Summary */}
          <aside className="cartlayout__aside">
            <div className="summary v2-summary">
              <h3>Order summary</h3>

              {/* Informational only — separate from the estimate below and from
                  checkout pricing. Nothing here auto-applies. */}
              {promotionsSource === 'supabase' && <PromoRail place="cart" variant="compact" />}

              {/* Cart shows the client-side estimate; checkout replaces it with
                  the server-computed breakdown (taxes/fees included). Every
                  figure here is derived from the live catalogue — the cart no
                  longer subtracts anything it cannot prove. */}
              <PriceSummary
                fallback={{ itemTotal: subtotal, mrpTotal, shipping }}
              />
              {blockedCartLines.length > 0 ? (
                  /* A retired pack size, a deactivated or sold-out product, or
                     a line stored before purchase gating existed. Each row
                     already states its own reason; this repeats the count and
                     holds the checkout shut. */
                  <>
                    <p className="summary__blocked" role="alert">
                      {blockedCartLines.length === 1
                        ? `“${blockedCartLines[0].product.name}” cannot be ordered right now.`
                        : `${blockedCartLines.length} items in your cart cannot be ordered right now.`}
                      {' '}See the note on {blockedCartLines.length === 1 ? 'that item' : 'those items'} above to continue.
                    </p>
                    <button type="button" className="btn btn-lg btn-block" disabled aria-disabled="true">
                      Checkout
                    </button>
                  </>
                ) : (
                  <Link to="/checkout" className="btn btn-lg btn-block">Checkout <Icon name="arrowRight" size={18} /></Link>
                )}
              <Link to="/shop" className="summary__continue">or continue shopping</Link>
              <div className="summary__badges">
                <span><Icon name="lock" size={14} /> Secure checkout</span>
                <span><Icon name="truck" size={14} /> Free standard shipping</span>
                <span><Icon name="truck" size={14} /> Delivery options at checkout</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ProductRail eyebrow="Add a little extra" title="Recommended for you" products={getBestsellers()} link="/shop" />
    </div>
  );
}

function SavedList({ saved, dispatch, inline }) {
  return (
    <div className={`savedlist ${inline ? 'savedlist--inline' : ''}`}>
      <h3 className="serif" style={{ fontSize: 'var(--text-xl)', margin: 'var(--sp-8) 0 var(--sp-4)' }}>Saved for later ({saved.length})</h3>
      <div className="savedlist__grid">
        {saved.map((l) => {
          const who = l.variantLabel ? `${l.product.name}, ${l.variantLabel}` : l.product.name;
          return (
          <div key={l.key} className="savedcard">
            <Link to={`/product/${l.product.slug}`} className="savedcard__media"><ProductImage product={l.product} frame="v2" /></Link>
            <div className="savedcard__body">
              <Link to={`/product/${l.product.slug}`} className="savedcard__name">{l.product.name}</Link>
              {/* The pack size, and the price OF that pack. This read
                  l.product.price, so saving a 750 ml line for later showed the
                  250 ml price (₹4,038 became ₹1,347) and dropped the label
                  entirely — the same line then returned to the cart at ₹4,038.
                  The stored line was always right; only this card lied. */}
              {l.variantLabel && <span className="savedcard__variant">{l.variantLabel}</span>}
              <span className="price">
                {l.unitPrice == null
                  ? <span className="muted">Price unavailable</span>
                  : <span className="now" style={{ fontSize: 'var(--text-md)' }}>{money(l.unitPrice)}</span>}
              </span>
              <div className="savedcard__actions">
                <button className="btn btn-sm btn-light" aria-label={`Move ${who} to cart`} onClick={() => dispatch({ type: 'MOVE_TO_CART', key: l.key })}>Move to cart</button>
                <button className="linkbtn linkbtn--danger" onClick={() => dispatch({ type: 'REMOVE_SAVED', key: l.key })} aria-label={`Remove ${who} from saved items`}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
