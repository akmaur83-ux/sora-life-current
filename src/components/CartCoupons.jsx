import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';
import { fetchEligibleCoupons, normalizeCouponCode } from '../lib/couponApi.js';

// ============================================================
// CART — COUPONS AND OFFERS
//
// Every rupee on this panel came from the server. The applied saving is
// `quote.breakdown.couponDiscount`, each offer's saving is the `discount` the
// eligible endpoint computed for THIS basket, and "add ₹X more" is `addMore`,
// also computed server-side. There is no arithmetic in this file, and the
// cart-integrity suite asserts there never is.
//
// That constraint is the whole point. The predecessor of this panel was a
// hard-coded `{ SORA10: 0.1 }` map that took 10% off the display while
// checkout charged full price — a ₹51,429 basket showed ₹43,715 and was
// billed ₹51,429. The figures below cannot drift from the charge because they
// are the same figures, from the same function, as create-order uses.
// ============================================================

/** The applied coupon, as the server currently judges it. */
function AppliedRow({ coupon, discount, onRemove }) {
  return (
    <div className="cartcoupon__applied">
      <span className="cartcoupon__tick"><Icon name="check" size={14} /></span>
      <div className="cartcoupon__appliedbody">
        <p className="cartcoupon__appliedcode">{coupon.code}</p>
        <p className="cartcoupon__appliedtitle">{coupon.title}</p>
      </div>
      {/* Straight from breakdown.couponDiscount — the same number the order
          will be created with. */}
      {discount > 0 && <span className="cartcoupon__saved">−{money(discount)}</span>}
      <button
        type="button"
        className="cartcoupon__remove"
        onClick={onRemove}
        aria-label={`Remove coupon ${coupon.code}`}
      >
        Remove
      </button>
    </div>
  );
}

/** One offer the customer has not applied yet. */
function OfferRow({ coupon, onApply, applying }) {
  const locked = coupon.addMore > 0;
  return (
    <li className={`cartcoupon__offer ${locked ? 'is-locked' : ''}`}>
      <div className="cartcoupon__offerbody">
        <p className="cartcoupon__offertitle">{coupon.title}</p>
        <p className="cartcoupon__offerdesc">
          {/* The server's own wording for why it does not apply yet, and the
              exact shortfall it calculated. */}
          {locked ? `Add ${money(coupon.addMore)} more to use this` : coupon.description}
        </p>
      </div>
      <div className="cartcoupon__offerside">
        {coupon.discount > 0 && <span className="cartcoupon__offersave">Save {money(coupon.discount)}</span>}
        <button
          type="button"
          className="cartcoupon__offerapply"
          onClick={() => onApply(coupon.code)}
          disabled={locked || applying}
          aria-label={`Apply ${coupon.code}`}
        >
          {coupon.code}
        </button>
      </div>
    </li>
  );
}

/**
 * @param items     hydrated cart lines, for the eligible lookup
 * @param code      the code currently applied (may be refused)
 * @param quote     the result of useCartQuote — the only source of figures
 * @param onApply   (code) => void
 * @param onRemove  () => void
 */
export default function CartCoupons({ items, code, quote, onApply, onRemove }) {
  const [offers, setOffers] = useState({ applicable: [], unlockable: [] });
  const [input, setInput] = useState('');

  const applied = quote.status === 'ok' && quote.coupon ? quote.coupon : null;
  const refused = quote.status === 'rejected' && code ? quote.message : '';

  // Refetched whenever the basket changes, for the same reason the quote is:
  // an offer's worth depends on the basket, so a stale list would advertise a
  // saving that no longer holds.
  const signature = JSON.stringify(items.map((l) => [l.id, l.qty, l.variantId || null]));
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const next = await fetchEligibleCoupons({
          items: JSON.parse(signature).map(([id, qty, variantId]) => ({ id, qty, variantId })),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setOffers(next);
      } catch {
        if (!controller.signal.aborted) setOffers({ applicable: [], unlockable: [] });
      }
    })();
    return () => controller.abort();
  }, [signature]);

  function submit(e) {
    e.preventDefault();
    const clean = normalizeCouponCode(input);
    if (!clean) return;
    onApply(clean);
    setInput('');
  }

  // The applied code is not repeated in the list below it.
  const listed = [...offers.applicable, ...offers.unlockable].filter((c) => c.code !== applied?.code);

  // Nothing to offer and nothing being tried: no empty panel. An entry field
  // with no coupons behind it is how the old cart invited customers to type
  // codes that did nothing.
  if (!listed.length && !applied && !refused) return null;

  return (
    <section className="cartcoupon" aria-labelledby="cartcoupon-h">
      <h4 id="cartcoupon-h" className="cartcoupon__h">
        <Icon name="tag" size={15} /> Coupons and offers
      </h4>

      {applied && (
        <AppliedRow
          coupon={applied}
          discount={quote.breakdown?.couponDiscount ?? 0}
          onRemove={onRemove}
        />
      )}

      {refused && (
        <div className="cartcoupon__refused" role="alert">
          <span className="cartcoupon__refusedcode">{code}</span>
          {/* The server's wording, verbatim. The cart does not decide how to
              describe a refusal, so the cart and checkout say the same thing
              about the same coupon. */}
          <span className="cartcoupon__refusedmsg">{refused}</span>
          <button type="button" className="cartcoupon__remove" onClick={onRemove}>Remove</button>
        </div>
      )}

      {!applied && (
        <form className="cartcoupon__form" onSubmit={submit}>
          <label className="sr-only" htmlFor="cart-coupon-input">Coupon code</label>
          <input
            id="cart-coupon-input"
            className="cartcoupon__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter coupon code"
            autoComplete="off"
            spellCheck="false"
            maxLength={40}
          />
          <button type="submit" className="cartcoupon__submit" disabled={!input.trim()}>
            Apply
          </button>
        </form>
      )}

      {listed.length > 0 && (
        <ul className="cartcoupon__offers">
          {listed.map((c) => (
            <OfferRow key={c.code} coupon={c} onApply={onApply} applying={quote.stale} />
          ))}
        </ul>
      )}
    </section>
  );
}
