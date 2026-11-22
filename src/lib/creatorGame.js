// ============================================================
// Creator Game v1 (owner, 2026-11-22) — pure helpers.
//
// The numbers come from my_creator_game() (0050), computed server-side from
// paid, non-self-referred sales, so nothing here can award itself a badge.
// This file only names things, lays out the map and draws the share card.
// Lives in the creator portal's own chunk: a shopper never downloads it.
// ============================================================

export const BADGES = Object.freeze([
  { id: 'first_sale', name: 'Pehli Sale', hint: 'Your first sale', icon: 'sparkle' },
  { id: 'ten_sales', name: 'Das Ka Dum', hint: '10 sales', icon: 'star' },
  { id: 'fifty_sales', name: 'Half Century', hint: '50 sales', icon: 'award' },
  { id: 'club_10k', name: '₹10k Club', hint: '₹10,000 in confirmed sales', icon: 'card', money: true },
  { id: 'lakhpati', name: 'Lakhpati', hint: '₹1,00,000 in confirmed sales', icon: 'crown', money: true },
  { id: 'states_5', name: 'Paanch Pradesh', hint: 'Orders from 5 states', icon: 'mapPin' },
  { id: 'states_10', name: 'Bharat Darshan', hint: 'Orders from 10 states', icon: 'mapPin' },
  { id: 'weekend', name: 'Weekend Warrior', hint: '5 sales on a Saturday or Sunday', icon: 'clock' },
  { id: 'streak_4', name: 'Chaar Hafte', hint: 'A sale 4 weeks in a row', icon: 'leaf' },
  { id: 'repeat', name: 'Bharosa', hint: 'A customer came back to you', icon: 'heartHand' },
  { id: 'discoverer', name: 'Discoverer', hint: 'First creator to sell a product', icon: 'flask' },
]);

/** Server badges joined to their names, earned first. Unknown ids are dropped. */
export function badgeList(game) {
  const byId = new Map((Array.isArray(game?.badges) ? game.badges : []).map((b) => [b?.id, b]));
  return BADGES.map((meta, i) => {
    const b = byId.get(meta.id) || {};
    const target = Math.max(1, Number(b.target) || 1);
    const progress = Math.max(0, Math.min(target, Number(b.progress) || 0));
    return { ...meta, order: i, target, progress, earned: progress >= target, fraction: progress / target };
  }).sort((a, b) => (Number(b.earned) - Number(a.earned)) || (b.fraction - a.fraction) || (a.order - b.order));
}

export const LEAGUES = Object.freeze({
  kaansa: { name: 'Kaansa League', en: 'Bronze', levels: 'Levels 1–3', tone: '#9A6A3A' },
  chandi: { name: 'Chandi League', en: 'Silver', levels: 'Levels 4–6', tone: '#7C8A93' },
  sona: { name: 'Sona League', en: 'Gold', levels: 'Levels 7–10', tone: '#B58A2E' },
  heera: { name: 'Heera League', en: 'Diamond', levels: 'Levels 11+', tone: '#3C7FA0' },
});
export const leagueOf = (id) => LEAGUES[id] || LEAGUES.kaansa;

/** Whole days left in a season (0 on its last day). */
export function daysLeft(endsAt, now = new Date()) {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86400000) - 1);
}

// ---- Bharat Yatra: a tile map (one equal tile per state / UT) ----------
// A tile grid, not a drawn border map: every state gets a same-size tile in
// roughly its place, so small states are as visible as big ones and no
// boundary is drawn at all.
export const STATE_TILES = Object.freeze([
  { code: 'JK', name: 'Jammu and Kashmir', c: 2, r: 0, alt: ['jammu & kashmir', 'j&k'] },
  { code: 'LA', name: 'Ladakh', c: 3, r: 0 },
  { code: 'PB', name: 'Punjab', c: 2, r: 1 },
  { code: 'HP', name: 'Himachal Pradesh', c: 3, r: 1 },
  { code: 'UK', name: 'Uttarakhand', c: 4, r: 1, alt: ['uttaranchal'] },
  { code: 'CH', name: 'Chandigarh', c: 1, r: 1 },
  { code: 'AR', name: 'Arunachal Pradesh', c: 8, r: 1 },
  { code: 'RJ', name: 'Rajasthan', c: 1, r: 2 },
  { code: 'HR', name: 'Haryana', c: 2, r: 2 },
  { code: 'DL', name: 'Delhi', c: 3, r: 2, alt: ['nct of delhi', 'new delhi', 'national capital territory of delhi'] },
  { code: 'UP', name: 'Uttar Pradesh', c: 4, r: 2 },
  { code: 'BR', name: 'Bihar', c: 5, r: 2 },
  { code: 'SK', name: 'Sikkim', c: 6, r: 2 },
  { code: 'AS', name: 'Assam', c: 7, r: 2 },
  { code: 'NL', name: 'Nagaland', c: 8, r: 2 },
  { code: 'GJ', name: 'Gujarat', c: 0, r: 3 },
  { code: 'MP', name: 'Madhya Pradesh', c: 2, r: 3 },
  { code: 'CG', name: 'Chhattisgarh', c: 3, r: 3, alt: ['chattisgarh'] },
  { code: 'JH', name: 'Jharkhand', c: 4, r: 3 },
  { code: 'WB', name: 'West Bengal', c: 5, r: 3 },
  { code: 'ML', name: 'Meghalaya', c: 6, r: 3 },
  { code: 'TR', name: 'Tripura', c: 7, r: 3 },
  { code: 'MN', name: 'Manipur', c: 8, r: 3 },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', c: 0, r: 4, alt: ['daman and diu', 'dadra and nagar haveli', 'dnh and dd'] },
  { code: 'MH', name: 'Maharashtra', c: 1, r: 4 },
  { code: 'TS', name: 'Telangana', c: 2, r: 4 },
  { code: 'OD', name: 'Odisha', c: 3, r: 4, alt: ['orissa'] },
  { code: 'MZ', name: 'Mizoram', c: 7, r: 4 },
  { code: 'GA', name: 'Goa', c: 1, r: 5 },
  { code: 'KA', name: 'Karnataka', c: 2, r: 5 },
  { code: 'AP', name: 'Andhra Pradesh', c: 3, r: 5 },
  { code: 'LD', name: 'Lakshadweep', c: 0, r: 6 },
  { code: 'KL', name: 'Kerala', c: 1, r: 6 },
  { code: 'TN', name: 'Tamil Nadu', c: 2, r: 6 },
  { code: 'PY', name: 'Puducherry', c: 3, r: 6, alt: ['pondicherry'] },
  { code: 'AN', name: 'Andaman and Nicobar Islands', c: 6, r: 6, alt: ['andaman & nicobar islands', 'andaman and nicobar'] },
]);

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, ' ').trim();
const LOOKUP = new Map();
for (const t of STATE_TILES) {
  LOOKUP.set(norm(t.name), t.code);
  LOOKUP.set(norm(t.code), t.code);
  for (const a of t.alt || []) LOOKUP.set(norm(a), t.code);
}
/** A free-text state from an order address → its tile code, or null. */
export const stateCode = (name) => LOOKUP.get(norm(name)) || null;

/** Tiles with order counts and a 0–1 heat. */
export function yatraTiles(map) {
  const counts = new Map();
  for (const row of Array.isArray(map) ? map : []) {
    const code = stateCode(row?.state);
    if (code) counts.set(code, (counts.get(code) || 0) + (Number(row?.orders) || 0));
  }
  const max = Math.max(1, ...counts.values());
  const tiles = STATE_TILES.map((t) => {
    const orders = counts.get(t.code) || 0;
    return { ...t, orders, lit: orders > 0, heat: orders ? 0.35 + 0.65 * (orders / max) : 0 };
  });
  return { tiles, visited: tiles.filter((t) => t.lit).length, total: tiles.length };
}

// ---- Cha-ching ----------------------------------------------------------
const seenKey = (creatorId) => `sora.creator.chaching.${creatorId}`;
const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } };

/**
 * Sales the creator has not celebrated yet. The very first visit marks
 * everything as seen without a party, so old history never pops up at once.
 */
export function unseenSales(recent, creatorId, read = safeGet) {
  const list = (Array.isArray(recent) ? recent : []).filter((r) => r && r.id && r.at);
  if (!creatorId || list.length === 0) return { fresh: [], newest: null, first: read(seenKey(creatorId)) == null };
  const newest = list.reduce((m, r) => (r.at > m ? r.at : m), list[0].at);
  const seen = read(seenKey(creatorId));
  if (seen == null) return { fresh: [], newest, first: true };
  return { fresh: list.filter((r) => r.at > seen).sort((a, b) => (a.at < b.at ? 1 : -1)), newest, first: false };
}
export const markSeen = (creatorId, at, write = safeSet) => { if (creatorId && at) write(seenKey(creatorId), at); };

/** A short coin "cha-ching", synthesised: no audio file is downloaded. */
export function playChaChing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const tone = (freq, start, dur, vol) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.02);
    };
    tone(988, 0, 0.12, 0.22);
    tone(1319, 0.09, 0.45, 0.22);
    tone(2637, 0.09, 0.3, 0.05);
    setTimeout(() => ctx.close?.(), 900);
  } catch { /* sound is a bonus */ }
}
export const buzz = () => { try { navigator.vibrate?.([25, 40, 70]); } catch { /* not on desktop */ } };

// ---- Vanity code ----------------------------------------------------------
export const VANITY_RE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
/** Client-side first check (the server checks again, and more). */
export function vanityProblem(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c.length < 4) return 'At least 4 characters.';
  if (c.length > 16) return 'At most 16 characters.';
  if (!VANITY_RE.test(c)) return 'Letters, numbers and single hyphens only.';
  if (!/[A-Z]/.test(c)) return 'Needs at least one letter.';
  return null;
}
export const VANITY_REASON = Object.freeze({
  level_locked: 'Custom codes unlock at Elite rank (level 5).',
  bad_format: 'Use 4–16 letters or numbers, with single hyphens.',
  not_allowed: 'That code isn’t allowed.',
  reserved: 'That code is reserved.',
  taken: 'That code is already taken. Try another.',
  cooldown: 'You can change your code once every 30 days.',
  not_active: 'Your creator account needs to be active first.',
});

// ---- Wrapped card -----------------------------------------------------------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  return m ? MONTHS[Number(m[2]) - 1] : '';
};

/** The lines a Wrapped card shows — shared by the on-page preview and the PNG. */
export function wrappedLines(stats, { name, rank, league, code } = {}) {
  const s = stats || {};
  return {
    title: `Mera SORA ${monthName(s.month)}`,
    name: String(name || '').trim(),
    big: Number(s.sales) || 0,
    bigLabel: (Number(s.sales) || 0) === 1 ? 'sale' : 'sales',
    rows: [
      ['States reached', String(Number(s.states) || 0)],
      ['Cities reached', String(Number(s.cities) || 0)],
      ['Season points', (Number(s.points) || 0).toLocaleString('en-IN')],
      ['Rank', rank || 'Rise'],
      ['League', leagueOf(league).name],
    ],
    top: s.top_product ? String(s.top_product) : null,
    code: code ? String(code) : null,
  };
}

/** Draws the 1080×1350 share card on a canvas and resolves a PNG Blob. */
export async function drawWrapped(lines) {
  const W = 1080; const H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  try { await document.fonts?.ready; } catch { /* system fonts then */ }
  const serif = getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || 'Georgia, serif';
  const sans = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1E3A2F'); bg.addColorStop(1, '#0F2018');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(228,196,130,.55)'; g.lineWidth = 3; g.strokeRect(48, 48, W - 96, H - 96);

  g.fillStyle = '#E4C482'; g.font = `600 30px ${sans}`; g.textAlign = 'left';
  g.fillText('SORA LIFESTYLE · CREATOR PROGRAM', 100, 150);
  g.fillStyle = '#F6F3EB'; g.font = `500 84px ${serif}`;
  g.fillText(lines.title, 100, 260);
  if (lines.name) { g.fillStyle = 'rgba(246,243,235,.75)'; g.font = `400 38px ${sans}`; g.fillText(lines.name, 100, 320); }

  g.fillStyle = '#E4C482'; g.font = `600 260px ${serif}`;
  g.fillText(String(lines.big), 92, 600);
  g.fillStyle = '#F6F3EB'; g.font = `500 46px ${sans}`;
  g.fillText(lines.bigLabel, 100, 670);

  let y = 790;
  for (const [k, v] of lines.rows) {
    g.fillStyle = 'rgba(246,243,235,.65)'; g.font = `400 36px ${sans}`; g.textAlign = 'left'; g.fillText(k, 100, y);
    g.fillStyle = '#F6F3EB'; g.font = `600 40px ${sans}`; g.textAlign = 'right'; g.fillText(v, W - 100, y);
    g.strokeStyle = 'rgba(246,243,235,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(100, y + 26); g.lineTo(W - 100, y + 26); g.stroke();
    y += 78;
  }
  g.textAlign = 'left';
  if (lines.top) {
    g.fillStyle = 'rgba(246,243,235,.65)'; g.font = `400 32px ${sans}`; g.fillText('Most loved', 100, y + 40);
    g.fillStyle = '#E4C482'; g.font = `600 40px ${sans}`;
    let t = lines.top;
    if (g.measureText(t).width > W - 200) {
      while (g.measureText(`${t}…`).width > W - 200 && t.length > 4) t = t.slice(0, -1);
      t = `${t.trimEnd()}…`;
    }
    g.fillText(t, 100, y + 92);
  }
  g.fillStyle = 'rgba(246,243,235,.8)'; g.font = `500 32px ${sans}`;
  g.fillText(lines.code ? `Shop with my code ${lines.code}` : 'soralifestyle.in', 100, H - 110);
  g.textAlign = 'right'; g.fillStyle = 'rgba(246,243,235,.55)'; g.fillText('soralifestyle.in', W - 100, H - 110);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}
