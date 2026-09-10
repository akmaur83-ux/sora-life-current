// ============================================================
// COUPON TICKET
//
// The card a customer sees on a product page. Extracted from PdpCouponSlot so
// the admin editor's preview renders THIS component rather than a lookalike —
// a preview built from copied markup drifts from the real thing, and then it
// is not a preview, it is a mock-up that happens to be nearby.
//
// It renders no rupee figure, ever. The "cart" behind a product page is one
// unit of one product, so any discount derived from it would be wrong the
// moment a second item entered the basket. What a coupon is worth depends on
// the whole basket, so the amount belongs in the cart, where the basket is.
//
// The ticket shape — notched sides, dashed perforation — is entirely CSS.
// See src/styles/coupons.css.
// ============================================================

/**
 * @param coupon    a publicCouponView shape: { code, title, description }
 * @param applied   already applied to the cart
 * @param onApply   (code) => void; omitted in the admin preview, which makes
 *                  the button inert rather than rendering a different one
 */
export default function CouponTicket({ coupon, applied = false, onApply = null }) {
  return (
    <li className={`pdp-coupon ${applied ? 'is-applied' : ''}`}>
      <div className="pdp-coupon__body">
        <p className="pdp-coupon__title">{coupon.title}</p>
        <p className="pdp-coupon__desc">{coupon.description}</p>
      </div>
      <div className="pdp-coupon__stub">
        <span className="pdp-coupon__code">{coupon.code}</span>
        <button
          type="button"
          className="pdp-coupon__apply"
          onClick={onApply ? () => onApply(coupon.code) : undefined}
          disabled={applied || !onApply}
          // The code sits in a span beside it, but a screen reader landing on
          // the button alone would otherwise hear only "Apply".
          aria-label={applied ? `${coupon.code} applied` : `Apply ${coupon.code}`}
        >
          {applied ? 'Applied' : 'Apply'}
        </button>
      </div>
    </li>
  );
}
