// General currency formatter for storefront/catalogue prices. Locale grouping,
// no forced decimals (so whole-rupee prices read as ₹1,968, not ₹1,968.00).
//
// A fractional value renders with exactly two places, never one. Left to
// toLocaleString alone, 558.4 came out as "₹558.4" — a figure that reads as a
// typo beside "₹3,723" — and the tax lines, which are legitimately in paise,
// could show one decimal or two depending on the amount. Whole values are
// unchanged: ₹1,968 is still ₹1,968.
export function money(n, currency = '₹') {
  const v = Number(n);
  if (!Number.isFinite(v)) return currency + '0';
  return currency + v.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Canonical formatter for creator-program FINANCIAL amounts — earnings,
// commission, payouts, eligible/attributed sales, and financial admin views.
// Always renders exactly two decimals in INR grouping, so a value like 393.6
// shows as ₹393.60 (never a truncated ₹393.6) and 0 shows as ₹0.00. This is
// display-only; it never changes stored values or calculations. Null/NaN → ₹0.00.
export function money2(n, currency = '₹') {
  const v = Number(n);
  return currency + (Number.isFinite(v) ? v : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
