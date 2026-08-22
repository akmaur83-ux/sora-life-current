export function money(n, currency = '₹') {
  return currency + Number(n).toLocaleString('en-IN');
}
export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
