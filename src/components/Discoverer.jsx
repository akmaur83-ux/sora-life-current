import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import Icon from './Icon.jsx';

// ============================================================
// "First sold by …" (Creator Game v1, owner 2026-11-22): the creator who
// made the first sale of this product gets the credit on its page for good.
// product_discoverer() (0050) returns the creator's public display name
// only — the same field the public creator leaderboard already shows.
//
// Speed: the call waits until the browser is idle after the page has drawn,
// is made once per product per visit, and renders nothing while it waits or
// when nobody has sold the product yet. No layout is reserved for it.
// ============================================================

const cache = new Map();

/** "vikas shamra" → "Vikas Shamra". Pure. */
export const displayName = (name) => String(name || '').trim().replace(/\s+/g, ' ')
  .split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

const idle = (fn) => {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 4000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const t = setTimeout(fn, 1200);
  return () => clearTimeout(t);
};

export default function Discoverer({ productId }) {
  const key = productId == null ? '' : String(productId);
  const [name, setName] = useState(() => cache.get(key) || null);

  useEffect(() => {
    if (!key || !isSupabaseConfigured) return undefined;
    if (cache.has(key)) { setName(cache.get(key)); return undefined; }
    let live = true;
    const cancel = idle(() => {
      supabase.rpc('product_discoverer', { p_product_id: key })
        .then(({ data, error }) => {
          const n = !error && data && data.name ? displayName(data.name) : null;
          cache.set(key, n);
          if (live) setName(n);
        }, () => {});
    });
    return () => { live = false; cancel(); };
  }, [key]);

  if (!name) return null;
  return (
    <p className="sora-discoverer">
      <Icon name="sparkle" size={13} />
      <span>First sold by <b>{name}</b> · SORA Creator</span>
    </p>
  );
}
