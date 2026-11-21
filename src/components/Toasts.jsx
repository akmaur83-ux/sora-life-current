import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';
import { celebrateAdd, trackPresses } from '../lib/feel.js';

export default function Toasts() {
  const { toasts } = useStore();
  // Something just landed in the bag (round 35, 2026-11-21): a tick on the phone and its
  // picture flying into the bag icon (lib/feel.js). Each note is celebrated once.
  const seen = useRef(new Set());
  useEffect(() => { trackPresses(); }, []);
  useEffect(() => {
    for (const t of toasts) {
      if (seen.current.has(t.id)) continue;
      seen.current.add(t.id);
      if (t.kind === 'cart' && /^Added to cart/.test(String(t.message))) celebrateAdd();
    }
  }, [toasts]);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="t-ic"><Icon name={t.kind === 'wish' ? 'heart' : 'checkCircle'} size={18} /></span>
          <span className="t-body"><strong>{t.message}</strong></span>
        </div>
      ))}
    </div>
  );
}
