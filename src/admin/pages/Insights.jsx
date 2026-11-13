import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { money } from '../../lib/format.js';

// ============================================================
// Admin → Insights (owner, 2026-11-13: feature 36, "kya bik raha hai"). Three lists:
//   * Top searches — what shoppers typed, by store (search_log, 0043);
//   * Searched, nothing found — demand the catalogue does not meet yet: stock it,
//     or add the words to a product's name or description;
//   * Best sellers — paid orders' lines, by units, in the period.
// Read-only. The search log holds the text only — no shopper, no address.
// ============================================================
export const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days']];

/** search_log rows → { top, zero }: each { q, store, n }, most searched first. Pure. */
export function summariseSearches(rows) {
  const top = new Map(); const zero = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = `${r.store}|${r.q}`;
    const into = Number(r.results) > 0 ? top : zero;
    into.set(k, { q: r.q, store: r.store, n: (into.get(k)?.n || 0) + 1 });
  }
  const sort = (m) => [...m.values()].sort((a, b) => b.n - a.n || a.q.localeCompare(b.q));
  // A query that found results at least once is not "nothing found".
  const found = new Set([...top.keys()]);
  return { top: sort(top), zero: sort(zero).filter((z) => !found.has(`${z.store}|${z.q}`)) };
}

/** Paid orders → best sellers by units: { name, units, revenue }. Pure. */
export function bestSellers(orders) {
  const m = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o.payment_status !== 'paid') continue;
    for (const l of Array.isArray(o.items) ? o.items : []) {
      const name = String(l?.name || '').trim();
      if (!name) continue;
      const cur = m.get(name) || { name, units: 0, revenue: 0 };
      cur.units += Number(l.qty) || 0;
      cur.revenue += Number(l.line_total) || (Number(l.unit_price) || 0) * (Number(l.qty) || 0);
      m.set(name, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

const STORE = { wellness: 'Wellness', fashion: 'Fashion', homeliving: 'Home & Living', grocery: 'Grocery' };
const box = { border: '1px solid #E4E8E1', background: '#fff', padding: 14 };

function List({ title, hint, rows, render, empty }) {
  return (
    <section style={box}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{title}</h2>
      <p className="adm-hint" style={{ margin: '0 0 10px' }}>{hint}</p>
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="adm-hint">{empty}</p> : (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{rows.slice(0, 25).map(render)}</ol>
      )}
    </section>
  );
}

export default function Insights() {
  const [days, setDays] = useState(7);
  const [searches, setSearches] = useState(null);
  const [sellers, setSellers] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setSearches(null); setSellers(null); setError('');
    const since = new Date(Date.now() - days * 86400e3).toISOString();
    supabase.from('search_log').select('q, store, results').gte('created_at', since).order('created_at', { ascending: false }).limit(5000)
      .then(({ data, error: e }) => { if (!live) return; if (e) { setError(e.message); setSearches({ top: [], zero: [] }); } else setSearches(summariseSearches(data)); });
    supabase.from('orders').select('items, payment_status, created_at').eq('payment_status', 'paid').gte('created_at', since).limit(2000)
      .then(({ data, error: e }) => { if (!live) return; if (e) { setError(e.message); setSellers([]); } else setSellers(bestSellers(data)); });
    return () => { live = false; };
  }, [days]);
  return (
    <div>
      <div className="adm__head"><h1>Insights</h1></div>
      <div className="adm-checkrow" role="tablist" style={{ gap: 8, margin: '12px 0' }}>
        {RANGES.map(([d, label]) => <button key={d} type="button" role="tab" aria-selected={days === d} className={`btn btn-sm${days === d ? '' : ' btn-ghost'}`} onClick={() => setDays(d)}>{label}</button>)}
      </div>
      {error && <div className="adm-banner error">{error}</div>}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <List title="Top searches" hint="What shoppers typed, and found something." rows={searches?.top ?? null} empty="No searches yet in this period."
          render={(r) => <li key={`${r.store}|${r.q}`}><b>{r.q}</b> <span style={{ color: '#5F6D64' }}>· {STORE[r.store]} · {r.n}×</span></li>} />
        <List title="Searched, nothing found" hint="Demand you are not meeting yet: stock it, or add these words to the right products." rows={searches?.zero ?? null} empty="Nothing went unfound in this period."
          render={(r) => <li key={`${r.store}|${r.q}`}><b>{r.q}</b> <span style={{ color: '#5F6D64' }}>· {STORE[r.store]} · {r.n}×</span></li>} />
        <List title="Best sellers" hint="Units sold in paid orders." rows={sellers} empty="No paid orders in this period."
          render={(r) => <li key={r.name}><b>{r.name}</b> <span style={{ color: '#5F6D64' }}>· {r.units} sold · {money(r.revenue)}</span></li>} />
      </div>
    </div>
  );
}
