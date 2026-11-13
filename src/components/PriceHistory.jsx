import { useEffect, useState } from 'react';
import { money } from '../lib/format.js';
import { fetchPriceHistory, priceSummary } from '../lib/insights.js';

// ============================================================
// Price history on a product page (owner, 2026-11-13: "pehle aur ab price graph").
// The product's own daily prices (recorded since 13 Nov 2026 whenever a price is
// set or changed), the last 30 days as a small line. Shown only once there are
// two days to compare; nothing is estimated or filled in.
// ============================================================
export function sparkPath(points, w = 260, h = 56, pad = 4) {
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices); const hi = Math.max(...prices);
  const span = hi - lo || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  return points.map((p, i) => `${i ? 'L' : 'M'}${(pad + i * step).toFixed(1)} ${(h - pad - ((p.price - lo) / span) * (h - pad * 2)).toFixed(1)}`).join(' ');
}

export default function PriceHistory({ productId }) {
  const [hist, setHist] = useState(null);
  useEffect(() => { let on = true; fetchPriceHistory(productId).then((h) => { if (on) setHist(h); }); return () => { on = false; }; }, [productId]);
  const s = hist ? priceSummary(hist, 30) : null;
  if (!s) return null;
  return (
    <section className="sora-ph" aria-labelledby="sora-ph-h">
      <h2 className="pdpk-h" id="sora-ph-h">Price in the last 30 days</h2>
      <svg viewBox="0 0 260 56" width="100%" height="56" role="img" aria-label={`From ${money(s.low)} to ${money(s.high)}; now ${money(s.now)}`}>
        <path d={sparkPath(s.points)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="sora-ph__facts">
        <span>Lowest <b>{money(s.low)}</b></span><span>Highest <b>{money(s.high)}</b></span><span>Now <b>{money(s.now)}</b></span>
      </p>
      {s.isLowest && <p className="sora-ph__low">Lowest price in the last 30 days</p>}
    </section>
  );
}
