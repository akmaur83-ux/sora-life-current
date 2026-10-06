// ============================================================
// Claim warnings — WARN, never block.
//
// Product copy is screened for three kinds of claim SORA LIFE cannot back
// without proof it does not hold today:
//   * medical or treatment claims — the Biosash ingest screen's vocabulary
//     (scripts/ingest-biosash-content.mjs, DISEASE_TERMS + TREATMENT_TERMS),
//     matched the same way: whole words, case-insensitive, an optional
//     plural, deliberately blunt ("treats" flags even when innocent)
//   * speed claims — delivery and dispatch promises (standard delivery is
//     6–7 days; Express and Scheduled were withdrawn) and "instant results"
//   * sustainability claims — eco, organic, biodegradable, recycled, carbon
//     neutral… each needs a certificate or evidence behind it
//
// The result says which word matched and shows it in context, so the admin
// can judge; nothing here stops a save or an import.
// test-store-catalogue-claims.mjs pins that the medical list still contains
// every term the ingest screen uses.
// ============================================================

export const MEDICAL_TERMS = [
  // Named conditions (the ingest screen's DISEASE_TERMS).
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
  // Treatment language (the ingest screen's TREATMENT_TERMS).
  'cure', 'cures', 'curing', 'treat', 'treats', 'treating', 'treatment of',
  'remedy', 'remedies', 'heals', 'healing of', 'prevents disease',
  'medicine for', 'medicinal use', 'therapeutic', 'clinically proven',
  'doctor recommended', 'prescription',
];

export const SUSTAINABILITY_TERMS = [
  'eco-friendly', 'eco friendly', 'environment-friendly', 'environment friendly', 'environmentally friendly',
  'earth-friendly', 'earth friendly', 'planet-friendly', 'planet friendly',
  'sustainable', 'sustainably', 'sustainability', 'biodegradable', 'compostable',
  'recyclable', 'recycled', 'upcycled', 'organic', 'carbon neutral', 'carbon-neutral',
  'net zero', 'net-zero', 'zero waste', 'zero-waste', 'plastic-free', 'plastic free',
  'chemical-free', 'chemical free', 'toxin-free', 'non-toxic', 'ethically sourced',
  'ethically made', 'fair trade', 'fairtrade', 'renewable', 'low impact', 'low-impact', 'green choice',
];

// Speed is phrased too many ways for a word list; each pattern names what it caught.
export const SPEED_PATTERNS = [
  /\b(?:fast|faster|fastest|quick|quicker|express|speedy|rapid|super[- ]?fast|lightning[- ]?fast|instant)(?:\s*(?:&|and)\s*[a-z]+)?\s+(?:delivery|deliveries|shipping|dispatch)\b/i,
  /\bsame[- ]day\b/i,
  /\bnext[- ]day\b/i,
  /\bovernight\s+(?:delivery|shipping|dispatch)\b/i,
  /\bdeliver(?:ed|s|y)?\s+(?:in|within)\s+(?:\d+|one|two|three)\s*(?:-\s*\d+\s*)?(?:hours?|hrs?|days?|business days?)\b/i,
  /\b(?:within|in)\s+(?:24|48|72)\s*(?:hours?|hrs?)\b/i,
  /\b(?:ships?|dispatched|dispatches)\s+(?:today|same day|immediately|within\s+\d+)/i,
  /\binstant(?:ly)?\s+(?:results?|relief|effect)\b/i,
  /\bresults?\s+in\s+\d+\s*(?:minutes?|hours?|days?)\b/i,
];

export const CLAIM_KINDS = {
  medical: 'Medical or treatment claim',
  speed: 'Speed claim',
  sustainability: 'Sustainability claim',
};

const escape = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termPattern = (term) => new RegExp(`(^|[^a-z])(${escape(term)}(?:e?s)?)(?=[^a-z]|$)`, 'i');
const MEDICAL = MEDICAL_TERMS.map((term) => [term, termPattern(term)]);
const GREEN = SUSTAINABILITY_TERMS.map((term) => [term, termPattern(term)]);

/** The match with about 30 characters either side, cut at whole words. */
function excerpt(text, index, length) {
  const start = Math.max(0, index - 30), end = Math.min(text.length, index + length + 30);
  let slice = text.slice(start, end);
  const inWord = (i) => /\S/.test(text[i - 1] || '') && /\S/.test(text[i] || '');
  if (start > 0 && inWord(start)) slice = slice.replace(/^\S*\s*/, '');            // began mid-word: drop the fragment
  if (end < text.length && inWord(end)) slice = slice.replace(/\s*\S*$/, '');
  return `${start > 0 ? '…' : ''}${slice.replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

/** Every claim in one piece of text: [{ kind, term, excerpt }], one per distinct term, in reading order. */
export function claimWarnings(text) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const found = [];
  const add = (kind, match, offset) => {
    const term = match.trim().toLowerCase();
    if (found.some((f) => f.kind === kind && f.term === term)) return;
    found.push({ kind, term, at: offset, excerpt: excerpt(source, offset, match.length) });
  };
  for (const [, re] of MEDICAL) { const m = re.exec(source); if (m) add('medical', m[2], m.index + m[1].length); }
  for (const re of SPEED_PATTERNS) { const m = re.exec(source); if (m) add('speed', m[0], m.index); }
  for (const [, re] of GREEN) { const m = re.exec(source); if (m) add('sustainability', m[2], m.index + m[1].length); }
  // A longer term already covers a shorter one at the same place ("treatment of" / "treat").
  const kept = found.filter((f) => !found.some((g) => g !== f && g.kind === f.kind && g.term.length > f.term.length && g.at <= f.at && f.at < g.at + g.term.length));
  return kept.sort((a, b) => a.at - b.at).map(({ kind, term, excerpt: e }) => ({ kind, term, excerpt: e }));
}

/** Warnings for a product's customer-facing copy, each tagged with the field it came from. */
export function productClaimWarnings(product) {
  return [['name', 'Name'], ['description', 'Description']].flatMap(([field, label]) => claimWarnings(product?.[field]).map((w) => ({ ...w, field, label })));
}
