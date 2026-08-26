// ============================================================
// TAX CONFIGURATION AND GST CALCULATION (server-authoritative)
//
// Deliberately NOT hard-coded to a rate. India applies different GST slabs
// to juices, supplements, cosmetics and personal care, so inventing a single
// rate here would produce wrong invoices. Rates are configuration:
//
//   SORA_GST_RATE        default GST % for any item without its own rate
//   SORA_TAX_MODE        'inclusive' (default) | 'exclusive'
//   SORA_SELLER_STATE    seller's state, e.g. "Punjab" — decides CGST+SGST vs IGST
//
// When no rate is configured anywhere the tax rows are simply omitted from
// the breakdown (the spec asks for "only show applicable rows"), rather than
// printing a fabricated number on a customer's invoice.
//
// TAX MODE — this changes what a customer is charged, so the default is the
// conservative one:
//   inclusive  (default) Indian retail/MRP convention: the displayed price
//              already contains GST. Tax is *extracted* for the invoice and
//              the grand total is unchanged. Existing order amounts stay
//              byte-for-byte the same as before this module existed.
//   exclusive  GST is *added* on top of the taxable amount. This raises every
//              order total by the GST rate, so it is opt-in only.
// ============================================================

export const DEFAULT_TAX_MODE = 'inclusive';

/** Read tax settings from the environment, with safe fallbacks. */
export function getTaxConfig(env = process.env) {
  const rawRate = Number(env.SORA_GST_RATE);
  const rate = Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 100 ? rawRate : 0;
  const mode = env.SORA_TAX_MODE === 'exclusive' ? 'exclusive' : DEFAULT_TAX_MODE;
  const sellerState = typeof env.SORA_SELLER_STATE === 'string' && env.SORA_SELLER_STATE.trim()
    ? env.SORA_SELLER_STATE.trim()
    : null;
  return { rate, mode, sellerState };
}

/** Normalise a state name for comparison ("  punjab " === "Punjab"). */
function normState(s) {
  return typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

/**
 * Intra-state (seller state === buyer state) splits into CGST + SGST.
 * Anything else is IGST. If the seller state is not configured we cannot
 * know, so we report a single undivided GST amount.
 */
export function resolveTaxKind(sellerState, buyerState) {
  if (!sellerState || !buyerState) return 'gst';
  return normState(sellerState) === normState(buyerState) ? 'cgst_sgst' : 'igst';
}

/**
 * Split a gross (tax-inclusive) amount into net + tax at `rate` percent.
 * gross = net * (1 + rate/100)  =>  net = gross / (1 + rate/100)
 */
export function splitInclusive(gross, rate) {
  if (!rate) return { net: round2(gross), tax: 0 };
  const net = gross / (1 + rate / 100);
  const tax = gross - net;
  return { net: round2(net), tax: round2(tax) };
}

/** Add tax on top of a net (tax-exclusive) amount. */
export function addExclusive(net, rate) {
  if (!rate) return { net: round2(net), tax: 0 };
  return { net: round2(net), tax: round2(net * (rate / 100)) };
}

/**
 * Compute the tax block for an order.
 *
 * @param lines        priced lines, each { lineTotal, gstRate }
 * @param extraTaxable additional taxable amounts (shipping/fees) at the
 *                     default rate; pass 0 to exclude them from tax
 * @param config       { rate, mode, sellerState }
 * @param buyerState   customer's state, for CGST/SGST vs IGST
 *
 * Returns null when no rate applies anywhere (so callers can omit the rows).
 */
export function computeTax(lines, extraTaxable, config, buyerState) {
  const { rate: defaultRate, mode, sellerState } = config;

  // Per-line rate falls back to the configured default.
  const rated = lines.map((l) => ({
    amount: l.lineTotal,
    rate: Number.isFinite(l.gstRate) && l.gstRate > 0 ? l.gstRate : defaultRate,
  }));
  if (extraTaxable > 0 && defaultRate > 0) {
    rated.push({ amount: extraTaxable, rate: defaultRate });
  }

  const anyRate = rated.some((r) => r.rate > 0);
  if (!anyRate) return null;

  // Group by rate so an invoice can show each slab separately (required on a
  // GST invoice when a single order mixes slabs).
  const bySlab = new Map();
  let taxableTotal = 0;
  let taxTotal = 0;

  for (const r of rated) {
    if (!r.rate) {
      // Zero-rated portion is still taxable value on the invoice.
      taxableTotal += r.amount;
      const z = bySlab.get(0) || { rate: 0, taxable: 0, tax: 0 };
      z.taxable = round2(z.taxable + r.amount);
      bySlab.set(0, z);
      continue;
    }
    const { net, tax } = mode === 'inclusive'
      ? splitInclusive(r.amount, r.rate)
      : addExclusive(r.amount, r.rate);
    taxableTotal += net;
    taxTotal += tax;
    const slab = bySlab.get(r.rate) || { rate: r.rate, taxable: 0, tax: 0 };
    slab.taxable = round2(slab.taxable + net);
    slab.tax = round2(slab.tax + tax);
    bySlab.set(r.rate, slab);
  }

  const kind = resolveTaxKind(sellerState, buyerState);
  const total = round2(taxTotal);
  const half = round2(total / 2);

  return {
    mode,
    kind,
    sellerState,
    buyerState: buyerState || null,
    taxableAmount: round2(taxableTotal),
    totalTax: total,
    // Only the applicable split is non-null, so the UI can render exactly
    // the rows that apply.
    cgst: kind === 'cgst_sgst' ? half : null,
    sgst: kind === 'cgst_sgst' ? round2(total - half) : null,
    igst: kind === 'igst' ? total : null,
    slabs: [...bySlab.values()].sort((a, b) => a.rate - b.rate),
  };
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
