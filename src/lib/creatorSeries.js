// ============================================================
// Creator portal charts — the pure part.
//
// Turns what the RPCs return into fixed-length number arrays, and turns those
// into SVG path data. No DOM, no React, no library: the sparkline is a
// polyline and a filled area, hand-built so the portal ships nothing extra.
//
// The empty case is designed, not tolerated: a series of zeros is still a
// series, and draws as a level baseline so the chart is present and honest
// ("waiting for data") rather than missing.
// ============================================================

export const SERIES_WEEKS = 12;
export const SERIES_MONTHS = 12;
export const METRICS = Object.freeze(['clicks', 'orders', 'products', 'sales', 'commission']);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// my_creator_activity_series() → { clicks: number[12], orders: …, … }.
// Absent, failed or short input still yields full-length arrays of zeros, so
// every figure gets a chart whether or not 0032 is applied.
export function weeklySeries(raw, weeks = SERIES_WEEKS) {
  const rows = Array.isArray(raw?.series) ? raw.series : [];
  const out = {};
  for (const m of METRICS) {
    const vals = rows.map((r) => num(r?.[m]));
    const tail = vals.slice(-weeks);
    out[m] = Array.from({ length: weeks }, (_, i) => tail[i - (weeks - tail.length)] ?? 0);
  }
  out.weeks = rows.slice(-weeks).map((r) => String(r?.week || ''));
  out.available = rows.length > 0;
  return out;
}

// my_creator_earnings().monthly_history ([{month:'YYYY-MM', commission}]) →
// the last `months` calendar months, oldest first, zeros where absent.
export function monthlySeries(history, months = SERIES_MONTHS, now = new Date()) {
  const byMonth = new Map();
  for (const h of Array.isArray(history) ? history : []) if (h?.month) byMonth.set(String(h.month), num(h.commission));
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return { keys, values: keys.map((k) => byMonth.get(k) ?? 0), available: byMonth.size > 0 };
}

// Running total of a series — the shape of "lifetime so far".
export function cumulative(points) {
  let acc = 0;
  return (Array.isArray(points) ? points : []).map((p) => (acc += num(p)));
}

export const isFlat = (points) => !Array.isArray(points) || points.length === 0 || points.every((p) => num(p) === num(points[0]));
export const isEmpty = (points) => !Array.isArray(points) || points.every((p) => num(p) === 0);

// SVG geometry. `pad` keeps the stroke inside the box; a flat series sits on
// a baseline near the bottom instead of collapsing to the middle.
export function sparkGeometry(points, { width = 96, height = 28, pad = 2 } = {}) {
  const vals = (Array.isArray(points) ? points : []).map(num);
  const n = vals.length;
  if (n === 0) return { line: '', area: '', last: null, flat: true, empty: true, width, height };
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min;
  const innerH = height - pad * 2;
  const baseline = height - pad;
  const x = (i) => (n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (v) => (span === 0 ? baseline : baseline - ((v - min) / span) * innerH);
  const pts = vals.map((v, i) => [round(x(i)), round(y(v))]);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ');
  const area = `${line} L${pts[n - 1][0]} ${baseline} L${pts[0][0]} ${baseline} Z`;
  return { line, area, last: pts[n - 1], flat: span === 0, empty: vals.every((v) => v === 0), width, height, points: pts };
}
const round = (v) => Math.round(v * 10) / 10;
