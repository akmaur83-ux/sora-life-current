// ============================================================
// "FREE delivery Sat, 14 Nov – Mon, 16 Nov" on every product page (owner,
// 2026-11-08: more marketplace features). The window is the store's own rule —
// Standard delivery in 6–7 business days, free on every order — counted from
// today with Sundays not counted, so it is an estimate the shipping policy already
// promises, never a new promise. The page says "estimated" and the checkout's
// confirmation stays what decides.
// ============================================================
export const DELIVERY_MIN_DAYS = 6;
export const DELIVERY_MAX_DAYS = 7;

/** `from` plus `n` business days (Sundays skipped). */
export function addBusinessDays(from, n) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left -= 1;
  }
  return d;
}

const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** { from, to, label } for an order placed on `now`. */
export function deliveryWindow(now = new Date(), min = DELIVERY_MIN_DAYS, max = DELIVERY_MAX_DAYS) {
  const from = addBusinessDays(now, min);
  const to = addBusinessDays(now, max);
  return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
}
