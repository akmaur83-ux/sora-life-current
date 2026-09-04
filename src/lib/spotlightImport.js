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

import { categoryBySlug } from '../data/categories.js';
import { isSpotlightEligible, sanitizeCategoryConfig, makeSpotlightId } from './categoryExperience.js';

/** Statuses a selected file can end in. Order is the reporting order. */
export const IMPORT_STATUS = Object.freeze({
  MATCHED: 'matched',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  AMBIGUOUS: 'ambiguous',
  UNMATCHED: 'unmatched',
});

/**
 * The product slug a file claims, from its name alone.
 *
 * Only the extension is removed. Case and surrounding whitespace are
 * normalised because file systems vary on those; nothing else is touched, so
 * "hair-oil (1).png" does NOT become "hair-oil".
 */
export function slugFromFilename(filename) {
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
export function parseMappingCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const iSlug = header.indexOf('sora_product_slug');
  const iFile = header.indexOf('local_file');
  const iSource = header.indexOf('source_url');
  if (iSlug < 0 || iFile < 0) return [];
  const rows = [];
  for (const line of lines.slice(1)) {
    // Fields may be quoted (product names contain commas).
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
    const val = (i) => (cells[i] || '').replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    const slug = val(iSlug).toLowerCase();
    const file = val(iFile);
    if (!slug || !file) continue;
    rows.push({ slug, file, sourceUrl: iSource >= 0 ? val(iSource) : '' });
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
export function planImport({ files = [], products = [], csvRows = [] } = {}) {
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

  const plan = files.map((file) => {
    const slug = slugFromFilename(file.name);
    const base = { file, filename: file.name, slug };

    if (!slug) return { ...base, status: IMPORT_STATUS.UNMATCHED, reason: 'No product slug in the filename.' };

    if ((claimCount.get(slug) || 0) > 1) {
      return { ...base, status: IMPORT_STATUS.AMBIGUOUS, reason: `More than one selected file claims "${slug}".` };
    }
    if (contestedSources.has(slug)) {
      return {
        ...base,
        status: IMPORT_STATUS.AMBIGUOUS,
        reason: 'The mapping attributes one source packshot to more than one product. Assign this one by hand.',
      };
    }

    const product = bySlug.get(slug);
    if (!product) return { ...base, status: IMPORT_STATUS.UNMATCHED, reason: `No product has the slug "${slug}".` };

    const csvRow = csvBySlug.get(slug);
    if (csvRow && csvRow.file && csvRow.file.toLowerCase() !== String(file.name).toLowerCase()) {
      return {
        ...base,
        product,
        status: IMPORT_STATUS.AMBIGUOUS,
        reason: `The mapping expects "${csvRow.file}" for this product, not "${file.name}".`,
      };
    }

    if (!isSpotlightEligible(product)) {
      return { ...base, product, status: IMPORT_STATUS.SKIPPED, reason: 'Product is not active, priced and in stock.' };
    }

    const categories = (product.categories || [product.category]).filter((c) => categoryBySlug[c]);
    if (!categories.length) {
      return { ...base, product, status: IMPORT_STATUS.SKIPPED, reason: 'Product is not in any known category.' };
    }

    return { ...base, product, categories, status: IMPORT_STATUS.MATCHED, reason: '' };
  });

  return { plan, counts: countByStatus(plan) };
}

export function countByStatus(plan) {
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
 * has only its spotlightImage replaced. A product with no item yet gets one
 * appended carrying nothing but its slug and the new image, so the category's
 * own theme continues to supply the background.
 *
 * @param existing  normalised { categories: { slug: config } }
 * @param uploads   [{ slug, url, categories: [slug] }]
 * @returns { categories, report } — report says what each category received
 */
export function applyUploads(existing, uploads = []) {
  const out = {};
  for (const [slug, cfg] of Object.entries(existing?.categories || {})) out[slug] = sanitizeCategoryConfig(cfg, slug);

  const report = {};
  const touch = (catSlug) => {
    if (!out[catSlug]) out[catSlug] = sanitizeCategoryConfig({}, catSlug);
    if (!report[catSlug]) {
      report[catSlug] = {
        category: catSlug, updated: [], created: [],
        // Whether this category is published. The import NEVER changes it —
        // it is reported so the owner can see which categories are still
        // waiting to be switched on.
        enabled: out[catSlug].enabled === true,
        wasUsingFallback: out[catSlug].items.length === 0,
      };
    }
    return out[catSlug];
  };

  for (const up of uploads) {
    if (!up?.slug || !up?.url) continue;
    for (const catSlug of up.categories || []) {
      if (!categoryBySlug[catSlug]) continue;
      const cfg = touch(catSlug);
      const idx = cfg.items.findIndex((it) => it.productSlug === up.slug);
      if (idx >= 0) {
        // Update in place: order and every authored field survive.
        cfg.items[idx] = { ...cfg.items[idx], spotlightImage: up.url };
        report[catSlug].updated.push(up.slug);
        continue;
      }
      cfg.items.push({
        id: makeSpotlightId(up.slug, cfg.items.map((it) => it.id)),
        productSlug: up.slug,
        spotlightImage: up.url,
        headline: '',
        subline: '',
        background: '',
        gradient: '',
        enabled: true,
      });
      report[catSlug].created.push(up.slug);
    }
  }

  return { categories: out, report: Object.values(report) };
}

/**
 * Merge the new category-experience block into the WHOLE homepage settings
 * object, so discovery, the visuals and every other homepage key survive.
 *
 * The caller must pass the homepage object it just re-read, not a stale copy.
 */
export function mergeIntoHomepage(currentHomepage, categoryExperience) {
  const base = currentHomepage && typeof currentHomepage === 'object' ? currentHomepage : {};
  return { ...base, categoryExperience };
}

/** A plain-text summary the owner can copy or save. */
export function buildSummaryText(plan, { uploadedUrls = new Map() } = {}) {
  const group = (status) => plan.filter((r) => r.status === status);
  const lines = [];
  const section = (title, rows, render) => {
    lines.push(`${title} (${rows.length})`);
    if (!rows.length) lines.push('  —');
    else rows.forEach((r) => lines.push(`  ${render(r)}`));
    lines.push('');
  };
  lines.push('SORA LIFE — spotlight packshot import');
  lines.push(new Date().toISOString());
  lines.push('');
  section('UPLOADED', group(IMPORT_STATUS.UPLOADED), (r) => `${r.slug}  ${uploadedUrls.get(r.slug) || ''}`.trim());
  section('FAILED', group(IMPORT_STATUS.FAILED), (r) => `${r.slug}  — ${r.reason}`);
  section('SKIPPED', group(IMPORT_STATUS.SKIPPED), (r) => `${r.slug}  — ${r.reason}`);
  section('AMBIGUOUS (left for review, nothing assigned)', group(IMPORT_STATUS.AMBIGUOUS), (r) => `${r.filename}  — ${r.reason}`);
  section('UNMATCHED FILES', group(IMPORT_STATUS.UNMATCHED), (r) => `${r.filename}  — ${r.reason}`);
  return lines.join('\n');
}
