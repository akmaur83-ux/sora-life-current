// ============================================================
// CART QUOTE — one server answer, refetched whenever the cart changes
//
// The cart must never hold a discount across a mutation. A ₹200 coupon on a
// ₹1,200 basket can become invalid the moment a line is removed, and showing
// the old figure for even one render is the same class of lie as computing it
// locally. So every quantity change, removal, save-for-later and code change
// refetches, and the previous request is aborted rather than allowed to land
// late over a newer one.
//
// While a refetch is in flight the last breakdown is kept on screen but
// `stale` is true, so the summary can dim rather than flicker between a
// number and a spinner on every keypress of the quantity stepper.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { quoteCart, cartToPayload } from './couponApi.js';

/** Debounce for cart edits. Long enough to coalesce a held-down stepper. */
const QUOTE_DEBOUNCE_MS = 250;

const EMPTY = {
  breakdown: null, coupon: null, status: 'idle', message: '', stale: false,
};

/**
 * @param lines     hydrated cart lines (cartDetailed)
 * @param code      the coupon code being tried; '' for none
 * @param delivery  delivery method id, for a total that matches checkout
 *
 * Returns { breakdown, coupon, status, message, stale }.
 *   status  'idle' | 'loading' | 'ok' | 'rejected' | 'error'
 *   coupon  the server's public view of the applied coupon, or null
 *   message the server's wording for a refusal — never composed here
 */
export function useCartQuote(lines, code, delivery = 'std') {
  const [state, setState] = useState(EMPTY);
  const abortRef = useRef(null);

  // The exact request that would be sent. Serialising it means a re-render
  // that does not change the cart does not refetch, while any real change to
  // an id, a quantity or a variant does.
  const signature = useMemo(
    () => JSON.stringify({ items: cartToPayload(lines), code, delivery }),
    [lines, code, delivery],
  );

  useEffect(() => {
    const { items, code: reqCode, delivery: reqDelivery } = JSON.parse(signature);

    // Nothing to price. Reset rather than leaving the last cart's total up.
    if (!items.length) { setState(EMPTY); return undefined; }

    // Keep the current figures visible, marked stale, so the summary does not
    // collapse to a spinner on every edit.
    setState((s) => ({ ...s, status: s.breakdown ? s.status : 'loading', stale: true }));

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const data = await quoteCart({
          items, delivery: reqDelivery, couponCode: reqCode, signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        if (data?.ok) {
          setState({
            breakdown: data.breakdown || null, coupon: data.coupon || null,
            status: 'ok', message: '', stale: false,
          });
        } else if (data?.reason) {
          // A real verdict about the code. The breakdown that comes with it is
          // the cart WITHOUT the coupon, which is exactly what should be shown
          // beside the explanation.
          setState({
            breakdown: data.breakdown || null, coupon: null,
            status: 'rejected', message: data.message || '', stale: false,
          });
        } else {
          // No code was being tried, or the cart itself is the problem.
          setState({
            breakdown: data?.breakdown || null, coupon: null,
            status: data?.error ? 'error' : 'idle', message: data?.error || '', stale: false,
          });
        }
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        // A network failure must not blank the cart. The locally-known
        // subtotal keeps rendering through PriceSummary's fallback.
        setState((s) => ({ ...s, status: 'error', message: '', stale: false }));
      }
    }, QUOTE_DEBOUNCE_MS);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [signature]);

  return state;
}
