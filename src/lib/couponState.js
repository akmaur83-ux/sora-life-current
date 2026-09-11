// ============================================================
// COUPON STATE — the cart's coupon code and the celebration bookkeeping
//
// Pure, so the rules run directly in tests — the same arrangement as
// wishlistState.js, and for the same reason. store.jsx delegates the coupon
// actions here and adds nothing of its own.
//
// Nothing in this file is a discount, a total or a validity flag. The state
// is a CODE the customer is trying, plus two facts about celebrating it:
//
//   couponCode        what is on the cart; persisted, so it survives reload
//   celebratePending  the code the customer JUST applied, awaiting the
//                     server's yes; NOT persisted, because a code restored
//                     on reload was not just applied
//   celebratedCodes   codes already celebrated this session, so removing and
//                     re-applying the same one does not repeat the modal;
//                     NOT persisted, so it is per session by construction
// ============================================================

export const initialCouponState = {
  couponCode: '',
  celebratePending: '',
  celebratedCodes: [],
};

export function couponReducer(state, action) {
  switch (action.type) {
    case 'APPLY_COUPON': {
      const code = action.code || '';
      return {
        ...state,
        couponCode: code,
        // An apply is an intent to celebrate — once per code per session, and
        // only once the server has said yes. The cart resolves the intent
        // when the quote lands; a refused code never reaches it.
        celebratePending: code && !state.celebratedCodes.includes(code) ? code : '',
      };
    }
    case 'CLEAR_COUPON':
      // Removing a coupon withdraws any pending celebration with it, so a
      // remove-then-quote race cannot celebrate a code no longer on the cart.
      return state.couponCode || state.celebratePending
        ? { ...state, couponCode: '', celebratePending: '' }
        : state;
    case 'COUPON_CELEBRATED':
      return {
        ...state,
        celebratePending: '',
        celebratedCodes: state.celebratedCodes.includes(action.code)
          ? state.celebratedCodes
          : [...state.celebratedCodes, action.code],
      };
    default:
      return state;
  }
}

/**
 * Should the cart open the celebration right now?
 *
 * Exactly one situation: the customer just applied a code, and the server's
 * settled quote confirms THAT code. A refused code never has quote.coupon; a
 * restored code never sets celebratePending; a repeated code was filtered by
 * APPLY_COUPON. Kept as a function so those three "never"s are testable
 * without React.
 */
export function shouldCelebrate(state, quote) {
  if (!state.celebratePending) return false;
  if (!quote || quote.status !== 'ok' || quote.stale || !quote.coupon) return false;
  return quote.coupon.code === state.celebratePending;
}
