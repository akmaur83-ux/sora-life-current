import { useEffect, useRef, useState } from 'react';

// Lightweight scroll-reveal via IntersectionObserver.
// Honors prefers-reduced-motion (starts visible).
// variant: 'up' (default) | 'fade' | 'scale' | 'left' | 'right' | 'soft'
const VARIANT_CLASS = {
  up: '',
  fade: 'reveal-fade',
  scale: 'reveal-scale',
  left: 'reveal-left',
  right: 'reveal-right',
  soft: 'reveal-soft',
};

export default function Reveal({ children, as: Tag = 'div', delay = 0, variant = 'up', className = '', ...rest }) {
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

  const variantClass = VARIANT_CLASS[variant] || '';
  return (
    <Tag ref={ref} className={`reveal ${variantClass} ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
