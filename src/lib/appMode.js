// ============================================================
// The SORA app (owner, 2026-11-13: "sora app pe kaam kro ache se deep mein").
// SORA LIFESTYLE installs from the browser as an app of its own (manifest +
// service worker, /sw.js). These are the small, pure rules the app pieces share:
// where it is running, whether to offer the install, and the visit count that
// decides when. Nothing here is sent anywhere; this browser only.
// ============================================================
export const APP_KEY = 'sora.app.v1';
export const NUDGE_EVERY_MS = 30 * 86400 * 1000;   // a dismissed install card stays away 30 days
export const NUDGE_MIN_VISITS = 2;                   // never on the very first visit
export const NUDGE_AFTER_MS = 15000;

/** iPhone / iPad Safari (not Chrome/Firefox/Edge/in-app browsers on iOS), which installs only through Share → Add to Home Screen. Pure. */
export function isIosSafari(ua = '', maxTouchPoints = 0, platform = '') {
  const s = String(ua);
  const ios = /iPhone|iPad|iPod/.test(s) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (!ios) return false;
  return /Safari\//.test(s) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(s);
}

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.matchMedia?.('(display-mode: minimal-ui)').matches || win.navigator?.standalone === true);
  } catch { return false; }
}

/** Today's visit counted once per day: { visits, day, dismissed }. Pure. */
export function countVisit(state, now) {
  const s = state && typeof state === 'object' ? state : {};
  const day = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const visits = Number(s.visits) || 0;
  return { ...s, visits: s.day === day ? visits : visits + 1, day };
}

/** Show the install card? Second visit or later, installable here, not dismissed in the last 30 days. Pure. */
export function shouldNudge(state, { now, canInstall, standalone, phone }) {
  if (standalone || !canInstall || !phone) return false;
  const s = state || {};
  if ((Number(s.visits) || 0) < NUDGE_MIN_VISITS) return false;
  if (s.dismissed && now - Number(s.dismissed) < NUDGE_EVERY_MS) return false;
  return true;
}

export const readApp = () => { try { return JSON.parse(window.localStorage.getItem(APP_KEY) || 'null'); } catch { return null; } };
export const writeApp = (v) => { try { window.localStorage.setItem(APP_KEY, JSON.stringify(v)); } catch { /* storage off */ } };
