import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';

// ============================================================
// Price drops on the wishlist (owner, 2026-11-10: more features). The first time a
// saved product shows on a wishlist page, its price and the date are kept in this
// browser. When the price is lower on a later visit, the wishlist says so at the top:
// "now ₹899 — ₹300 less than on 8 Nov". Real prices only, nothing invented, nothing
// sent anywhere; a price that rises keeps the first one as the mark.
// ============================================================
const KEY = 'sora.wish.prices.v1';
const MAX = 400;

const readAll = () => { try { const v = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };

/**
 * Notes today's prices and returns the drops, biggest first. Pure but for `store`.
 * items: [{ key, name, price, href, image }]; store: a { key: { p, at } } object it updates.
 */
export function priceDrops(items, store, now = Date.now()) {
  const drops = [];
  for (const it of items || []) {
    const price = Math.round(Number(it?.price) || 0);
    if (!it?.key || !(price > 0)) continue;
    const was = store[it.key];
    if (!was || !(was.p > 0)) { store[it.key] = { p: price, at: now }; continue; }
    if (price < was.p) drops.push({ ...it, price, was: was.p, since: was.at, less: was.p - price });
  }
  return drops.sort((a, b) => b.less - a.less);
}

const day = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export default function PriceDrops({ items, className = '' }) {
  const [drops, setDrops] = useState([]);
  const sig = (items || []).map((i) => `${i.key}:${i.price}`).join('|');
  useEffect(() => {
    if (typeof window === 'undefined' || !sig) { setDrops([]); return; }
    const store = readAll();
    setDrops(priceDrops(items, store));
    const keys = Object.keys(store);
    if (keys.length > MAX) keys.sort((a, b) => store[a].at - store[b].at).slice(0, keys.length - MAX).forEach((k) => delete store[k]);
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage off */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  if (!drops.length) return null;
  return (
    <section className={`hx-drops${className ? ` ${className}` : ''}`} aria-labelledby="hx-drops-h">
      <h2 className="hx-drops__h" id="hx-drops-h">{drops.length === 1 ? 'A price dropped on your list' : `${drops.length} prices dropped on your list`}</h2>
      <ul className="hx-drops__list">
        {drops.slice(0, 6).map((d) => (
          <li key={d.key}>
            <Link to={d.href} className="hx-drops__item">
              {d.image ? <img src={d.image} alt="" width="48" height="48" loading="lazy" /> : <span className="hx-drops__ph" aria-hidden="true" />}
              <span className="hx-drops__name">{d.name}</span>
              <span className="hx-drops__price"><b>{money(d.price)}</b> <em>{money(d.less)} less than on {day(d.since)}</em></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
