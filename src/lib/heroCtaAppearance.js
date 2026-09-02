import { safeVisualUrl } from './homepageAppearance.js';

const number = (label, value, min, max, step = 1) => ({ label, type: 'number', value, min, max, step });
const select = (label, value, options) => ({ label, type: 'select', value, options });
const color = (label) => ({ label, type: 'color', value: '' });
export const HERO_CTA_FIELDS = {
  desktopPosition: select('Desktop position', 'flow', ['flow', 'custom']), x: number('Desktop horizontal position (%)', 0, 0, 100), y: number('Desktop vertical position (%)', 75, 0, 100),
  mobilePosition: select('Mobile position', 'auto', ['auto', 'custom']), mobileX: number('Mobile horizontal position (%)', 50, 0, 100), mobileY: number('Mobile vertical position (%)', 95, 0, 100),
  width: number('Button width (px; 0 = automatic)', 118, 0, 480), paddingX: number('Horizontal padding (px)', 14, 4, 48), paddingY: number('Vertical padding (px)', 7, 0, 24),
  backgroundColor: color('Background color (blank = theme)'), textColor: color('Text color (blank = theme)'), borderColor: color('Border color (blank = theme)'),
  borderWidth: number('Border thickness (px)', 1, 0, 6), radius: number('Corner radius (px)', 2, 0, 40), fontSize: number('Font size (px; 0 = responsive default)', 13, 0, 24),
  fontWeight: select('Font weight', 700, [400, 500, 600, 700]), opacity: number('Button opacity', 1, 0.3, 1, 0.05), shadow: select('Button shadow', 'none', ['none', 'subtle']),
  textureUrl: { label: 'Button background texture', type: 'image', value: '' }, textureOpacity: number('Texture opacity', 0.25, 0, 1, 0.05), textureFit: select('Texture fit', 'cover', ['cover', 'contain']),
  iconUrl: { label: 'Button icon image', type: 'image', value: '' }, iconSide: select('Icon side', 'left', ['left', 'right']), iconSize: number('Icon size (px)', 16, 10, 32),
};

export function sanitizeHeroCta(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(Object.entries(HERO_CTA_FIELDS).map(([key, f]) => {
    const v = raw[key]; let value = f.value;
    if (f.type === 'number' && v !== '' && (typeof v === 'number' || typeof v === 'string') && Number.isFinite(Number(v))) value = Math.min(f.max, Math.max(f.min, Number(v)));
    if (f.type === 'select' && f.options.includes(v)) value = v;
    if (f.type === 'color' && typeof v === 'string' && /^#[\da-f]{6}$/i.test(v)) value = v;
    if (f.type === 'image') value = safeVisualUrl(v);
    return [key, value];
  }));
}

export function mergeHeroCta(homepage, slideId, appearance) {
  if (typeof slideId !== 'string' || !/^[\w-]{1,100}$/.test(slideId) || ['__proto__', 'constructor', 'prototype'].includes(slideId)) throw new Error('Invalid slide ID');
  return { ...homepage, heroCtas: { ...(homepage?.heroCtas || {}), [slideId]: sanitizeHeroCta(appearance) } };
}

export function heroCtaStyle(input) {
  const a = sanitizeHeroCta(input);
  // Auto always resolves to the current safe mobile default, including for
  // older saved records that may contain legacy X/Y values.
  const mobileX = a.mobilePosition === 'custom' ? a.mobileX : 50;
  const mobileY = a.mobilePosition === 'custom' ? a.mobileY : 95;
  return { '--hcta-x': `${a.x}%`, '--hcta-y': `${a.y}%`, '--hcta-mobile-x': `${mobileX}%`, '--hcta-mobile-y': `${mobileY}%`, '--hcta-width': a.width ? `${a.width}px` : 'auto',
    '--hcta-px': `${a.paddingX}px`, '--hcta-py': `${a.paddingY}px`, '--hcta-bg': a.backgroundColor || 'var(--slv2-primary, var(--slv2-f700))', '--hcta-text': a.textColor || 'var(--slv2-ivory)',
    '--hcta-border': a.borderColor || 'transparent', '--hcta-border-width': `${a.borderWidth}px`, '--hcta-radius': `${a.radius}px`, '--hcta-font': a.fontSize ? `${a.fontSize}px` : undefined,
    '--hcta-weight': a.fontWeight, '--hcta-opacity': a.opacity, '--hcta-shadow': a.shadow === 'subtle' ? '0 2px 6px rgb(0 0 0 / 16%)' : 'none', '--hcta-texture-opacity': a.textureOpacity,
    '--hcta-texture-fit': a.textureFit, '--hcta-icon-size': `${a.iconSize}px` };
}
