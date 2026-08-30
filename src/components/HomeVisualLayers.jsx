// Decorative images are separate, non-interactive layers, never content
// overlays. Their opacity cannot fade category labels or promotion artwork.
export default function HomeVisualLayers({ background, texture, left, right }) {
  const layers = [
    background && { ...background, name: 'background' },
    texture && { ...texture, name: 'texture' },
    left && { ...left, name: 'left' },
    right && { ...right, name: 'right' },
  ].filter((layer) => layer?.url);
  if (!layers.length) return null;
  return <div className="hp-visual-layers" aria-hidden="true">
    {layers.map((layer) => <img key={`${layer.name}:${layer.url}`} alt="" src={layer.url}
      className={`hp-visual-layer hp-visual-layer--${layer.name}${layer.hideMobile ? ' hp-visual-layer--mobile-hidden' : ''}`}
      style={{ opacity: layer.opacity, objectFit: layer.fit || 'contain', objectPosition: layer.position || 'center', ...(layer.size ? { width: layer.size } : {}) }}
      loading="lazy" decoding="async" onError={(e) => { e.currentTarget.hidden = true; }} />)}
  </div>;
}
