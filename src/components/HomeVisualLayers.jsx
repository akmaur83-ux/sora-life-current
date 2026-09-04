import { useEffect, useState } from 'react';
import DeferredImage from './DeferredImage.jsx';

// Decorative images are separate, non-interactive layers, never content
// overlays. Their opacity cannot fade category labels or promotion artwork.
export default function HomeVisualLayers({ background, texture, left, right }) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(max-width: 767px)').matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  const layers = [
    background && { ...background, name: 'background' },
    texture && { ...texture, name: 'texture' },
    left && { ...left, name: 'left' },
    right && { ...right, name: 'right' },
  ].filter((layer) => layer?.url && !(mobile && layer.hideMobile));
  if (!layers.length) return null;
  return <div className="hp-visual-layers" aria-hidden="true">
    {layers.map((layer) => <DeferredImage key={`${layer.name}:${layer.url}`} alt="" src={layer.url}
      className={`hp-visual-layer hp-visual-layer--${layer.name}${layer.hideMobile ? ' hp-visual-layer--mobile-hidden' : ''}`}
      style={{ opacity: layer.opacity, objectFit: layer.fit || 'contain', objectPosition: layer.position || 'center', ...(layer.size ? { width: layer.size } : {}) }}
      loading="lazy" decoding="async" onError={(e) => { e.currentTarget.hidden = true; }} />)}
  </div>;
}
