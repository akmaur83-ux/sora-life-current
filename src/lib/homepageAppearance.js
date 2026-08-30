// Structured presentation fields inside site_settings.homepage.visuals.
// No CSS/HTML input is accepted. Shared by the editor and storefront reader.
export const IMAGE_POSITIONS = ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'];
const color = (label, value) => ({ label, type: 'color', value });
const number = (label, value, min, max, step = 1) => ({ label, type: 'number', value, min, max, step });
const toggle = (label, value = false) => ({ label, type: 'boolean', value });
const image = (label) => ({ label, type: 'image', value: '' });
const select = (label, value, options) => ({ label, type: 'select', value, options });

export const HOMEPAGE_VISUAL_FIELDS = {
  categoryStrip: {
    enabled: toggle('Enable category background', false),
    backgroundColor: color('Background color', '#F7F1E7'),
    imageUrl: image('Background strip image'),
    imageSize: select('Background image fit', 'cover', ['cover', 'contain']),
    imagePosition: select('Background image position', 'center center', IMAGE_POSITIONS),
    imageOpacity: number('Background image opacity', 1, 0, 1, 0.05),
    overlayColor: color('Overlay color', '#FBF8F1'),
    overlayOpacity: number('Overlay strength (0 = off)', 0, 0, 1, 0.05),
    paddingTop: number('Top padding (px)', 12, 0, 48),
    paddingBottom: number('Bottom padding (px)', 12, 0, 48),
    borderTop: toggle('Show top border'),
    borderBottom: toggle('Show bottom border'),
    borderColor: color('Border color', '#DED2C4'),
    borderWidth: number('Border thickness (px)', 1, 0, 4),
    radius: number('Corner radius (px)', 8, 0, 16),
    textureUrl: image('Decorative texture'),
    texturePosition: select('Texture position', 'center center', IMAGE_POSITIONS),
    leftImage: image('Left decoration'),
    rightImage: image('Right decoration'),
    decorationOpacity: number('Decoration opacity', 0.25, 0, 1, 0.05),
    decorationSize: number('Decoration width (px)', 120, 24, 240),
    decorationPosition: select('Decoration vertical position', 'center', ['top', 'center', 'bottom']),
    hideTextureMobile: toggle('Hide texture on mobile'),
    hideLeftMobile: toggle('Hide left decoration on mobile', true),
    hideRightMobile: toggle('Hide right decoration on mobile', true),
  },
  offers: {
    backgroundColor: color('Section background', '#FBF8F1'),
    frameColor: color('Frame interior', '#FFF8ED'),
    frameEnabled: toggle('Show bordered frame', true),
    borderColor: color('Frame border color', '#702B3B'),
    borderWidth: number('Frame border thickness (px)', 1, 0, 4),
    accentColor: color('Heading and accent color', '#702B3B'),
    radius: number('Frame corner radius (px)', 12, 0, 16),
    textureUrl: image('Frame background image / texture'),
    textureOpacity: number('Texture opacity', 0.12, 0, 1, 0.01),
    padding: number('Section top and bottom padding (px)', 20, 0, 48),
    gap: number('Gap between promotions (px)', 16, 8, 32),
    desktopColumns: select('Maximum promotions per desktop row', 2, [1, 2, 3]),
    mobileWidth: number('Mobile promotion width (%)', 90, 88, 92),
    decorationUrl: image('Optional decorative artwork'),
    decorationOpacity: number('Artwork opacity', 0.15, 0, 1, 0.05),
    decorationSize: number('Artwork width (px)', 160, 24, 240),
  },
};

export function safeVisualUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();
  if (raw.length > 2000 || /[\s\\\u0000-\u001f\u007f]/.test(raw)) return '';
  let url;
  try { url = new URL(raw, 'https://visual.invalid'); } catch { return ''; }
  if (url.username || url.password || url.port || /\.(svg|html?)$/i.test(url.pathname)) return '';
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return ''; }
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return '';
  if (raw.startsWith('/') && !raw.startsWith('//') && url.origin === 'https://visual.invalid') return raw;
  if (!raw.startsWith('https://') || url.protocol !== 'https:') return '';
  const host = url.hostname;
  // Visual URLs load in <img>, never via a server fetch. Still reject local,
  // private and literal-IP destinations rather than probing a user's LAN.
  if (!host.includes('.') || /^(localhost|.*\.(localhost|local|internal|test|invalid|lan|home\.arpa))$/i.test(host)
    || /^[\d.]+$/.test(host) || host.includes(':')) return '';
  return url.href;
}

export function sanitizeHomepageVisuals(raw) {
  const result = {};
  for (const [group, fields] of Object.entries(HOMEPAGE_VISUAL_FIELDS)) {
    result[group] = {};
    for (const [key, field] of Object.entries(fields)) {
      const v = raw?.[group]?.[key];
      let clean = field.value;
      if (field.type === 'boolean' && typeof v === 'boolean') clean = v;
      if (field.type === 'color' && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) clean = v;
      if (field.type === 'image') clean = safeVisualUrl(v);
      if (field.type === 'select' && field.options.includes(v)) clean = v;
      if (field.type === 'number' && v !== '' && v != null && Number.isFinite(Number(v))) {
        clean = Math.min(field.max, Math.max(field.min, Number(v)));
      }
      result[group][key] = clean;
    }
  }
  return result;
}

export function mergeHomepageVisuals(current, visuals) {
  return { ...(current && typeof current === 'object' ? current : {}), visuals: sanitizeHomepageVisuals(visuals) };
}

// Keep the placement runtime and its sort/date/active rules authoritative.
// De-duplicate IDs only; never slice away additional posters or offer cards.
export function uniqueHomepagePromotions(promotions) {
  const seen = new Set();
  return promotions.filter((promo) => {
    if (seen.has(promo.id)) return false;
    seen.add(promo.id);
    return true;
  });
}
