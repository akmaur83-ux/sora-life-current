// ============================================================
// The offer countdown in the buy box (owner, 2026-11-08: more features). What it
// says, the code and when it ends are the admin's (Storefronts → Wellness → Offer
// countdown); it shows only while that time is ahead and disappears by itself
// when it passes. The coupon itself, and whether it applies, stay the cart's
// business: this line never prices anything.
// ============================================================
export const OFFER_COUNTDOWN = Object.freeze({ hidden: false, title: 'Diwali offer: 20% off with code', code: 'DIWALI20', endsAt: '2026-11-15 23:59' });

/** 'YYYY-MM-DD HH:MM' in India time → ms since epoch; NaN when unreadable. */
export function parseIndiaTime(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(text || '').trim());
  if (!m) return NaN;
  const [, y, mo, d, h = '23', mi = '59'] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi) - (5.5 * 3600 * 1000);
}

/** '6d 18h 20m' / '4h 05m' / '12m' for the time left; '' when none. */
export function timeLeft(ms) {
  if (!(ms > 0)) return '';
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h ${mm}m`;
  if (h > 0) return `${h}h ${String(mm).padStart(2, '0')}m`;
  return `${Math.max(1, mm)}m`;
}
