import { useState } from 'react';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';

// ============================================================
// "Share my wishlist" (owner, 2026-11-08: more features): the saved products as
// a list of names, prices and links — for a gift hint, or to ask family. The
// phone's share sheet where there is one, WhatsApp otherwise. Nothing leaves the
// browser unless the visitor sends it.
// ============================================================
const ORIGIN = 'https://www.soralifestyle.in';

/** The message text; pure, so a test can call it. */
export function wishlistText(items, heading = 'My SORA LIFESTYLE wishlist') {
  const lines = (items || []).slice(0, 20).map((p, i) => `${i + 1}. ${p.name}${p.price > 0 ? ` — ${money(p.price)}` : ''}\n${ORIGIN}${p.href}`);
  return `${heading}:\n\n${lines.join('\n\n')}`;
}

export default function ShareList({ items, heading }) {
  const [note, setNote] = useState('');
  if (!items || items.length === 0) return null;
  const text = wishlistText(items, heading);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: heading || 'My wishlist', text }); return; }
    } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setNote('Opening WhatsApp…');
  };
  return (
    <p className="hx-share">
      <button type="button" className="hx-share__btn" onClick={share}><Icon name="chat" size={16} /> Share my wishlist</button>
      {note && <span role="status">{note}</span>}
    </p>
  );
}
