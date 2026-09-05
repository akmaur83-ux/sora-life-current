// ============================================================
// SORA LIFE — Biosash product content ingestion
//
//   node scripts/ingest-biosash-content.mjs --dry-run     (default; writes a CSV, touches nothing)
//   node scripts/ingest-biosash-content.mjs --live        (writes the columns 0025 added)
//   node scripts/ingest-biosash-content.mjs --dry-run --limit 5
//
// SCOPE. Only products carrying a biosash_id or a source_url on biosash.com.
// Everything else in the catalogue is out of scope and is never fetched.
//
// FILL-ONLY. A field is written only when the product's current value is
// empty. Existing content — whoever authored it — is never overwritten, so
// the script is safe to re-run and re-running it is a no-op for anything
// already populated.
//
// PRICES ARE NEVER TOUCHED. The source pages carry price and mrp and this
// script deliberately reads neither into a patch. Sora Life's prices are its
// own, and there is a known Bioradiance mismatch that is a data question, not
// something an importer should silently "fix".
//
// POLITENESS. biosash.com/robots.txt allows product pages to every agent and
// asks for Crawl-delay: 1. This waits at least that long between requests,
// identifies itself honestly, and stops on the first 401/403/429 rather than
// working around a block.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { stripHtml } from './lib/strip-html.mjs';

const ARGS = new Set(process.argv.slice(2));
const LIVE = ARGS.has('--live');
// --inspect prints the shaped patch instead of only counting it, so the JSON
// actually destined for the database can be read before any of it is written.
const INSPECT = ARGS.has('--inspect');
// --only <slug>[,<slug>] narrows a run to named products, for spot-checking
// one record's parsed output without fetching the whole catalogue.
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > 0 ? new Set(String(process.argv[i + 1] || '').split(',').filter(Boolean)) : null;
})();
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i > 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

const UA = 'SoraLifeBot/1.0 (+https://sora-life-current.vercel.app; authorized product content sync)';
const CRAWL_DELAY_MS = 1100;   // robots.txt asks for 1s; a little over, to be safe
const ORIGIN = 'https://biosash.com';

// ---------- config ----------
function env(name) {
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}
const SUPABASE_URL = env('VITE_SUPABASE_URL');
const READ_KEY = env('VITE_SUPABASE_PUBLISHABLE_KEY');
// Writes to public.products are admin-gated, which a browser key cannot pass.
// Only the --live path reads this, and it never leaves this process.
const WRITE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !READ_KEY) { console.error('Missing Supabase config in .env.local'); process.exit(1); }
if (LIVE && !WRITE_KEY) { console.error('--live needs SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- source parsing ----------

/** Next streams its RSC tree as self.__next_f.push([1,"<json-escaped chunk>"]). */
function flightPayload(html) {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { out += JSON.parse(m[1]); } catch { /* a truncated chunk is not fatal */ }
  }
  return out;
}

function jsonLdProduct(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (j['@type'] === 'Product') return j;
    } catch { /* one malformed block must not lose the others */ }
  }
  return null;
}

/**
 * Read one balanced JSON object out of a longer string, starting at `from`.
 * The flight payload is not valid JSON as a whole, so the objects inside it
 * have to be sliced by counting braces rather than parsed wholesale.
 */
function objectAt(text, from) {
  const start = text.indexOf('{', from);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** Resolve a "$53" body reference to the text carried by chunk 53. */
function resolveRef(flight, value) {
  if (typeof value !== 'string' || !/^\$[0-9a-f]+$/i.test(value)) return value;
  const id = value.slice(1);
  // Chunks arrive as `\n<id>:T<hex-length>,<text>` — the hex length tells us
  // exactly where the text ends, which matters because the body itself
  // contains newlines and the next chunk starts on one.
  const m = flight.match(new RegExp(`\\n${id}:T([0-9a-f]+),`));
  if (!m) return null;
  const start = m.index + m[0].length;
  return flight.slice(start, start + parseInt(m[1], 16));
}

// Tags come off BEFORE whitespace is collapsed. The source authors its copy as
// HTML, and storing that raw put a literal "<p>" on the page for 50 of the 122
// descriptions this ingest wrote.
const clean = (s) => stripHtml(s).replace(/\s+/g, ' ').trim();
const lines = (s) => stripHtml(s).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function parseProductPage(html) {
  const flight = flightPayload(html);
  const ld = jsonLdProduct(html);

  // The buy panel carries the canonical product facts.
  const buyIdx = flight.indexOf('"shortDescription"');
  const buy = buyIdx >= 0 ? objectAt(flight, flight.lastIndexOf('{"productId"', buyIdx)) : null;

  // Topic accordion: Overview / Benefits / How to use / ...
  let topics = [];
  const topicsIdx = flight.indexOf('"key":"overview"');
  if (topicsIdx >= 0) {
    const wrapper = objectAt(flight, flight.lastIndexOf('{"items"', topicsIdx));
    if (wrapper && Array.isArray(wrapper.items)) topics = wrapper.items;
  }
  const topicBody = (...titles) => {
    const t = topics.find((x) => titles.some((n) => clean(x.title).toLowerCase() === n));
    return t ? resolveRef(flight, t.body) : null;
  };

  // Ingredient taxonomy, as rendered by the PdpIngredients component.
  let ingredients = [];
  const ingIdx = flight.indexOf('"ingredients":[');
  if (ingIdx >= 0) {
    const wrapper = objectAt(flight, flight.lastIndexOf('{', ingIdx));
    if (wrapper && Array.isArray(wrapper.ingredients)) ingredients = wrapper.ingredients;
  }

  return {
    brand: clean(ld?.brand?.name) || null,
    name: clean(buy?.name || ld?.name) || null,
    overview: clean(topicBody('overview')) || null,
    // The same field with its line structure intact, for the description.
    overviewRaw: topicBody('overview') || null,
    shortDescription: clean(buy?.shortDescription || ld?.description) || null,
    benefitsRaw: topicBody('benefits', 'key benefits') || null,
    howToUseRaw: topicBody('how to use', 'directions', 'dosage', 'usage') || null,
    ingredients,
    packSize: clean(buy?.packSize) || null,
    sku: clean(buy?.sku) || null,
    categoryName: clean(buy?.categoryName) || null,
    wellness: Array.isArray(buy?.wellness) ? buy.wellness.map(clean).filter(Boolean) : [],
    concerns: Array.isArray(buy?.concerns) ? buy.concerns.map(clean).filter(Boolean) : [],
    images: Array.isArray(ld?.image) ? ld.image.filter((u) => typeof u === 'string' && u.startsWith('http')) : [],
  };
}

// ---------- claims screening ----------
//
// Biosash writes therapeutic copy: their own pages name diseases and assert
// treatment effects. Sora Life is a marketplace and that text would go live
// verbatim under its name, so anything reading as a drug claim is held back
// for a human to rewrite rather than published automatically.
//
// The screen is deliberately BLUNT and errs toward flagging. The two failure
// modes are not symmetrical: a false positive costs a description that gets
// written on the next run once the copy is rewritten, while a false negative
// puts a medical claim on a live product page and — because the ingest is
// fill-only — never revisits it. So a word that is usually innocent ("treats")
// still flags.
//
// A flagged product still ingests brand, net_content, specifications and
// gallery. Only the free-text fields a human has to own are withheld.

// Named conditions. Matching these anywhere in the copy is enough.
const DISEASE_TERMS = [
  'impotence', 'impotency', 'erectile dysfunction', 'premature ejaculation',
  'infertility', 'libido', 'sexual weakness', 'sexual dysfunction', 'aphrodisiac',
  'arthritis', 'osteoarthritis', 'rheumatism', 'rheumatoid', 'gout',
  'diabetes', 'diabetic', 'blood sugar', 'insulin',
  'cancer', 'tumour', 'tumor', 'carcinogen', 'chemotherapy',
  'blood pressure', 'hypertension', 'hypotension', 'cholesterol',
  'asthma', 'bronchitis', 'tuberculosis', 'pneumonia',
  'ulcer', 'piles', 'haemorrhoid', 'hemorrhoid', 'constipation',
  'jaundice', 'hepatitis', 'liver disease', 'kidney stone', 'renal',
  'thyroid', 'anaemia', 'anemia', 'osteoporosis',
  'depression', 'anxiety disorder', 'insomnia', 'alzheimer', 'dementia',
  'infection', 'inflammatory disease', 'immunity booster',
  'menopause', 'menstrual disorder', 'leucorrhoea', 'leukorrhea',
  'obesity', 'stroke', 'heart disease', 'cardiac', 'migraine', 'epilepsy',
];

// Treatment language. These are claims about what the product DOES to a
// condition, which is the part a supplement may not assert.
const TREATMENT_TERMS = [
  'cure', 'cures', 'curing', 'treat', 'treats', 'treating', 'treatment of',
  'remedy', 'remedies', 'heals', 'healing of', 'prevents disease',
  'medicine for', 'medicinal use', 'therapeutic', 'clinically proven',
  'doctor recommended', 'prescription',
];

const SCREEN_TERMS = [...DISEASE_TERMS, ...TREATMENT_TERMS];

/**
 * Return every screened term appearing in `text`.
 * Whole-word, so "treat" does not fire on "treatment-free" prose and "cure"
 * does not fire inside "manicure" or "secure" — but with an optional plural
 * suffix, because strict whole-word matching let real claims through: an
 * immunity capsule promising to "protect the body against INFECTIONS" scored
 * clean where the singular would have flagged it. Missing a claim is the
 * expensive direction; also matching "cures" and "infections" is not.
 */
function screenText(text) {
  const hay = String(text || '').toLowerCase();
  if (!hay) return [];
  const hits = [];
  for (const term of SCREEN_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z])${escaped}(e?s)?([^a-z]|$)`, 'i');
    if (re.test(hay)) hits.push(term);
  }
  return hits;
}

/**
 * Screen everything free-text the ingest would publish: the description, and
 * every benefit and claim string. Returns the matched terms and which field
 * each came from.
 */
function screenContent(patch) {
  const found = new Map();
  const record = (field, text) => {
    for (const term of screenText(text)) {
      if (!found.has(term)) found.set(term, new Set());
      found.get(term).add(field);
    }
  };

  record('description', patch.description);
  for (const b of patch.benefits || []) {
    record('benefits', `${b.title || ''} ${b.description || ''}`);
  }
  for (const c of patch.key_claims || []) record('key_claims', c);
  for (const s of patch.how_to_use || []) record('how_to_use', s.text);
  for (const [k, v] of Object.entries(patch.specifications || {})) record('specifications', `${k} ${v}`);

  return [...found.entries()].map(([term, fields]) => ({ term, fields: [...fields] }));
}

// ---------- shaping ----------

const isEmpty = (v) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * The ingredient taxonomy stores a bare filename ("Nirgundi.jpg"), not a path.
 * Resolving that against the origin gives https://biosash.com/Nirgundi.jpg,
 * which 404s; the files are served from /media/uploads/ingredients/, a sibling
 * of the /media/uploads/products/ prefix the packshots use. Anything that
 * already looks like a path or an absolute URL is left exactly as it is.
 */
function ingredientImageUrl(value) {
  const raw = clean(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes('/')) return new URL(raw, ORIGIN).href;
  return `${ORIGIN}/media/uploads/ingredients/${raw}`;
}

function shapePatch(current, src) {
  const patch = {};
  const filled = [];
  const put = (col, value) => {
    if (isEmpty(value)) return;
    if (!isEmpty(current[col])) return;   // fill-only: never overwrite
    patch[col] = value;
    filled.push(col);
  };

  put('brand', src.brand);
  // Overview is the long-form copy; the short line is the fallback so a product
  // with only a tagline still gets something real rather than nothing.
  //
  // stripHtml rather than clean() here: clean() flattens newlines, and these
  // run to well over a thousand characters. The description is the one
  // ingested field whose paragraph breaks earn their keep, and the PDP renders
  // it with `white-space: pre-line` so they survive to the page.
  put('description', stripHtml(src.overviewRaw) || src.overview || src.shortDescription);
  put('net_content', src.packSize);

  // Each line of the Benefits topic is one claim. The source writes them as
  // sentences, so the leading clause becomes the title and the sentence stays
  // whole as the description — nothing is paraphrased or invented.
  const benefitLines = lines(src.benefitsRaw);
  if (benefitLines.length) {
    put('benefits', benefitLines.map((line) => {
      const cut = line.search(/[.,]|\s+(?:is|are|helps|contains|works|reduces|supports)\s/i);
      const title = cut > 0 ? line.slice(0, cut).trim() : line.slice(0, 60).trim();
      return { title, description: line };
    }));
  }

  if (src.ingredients.length) {
    put('ingredients', src.ingredients.map((i) => ({
      name: clean(i.name),
      description: null,
      image_url: ingredientImageUrl(i.image),
    })).filter((i) => i.name));
  }

  const steps = lines(src.howToUseRaw);
  if (steps.length) put('how_to_use', steps.map((text, n) => ({ step: n + 1, text })));

  const specs = {};
  if (src.packSize) specs['Pack size'] = src.packSize;
  if (src.sku) specs['Source SKU'] = src.sku;
  if (src.categoryName) specs['Source category'] = src.categoryName;
  put('specifications', specs);

  // `concerns` names conditions — "Osteo Arthritis", "Diabetes". It is dropped
  // entirely rather than stored anywhere.
  //
  // It was first kept out of key_claims (a disease beside the price reads as a
  // treatment claim) and parked in the specification table as "context". That
  // was half a decision: a "Concerns: Osteo Arthritis" row makes the same
  // association in smaller type, and the claims screen proved it — four
  // products were flagged ONLY because of condition names this importer had
  // written into their own specs, losing otherwise-clean descriptions to a
  // problem the importer created. Conditions do not belong on the page.
  put('key_claims', src.wellness);

  return { patch, filled };
}

// ---------- network ----------

let blocked = null;
async function fetchPage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (r.status === 401 || r.status === 403 || r.status === 429) {
    blocked = `${r.status} on ${url}`;
    return null;
  }
  if (!r.ok) return { error: `HTTP ${r.status}` };
  return { html: await r.text() };
}

/**
 * Confirm an image URL actually serves an image BEFORE it is stored.
 * The thumbnail strip that renders four tiles, 404s and collapses is caused by
 * unvalidated URLs reaching the database; validating here is what stops that
 * being a runtime problem.
 */
const urlCache = new Map();
async function validImage(url) {
  if (urlCache.has(url)) return urlCache.get(url);
  let ok = false;
  try {
    let r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    // Some CDNs refuse HEAD but serve GET; a ranged GET keeps it cheap.
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-256' } });
    }
    ok = r.ok && /^image\//i.test(r.headers.get('content-type') || '');
  } catch { ok = false; }
  urlCache.set(url, ok);
  return ok;
}

const H_READ = { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` };

async function loadProducts() {
  const cols = 'id,slug,name,category,biosash_id,source_url,description,image_url,gallery_urls,form';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${cols}&limit=1000`, { headers: H_READ });
  if (!r.ok) throw new Error(`products read failed: ${r.status}`);
  return r.json();
}

/** Only present on --live; every other path leaves the database untouched. */
async function writePatch(id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: WRITE_KEY,
      Authorization: `Bearer ${WRITE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
}

// ---------- run ----------

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  const all = await loadProducts();
  let targets = all.filter((p) => p.biosash_id || /(^|\/\/)([a-z0-9-]+\.)?biosash\.com/i.test(String(p.source_url || '')));
  if (ONLY) targets = targets.filter((p) => ONLY.has(p.slug));
  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log(`\nCatalogue ${all.length} · in scope ${targets.length} · mode ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log(`UA: ${UA}\nCrawl delay: ${CRAWL_DELAY_MS}ms\n`);

  const rows = [];
  const flagged = [];
  let done = 0, wrote = 0, failed = 0;

  for (const p of targets) {
    if (blocked) break;
    const url = p.source_url || `${ORIGIN}/product/${p.slug}/`;
    const res = await fetchPage(url);
    await sleep(CRAWL_DELAY_MS);
    done += 1;

    if (blocked) break;
    if (!res || res.error) {
      failed += 1;
      rows.push({ id: p.id, slug: p.slug, url, fields: '', images_kept: '', images_rejected: '', note: res?.error || 'fetch failed' });
      continue;
    }

    let src;
    try { src = parseProductPage(res.html); } catch (e) {
      failed += 1;
      rows.push({ id: p.id, slug: p.slug, url, fields: '', images_kept: '', images_rejected: '', note: `parse error: ${e.message}` });
      continue;
    }

    const { patch, filled } = shapePatch(p, src);

    // Ingredient thumbnails get the same treatment as the gallery: a URL that
    // does not serve an image today is nulled here rather than becoming a
    // broken tile on the PDP later. The ingredient itself is still kept — its
    // name and prose are the content; the picture is a bonus.
    if (Array.isArray(patch.ingredients)) {
      for (const ing of patch.ingredients) {
        if (ing.image_url && !(await validImage(ing.image_url))) ing.image_url = null;
        if (ing.image_url) await sleep(120);
      }
    }

    // Gallery: keep only URLs that actually serve an image today.
    const kept = [], rejected = [];
    const existing = Array.isArray(p.gallery_urls) ? p.gallery_urls : [];
    const stale = existing.filter((u) => /biosash\.com/i.test(String(u)));
    const candidates = [...new Set([...src.images, ...existing.filter((u) => !stale.includes(u))])];
    for (const u of candidates) {
      if (await validImage(u)) kept.push(u); else rejected.push(u);
      await sleep(150);
    }
    // Only propose a gallery when it is an improvement on what is stored.
    const galleryChanged = kept.length && JSON.stringify(kept) !== JSON.stringify(existing);
    if (galleryChanged) { patch.gallery_urls = kept; filled.push('gallery_urls'); }

    // Screen the free text BEFORE anything is written. A flagged product
    // keeps its factual fields — brand, pack size, specifications, validated
    // gallery — and loses only the prose a human has to own.
    const flags = screenContent(patch);
    if (flags.length) {
      const withheld = [];
      for (const col of ['description', 'benefits', 'key_claims', 'how_to_use']) {
        if (col in patch) { delete patch[col]; withheld.push(col); }
      }
      for (const col of withheld) {
        const at = filled.indexOf(col);
        if (at >= 0) filled.splice(at, 1);
      }
      flagged.push({
        id: p.id, slug: p.slug, url, category: p.category || '',
        terms: flags.map((x) => x.term),
        fields: [...new Set(flags.flatMap((x) => x.fields))],
        withheld,
        excerpt: String(src.overview || src.shortDescription || '').slice(0, 220),
      });
    }

    if (filled.length) {
      patch.content_source = 'biosash';
      patch.content_updated_at = new Date().toISOString();
    }

    rows.push({
      id: p.id, slug: p.slug, url,
      fields: filled, images_kept: kept.length, images_rejected: rejected.join(' '),
      note: filled.length ? '' : 'nothing to fill',
      screened: '',
    });

    if (INSPECT) {
      console.log(`\n${JSON.stringify({ slug: p.slug, url, patch }, null, 2)}`);
    }

    if (LIVE && filled.length) {
      try { await writePatch(p.id, patch); wrote += 1; }
      catch (e) { failed += 1; rows[rows.length - 1].note = `write failed: ${e.message}`; }
    }

    process.stdout.write(`\r  ${done}/${targets.length}  ${p.slug.slice(0, 38).padEnd(38)}`);
  }

  process.stdout.write('\n');

  const out = 'reports/biosash-ingest-' + (LIVE ? 'live' : 'dryrun') + '.csv';
  const header = 'product_id,slug,source_url,fields_to_fill,images_kept,images_rejected,note';
  writeFileSync(out, [header, ...rows.map((r) => [
    r.id, r.slug, r.url, csvCell(r.fields), r.images_kept, csvCell(r.images_rejected), csvCell(r.note),
  ].join(','))].join('\n') + '\n');

  const tally = {};
  for (const r of rows) for (const f of (r.fields || [])) tally[f] = (tally[f] || 0) + 1;

  const flaggedOut = 'reports/biosash-ingest-flagged.csv';
  writeFileSync(flaggedOut, [
    'product_id,slug,category,source_url,matched_terms,matched_in,fields_withheld,excerpt',
    ...flagged.map((r) => [
      r.id, r.slug, r.category, r.url, csvCell(r.terms), csvCell(r.fields), csvCell(r.withheld), csvCell(r.excerpt),
    ].join(',')),
  ].join('\n') + '\n');

  console.log(`\nFetched ${done} · would fill ${rows.filter((r) => r.fields.length).length} · failed ${failed}`);
  console.log(`Claims-screened out: ${flagged.length} products -> ${flaggedOut}`);
  if (LIVE) console.log(`Wrote ${wrote}`);
  console.log('Per-field:', Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '(none)');
  console.log(`Report: ${out}`);
  if (blocked) console.log(`\nSTOPPED — the site blocked us (${blocked}). Nothing further was attempted.`);
})();
