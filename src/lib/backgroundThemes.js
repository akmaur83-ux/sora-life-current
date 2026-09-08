// Decorative art direction uses explicit product/category text, never inferred
// health benefits or invented ingredient claims. Unknown products stay neutral.
export const SECTION_THEMES = {
  trending: 'botanical', 'shop-by-category': 'citrus', 'shop-by-concerns': 'hydration',
  brands: 'gold', discover: 'silk', popular: 'berry', 'mom-trust': 'coconut',
  collections: 'floral', 'why-sora-life': 'mineral',
};
export const BACKGROUND_THEMES = {
  botanical: { colors: ['30 154 93', '173 202 58', '223 235 201'], shapes: ['sprig', 'sprig', 'leaf', 'leaf', 'mote'] },
  citrus: { colors: ['255 128 20', '255 192 42', '254 228 173'], shapes: ['citrus', 'citrus', 'droplet', 'mote', 'mote'] },
  hydration: { colors: ['0 171 190', '65 133 230', '218 237 239'], shapes: ['ripple', 'ripple', 'pearl', 'pearl', 'droplet'] },
  gold: { colors: ['195 133 25', '244 184 60', '248 232 195'], shapes: ['beam', 'beam', 'mote', 'mote', 'mote'] },
  silk: { colors: ['215 114 128', '231 168 100', '247 227 211'], shapes: ['ribbon', 'ribbon', 'pearl', 'pearl', 'mote'] },
  berry: { colors: ['239 120 26', '229 174 39', '249 226 182'], shapes: ['berries', 'berries', 'droplet', 'mote', 'mote'] },
  coconut: { colors: ['160 174 110', '185 146 103', '239 230 205'], shapes: ['coconut', 'coconut', 'leaf', 'droplet', 'mote'] },
  floral: { colors: ['217 76 124', '176 112 192', '246 219 219'], shapes: ['petal', 'petal', 'petal', 'pearl', 'mote'] },
  nutrient: { colors: ['47 158 118', '216 178 58', '235 228 199'], shapes: ['capsule', 'capsule', 'orbit', 'mote', 'mote'] },
  oil: { colors: ['182 135 48', '221 176 86', '249 231 191'], shapes: ['droplet', 'droplet', 'ribbon', 'mote', 'mote'] },
  mineral: { colors: ['131 155 161', '174 180 175', '232 235 227'], shapes: ['crystal', 'crystal', 'beam', 'mote', 'mote'] },
};
export function productBackgroundTheme(product) {
  if (!product) return 'mineral';
  const name = String(product.name || '').toLowerCase();
  const category = String(product.category || '').toLowerCase();
  if (/device|apparatus|massager|purifier|bracelet/.test(name)) return 'mineral';
  // Named families take precedence over the broader category fallback.
  if (/\b(capsules?|tablets?|protein powder)\b/.test(name)) return 'nutrient';
  if (/\b(coconut)\b/.test(name)) return 'coconut';
  if (/\b(lemon|orange|citrus|vitamin[ -]?c|grape ?fruit)\b/.test(name)) return 'citrus';
  if (/\b(rose|lavender|jasmine|hibiscus)\b/.test(name)) return 'floral';
  if (/sea ?buckthorn|\bberr(y|ies)\b/.test(name)) return 'berry';
  if (/\b(peppermint|mint|neem|tulsi|aloe|herbal|rosemary)\b/.test(name)) return 'botanical';
  if (/\boil\b/.test(name)) return 'oil';
  if (/cream|lotion|butter|mask/.test(name)) return 'silk';
  if (/serum|wash|gel|toner|hydrat/.test(name)) return 'hydration';
  if (/supplement|body-building/.test(category)) return 'nutrient';
  if (/skin|bath|personal-care/.test(category)) return 'hydration';
  if (/hair/.test(category)) return 'silk';
  if (/juices|drinks/.test(category)) return 'citrus';
  return 'mineral';
}
