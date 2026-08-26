// General currency formatter for storefront/catalogue prices. Locale grouping,
// no forced decimals (so whole-rupee prices read as ₹1,968, not ₹1,968.00).
export function money(n, currency = '₹') {
  return currency + Number(n).toLocaleString('en-IN');
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
