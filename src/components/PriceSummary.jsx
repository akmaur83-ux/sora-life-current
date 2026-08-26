import { money } from '../lib/format.js';

// ============================================================
// Detailed order price summary.
//
// Renders the SAME shape the server produces (api/_lib/pricing.js ->
// breakdown), so the cart, checkout and invoice all show one consistent
// story. When a server breakdown is supplied it is displayed verbatim —
// the client never re-derives money it was given.
//
// Only applicable rows are rendered: no zero-rupee "Coupon Discount -₹0"
// filler, and tax rows appear only when a GST rate is actually configured.
// ============================================================

function Row({ label, value, tone, strong, note }) {
  return (
    <div className={`psum__row ${tone ? `psum__row--${tone}` : ''} ${strong ? 'is-strong' : ''}`}>
      <span className="psum__label">
        {label}
        {note && <span className="psum__note">{note}</span>}
      </span>
      <span className="psum__value">{value}</span>
    </div>
  );
}

/**
 * @param breakdown  server-computed breakdown (preferred)
 * @param fallback   { itemTotal, mrpTotal, shipping } used before the server
 *                   has priced the cart, so the cart page still shows totals
 */
export default function PriceSummary({ breakdown, fallback, currency = '₹', compact = false }) {
  const b = breakdown || null;

  // Pre-server view: only what the client can honestly know.
  if (!b) {
    const itemTotal = fallback?.itemTotal ?? 0;
    const mrpTotal = fallback?.mrpTotal ?? itemTotal;
    const productDiscount = Math.max(0, mrpTotal - itemTotal);
    const shipping = fallback?.shipping ?? 0;
    return (
      <div className={`psum ${compact ? 'psum--compact' : ''}`}>
        {mrpTotal > itemTotal && <Row label="MRP Total" value={money(mrpTotal, currency)} tone="mrp" />}
        <Row label="Item Total" value={money(itemTotal, currency)} />
        {productDiscount > 0 && (
          <Row label="Product Discount" value={`-${money(productDiscount, currency)}`} tone="save" />
        )}
        <Row
          label="Shipping"
          value={shipping > 0 ? money(shipping, currency) : 'FREE'}
          tone={shipping > 0 ? undefined : 'save'}
        />
        <div className="psum__rule" />
        <Row label="Total" value={money(itemTotal + shipping, currency)} strong />
        <p className="psum__hint">Taxes and any fees are confirmed at checkout.</p>
      </div>
    );
  }

  const tax = b.tax;
  const taxRows = [];
  if (tax) {
    if (tax.kind === 'cgst_sgst') {
      taxRows.push(['CGST', tax.cgst], ['SGST', tax.sgst]);
    } else if (tax.kind === 'igst') {
      taxRows.push(['IGST', tax.igst]);
    } else {
      taxRows.push(['GST', tax.totalTax]);
    }
  }

  return (
    <div className={`psum ${compact ? 'psum--compact' : ''}`}>
      {b.mrpTotal > b.itemTotal && <Row label="MRP Total" value={money(b.mrpTotal, currency)} tone="mrp" />}
      <Row label="Item Total" value={money(b.itemTotal, currency)} />

      {b.productDiscount > 0 && (
        <Row label="Product Discount" value={`-${money(b.productDiscount, currency)}`} tone="save" />
      )}
      {b.couponDiscount > 0 && (
        <Row
          label="Coupon Discount"
          note={b.coupon?.code ? ` (${b.coupon.code})` : null}
          value={`-${money(b.couponDiscount, currency)}`}
          tone="save"
        />
      )}

      {(b.productDiscount > 0 || b.couponDiscount > 0) && (
        <Row label="Subtotal" value={money(b.subtotal, currency)} />
      )}

      <Row
        label="Shipping"
        value={b.shipping > 0 ? money(b.shipping, currency) : 'FREE'}
        tone={b.shipping > 0 ? undefined : 'save'}
      />
      {b.platformFee > 0 && <Row label="Platform Fee" value={money(b.platformFee, currency)} />}
      {b.packagingFee > 0 && <Row label="Packaging Fee" value={money(b.packagingFee, currency)} />}

      {tax && (
        <>
          <Row label="Taxable Amount" value={money(tax.taxableAmount, currency)} />
          {taxRows.map(([label, amount]) => (
            <Row key={label} label={label} value={money(amount, currency)} />
          ))}
        </>
      )}

      <div className="psum__rule" />
      <Row label="Grand Total" value={money(b.grandTotal, currency)} strong />

      {tax?.mode === 'inclusive' && (
        <p className="psum__hint">Inclusive of all taxes.</p>
      )}
      {b.totalSavings > 0 && (
        <p className="psum__save">You save {money(b.totalSavings, currency)} on this order</p>
      )}
    </div>
  );
}
