import assert from 'node:assert/strict';
import { BACKGROUND_THEMES, SECTION_THEMES, productBackgroundTheme } from '../src/lib/backgroundThemes.js';
const signatures = Object.values(SECTION_THEMES).map(id => BACKGROUND_THEMES[id].shapes.join(','));
assert.equal(new Set(signatures).size, signatures.length, 'each named homepage section has a distinct motif set');
for (const [name, category, expected] of [
  ['Peppermint Bathing Bar', 'bath-body', 'botanical'],
  ['Sea Buckthorn Face Wash', 'skin-care', 'berry'],
  ['Vitamin C Face Serum', 'skin-care', 'citrus'],
  ['Nonisash Capsule', 'supplements', 'nutrient'],
  ['Coconut Natural Face Wash', 'skin-care', 'coconut'],
  ['Rose Water', 'skin-care', 'floral'],
  ['Sesame Hair Oil', 'hair-care', 'oil'],
  ['Luxury Night Cream', 'skin-care', 'silk'],
  ['Hair Serum', 'hair-care', 'hydration'],
  ['Multifunctional Head Care Apparatus', 'personal-care', 'mineral'],
]) assert.equal(productBackgroundTheme({name, category}), expected, name);
assert.equal(productBackgroundTheme({name:'Unknown item', category:'unknown'}), 'mineral');
assert.equal(productBackgroundTheme(null), 'mineral');
for (const theme of Object.values(BACKGROUND_THEMES)) {
  assert.equal(theme.shapes.length, 5, 'bounded scene size');
  assert.ok(theme.colors.every(color => /^\d+ \d+ \d+$/.test(color)), 'only fixed safe palettes');
}
console.log('PASS distinct section scenes, named product theme precedence, neutral fallback, and bounded motifs');
