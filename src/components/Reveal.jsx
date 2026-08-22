import { useEffect, useRef, useState } from 'react';

// Lightweight scroll-reveal via IntersectionObserver.
// Honors prefers-reduced-motion (starts visible).
export default function Reveal({ children, as: Tag = 'div', delay = 0, className = '', ...rest }) {
  const ref = useRef(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(!!reduced);

  useEffect(() => {
    if (reduced || shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, shown]);

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
