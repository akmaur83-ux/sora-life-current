import { useEffect, useRef, useState } from 'react';

// ============================================================
// Search by voice (owner, 2026-11-10: more features): a microphone in the search
// boxes of every store. Tap, say "cotton kurta" (Indian English), and the store's
// results open. Uses the browser's own speech recognition (Chrome, Edge, Safari,
// Android); where the browser has none the button is simply not drawn. Nothing is
// recorded or kept by SORA.
// ============================================================
export function speechApi() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** What was heard, as a search: trimmed, without the full stop speech adds. */
export const spokenQuery = (t) => String(t || '').replace(/[.?!।]+\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 80);

const Mic = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export default function VoiceSearch({ onResult, className = '' }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  useEffect(() => {
    setOk(!!speechApi());
    return () => { try { rec.current?.abort(); } catch { /* already stopped */ } };
  }, []);
  if (!ok) return null;
  const toggle = () => {
    if (on) { try { rec.current?.stop(); } catch { /* already stopped */ } return; }
    const R = speechApi();
    if (!R) return;
    const r = new R();
    r.lang = 'en-IN'; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onresult = (e) => { const t = spokenQuery(e.results?.[0]?.[0]?.transcript); if (t.length >= 2) onResult(t); };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    try { r.start(); setOn(true); } catch { setOn(false); }
  };
  return (
    <>
      <button type="button" className={`hx-voice${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={toggle}
        aria-label={on ? 'Stop listening' : 'Search by voice'} aria-pressed={on} title="Search by voice"><Mic /></button>
      {on && <span className="hx-voice__tip" role="status">Listening… say what you’re looking for</span>}
    </>
  );
}
