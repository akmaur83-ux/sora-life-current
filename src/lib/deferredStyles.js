// ============================================================
// Styles for the routes outside the shop: /admin, /passport, /creator.
//
// These live in public/app-deferred.css (built by scripts/build-css.mjs) and
// are NOT linked from index.html. A shopper on a phone was downloading ~58 KB
// of admin, passport and creator CSS — render-blocking, ahead of first paint —
// on every storefront page, to style routes they will never open.
//
// Loading rules:
//   * landing directly on one of those routes injects the stylesheet into
//     <head> before React renders, so the browser blocks paint on it exactly
//     as it did before and there is no flash of unstyled content;
//   * anywhere else it is fetched when the main thread is next idle, so it is
//     already cached before the user can navigate there;
//   * navigating to one of those routes in-app asks for it again, which is a
//     no-op if it is already in the document.
//
// Injected from JS rather than left in index.html with the usual
// media="print" onload swap because the Content-Security-Policy has no
// 'unsafe-inline' in script-src, so inline event handlers do not run.
// ============================================================
export const DEFERRED_ROUTES = /^\/(admin|passport|creator)(\/|$)/;

export function loadDeferredStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-deferred-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/public/app-deferred.css';
  link.setAttribute('data-deferred-styles', '');
  document.head.appendChild(link);
}

/** Called once at startup, before the app renders. */
export function scheduleDeferredStyles() {
  if (typeof window === 'undefined') return;

  if (DEFERRED_ROUTES.test(window.location.pathname)) {
    loadDeferredStyles();
    return;
  }

  // Storefront. Wait for `load` BEFORE going idle: on Slow 4G an idle
  // callback fires while the bundle and fonts are still arriving, so a
  // 54 KB stylesheet for routes nobody is on ends up competing for the
  // very bandwidth first paint is waiting on. Measured: it was showing up
  // as the fifth-heaviest resource on the homepage. After `load` there is
  // nothing left to starve.
  const afterLoad = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(loadDeferredStyles, { timeout: 10000 });
    } else {
      setTimeout(loadDeferredStyles, 1500);
    }
  };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}
