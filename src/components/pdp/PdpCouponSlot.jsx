import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import CouponTicket from './CouponTicket.jsx';
import { fetchEligibleCoupons } from '../../lib/couponApi.js';
import { useStore } from '../../lib/store.jsx';

// ============================================================
// PDP COUPON SLOT — offers, never prices
//
// This slot was reserved and left empty in Run 2 with a note: anything that
// lands here must be priced by api/_lib/pricing.js and displayed, never
// computed in the browser. That still holds, and this component honours it in
// the strongest way available — it renders NO rupee figure at all.
//
// The reason is not caution, it is correctness. The "cart" behind a product
// page is one unit of one product, so any discount derived from it would be
// wrong the moment a second item entered the basket. What a coupon is worth
// depends on the whole basket, so the amount belongs in the cart, where the
// basket exists. Here the card advertises the terms and hands over the code.
//
// It still renders null when nothing applies, so a sparse PDP has no orphaned
// gap where a card would eventually go — the original contract of the slot.
//
// The ticket itself lives in CouponTicket.jsx so the admin editor's preview
// can render the real component rather than a copy of its markup.
// ============================================================

/**
 * @param product   the product being viewed
 * @param variantId the selected priced variant, if any
 */
export default function PdpCouponSlot({ product, variantId = null }) {
  const { couponCode, dispatch, toast } = useStore();
  const [offers, setOffers] = useState([]);
  const [open, setOpen] = useState(false);

  const productId = product?.id ?? null;

  useEffect(() => {
    if (!productId) { setOffers([]); return undefined; }
    const controller = new AbortController();

    (async () => {
      try {
        // One unit is the right question here: "is there an offer on this
        // product at all", not "what would it save on this basket".
        const { applicable, unlockable } = await fetchEligibleCoupons({
          items: [{ id: productId, qty: 1, variantId }],
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // Both lists are shown. An unlockable coupon is a genuine offer with a
        // spend condition, and its own description already states the
        // condition — hiding it would keep a real offer secret from the person
        // most likely to reach it.
        setOffers([...applicable, ...unlockable]);
      } catch {
        if (!controller.signal.aborted) setOffers([]);
      }
    })();

    return () => controller.abort();
  }, [productId, variantId]);

  if (!offers.length) return null;

  function apply(code) {
    dispatch({ type: 'APPLY_COUPON', code });
    // Deliberately does not claim a saving. The cart quotes the code against
    // the real basket and reports what it is actually worth; promising a
    // number here would be the same guess this component exists to avoid.
    toast(`${code} will be applied in your cart`, { kind: 'cart' });
  }

  return (
    <section className="pdp-coupons" aria-labelledby="pdp-coupons-h">
      <button
        type="button"
        className="pdp-coupons__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="pdp-coupons-list"
      >
        <span className="pdp-coupons__icon"><Icon name="tag" size={18} /></span>
        <span id="pdp-coupons-h" className="pdp-coupons__label">
          Offers
          <span className="pdp-coupons__count">{offers.length}</span>
        </span>
        <span className={`pdp-coupons__chev ${open ? 'is-open' : ''}`}>
          <Icon name="chevronDown" size={18} />
        </span>
      </button>

      <ul id="pdp-coupons-list" className="pdp-coupons__list" hidden={!open}>
        {offers.map((c) => (
          <CouponTicket
            key={c.code}
            coupon={c}
            applied={couponCode === c.code}
            onApply={apply}
          />
        ))}
      </ul>
    </section>
  );
}
