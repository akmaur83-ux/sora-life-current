// ============================================================
// SORA LIFE — product content field shapes (migration 0025)
//
// One definition of what each content column may contain, shared by the admin
// editor, the CSV importer and the save path. Three callers agreeing on a
// shape by coincidence is how a malformed object reaches the PDP — and React
// throws on an object rendered as a child, which nearly white-screened the
// storefront during the Biosash ingest.
//
// Every normaliser is TOTAL: hand it anything and it returns a valid value of
// the right shape, or null. Nothing here throws, so a bad row degrades to
// empty rather than taking a page down.
//
// NULL vs EMPTY is load-bearing throughout:
//   null  -> "not authored" — the PDP section renders nothing
//   []/{} -> "authored as empty" — an admin deliberately cleared it
// The importer's fill-only mode only fills nulls; it never overwrites either.
// ============================================================

export const CONTENT_FIELDS = [
  'brand', 'net_content', 'key_claims', 'benefits',
  'ingredients', 'how_to_use', 'specifications',
];

/** Human labels, used by the editor, the coverage view and import reports. */
export const CONTENT_LABELS = {
  brand: 'Brand',
  net_content: 'Net content',
  key_claims: 'Key claims',
  benefits: 'Benefits',
  ingredients: 'Ingredients',
  how_to_use: 'How to use',
  specifications: 'Specifications',
};

const str = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const truthyStr = (v) => { const s = str(v); return s.length ? s : null; };

/** An array field that came back empty is "authored as empty", not "absent". */
const arrayOrNull = (rows) => (Array.isArray(rows) ? rows : null);

// ---------- normalisers ----------

export function normalizeKeyClaims(value) {
  if (value === null || value === undefined) return null;
  const list = Array.isArray(value)
    ? value
    // A tag input or a CSV cell may hand us a comma-separated string.
    : String(value).split(',');
  const out = list.map(str).filter(Boolean);
  return arrayOrNull(out);
}

export function normalizeBenefits(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const raw of value) {
    if (typeof raw === 'string') {
      // The legacy shape. Keep it readable rather than dropping the content.
      const t = str(raw);
      if (t) out.push({ title: t, description: '' });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const title = str(raw.title);
    const description = str(raw.description);
    // A row with neither is not a benefit, it is an empty row the admin has
    // not filled in yet — dropped on save rather than stored.
    if (!title && !description) continue;
    out.push({ title: title || description, description: title ? description : '' });
  }
  return out;
}

export function normalizeIngredients(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const raw of value) {
    if (typeof raw === 'string') {
      const n = str(raw);
      if (n) out.push({ name: n, description: '', image_url: null });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const name = str(raw.name);
    if (!name) continue;                       // an ingredient with no name is nothing
    out.push({
      name,
      description: str(raw.description),
      // Only http(s). A relative or javascript: value must never reach an
      // <img src> on a live page.
      image_url: /^https?:\/\//i.test(str(raw.image_url)) ? str(raw.image_url) : null,
    });
  }
  return out;
}

export function normalizeHowToUse(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const raw of value) {
    const text = typeof raw === 'string' ? str(raw) : str(raw?.text);
    if (!text) continue;
    out.push({ step: out.length + 1, text });   // renumbered, so order is the truth
  }
  return out;
}

export function normalizeSpecifications(value) {
  if (value === null || value === undefined) return null;
  // Accept both the stored object and the editor's row array.
  const pairs = Array.isArray(value)
    ? value.map((r) => [str(r?.key), str(r?.value)])
    : (typeof value === 'object' ? Object.entries(value).map(([k, v]) => [str(k), str(v)]) : []);
  const out = {};
  for (const [k, v] of pairs) {
    if (!k || !v) continue;                     // a label with no value renders as "Shelf life:"
    out[k] = v;
  }
  return out;
}

/**
 * Normalise a whole content patch.
 *
 * Only keys PRESENT in `input` appear in the result — absence means "leave
 * alone", exactly like description and gallery_urls in productToDbRow. The
 * caller decides what absence means; this function does not invent values.
 */
export function normalizeContentPatch(input) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input || {}, k);
  if (has('brand')) out.brand = truthyStr(input.brand);
  if (has('net_content')) out.net_content = truthyStr(input.net_content);
  if (has('key_claims')) out.key_claims = normalizeKeyClaims(input.key_claims);
  if (has('benefits')) out.benefits = normalizeBenefits(input.benefits);
  if (has('ingredients')) out.ingredients = normalizeIngredients(input.ingredients);
  if (has('how_to_use')) out.how_to_use = normalizeHowToUse(input.how_to_use);
  if (has('specifications')) out.specifications = normalizeSpecifications(input.specifications);
  return out;
}

// ---------- validation ----------

/**
 * Problems that should stop a save, as human sentences.
 *
 * Normalisation already drops anything unrenderable, so this exists to TELL
 * the admin what was wrong rather than silently discarding their typing —
 * a row that vanishes on save with no explanation is worse than a refusal.
 */
export function validateContent(input) {
  const errors = [];
  const check = (key, value) => {
    if (value === null || value === undefined) return;
    if (!Array.isArray(value)) { errors.push(`${CONTENT_LABELS[key]}: expected a list.`); return; }
  };

  check('key_claims', input.key_claims);
  check('benefits', input.benefits);
  check('ingredients', input.ingredients);
  check('how_to_use', input.how_to_use);

  for (const c of input.key_claims || []) {
    if (typeof c !== 'string') { errors.push('Key claims: every claim must be text.'); break; }
    if (c.length > 60) { errors.push(`Key claim "${c.slice(0, 24)}…" is too long for a badge (60 characters max).`); break; }
  }
  for (const b of input.benefits || []) {
    if (!b || typeof b !== 'object' || Array.isArray(b)) { errors.push('Benefits: each row needs a title and description.'); break; }
    if (!str(b.title) && !str(b.description)) { errors.push('Benefits: a row is completely empty.'); break; }
  }
  for (const i of input.ingredients || []) {
    if (!i || typeof i !== 'object' || Array.isArray(i)) { errors.push('Ingredients: each row needs a name.'); break; }
    if (!str(i.name)) { errors.push('Ingredients: a row has a description but no name.'); break; }
    const url = str(i.image_url);
    if (url && !/^https?:\/\//i.test(url)) { errors.push(`Ingredients: "${url.slice(0, 30)}" is not an http(s) image URL.`); break; }
  }
  for (const s of input.how_to_use || []) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) { errors.push('How to use: each step needs text.'); break; }
    if (!str(s.text)) { errors.push('How to use: a step has no text.'); break; }
  }
  const spec = input.specifications;
  if (spec !== null && spec !== undefined && (typeof spec !== 'object' || Array.isArray(spec))) {
    errors.push('Specifications: expected key/value pairs.');
  }

  return errors;
}

// ---------- coverage ----------

/** True when a content field actually has something in it. */
export function fieldPopulated(product, field) {
  const v = {
    brand: product?.brand,
    net_content: product?.netContent ?? product?.net_content,
    key_claims: product?.keyClaims ?? product?.key_claims,
    benefits: product?.benefits,
    ingredients: product?.ingredients,
    how_to_use: product?.howToUse ?? product?.how_to_use,
    specifications: product?.specifications,
  }[field];
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/** How many of the seven authored fields a product has. Description is counted
 *  separately because it predates 0025 and is filled far more often. */
export function contentScore(product) {
  const populated = CONTENT_FIELDS.filter((f) => fieldPopulated(product, f));
  return {
    populated,
    missing: CONTENT_FIELDS.filter((f) => !populated.includes(f)),
    count: populated.length,
    total: CONTENT_FIELDS.length,
    hasDescription: !!str(product?.description),
  };
}
