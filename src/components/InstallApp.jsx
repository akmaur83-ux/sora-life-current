import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isIosSafari, isStandalone } from '../lib/appMode.js';

// ============================================================
// "Install the SORA app" (owner, 2026-11-10; deeper 2026-11-13). The site carries a
// web app manifest and a service worker (/sw.js), so it installs as an app of its
// own: full screen, own icon, works offline for what was already seen.
//
//   * Chrome / Edge / Samsung Internet (Android, desktop): the browser announces it
//     can install (beforeinstallprompt); the button opens the browser's own dialog.
//   * iPhone / iPad Safari: there is no such dialog, so the button opens a short
//     guide: Share → Add to Home Screen → Add.
//   * Anywhere else, or already running as the app: nothing is shown.
// ============================================================
let deferred = null;
let installedNow = false;
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; emit(); });
}
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const canInstall = () => !!deferred;
const never = () => false;

export function useCanInstall() { return useSyncExternalStore(subscribe, canInstall, never); }

/** 'prompt' (the browser's dialog), 'ios' (the Share guide) or '' (nothing to offer here). */
export function useInstallMode() {
  const can = useCanInstall();
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIos(!isStandalone() && isIosSafari(navigator.userAgent, navigator.maxTouchPoints, navigator.platform));
  }, []);
  if (installedNow) return '';
  if (can) return 'prompt';
  return ios ? 'ios' : '';
}

/** Opens the browser's install dialog; true when the visitor accepted. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  try {
    await e.prompt();
    const r = await e.userChoice;
    if (r?.outcome === 'accepted') { deferred = null; emit(); return true; }
  } catch { /* dismissed */ }
  return false;
}

const ShareGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
);
const PlusGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
);

/** The iPhone guide: three steps, closes on Escape, the backdrop or the button. */
export function IosInstallGuide({ onClose }) {
  const closer = useRef(null);
  useEffect(() => {
    closer.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="hx-ios" role="dialog" aria-modal="true" aria-labelledby="hx-ios-h" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hx-ios__box">
        <img src="/assets/app-icon-192.png" alt="" width="64" height="64" className="hx-ios__icon" />
        <h2 id="hx-ios-h">Install the SORA app</h2>
        <p className="hx-ios__lede">Add SORA LIFESTYLE to your Home Screen: it opens full screen like an app, and products you’ve seen stay available offline.</p>
        <ol className="hx-ios__steps">
          <li><span className="hx-ios__n">1</span><span>Tap <b>Share</b> <i className="hx-ios__glyph"><ShareGlyph /></i> in Safari’s toolbar</span></li>
          <li><span className="hx-ios__n">2</span><span>Scroll down and tap <b>Add to Home Screen</b> <i className="hx-ios__glyph"><PlusGlyph /></i></span></li>
          <li><span className="hx-ios__n">3</span><span>Tap <b>Add</b>. SORA appears on your Home Screen.</span></li>
        </ol>
        <button type="button" ref={closer} className="hx-ios__ok" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function InstallApp({ className = '', label = 'Install the SORA app' }) {
  const mode = useInstallMode();
  const [guide, setGuide] = useState(false);
  if (!mode) return null;
  const install = () => { if (mode === 'ios') setGuide(true); else promptInstall(); };
  return (
    <>
      <button type="button" className={`hx-install${className ? ` ${className}` : ''}`} onClick={install}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7v7m-3-3 3 3 3-3M10 18.5h4" /></svg>
        {label}
      </button>
      {guide && <IosInstallGuide onClose={() => setGuide(false)} />}
    </>
  );
}
