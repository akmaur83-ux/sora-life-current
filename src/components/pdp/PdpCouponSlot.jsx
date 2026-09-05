// ============================================================
// COUPON SLOT — reserved region, deliberately empty.
//
// Run 2 mounts recommended coupon cards here. Nothing in this run may put a
// discount on the PDP, and in particular nothing may CALCULATE one: the old
// client-only SORA10 / WELCOME codes were removed because checkout ignored
// them and the two totals disagreed in front of the customer. Any coupon that
// lands here must be priced by api/_lib/pricing.js and displayed, never
// computed in the browser.
//
// It renders null rather than an empty container so a sparse PDP has no
// orphaned gap where a card will eventually go. The named element is the
// contract; the markup arrives with the feature.
// ============================================================
export default function PdpCouponSlot() {
  return null;
}
