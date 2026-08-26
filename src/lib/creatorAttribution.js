// ============================================================
// Creator Program — client-side attribution capture (FOUNDATION)
//
// When a visitor arrives with ?ref=SORA-ANJALI (optionally &campaign=…), this
// hands the PUBLIC code to the server, which resolves it to internal ids and
// records the event. The browser is never told the internal creator/campaign
// ids and never computes anything about commission.
//
// What is stored locally is an OPAQUE attribution handle plus the public
// display fields needed to say "you're shopping with <creator>". A forged
// handle resolves to nothing server-side, so tampering with localStorage
// cannot manufacture attribution — Part 2 will re-resolve it on the server.
//
// Privacy: the visitor id is a random value this browser generates for
// itself. No fingerprinting, no IP collection, no third-party calls.
// ============================================================

const VISITOR_KEY = 'sora.creator.visitor';
const ATTR_KEY = 'sora.creator.attribution';
const SEEN_KEY = 'sora.creator.seen'; // per-tab dedupe

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
function safeSet(storage, key, value) {
  try { storage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** Random, self-assigned visitor id. Clearing site data resets it. */
export function getVisitorId() {
  let id = safeGet(localStorage, VISITOR_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    safeSet(localStorage, VISITOR_KEY, id);
  }
  return id;
}

/** The stored attribution, or null when absent/expired/corrupt. */
export function getStoredAttribution() {
  const raw = safeGet(localStorage, ATTR_KEY);
  if (!raw) return null;
  try {
    const a = JSON.parse(raw);
    if (!a?.attributionId) return null;
    if (a.expiresAt && new Date(a.expiresAt).getTime() < Date.now()) return null;
    return a;
  } catch {
    return null;
  }
}

function store(attr) {
  safeSet(localStorage, ATTR_KEY, JSON.stringify(attr));
}

async function post(payload, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch('/api/creator/track', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false }));
}

/**
 * Read ?ref / &campaign from the current URL and record a landing event.
 * Safe to call on every navigation: it de-duplicates per tab, so a visitor
 * browsing with ?ref still in the URL produces one event, not one per render.
 *
 * Never throws and never blocks rendering — tracking must not be able to
 * break the storefront.
 */
export async function captureAttributionFromUrl(search) {
  try {
    const params = new URLSearchParams(search || window.location.search);
    const creatorRef = (params.get('ref') || '').trim();
    // `trk` is the unique per-link code (TRK-…). When present it is the more
    // specific identifier — it resolves to the exact link AND its campaign —
    // so it is what we send. `ref` alone still works for a plain creator link.
    const linkRef = (params.get('trk') || '').trim();
    const ref = linkRef || creatorRef;
    if (!ref) return null;
    const campaign = (params.get('campaign') || '').trim();

    const seenKey = `${ref}|${campaign}`;
    if (safeGet(sessionStorage, SEEN_KEY) === seenKey) return getStoredAttribution();
    safeSet(sessionStorage, SEEN_KEY, seenKey);

    const out = await post({
      ref,
      campaign,
      event: 'landing',
      visitorId: getVisitorId(),
      path: window.location.pathname,
    });

    if (!out?.ok) return null;

    const attr = {
      attributionId: out.attributionId,
      creatorCode: out.creatorCode,
      displayName: out.displayName,
      campaignCode: out.campaignCode || null,
      campaignName: out.campaignName || null,
      capturedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (Number(out.windowDays) || 30) * 86400000).toISOString(),
      linkedSignup: false,
    };
    store(attr);
    return attr;
  } catch {
    return null;
  }
}

/**
 * Record that the attributed visitor has just signed in/up, so Part 2 can
 * connect visitor -> account. Fires at most once per stored attribution. The
 * server derives the user id from the access token; the browser cannot claim
 * an arbitrary account.
 */
export async function linkAttributionToAccount(accessToken) {
  try {
    const attr = getStoredAttribution();
    if (!attr || attr.linkedSignup || !accessToken) return;
    const out = await post({
      ref: attr.creatorCode,
      campaign: attr.campaignCode || '',
      event: 'signup',
      visitorId: getVisitorId(),
      path: window.location.pathname,
    }, accessToken);
    if (out?.ok) store({ ...attr, linkedSignup: true });
  } catch {
    /* attribution is best-effort */
  }
}
