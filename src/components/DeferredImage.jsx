import { useEffect, useRef, useState } from 'react';

// Native loading="lazy" intentionally leaves the exact fetch threshold to the
// browser. Chromium's threshold is generous enough that long catalogue pages
// can fetch several full-resolution rows before the customer reaches them.
// This small shared observer keeps `src` off genuinely distant/hidden images,
// while still handing the final request to the browser before it scrolls in.
const callbacks = new WeakMap();
let observer;
const NEVER_REVEALED = Symbol('never-revealed');

function sharedObserver() {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') return null;
  if (!observer) {
    observer = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const reveal = callbacks.get(entry.target);
        observer.unobserve(entry.target);
        callbacks.delete(entry.target);
        reveal?.();
      }
    }, { rootMargin: '600px 180px' });
  }
  return observer;
}

export function useDeferredMedia(eager = false, identity = null) {
  const ref = useRef(null);
  const [revealedIdentity, setRevealedIdentity] = useState(eager ? identity : NEVER_REVEALED);
  const ready = eager || revealedIdentity === identity;

  useEffect(() => {
    if (eager) {
      setRevealedIdentity(identity);
      return undefined;
    }
    if (ready) return undefined;
    const node = ref.current;
    const io = sharedObserver();
    if (!node || !io) {
      // Progressive fallback for older browsers: never strand an image.
      setRevealedIdentity(identity);
      return undefined;
    }
    callbacks.set(node, () => setRevealedIdentity(identity));
    io.observe(node);
    return () => {
      io.unobserve(node);
      callbacks.delete(node);
    };
  }, [eager, identity, ready]);

  return { ref, ready };
}

export default function DeferredImage({
  src,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  ...props
}) {
  const eager = loading === 'eager' || fetchPriority === 'high';
  const { ref, ready } = useDeferredMedia(eager, src);
  return (
    <img
      {...props}
      ref={ref}
      src={ready ? src : undefined}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
    />
  );
}
