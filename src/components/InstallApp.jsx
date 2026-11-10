import { useSyncExternalStore } from 'react';

// ============================================================
// "Install the SORA app" (owner, 2026-11-10: more features). The site carries a web
// app manifest (/manifest.webmanifest), so Chrome and Edge on Android and desktop can
// put SORA LIFESTYLE on the home screen as an app of its own: full screen, own icon,
// one tap away. The browser announces that it can (beforeinstallprompt); only then
// does the footer show the button, and it goes once installed.
// ============================================================
let deferred = null;
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const canInstall = () => !!deferred;
const never = () => false;

export function useCanInstall() { return useSyncExternalStore(subscribe, canInstall, never); }

export default function InstallApp({ className = '' }) {
  const can = useCanInstall();
  if (!can) return null;
  const install = async () => {
    const e = deferred;
    if (!e) return;
    try { await e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') { deferred = null; emit(); } } catch { /* dismissed */ }
  };
  return (
    <button type="button" className={`hx-install${className ? ` ${className}` : ''}`} onClick={install}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7v7m-3-3 3 3 3-3M10 18.5h4" /></svg>
      Install the SORA app
    </button>
  );
}
