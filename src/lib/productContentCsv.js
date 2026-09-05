// ============================================================
// SORA LIFE — product content CSV round-trip
//
// Export every product's content fields, edit in a spreadsheet, import back.
// This is what makes filling in 124 products realistic; the per-product editor
// is for one at a time.
//
// The structured fields are JSON-encoded in their cells. That is uglier in a
// spreadsheet than one-column-per-benefit would be, but it round-trips
// exactly: a benefit whose description contains a comma, a newline or a quote
// survives, and there is no ambiguity about how many benefits a row has.
//
// Nothing here writes. Callers get a plan of what WOULD change and decide.
// ============================================================
import {
  CONTENT_FIELDS, CONTENT_LABELS, normalizeContentPatch,
} from './productContent.js';

export const CSV_COLUMNS = ['id', 'slug', 'name', ...CONTENT_FIELDS];
const STRUCTURED = new Set(['key_claims', 'benefits', 'ingredients', 'how_to_use', 'specifications']);

// ---------- serialize ----------

const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const valueFor = (p, field) => {
  const v = {
    brand: p.brand,
    net_content: p.netContent ?? p.net_content,
    key_claims: p.keyClaims ?? p.key_claims,
    benefits: p.benefits,
    ingredients: p.ingredients,
    how_to_use: p.howToUse ?? p.how_to_use,
    specifications: p.specifications,
  }[field];
  if (v === null || v === undefined) return '';
  return STRUCTURED.has(field) ? JSON.stringify(v) : String(v);
};

export function productsToCsv(products) {
  const rows = [CSV_COLUMNS.join(',')];
  for (const p of products) {
    rows.push([
      cell(p.dbId ?? p.id),
      cell(p.slug),
      cell(p.name),
      ...CONTENT_FIELDS.map((f) => cell(valueFor(p, f))),
    ].join(','));
  }
  return `${rows.join('\n')}\n`;
}

// ---------- parse ----------

/** RFC4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');   // strip a spreadsheet BOM
  const rows = [];
  let row = [], cur = '', quoted = false;

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cur); cur = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

const isEmptyCell = (v) => String(v ?? '').trim() === '';

/**
 * Turn a parsed CSV into a per-product plan.
 *
 * EVERY row is validated before ANY row is reported as writable, and the
 * caller is expected to refuse the whole file if `errors` is non-empty for a
 * row it cares about — a half-applied content import is worse than none,
 * because there is no way to tell which half landed.
 *
 * A BLANK cell means "no opinion, leave it alone" — never "clear this field".
 * Clearing is a deliberate act and belongs in the per-product editor, not in
 * a spreadsheet where an accidentally deleted column would wipe the catalogue.
 */
export function planImport(rowsText, products, { overwrite = false } = {}) {
  const rows = parseCsv(rowsText);
  if (!rows.length) return { ok: false, reason: 'The file is empty.', changes: [], skipped: [] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  if (idx('slug') < 0 && idx('id') < 0) {
    return { ok: false, reason: 'The file needs a "slug" or "id" column to match products on.', changes: [], skipped: [] };
  }

  const bySlug = new Map(products.map((p) => [String(p.slug), p]));
  const byId = new Map(products.map((p) => [String(p.dbId ?? p.id), p]));
  const present = CONTENT_FIELDS.filter((f) => idx(f) >= 0);

  const changes = [], skipped = [];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const line = r + 1;
    const slug = idx('slug') >= 0 ? String(cells[idx('slug')] ?? '').trim() : '';
    const id = idx('id') >= 0 ? String(cells[idx('id')] ?? '').trim() : '';
    const product = bySlug.get(slug) || byId.get(id);

    if (!product) {
      skipped.push({ line, slug: slug || id, reason: 'No product matches this slug or id.' });
      continue;
    }

    const patch = {}, diffs = [], rowErrors = [];

    for (const field of present) {
      const raw = cells[idx(field)];
      if (isEmptyCell(raw)) continue;                       // no opinion

      let parsed;
      if (STRUCTURED.has(field)) {
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          rowErrors.push(`${CONTENT_LABELS[field]}: not valid JSON.`);
          continue;
        }
      } else {
        parsed = String(raw).trim();
      }
      patch[field] = parsed;
    }

    // Normalise once, then compare — so "same content, different key order"
    // is not reported as a change on a clean round-trip.
    const normalized = normalizeContentPatch(patch);
    for (const [field, next] of Object.entries(normalized)) {
      const currentRaw = valueFor(product, field);
      const nextRaw = STRUCTURED.has(field)
        ? JSON.stringify(next ?? null)
        : String(next ?? '');
      const currentCmp = currentRaw === '' && STRUCTURED.has(field) ? 'null' : currentRaw;

      if (nextRaw === currentCmp) continue;                 // identical, nothing to do

      const alreadyHas = currentRaw !== '';
      if (alreadyHas && !overwrite) {
        diffs.push({ field, skipped: true, reason: 'already has a value (fill-only)', before: currentRaw, after: nextRaw });
        continue;
      }
      diffs.push({ field, before: currentRaw, after: nextRaw });
    }

    if (rowErrors.length) {
      skipped.push({ line, slug: product.slug, reason: rowErrors.join(' ') });
      continue;
    }

    const applying = diffs.filter((d) => !d.skipped);
    if (!applying.length) continue;

    changes.push({
      line,
      dbId: product.dbId ?? product.id,
      slug: product.slug,
      name: product.name,
      diffs,
      patch: Object.fromEntries(applying.map((d) => [d.field, normalized[d.field]])),
    });
  }

  return { ok: true, columns: present, changes, skipped };
}
