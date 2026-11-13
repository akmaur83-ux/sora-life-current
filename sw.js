/* SORA LIFESTYLE app service worker (2026-11-13: the SORA app, deep).
 *
 * What it does, and only this:
 *   * pages and the app's own code — network first, so a deploy is live at once;
 *     when the network is slow (3.5 s) or gone, the last copy that loaded;
 *   * the site's own pictures (/img, /assets, /video posters, /public/art) — from
 *     the device once seen, refreshed in the background;
 *   * the public catalogue (products, categories, media, promotions, the published
 *     storefront) read from Supabase — network first, the last answer when offline,
 *     so products already seen can still be browsed with no signal;
 *   * nothing else. Never touched: /api/*, checkout and payment (Razorpay), sign-in,
 *     orders, addresses, coupons, anything with a method other than GET, anything
 *     the admin pages read. Those always go straight to the network.
 *
 * No connection and no saved copy: /offline.html.
 * To switch the app off for every device: replace this file with one that calls
 * self.registration.unregister() (see the comment at the end).
 */
const VERSION = 'sora-app-v1';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const KEEP = [SHELL, PAGES, STATIC, DATA];

const PRECACHE = [
  '/', '/offline.html', '/public/bundle.js', '/public/app.css', '/public/app-deferred.css',
  '/manifest.webmanifest', '/assets/app-icon-192.png', '/assets/sora-lifestyle-bird-header.webp',
];

// Public catalogue tables the storefront reads (the same rows every visitor sees).
const PUBLIC_TABLES = /^\/rest\/v1\/(catalogue_products|catalogue_variants|catalogue_categories|catalogue_product_media|products|product_media|product_variants|categories|promotions|site_settings|storefront_published)(\?|$)/;
// Never served from the device, whatever else is true.
const NEVER = /^\/(api|admin|checkout|cart|login|creator|invoice|passport|account)(\/|$)|^\/(fashion|homeliving|grocery)\/(cart|checkout)(\/|$)/;
const NETWORK_WAIT_MS = 3500;
const LIMITS = { [PAGES]: 40, [STATIC]: 250, [DATA]: 80 };

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One failed file must not stop the app installing: each is tried on its own.
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('sora-app-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch { /* not supported */ } }
    await self.clients.claim();
  })());
});

async function trim(name) {
  const max = LIMITS[name];
  if (!max) return;
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

async function put(name, request, response) {
  if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) return;
  try {
    const cache = await caches.open(name);
    await cache.put(request, response);
    trim(name);
  } catch { /* storage full or off: carry on without saving */ }
}

const timeout = (ms) => new Promise((resolve) => { setTimeout(() => resolve(null), ms); });

/** Network first; after NETWORK_WAIT_MS (or on failure) the saved copy, if there is one. */
async function networkFirst(event, request, name, { preload } = {}) {
  const fromNet = (async () => {
    const res = (preload && (await event.preloadResponse.catch(() => null))) || (await fetch(request));
    event.waitUntil(put(name, request, res.clone()));
    return res;
  })();
  fromNet.catch(() => {});
  const first = await Promise.race([fromNet.catch(() => null), timeout(NETWORK_WAIT_MS)]);
  if (first) return first;
  const saved = await caches.match(request, { ignoreVary: true });
  if (saved) return saved;
  return fromNet; // nothing saved: keep waiting for the network (it may still answer, or fail)
}

/** Saved copy at once if there is one, refreshed in the background; else the network. */
async function staleWhileRevalidate(event, request, name) {
  const saved = await caches.match(request);
  const fresh = fetch(request).then((res) => { event.waitUntil(put(name, request, res.clone())); return res; });
  if (saved) { event.waitUntil(fresh.catch(() => {})); return saved; }
  return fresh;
}

async function page(event) {
  try {
    return await networkFirst(event, event.request, PAGES, { preload: true });
  } catch {
    // Offline and this page never saved: the app shell can draw any route; else the offline page.
    return (await caches.match('/', { ignoreSearch: true })) || (await caches.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch { return; }

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;
    if (NEVER.test(url.pathname)) {
      // Straight to the network; with no connection at all, the offline page instead of the browser's error.
      if (request.mode === 'navigate') event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
      return;
    }
    if (request.mode === 'navigate') { event.respondWith(page(event)); return; }
    if (/^\/public\/(bundle\.js|app\.css|app-deferred\.css|chunks\/)/.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
      event.respondWith(networkFirst(event, request, SHELL).catch(() => caches.match(request).then((r) => r || Response.error())));
      return;
    }
    if (/^\/(img|assets|video\/[^/]+\/[^/]+\.webp$|public\/(art|category-images))/.test(url.pathname) && !/\.(mp4|webm)$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(event, request, STATIC).catch(() => Response.error()));
    }
    return;
  }

  // The public catalogue from Supabase; never for the admin pages, never with a Range header.
  if (/\.supabase\.co$/.test(url.hostname) && PUBLIC_TABLES.test(url.pathname + (url.search ? '?' : ''))) {
    const ref = request.referrer || '';
    if (/\/admin(\/|$)/.test(ref) || request.headers.has('range')) return;
    event.respondWith(networkFirst(event, request, DATA).catch(() => caches.match(request).then((r) => r || Response.error())));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'sora:skip-waiting') self.skipWaiting();
});

/* Kill switch, if ever needed — replace everything above with:
 *   self.addEventListener('install', () => self.skipWaiting());
 *   self.addEventListener('activate', (e) => e.waitUntil((async () => {
 *     for (const n of await caches.keys()) await caches.delete(n);
 *     await self.registration.unregister();
 *     for (const c of await self.clients.matchAll()) c.navigate(c.url);
 *   })()));
 */
