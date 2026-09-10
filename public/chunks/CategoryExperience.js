import { bs as isSpotlightEligible, bt as categoryBySlug, bu as sanitizeCategoryConfig, bv as safeColor, bw as safeGradient, bx as makeSpotlightId, by as validateImageUpload, r as reactExports, j as jsxRuntimeExports, bp as products, a as adminGetSetting, bz as normalizeCategoryExperience, bA as categoryExperiencePayload, e as adminSetSetting, y as categories, bB as categoryIsReadyButOff, bC as categoryToneTheme, bD as MIN_INTERVAL_MS, bE as MAX_INTERVAL_MS, bF as DEFAULT_ITEM_SCALE, bG as MIN_ITEM_SCALE, bH as MAX_ITEM_SCALE, bI as ITEM_OFFSET_LIMIT, bJ as CategorySpotlight } from '../bundle.js';
import { u as uploadHomepageImage } from './homepageImageUpload.js';

// ============================================================
// Bulk spotlight packshot import — matching and assignment rules.
//
// The owner has a folder of packshots already named by SORA LIFE product slug
// (<product-slug>.png). This module decides, for a given set of files, which
// product each one belongs to and where its uploaded URL should land in
// homepage.categoryExperience — WITHOUT guessing.
//
// MATCHING IS EXACT. A filename matches a product only if, with its extension
// removed, it equals that product's slug. There is no fuzzy matching, no
// normalisation beyond trimming and lowercasing, and no "closest match". A
// file that does not resolve is reported as unmatched and left alone.
//
// AMBIGUITY IS REPORTED, NEVER RESOLVED. If two files claim the same product,
// or a supplied mapping row disagrees with a filename, or one source asset is
// mapped to two products, every side of the conflict is skipped and named for
// the owner. This is the class of problem the Immunosash case belongs to: one
// source packshot recorded against both the 30-capsule pack and the 250 ml
// juice. Nothing here will pick one.
//
// Pure and free of React, Supabase and the DOM, so the rules run in tests.
// ============================================================


/** Statuses a selected file can end in. Order is the reporting order. */
const IMPORT_STATUS = Object.freeze({
  MATCHED: 'matched',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  AMBIGUOUS: 'ambiguous',
  UNMATCHED: 'unmatched'
});

/**
 * The product slug a file claims, from its name alone.
 *
 * Only the extension is removed. Case and surrounding whitespace are
 * normalised because file systems vary on those; nothing else is touched, so
 * "hair-oil (1).png" does NOT become "hair-oil".
 */
function slugFromFilename(filename) {
  if (typeof filename !== 'string') return '';
  const base = filename.split(/[\\/]/).pop() || '';
  return base.replace(/\.[a-z0-9]{2,5}$/i, '').trim().toLowerCase();
}

/**
 * Parse the mapping CSV the staging step produced. Optional — the filenames
 * already carry the slug; this is a cross-check, not the source of truth.
 *
 * Deliberately small: the file is one we generated, with a fixed header.
 */
function parseMappingCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const iSlug = header.indexOf('sora_product_slug');
  const iFile = header.indexOf('local_file');
  const iSource = header.indexOf('source_url');
  if (iSlug < 0 || iFile < 0) return [];
  const rows = [];
  for (const line of lines.slice(1)) {
    // Fields may be quoted (product names contain commas).
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
    const val = i => (cells[i] || '').replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    const slug = val(iSlug).toLowerCase();
    const file = val(iFile);
    if (!slug || !file) continue;
    rows.push({
      slug,
      file,
      sourceUrl: iSource >= 0 ? val(iSource) : ''
    });
  }
  return rows;
}

/**
 * Decide what happens to each selected file.
 *
 * @param files      [{ name, size }] — enough to plan without reading bytes
 * @param products   the live catalogue
 * @param csvRows    optional parseMappingCsv() output, used only to CONTRADICT
 * @returns { plan, counts } — plan is one entry per file, in input order
 */
function planImport({
  files = [],
  products = [],
  csvRows = []
} = {}) {
  const bySlug = new Map();
  for (const p of products) if (p?.slug) bySlug.set(String(p.slug).toLowerCase(), p);

  // A slug claimed by more than one selected file is ambiguous on both sides.
  const claimCount = new Map();
  for (const f of files) {
    const s = slugFromFilename(f.name);
    if (!s) continue;
    claimCount.set(s, (claimCount.get(s) || 0) + 1);
  }

  // Cross-check structures from the optional CSV.
  const csvBySlug = new Map();
  const csvFileToSlugs = new Map();
  for (const r of csvRows) {
    if (!csvBySlug.has(r.slug)) csvBySlug.set(r.slug, r);
    // One SOURCE asset attributed to two products is exactly the Immunosash
    // collision. Both sides stay out of the import.
    const key = (r.sourceUrl || r.file).toLowerCase();
    if (!csvFileToSlugs.has(key)) csvFileToSlugs.set(key, new Set());
    csvFileToSlugs.get(key).add(r.slug);
  }
  const contestedSources = new Set();
  for (const [, slugs] of csvFileToSlugs) {
    if (slugs.size > 1) for (const s of slugs) contestedSources.add(s);
  }
  const plan = files.map(file => {
    const slug = slugFromFilename(file.name);
    const base = {
      file,
      filename: file.name,
      slug
    };
    if (!slug) return {
      ...base,
      status: IMPORT_STATUS.UNMATCHED,
      reason: 'No product slug in the filename.'
    };
    if ((claimCount.get(slug) || 0) > 1) {
      return {
        ...base,
        status: IMPORT_STATUS.AMBIGUOUS,
        reason: `More than one selected file claims "${slug}".`
      };
    }
    if (contestedSources.has(slug)) {
      return {
        ...base,
        status: IMPORT_STATUS.AMBIGUOUS,
        reason: 'The mapping attributes one source packshot to more than one product. Assign this one by hand.'
      };
    }
    const product = bySlug.get(slug);
    if (!product) return {
      ...base,
      status: IMPORT_STATUS.UNMATCHED,
      reason: `No product has the slug "${slug}".`
    };
    const csvRow = csvBySlug.get(slug);
    if (csvRow && csvRow.file && csvRow.file.toLowerCase() !== String(file.name).toLowerCase()) {
      return {
        ...base,
        product,
        status: IMPORT_STATUS.AMBIGUOUS,
        reason: `The mapping expects "${csvRow.file}" for this product, not "${file.name}".`
      };
    }
    if (!isSpotlightEligible(product)) {
      return {
        ...base,
        product,
        status: IMPORT_STATUS.SKIPPED,
        reason: 'Product is not active, priced and in stock.'
      };
    }
    const categories = (product.categories || [product.category]).filter(c => categoryBySlug[c]);
    if (!categories.length) {
      return {
        ...base,
        product,
        status: IMPORT_STATUS.SKIPPED,
        reason: 'Product is not in any known category.'
      };
    }
    return {
      ...base,
      product,
      categories,
      status: IMPORT_STATUS.MATCHED,
      reason: ''
    };
  });
  return {
    plan,
    counts: countByStatus(plan)
  };
}
function countByStatus(plan) {
  const counts = {};
  for (const key of Object.values(IMPORT_STATUS)) counts[key] = 0;
  for (const row of plan) counts[row.status] = (counts[row.status] || 0) + 1;
  return counts;
}

/**
 * Fold uploaded URLs into the existing category-experience configuration.
 *
 * Everything already configured is preserved: a category's enabled flag,
 * auto-rotate, interval, theme, and each item's headline, subline, background,
 * gradient, enabled flag and ORDER. An item that already exists for a product
 * has its spotlightImage and generated autoTheme refreshed; manual background
 * and gradient remain untouched and therefore continue to win. A product with
 * no item yet gets one appended with the generated theme.
 *
 * @param existing  normalised { categories: { slug: config } }
 * @param uploads   [{ slug, url, categories: [slug] }]
 * @returns { categories, report } — report says what each category received
 */
function applyUploads(existing, uploads = []) {
  const out = {};
  for (const [slug, cfg] of Object.entries(existing?.categories || {})) out[slug] = sanitizeCategoryConfig(cfg, slug);
  const report = {};
  const touch = catSlug => {
    if (!out[catSlug]) out[catSlug] = sanitizeCategoryConfig({}, catSlug);
    if (!report[catSlug]) {
      report[catSlug] = {
        category: catSlug,
        updated: [],
        created: [],
        // Whether this category is published. The import NEVER changes it —
        // it is reported so the owner can see which categories are still
        // waiting to be switched on.
        enabled: out[catSlug].enabled === true,
        wasUsingFallback: out[catSlug].items.length === 0
      };
    }
    return out[catSlug];
  };
  for (const up of uploads) {
    if (!up?.slug || !up?.url) continue;
    const autoTheme = {
      background: safeColor(up.autoTheme?.background),
      gradient: safeGradient(up.autoTheme?.gradient)
    };
    const hasAutoTheme = Boolean(autoTheme.background || autoTheme.gradient);
    for (const catSlug of up.categories || []) {
      if (!categoryBySlug[catSlug]) continue;
      const cfg = touch(catSlug);
      const idx = cfg.items.findIndex(it => it.productSlug === up.slug);
      if (idx >= 0) {
        // Update in place: order and every authored field survive. Automatic
        // values are separate, so this cannot overwrite an owner's colours.
        cfg.items[idx] = {
          ...cfg.items[idx],
          spotlightImage: up.url,
          ...(hasAutoTheme ? {
            autoTheme
          } : {})
        };
        report[catSlug].updated.push(up.slug);
        continue;
      }
      cfg.items.push({
        id: makeSpotlightId(up.slug, cfg.items.map(it => it.id)),
        productSlug: up.slug,
        spotlightImage: up.url,
        headline: '',
        subline: '',
        background: '',
        gradient: '',
        autoTheme: hasAutoTheme ? autoTheme : {
          background: '',
          gradient: ''
        },
        enabled: true
      });
      report[catSlug].created.push(up.slug);
    }
  }
  return {
    categories: out,
    report: Object.values(report)
  };
}

/**
 * Merge the new category-experience block into the WHOLE homepage settings
 * object, so discovery, the visuals and every other homepage key survive.
 *
 * The caller must pass the homepage object it just re-read, not a stale copy.
 */
function mergeIntoHomepage(currentHomepage, categoryExperience) {
  const base = currentHomepage && typeof currentHomepage === 'object' ? currentHomepage : {};
  return {
    ...base,
    categoryExperience
  };
}

/** A plain-text summary the owner can copy or save. */
function buildSummaryText(plan, {
  uploadedUrls = new Map()
} = {}) {
  const group = status => plan.filter(r => r.status === status);
  const lines = [];
  const section = (title, rows, render) => {
    lines.push(`${title} (${rows.length})`);
    if (!rows.length) lines.push('  —');else rows.forEach(r => lines.push(`  ${render(r)}`));
    lines.push('');
  };
  lines.push('SORA LIFE — spotlight packshot import');
  lines.push(new Date().toISOString());
  lines.push('');
  section('UPLOADED', group(IMPORT_STATUS.UPLOADED), r => `${r.slug}  ${uploadedUrls.get(r.slug) || ''}`.trim());
  section('FAILED', group(IMPORT_STATUS.FAILED), r => `${r.slug}  — ${r.reason}`);
  section('SKIPPED', group(IMPORT_STATUS.SKIPPED), r => `${r.slug}  — ${r.reason}`);
  section('AMBIGUOUS (left for review, nothing assigned)', group(IMPORT_STATUS.AMBIGUOUS), r => `${r.filename}  — ${r.reason}`);
  section('UNMATCHED FILES', group(IMPORT_STATUS.UNMATCHED), r => `${r.filename}  — ${r.reason}`);
  return lines.join('\n');
}

const SOURCE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 16 * 1000 * 1000;
const MAX_SOURCE_DIMENSION = 6000;
const MAX_OUTPUT_DIMENSION = 2400;
const VISIBLE_ALPHA = 12;
const ACCENT_ALPHA = 64;
const PACKSHOT_PADDING_RATIO = 0.05;
const clampByte = n => Math.max(0, Math.min(255, Math.round(n)));
const hex = ([r, g, b]) => `#${[r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
function rgbToHsl(r, g, b) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rn) h = (gn - bn) / d % 6;else if (max === gn) h = (bn - rn) / d + 2;else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return {
    h,
    s,
    l
  };
}
function nearWhite(r, g, b) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  return min >= 225 && max - min <= 32;
}
function edgeBackgroundReference(data, width, height) {
  let opaque = 0,
    white = 0,
    r = 0,
    g = 0,
    b = 0;
  const visit = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < VISIBLE_ALPHA) return;
    opaque += 1;
    if (!nearWhite(data[i], data[i + 1], data[i + 2])) return;
    white += 1;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  };
  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    if (height > 1) visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(0, y);
    if (width > 1) visit(width - 1, y);
  }
  if (!opaque || white / opaque < 0.35) return null;
  return [r / white, g / white, b / white];
}
function removeEdgeConnectedWhite(data, width, height) {
  const reference = edgeBackgroundReference(data, width, height);
  if (!reference) return 0;
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0,
    tail = 0,
    removed = 0;
  const qualifies = p => {
    const i = p * 4;
    if (data[i + 3] < VISIBLE_ALPHA) return false;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    // Being pale is not enough: white caps and labels are real product pixels.
    // A removable pixel must closely match the near-white colour sampled from
    // the OUTER edge. The deliberately conservative tolerance may retain a
    // faint antialias fringe, but cannot flood through into pale packaging.
    const close = Math.max(Math.abs(r - reference[0]), Math.abs(g - reference[1]), Math.abs(b - reference[2])) <= 10;
    return close && Math.min(r, g, b) >= 225;
  };
  const add = p => {
    if (seen[p] || !qualifies(p)) return;
    seen[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < width; x += 1) {
    add(x);
    if (height > 1) add((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    add(y * width);
    if (width > 1) add(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++],
      x = p % width,
      y = Math.floor(p / width);
    data[p * 4 + 3] = 0;
    removed += 1;
    if (x > 0) add(p - 1);
    if (x + 1 < width) add(p + 1);
    if (y > 0) add(p - width);
    if (y + 1 < height) add(p + width);
  }
  return removed;
}
function visibleBounds(data, width, height) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < VISIBLE_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < left ? null : {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1
  };
}
function representativeAccent(data, width, height) {
  const bins = Array.from({
    length: 24
  }, () => ({
    score: 0,
    r: 0,
    g: 0,
    b: 0,
    weight: 0
  }));
  const stride = Math.max(1, Math.floor(Math.sqrt(width * height / 150000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < ACCENT_ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (nearWhite(r, g, b) || Math.max(r, g, b) < 38) continue;
      const {
        h,
        s,
        l
      } = rgbToHsl(r, g, b);
      if (s < 0.14 || l < 0.12 || l > 0.9) continue;
      const weight = Math.pow(s, 1.35) * (0.55 + 0.45 * (1 - Math.abs(l - 0.54)));
      const bin = bins[Math.min(23, Math.floor(h / 15))];
      bin.score += weight;
      bin.weight += weight;
      bin.r += r * weight;
      bin.g += g * weight;
      bin.b += b * weight;
    }
  }
  const winner = bins.reduce((best, bin) => bin.score > best.score ? bin : best, bins[0]);
  if (!winner.weight) return [111, 127, 109];
  return [winner.r / winner.weight, winner.g / winner.weight, winner.b / winner.weight].map(clampByte);
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];else if (hp < 2) [r, g, b] = [x, c, 0];else if (hp < 3) [r, g, b] = [0, c, x];else if (hp < 4) [r, g, b] = [0, x, c];else if (hp < 5) [r, g, b] = [x, 0, c];else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Ground tuning, named and in one place so the palette stays adjustable.
 *
 * `lumFloor` is not a taste value like the others: it is the relative-luminance
 * budget the muted text needs. --cspot-ink-mute (#232E26) clears 4.5:1 at
 * luminance 0.30, so no stop of any gradient may fall below it. Change the ink
 * and this number has to be recomputed with it.
 */
const GROUND = {
  satMul: 0.80,
  // how much of the accent's own saturation carries through
  satAdd: 0.34,
  // floor lift, so a muted accent still reads as a colour
  satMin: 0.52,
  satMax: 0.72,
  greenTrim: 0.30,
  // see hueSaturationTrim
  lightTop: 0.675,
  // HSL lightness for an already-light accent
  lightSpread: 0.095,
  // a deeper accent earns a deeper ground
  gradientLift: 0.060,
  gradientDrop: 0.070,
  lumFloor: 0.300 // the text-contrast budget; see above
};
const channelLuminance = v => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0-1, from 0-255 channels. */
function relativeLuminance([r, g, b]) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * At one HSL saturation a yellow-green carries far more apparent chroma than a
 * rose or a violet does. A single ceiling therefore either lets the greens go
 * acid or holds every other hue back: at satMax 0.86 the aloe accents resolved
 * to #C1F677 and #0FC556 — lime and electric emerald — while the same ceiling
 * left the corals looking unfinished. This trims the ceiling smoothly through
 * the green-yellow band only, deepest around 110 degrees.
 */
function hueSaturationTrim(hue) {
  const bandwidth = 85;
  const distance = Math.min(Math.abs((hue - 110 + 540) % 360 - 180), bandwidth) / bandwidth;
  return 1 - GROUND.greenTrim * Math.cos(distance * Math.PI / 2);
}

/**
 * Raise a lightness until the colour clears the luminance floor. Only ever
 * lightens: a colour already above the floor is returned untouched, so the
 * floor can never wash out a hue that did not need protecting.
 */
function liftToLuminanceFloor(hue, sat, light) {
  if (relativeLuminance(hslToRgb(hue, sat, light)) >= GROUND.lumFloor) return light;
  let low = light,
    high = 1;
  for (let i = 0; i < 22; i += 1) {
    const mid = (low + high) / 2;
    if (relativeLuminance(hslToRgb(hue, sat, mid)) < GROUND.lumFloor) low = mid;else high = mid;
  }
  return high;
}

/**
 * A premium ground derived from the product's own accent.
 *
 * Built in HSL rather than by mixing toward ivory. A flat mix pulls every hue
 * toward the same pale point, which is why ten Hair Care products once landed
 * in one narrow grey-green/grey-beige band — #DDE4D8 beside #E6E7DA beside
 * #E2E6DE, barely distinguishable as the carousel advanced.
 *
 * Colour decides the depth and accessibility only ever vetoes going too dark.
 * Two alternatives were measured against the ten real Hair Care packshots and
 * rejected:
 *
 *  - Raising saturation uniformly. The greens reached #C1F677 while the corals
 *    barely moved, because apparent chroma is hue-dependent. hueSaturationTrim
 *    is the fix.
 *  - Choosing lightness by solving for a fixed relative luminance. That makes
 *    contrast identical on every slide, but it also forces reds light (red is
 *    dark per unit chroma) and greens dark, so the corals washed out to #EBC4B9
 *    exactly where they needed to be strongest.
 *
 * So the tone is set in HSL and then clamped up to lumFloor. The gradient is
 * derived from its DARKEST stop rather than from the ground: clamping each
 * stop independently collapsed the gradient to a flat fill on reds, whose
 * ground already sat on the floor and so had nothing below it to fade into.
 * Pinning the end AT the floor and stacking the ground and start above it
 * gives every hue a real gradient and spends the whole contrast budget.
 *
 * Measured over the ten real packshots: average chroma 111 (was 60, and 33
 * before that), minimum 85, and every stop of every gradient holds 5.5:1 for
 * the title ink, 4.7:1 for the muted ink and 4.1:1 for the CTA pill.
 */
function groundThemeFromAccent(accent) {
  const {
    h,
    s,
    l
  } = rgbToHsl(accent[0], accent[1], accent[2]);
  const trim = hueSaturationTrim(h);
  const sat = Math.min(GROUND.satMax * trim, Math.max(GROUND.satMin * trim, s * GROUND.satMul + GROUND.satAdd));
  const base = GROUND.lightTop - GROUND.lightSpread * (1 - l);

  // One colour at three depths, so the stage reads as a single lit surface
  // rather than two unrelated mixes.
  const endLight = liftToLuminanceFloor(h, sat, base - GROUND.gradientDrop);
  const at = light => hslToRgb(h, sat, Math.min(0.94, light));
  const ground = at(endLight + GROUND.gradientDrop);
  const start = at(endLight + GROUND.gradientDrop + GROUND.gradientLift);
  const end = at(endLight);
  return {
    accent: hex(accent),
    background: hex(ground),
    gradient: `linear-gradient(168deg, ${hex(start)} 0%, ${hex(end)} 100%)`
  };
}

/**
 * Pure pixel core shared by the browser importer and offline regression/QA.
 * White is removed only when connected to a near-white outer edge. Internal
 * white packaging and label pixels therefore survive.
 */
function normalizePackshotPixels(input, width, height, {
  paddingRatio = PACKSHOT_PADDING_RATIO
} = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Packshot dimensions are invalid.');
  }
  if (!input || input.length !== width * height * 4) throw new Error('Packshot pixel data is invalid.');
  const data = new Uint8ClampedArray(input);
  const removedPixels = removeEdgeConnectedWhite(data, width, height);
  const bounds = visibleBounds(data, width, height);
  if (!bounds) throw new Error('No visible product remains after background cleanup.');
  const pad = Math.max(2, Math.ceil(Math.max(bounds.width, bounds.height) * Math.min(0.06, Math.max(0.04, paddingRatio))));
  const outputWidth = bounds.width + pad * 2;
  const outputHeight = bounds.height + pad * 2;
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.top + y) * width + bounds.left) * 4;
    const targetStart = ((y + pad) * outputWidth + pad) * 4;
    output.set(data.subarray(sourceStart, sourceStart + bounds.width * 4), targetStart);
  }
  const accent = representativeAccent(output, outputWidth, outputHeight);
  return {
    data: output,
    width: outputWidth,
    height: outputHeight,
    theme: groundThemeFromAccent(accent),
    stats: {
      sourceWidth: width,
      sourceHeight: height,
      removedPixels,
      backgroundRemoved: removedPixels > 0,
      bounds,
      padding: pad,
      outputWidth,
      outputHeight,
      accent: hex(accent)
    }
  };
}
function canvas(width, height) {
  if (typeof document === 'undefined') throw new Error('Packshot processing requires a browser.');
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return el;
}
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close?.()
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('This image could not be decoded.'));
  });
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url)
  };
}
const toPng = el => new Promise((resolve, reject) => {
  el.toBlob(blob => blob ? resolve(blob) : reject(new Error('The normalized PNG could not be created.')), 'image/png');
});
async function processSpotlightPackshot(file) {
  await validateImageUpload(file, {
    allowedTypes: SOURCE_TYPES,
    maxBytes: MAX_SOURCE_BYTES,
    maxPixels: MAX_SOURCE_PIXELS,
    maxDimension: MAX_SOURCE_DIMENSION
  });
  const decoded = await decode(file);
  try {
    const sourceCanvas = canvas(decoded.width, decoded.height);
    const sourceCtx = sourceCanvas.getContext('2d', {
      willReadFrequently: true
    });
    if (!sourceCtx) throw new Error('Image processing is not available in this browser.');
    sourceCtx.drawImage(decoded.source, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, decoded.width, decoded.height);
    const normalized = normalizePackshotPixels(pixels.data, decoded.width, decoded.height);
    const rawCanvas = canvas(normalized.width, normalized.height);
    const rawCtx = rawCanvas.getContext('2d');
    const out = rawCtx.createImageData(normalized.width, normalized.height);
    out.data.set(normalized.data);
    rawCtx.putImageData(out, 0, 0);
    const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(normalized.width, normalized.height));
    const finalCanvas = scale < 1 ? canvas(Math.max(1, Math.round(normalized.width * scale)), Math.max(1, Math.round(normalized.height * scale))) : rawCanvas;
    if (scale < 1) finalCanvas.getContext('2d').drawImage(rawCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    const blob = await toPng(finalCanvas);
    const name = `${String(file.name || 'packshot').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 100) || 'packshot'}.png`;
    const processedFile = typeof File === 'function' ? new File([blob], name, {
      type: 'image/png',
      lastModified: Date.now()
    }) : Object.assign(blob, {
      name
    });
    return {
      file: processedFile,
      theme: normalized.theme,
      stats: normalized.stats
    };
  } finally {
    decoded.close();
  }
}

function BulkPackshotImport({
  onImported
}) {
  const [files, setFiles] = reactExports.useState([]);
  const [csvRows, setCsvRows] = reactExports.useState([]);
  const [csvName, setCsvName] = reactExports.useState('');
  const [rows, setRows] = reactExports.useState([]); // live plan, mutated as we go
  const [running, setRunning] = reactExports.useState(false);
  const [done, setDone] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [saveNote, setSaveNote] = reactExports.useState('');
  const [catReport, setCatReport] = reactExports.useState([]);
  const urlsRef = reactExports.useRef(new Map());
  const cancelRef = reactExports.useRef(false);
  const plan = reactExports.useMemo(() => rows.length ? rows : planImport({
    files,
    products,
    csvRows
  }).plan, [files, csvRows, rows]);
  const counts = reactExports.useMemo(() => countByStatus(plan), [plan]);
  const uploadedCount = counts[IMPORT_STATUS.UPLOADED] || 0;

  // What the import will actually do, per category, before it runs. One
  // product can belong to several categories, so the number of ASSIGNMENTS is
  // legitimately higher than the number of images — they are counted, and
  // named, separately.
  const preflight = reactExports.useMemo(() => {
    const byCat = new Map();
    let assignments = 0;
    for (const r of plan) {
      if (r.status !== IMPORT_STATUS.MATCHED) continue;
      for (const c of r.categories || []) {
        byCat.set(c, (byCat.get(c) || 0) + 1);
        assignments += 1;
      }
    }
    return {
      assignments,
      categories: [...byCat.entries()].map(([category, n]) => ({
        category,
        n
      })).sort((a, b) => b.n - a.n)
    };
  }, [plan]);
  const totalToUpload = plan.filter(r => r.status === IMPORT_STATUS.MATCHED || r.status === IMPORT_STATUS.UPLOADING || r.status === IMPORT_STATUS.UPLOADED || r.status === IMPORT_STATUS.FAILED).length;
  function pickImages(e) {
    const picked = [...(e.target.files || [])].filter(f => /^image\//.test(f.type));
    setFiles(picked);
    setRows([]);
    setDone(false);
    setErr('');
    setSaveNote('');
    setCatReport([]);
    urlsRef.current = new Map();
  }
  async function pickCsv(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const parsed = parseMappingCsv(await f.text());
      setCsvRows(parsed);
      setCsvName(`${f.name} — ${parsed.length} row${parsed.length === 1 ? '' : 's'}`);
      setRows([]);
    } catch {
      setErr('Could not read that mapping file.');
    }
  }
  async function run() {
    setRunning(true);
    setErr('');
    setSaveNote('');
    cancelRef.current = false;
    urlsRef.current = new Map();

    // Freeze the plan so the table stops recomputing under us.
    const live = planImport({
      files,
      products,
      csvRows
    }).plan.map(r => ({
      ...r
    }));
    setRows(live);
    const uploads = [];
    for (let i = 0; i < live.length; i += 1) {
      if (cancelRef.current) break;
      const row = live[i];
      if (row.status !== IMPORT_STATUS.MATCHED) continue;
      live[i] = {
        ...row,
        status: IMPORT_STATUS.UPLOADING
      };
      setRows([...live]);
      try {
        // CPU-only browser preprocessing happens before the existing upload:
        // edge-connected white is removed, transparent excess is cropped and
        // the result is encoded as a SORA-hosted PNG. No storefront runtime
        // performs pixel analysis.
        const processed = await processSpotlightPackshot(row.file);
        const url = await uploadHomepageImage(processed.file);
        urlsRef.current.set(row.slug, url);
        uploads.push({
          slug: row.slug,
          url,
          categories: row.categories,
          autoTheme: {
            background: processed.theme.background,
            gradient: processed.theme.gradient
          }
        });
        live[i] = {
          ...row,
          status: IMPORT_STATUS.UPLOADED,
          url
        };
      } catch (ex) {
        // One bad file must not end the batch.
        live[i] = {
          ...row,
          status: IMPORT_STATUS.FAILED,
          reason: ex?.message || 'Upload failed.'
        };
      }
      setRows([...live]);
    }
    if (uploads.length) {
      try {
        // Re-read immediately before writing so a concurrent edit to
        // discovery or the homepage visuals is carried through, not clobbered.
        const currentHomepage = (await adminGetSetting('homepage')) || {};
        const existing = normalizeCategoryExperience(currentHomepage.categoryExperience);
        const {
          categories,
          report
        } = applyUploads(existing, uploads);
        const payload = categoryExperiencePayload(categories);
        await adminSetSetting('homepage', mergeIntoHomepage(currentHomepage, payload));
        setCatReport(report);
        const assignments = report.reduce((n, c) => n + c.updated.length + c.created.length, 0);
        setSaveNote(`${uploads.length} source image${uploads.length === 1 ? '' : 's'} uploaded, ` + `${assignments} category assignment${assignments === 1 ? '' : 's'} created. Saved. ` + 'Packshots are ready. Review each category and turn Spotlight enabled on when you ' + 'are ready to publish it — nothing is live until you do.');
        onImported?.();
      } catch (ex) {
        setErr(`${uploads.length} image${uploads.length === 1 ? '' : 's'} uploaded, but saving the assignment failed: ` + `${ex?.message || 'unknown error'}. The images are stored — run the import again to assign them.`);
      }
    } else {
      setSaveNote('Nothing was uploaded, so no settings were changed.');
    }
    setRunning(false);
    setDone(true);
  }
  function downloadSummary() {
    const text = buildSummaryText(plan, {
      uploadedUrls: urlsRef.current
    });
    const blob = new Blob([text], {
      type: 'text/plain'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spotlight-import-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const matched = counts[IMPORT_STATUS.MATCHED] || 0;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "card adm-bpi",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      className: "adm-cx__h2",
      children: "Bulk import spotlight packshots"
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "hint",
      children: ["Select a folder of packshots named after their product \u2014 ", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
        children: "aloe-vera-protein-shampoo.png"
      }), ". Each file is uploaded to SORA LIFE\u2019s own media storage and assigned as that product\u2019s spotlight image. Files are matched on the exact product slug; nothing is guessed."]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Importing never publishes anything. A category you have not switched on stays off, and one that was already on stays on \u2014 you decide when each goes live."
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-bpi__pickers",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: "bpi-files",
          children: "Packshot images"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: "bpi-files",
          type: "file",
          multiple: true,
          accept: "image/png,image/jpeg,image/webp",
          onChange: pickImages,
          disabled: running
        }), files.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [files.length, " image", files.length === 1 ? '' : 's', " selected."]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: "bpi-csv",
          children: "Mapping file (optional)"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: "bpi-csv",
          type: "file",
          accept: ".csv,text/csv",
          onChange: pickCsv,
          disabled: running
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: csvName || 'If you have _MAPPING.csv, add it and the import will refuse anything it disagrees with.'
        })]
      })]
    }), plan.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-bpi__counts",
        role: "status",
        "aria-live": "polite",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Matched",
          n: matched
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Uploading",
          n: counts[IMPORT_STATUS.UPLOADING] || 0
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Uploaded",
          n: uploadedCount,
          tone: "ok"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Skipped",
          n: counts[IMPORT_STATUS.SKIPPED] || 0
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Failed",
          n: counts[IMPORT_STATUS.FAILED] || 0,
          tone: "bad"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Ambiguous",
          n: counts[IMPORT_STATUS.AMBIGUOUS] || 0,
          tone: "warn"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Tally, {
          label: "Unmatched",
          n: counts[IMPORT_STATUS.UNMATCHED] || 0
        })]
      }), !running && !done && matched > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-bpi__preflight",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: matched
          }), " image", matched === 1 ? '' : 's', " will be uploaded and assigned, creating ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: preflight.assignments
          }), " category assignment", preflight.assignments === 1 ? '' : 's', preflight.assignments > matched && ' — some products belong to more than one category, so they are assigned in each', "."]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint adm-bpi__cats-line",
          children: preflight.categories.map(c => `${c.category} (${c.n})`).join(' · ')
        })]
      }), (running || done) && totalToUpload > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "adm-bpi__progress",
        role: "status",
        "aria-live": "polite",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
          children: [uploadedCount, " / ", totalToUpload]
        }), " uploaded", counts[IMPORT_STATUS.FAILED] > 0 && ` · ${counts[IMPORT_STATUS.FAILED]} failed`]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-bpi__list",
        children: plan.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: `adm-bpi__row adm-bpi__row--${r.status}`,
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-bpi__file",
            children: r.filename
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-bpi__status",
            children: r.status
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-bpi__note",
            children: r.reason || (r.product ? r.product.name : '')
          })]
        }, r.filename))
      })]
    }), catReport.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-bpi__cats",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
        className: "adm-bpi__h3",
        children: "Categories changed"
      }), catReport.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: c.category
        }), ": ", c.updated.length, " updated, ", c.created.length, " added", c.enabled ? ' · live' : ' · READY — NOT LIVE']
      }, c.category))]
    }), saveNote && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint ok",
      children: saveNote
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint err",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-bpi__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        onClick: run,
        disabled: running || matched === 0,
        children: running ? 'Importing…' : `Import ${matched || ''} packshot${matched === 1 ? '' : 's'}`.trim()
      }), running && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-light",
        onClick: () => {
          cancelRef.current = true;
        },
        children: "Stop after this file"
      }), done && plan.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-light",
        onClick: downloadSummary,
        children: "Download summary"
      })]
    })]
  });
}
function Tally({
  label,
  n,
  tone
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
    className: `adm-bpi__tally${tone ? ` adm-bpi__tally--${tone}` : ''}${n ? '' : ' is-zero'}`,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
      children: n
    }), " ", label]
  });
}

function CategoryExperience() {
  const [slug, setSlug] = reactExports.useState(categories[0]?.slug || '');
  const [bySlug, setBySlug] = reactExports.useState({});
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [uploads, setUploads] = reactExports.useState(0);
  const [msg, setMsg] = reactExports.useState('');
  const [err, setErr] = reactExports.useState('');
  // A category can now hold every one of its products — Wellness has 46 —
  // so the editor needs a way to reach one row without scrolling past forty.
  const [filter, setFilter] = reactExports.useState('');
  const [showPreview, setShowPreview] = reactExports.useState(false);
  async function reloadFromSettings() {
    try {
      const hp = (await adminGetSetting('homepage')) || {};
      setBySlug(normalizeCategoryExperience(hp.categoryExperience).categories);
    } catch (ex) {
      setErr(ex.message || 'Could not load settings.');
    }
  }
  reactExports.useEffect(() => {
    (async () => {
      await reloadFromSettings();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cfg = reactExports.useMemo(() => sanitizeCategoryConfig(bySlug[slug], slug), [bySlug, slug]);

  // Only this category's sellable products may be spotlighted. Filtering here
  // rather than in the picker means the rule holds however the list is used.
  const eligible = reactExports.useMemo(() => products.filter(p => (p.categories || [p.category]).includes(slug)).filter(isSpotlightEligible), [slug]);
  const chosen = new Set(cfg.items.map(i => i.productSlug));
  const available = eligible.filter(p => !chosen.has(p.slug));
  const patch = fields => setBySlug(prev => ({
    ...prev,
    [slug]: {
      ...cfg,
      ...fields
    }
  }));
  const patchItems = items => patch({
    items
  });
  const addItem = productSlug => {
    if (!productSlug) return;
    patchItems([...cfg.items, {
      id: makeSpotlightId(productSlug, cfg.items.map(i => i.id)),
      productSlug,
      spotlightImage: '',
      headline: '',
      subline: '',
      background: '',
      gradient: '',
      enabled: true
    }]);
  };
  const patchItem = (i, fields) => patchItems(cfg.items.map((it, n) => n === i ? {
    ...it,
    ...fields
  } : it));
  const removeItem = i => patchItems(cfg.items.filter((_, n) => n !== i));
  const moveItem = (i, delta) => {
    const to = i + delta;
    if (to < 0 || to >= cfg.items.length) return;
    const next = [...cfg.items];
    [next[i], next[to]] = [next[to], next[i]];
    patchItems(next);
  };
  const save = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      // Read-modify-write the whole homepage object so a concurrent edit to
      // discovery or the visuals is not clobbered by this save.
      const current = (await adminGetSetting('homepage')) || {};
      const next = {
        ...current,
        categoryExperience: categoryExperiencePayload({
          ...bySlug,
          [slug]: cfg
        })
      };
      await adminSetSetting('homepage', next);
      setBySlug(normalizeCategoryExperience(next.categoryExperience).categories);
      setMsg('Saved. The category page updates on next load.');
    } catch (ex) {
      setErr(ex.message || 'Could not save.');
    }
    setSaving(false);
  };

  // Rows stay collapsed (<details>) and are filtered by product name, so a
  // 46-item category is a short searchable list rather than a wall of forms.
  // The original INDEX travels with each row, so Move up/down and Remove keep
  // acting on the real list while a filter is applied.
  const visibleItems = cfg.items.map((item, index) => ({
    item,
    index
  })).filter(({
    item
  }) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    const product = products.find(pr => pr.slug === item.productSlug);
    return `${product?.name || ''} ${item.productSlug}`.toLowerCase().includes(q);
  });
  const readyButOff = categoryIsReadyButOff(cfg);
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm__head",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
      children: "Category Experience"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    })]
  });
  const tone = categoryToneTheme(slug);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Category Experience"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "The animated product stage at the top of a category page. Choose which products appear and how they look. Leave the list empty and the stage fills itself from the category\u2019s own products."
        })]
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "card",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: "cx-cat",
          children: "Category"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
          id: "cx-cat",
          className: "input",
          value: slug,
          onChange: e => setSlug(e.target.value),
          children: categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: c.slug,
            children: c.name
          }, c.slug))
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [eligible.length, " product", eligible.length === 1 ? '' : 's', " in this category can be spotlighted."]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: `adm-cx__state adm-cx__state--${cfg.enabled ? 'live' : readyButOff ? 'ready' : 'off'}`,
        children: cfg.enabled ? 'LIVE — customers see this spotlight.' : readyButOff ? `READY — NOT LIVE. ${cfg.items.length} product${cfg.items.length === 1 ? '' : 's'} assigned. Turn it on below when you are happy with it.` : 'NOT LIVE. Nothing is shown on this category page yet.'
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-cx__row",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "check",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "checkbox",
            checked: cfg.enabled,
            onChange: e => patch({
              enabled: e.target.checked
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "check__box"
          }), " Show the spotlight on this category"]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "check",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "checkbox",
            checked: cfg.autoRotate,
            onChange: e => patch({
              autoRotate: e.target.checked
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "check__box"
          }), " Rotate automatically"]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "label",
          htmlFor: "cx-int",
          children: ["Time on each product \u2014 ", (cfg.intervalMs / 1000).toFixed(1), "s"]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: "cx-int",
          type: "range",
          className: "input",
          min: MIN_INTERVAL_MS,
          max: MAX_INTERVAL_MS,
          step: 100,
          value: cfg.intervalMs,
          onChange: e => patch({
            intervalMs: Number(e.target.value)
          }),
          disabled: !cfg.autoRotate
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "Rotation always pauses while a customer is looking at or using the stage."
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "card",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        className: "adm-cx__h2",
        children: "Category background"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: "Used for any product that has no background of its own."
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ThemeFields, {
        theme: cfg.theme,
        fallback: tone,
        onChange: theme => patch({
          theme
        }),
        idPrefix: "cx-cat-theme"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "card",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h2", {
        className: "adm-cx__h2",
        children: ["Spotlight products", cfg.items.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "adm-cx__count",
          children: [" \xB7 ", cfg.items.length]
        })]
      }), cfg.items.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: ["Nothing chosen yet \u2014 the stage will show every one of this category\u2019s", ' ', eligible.length, " sellable products automatically, in catalogue order. Add products below to control the order and the look."]
      }), cfg.items.length > 6 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field adm-cx__filter",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label sr-only",
          htmlFor: "cx-filter",
          children: "Find a product in this list"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: "cx-filter",
          className: "input",
          type: "search",
          value: filter,
          onChange: e => setFilter(e.target.value),
          placeholder: `Find one of the ${cfg.items.length} products…`
        }), filter && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [visibleItems.length, " of ", cfg.items.length, " shown.", ' ', "Ordering moves the product within the full list, not the filtered view."]
        })]
      }), visibleItems.map(({
        item,
        index: i
      }) => {
        const product = eligible.find(p => p.slug === item.productSlug) || products.find(p => p.slug === item.productSlug);
        const stale = !product || !isSpotlightEligible(product) || !(product.categories || [product.category]).includes(slug);
        return /*#__PURE__*/jsxRuntimeExports.jsxs("details", {
          className: `adm-dc${item.enabled ? '' : ' adm-dc--off'}`,
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("summary", {
            className: "adm-dc__sum",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              className: "adm-dc__title",
              children: [i + 1, ". ", product?.name || item.productSlug]
            }), !item.enabled && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "adm-dc__badge",
              children: "Hidden"
            }), stale && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "adm-dc__badge",
              children: "Not shown"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-dc__body",
            children: [stale && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
              className: "hint err",
              children: "This product is no longer sellable in this category, so the stage skips it. Remove it, or fix the product."
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
              className: "check",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
                type: "checkbox",
                checked: item.enabled,
                onChange: e => patchItem(i, {
                  enabled: e.target.checked
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "check__box"
              }), " Include this product"]
            }), /*#__PURE__*/jsxRuntimeExports.jsx(SpotlightImageField, {
              value: item.spotlightImage,
              name: product?.name || item.productSlug,
              onChange: spotlightImage => patchItem(i, {
                spotlightImage
              }),
              onBusy: d => setUploads(n => n + d)
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-cx__fit",
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "field",
                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
                  className: "label",
                  htmlFor: `cx-scale-${item.id}`,
                  children: ["Visual size \u2014 ", Number(item.visualScale ?? DEFAULT_ITEM_SCALE).toFixed(2), "\xD7"]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  id: `cx-scale-${item.id}`,
                  type: "range",
                  className: "input",
                  min: MIN_ITEM_SCALE,
                  max: MAX_ITEM_SCALE,
                  step: 0.01,
                  value: item.visualScale ?? DEFAULT_ITEM_SCALE,
                  onChange: e => patchItem(i, {
                    visualScale: Number(e.target.value)
                  })
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "field",
                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
                  className: "label",
                  htmlFor: `cx-offset-${item.id}`,
                  children: ["Nudge up / down \u2014 ", item.verticalOffset ?? 0, "px"]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  id: `cx-offset-${item.id}`,
                  type: "range",
                  className: "input",
                  min: -ITEM_OFFSET_LIMIT,
                  max: ITEM_OFFSET_LIMIT,
                  step: 1,
                  value: item.verticalOffset ?? 0,
                  onChange: e => patchItem(i, {
                    verticalOffset: Number(e.target.value)
                  })
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "btn btn-sm btn-light",
                onClick: () => patchItem(i, {
                  visualScale: DEFAULT_ITEM_SCALE,
                  verticalOffset: 0
                }),
                disabled: (item.visualScale ?? DEFAULT_ITEM_SCALE) === DEFAULT_ITEM_SCALE && (item.verticalOffset ?? 0) === 0,
                children: "Reset fit"
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
              className: "hint",
              children: "Use the preview below to see the effect before you save."
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                htmlFor: `cx-h-${item.id}`,
                children: "Headline (optional)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                id: `cx-h-${item.id}`,
                className: "input",
                maxLength: 60,
                value: item.headline,
                onChange: e => patchItem(i, {
                  headline: e.target.value
                }),
                placeholder: "A short line above the product name"
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                htmlFor: `cx-s-${item.id}`,
                children: "Subline (optional)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                id: `cx-s-${item.id}`,
                className: "input",
                maxLength: 90,
                value: item.subline,
                onChange: e => patchItem(i, {
                  subline: e.target.value
                }),
                placeholder: "One short supporting line"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "hint",
                children: "Your own words, shown exactly as written. Do not describe results or benefits the product has not been approved to claim."
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx(ThemeFields, {
              theme: {
                background: item.background,
                gradient: item.gradient
              },
              fallback: {
                background: item.autoTheme?.background || cfg.theme.background,
                gradient: item.autoTheme?.gradient || (item.autoTheme?.background ? '' : cfg.theme.gradient)
              },
              optional: true,
              onChange: ({
                background,
                gradient
              }) => patchItem(i, {
                background,
                gradient
              }),
              idPrefix: `cx-item-${item.id}`
            }), item.autoTheme?.background && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
              className: "hint",
              children: "Automatic theme sampled from this imported packshot. Enter either field above to override it."
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-dc__foot",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "btn btn-sm btn-light",
                onClick: () => moveItem(i, -1),
                disabled: i === 0,
                children: "\u2191 Move up"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "btn btn-sm btn-light",
                onClick: () => moveItem(i, 1),
                disabled: i === cfg.items.length - 1,
                children: "\u2193 Move down"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "linkbtn linkbtn--danger",
                onClick: () => removeItem(i),
                children: "Remove"
              })]
            })]
          })]
        }, item.id);
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-dc__add",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: "cx-add",
          children: "Add a product"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
          id: "cx-add",
          className: "input",
          value: "",
          disabled: !available.length,
          onChange: e => addItem(e.target.value),
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: "",
            children: available.length ? 'Choose a product…' : 'Every eligible product is already added'
          }), available.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
            value: p.slug,
            children: [p.name, p.form ? ` · ${p.form}` : '']
          }, p.slug))]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: ["Only products from ", categories.find(c => c.slug === slug)?.name, " that are active, priced and in stock."]
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "card",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        className: "adm-cx__h2",
        children: "Preview"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: "Exactly what the category page would show, using the settings above \u2014 including unsaved changes. Visible only here; turning the spotlight on is what publishes it."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-light",
        onClick: () => setShowPreview(v => !v),
        children: showPreview ? 'Hide preview' : 'Show preview'
      }), showPreview && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-cx__preview",
        children: /*#__PURE__*/jsxRuntimeExports.jsx(CategorySpotlight, {
          category: categories.find(c => c.slug === slug),
          products: products.filter(p => (p.categories || [p.category]).includes(slug)),
          configOverride: cfg,
          preview: true
        }, `${slug}-${cfg.items.length}-${cfg.theme.background}`)
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(BulkPackshotImport, {
      onImported: reloadFromSettings
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint ok",
      children: msg
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint err",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      className: "btn",
      onClick: save,
      disabled: saving || uploads > 0,
      children: saving ? 'Saving…' : uploads > 0 ? 'Waiting for upload…' : 'Save Category Experience'
    })]
  });
}

/** Background colour + optional gradient, with live validation feedback. */
function ThemeFields({
  theme,
  fallback,
  onChange,
  idPrefix,
  optional = false
}) {
  const bgOk = !theme.background || Boolean(safeColor(theme.background));
  const gradOk = !theme.gradient || Boolean(safeGradient(theme.gradient));
  const shownBg = safeColor(theme.background) || fallback.background;
  const shownGrad = safeGradient(theme.gradient) || (theme.background ? '' : fallback.gradient);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-cx__theme",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-cx__theme-fields",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `${idPrefix}-bg`,
          children: "Background colour"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: `${idPrefix}-bg`,
          className: "input",
          value: theme.background || '',
          onChange: e => onChange({
            background: e.target.value,
            gradient: theme.gradient || ''
          }),
          placeholder: optional ? `Leave empty to use ${fallback.background}` : fallback.background
        }), !bgOk && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint err",
          children: "Not a colour we can use \u2014 it will be ignored."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `${idPrefix}-grad`,
          children: "Gradient (optional)"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: `${idPrefix}-grad`,
          className: "input",
          value: theme.gradient || '',
          onChange: e => onChange({
            background: theme.background || '',
            gradient: e.target.value
          }),
          placeholder: "linear-gradient(168deg, #F4EFF5 0%, #E6DCEA 100%)"
        }), !gradOk && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint err",
          children: "Only a plain linear/radial/conic gradient is accepted."
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-cx__swatch",
      style: {
        background: shownGrad || shownBg
      },
      "aria-hidden": "true"
    })]
  });
}

/** Optional cutout asset. Reuses the homepage image upload path unchanged. */
function SpotlightImageField({
  value,
  name,
  onChange,
  onBusy
}) {
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onBusy(1);
    setErr('');
    try {
      onChange(await uploadHomepageImage(file));
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
    setBusy(false);
    onBusy(-1);
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: "Spotlight packshot"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      value: value || '',
      onChange: e => onChange(e.target.value),
      placeholder: "Leave empty to use the product's own image",
      "aria-label": `Spotlight packshot URL for ${name}`
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "hint",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "Use a packshot: the product on its own, with nothing behind it."
      }), " A cut-out PNG on a transparent background is ideal; a clean white-background studio shot also works. The spotlight floats this image directly on the category colour, so it is not a photo frame \u2014 a lifestyle photo, a banner, or a shot with a room, table or props behind the product will show its rectangular edges against the background and look wrong here."]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Leave this empty and the product\u2019s normal catalogue image is used instead. That still works, but if that image is a lifestyle photo the stage will show its edges \u2014 which is why a packshot here is worth uploading."
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint err",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-disc-row__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
        type: "file",
        accept: "image/png,image/jpeg,image/webp",
        onChange: pick,
        disabled: busy,
        "aria-label": `Upload a spotlight image for ${name}`
      }), value && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        onClick: () => onChange(''),
        children: "Use product image"
      }), busy && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "hint",
        children: "Uploading\u2026"
      })]
    })]
  });
}

export { CategoryExperience as default };
//# sourceMappingURL=CategoryExperience.js.map
