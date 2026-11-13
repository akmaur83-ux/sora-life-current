// ============================================================
// Is customer care open right now? (2026-11-13: more features) — read from the
// support hours the Contact page publishes ("9:00 AM–6:00 PM IST", optionally with
// days: "Mon–Sat, 9:00 AM–6:00 PM IST"), on India time. Hours that cannot be read
// give null and nothing is shown: the chat button never claims to be online on a guess.
// ============================================================
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)/gi;

const toMin = (h, m, ap) => ((Number(h) % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0)) * 60 + (Number(m) || 0);

/** { start, end (minutes past midnight), days: day indexes or null for every day, opens: '9:00 AM' } or null. Pure. */
export function parseCareHours(text) {
  const s = String(text || '');
  const t = [...s.matchAll(TIME)];
  if (t.length < 2) return null;
  const start = toMin(t[0][1], t[0][2], t[0][3]);
  const end = toMin(t[1][1], t[1][2], t[1][3]);
  if (!(end > start)) return null;
  let days = null;
  const d = s.toLowerCase().match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|–|to)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/);
  if (d) {
    days = [];
    for (let i = DAYS.indexOf(d[1]); ; i = (i + 1) % 7) { days.push(i); if (i === DAYS.indexOf(d[2])) break; }
  }
  return { start, end, days, opens: `${Number(t[0][1])}:${t[0][2] || '00'} ${t[0][3].toUpperCase()}` };
}

/** Open now on India time (UTC+5:30)? null when the hours cannot be read. Pure (now injected). */
export function careOpen(text, now = Date.now()) {
  const h = parseCareHours(text);
  if (!h) return null;
  const ist = new Date(now + 330 * 60000);
  const min = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (h.days && !h.days.includes(ist.getUTCDay())) return { open: false, opens: h.opens };
  return { open: min >= h.start && min < h.end, opens: h.opens };
}
