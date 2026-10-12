// ============================================================
// Builds the kit's templates and FIELD-GUIDE.md from spec.mjs, so the sheets,
// the guide and the validator can never describe different columns.
//   node scripts/catalogue-kit/kit.mjs build          write them
//   node scripts/catalogue-kit/kit.mjs build --check  fail if the committed copies differ
// ============================================================
import { COLUMNS, EXAMPLES, KITS, SHEETS, columnsFor, sheetsFor, PURITY } from './spec.mjs';
import { toCsv } from './sheets.mjs';

const REQUIRED = { new: 'Required for a new row', live: 'Expected before it goes live (the validator warns; nothing blocks)', no: 'Optional' };

/** Every template: { path, text }. */
export function templates() {
  const out = [];
  for (const kit of Object.keys(KITS)) {
    for (const sheet of sheetsFor(kit)) {
      const columns = columnsFor(sheet, kit).map((c) => c.key);
      out.push({ path: `templates/${kit}-${sheet}.csv`, text: toCsv(columns, EXAMPLES[kit][sheet] || []) });
    }
  }
  out.push({ path: 'templates/companies.csv', text: toCsv(columnsFor('companies', 'fashion').map((c) => c.key), EXAMPLES.companies) });
  return out;
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
export function fieldGuide() {
  const lines = [
    '# Catalogue loading kit — field guide',
    '',
    '_Generated from `scripts/catalogue-kit/spec.mjs` by `node scripts/catalogue-kit/kit.mjs build`. Edit the spec, not this file._',
    '',
    'Two kits, both loaded into the **fashion** store: **fashion** and **jewellery** (jewellery is the fashion store’s Jewellery category).',
    'Each kit has a products sheet and a variants sheet; jewellery adds a stones sheet; both share one companies sheet.',
    '',
    '## How the import reads every sheet',
    '- **A blank cell means “leave it alone”**, never “clear it”. On a new row a blank takes the default stated below.',
    '- **Fill-only by default**: a cell fills an empty field; a field that already has a value is kept unless you tick **Overwrite existing values**.',
    '- **New products arrive as drafts.** There is no is_active column for products: you publish each one in the editor once it has an image and an active size/colour.',
    '- A row with any problem is skipped whole, with its reason — never half-applied.',
    '- **Import the products file first, then the variants file** (variants name their product by slug): Store catalogue → Fashion → Bulk import (CSV) → Products, then → Sizes & colours (variants).',
    '- Columns marked **0036** are not imported yet: fill them in now. The import lists them as “ignored” (the file keeps them) until migration 0036 is applied and the importer learns them. The validator checks them today.',
    '- Every fashion and jewellery product needs **at least one size/colour row** to be published or bought. A product with “no variants” is one row with size **One size**.',
    '- Run the validator on a filled kit before importing: `node scripts/catalogue-kit/kit.mjs validate --kit fashion --products … --variants …`.',
    '',
  ];
  for (const sheet of Object.keys(SHEETS)) {
    const cols = COLUMNS.filter((c) => c.sheet === sheet);
    if (!cols.length) continue;
    const kits = [...new Set(cols.flatMap((c) => c.kits))];
    lines.push(`## ${sheet}.csv`, '', SHEETS[sheet], '', `Used by: ${kits.map((k) => KITS[k].label).join(', ')}.`, '');
    for (const c of cols) {
      const example = Object.entries(c.example).filter(([, v]) => v !== '').map(([k, v]) => `\`${v}\`${Object.keys(c.example).length > 1 ? ` (${KITS[k].label.toLowerCase()})` : ''}`).join(' · ');
      lines.push(`### \`${c.key}\`${c.importable ? '' : ' — 0036, not imported yet'}`);
      lines.push(`- **For:** ${c.purpose}`);
      lines.push(`- **Kits:** ${c.kits.map((k) => KITS[k].label).join(', ')} · **${REQUIRED[c.required]}**`);
      lines.push(`- **Format:** ${c.format}`);
      lines.push(`- **Example:** ${example || '_(leave blank)_'}`);
      lines.push(`- **If blank:** ${c.blank}`);
      if (c.rejects.length) {
        lines.push('- **Refused, and the message you see:**');
        for (const [when, message] of c.rejects) lines.push(`  - ${when} → “${esc(message)}”`);
      }
      lines.push('');
    }
  }
  lines.push(
    '## Purity grades (jewellery `purity`)',
    '',
    '| Metal | Fineness → grade |',
    '|---|---|',
    ...Object.entries(PURITY).map(([metal, grades]) => `| ${metal} | ${Object.entries(grades).map(([k, v]) => `${k} → ${v}`).join(', ')} |`),
    '',
    '## The example rows',
    '',
    'Each template holds three example products (slugs start `example-`; the validator refuses them, so delete them before importing):',
    '',
    '| Kit | No variants (one “One size” row) | Sizes × colours, priced per size | Out of stock, draft |',
    '|---|---|---|---|',
    ...Object.keys(KITS).map((kit) => `| ${KITS[kit].label} | ${EXAMPLES[kit].products.map((p) => `\`${p.slug}\``).join(' | ')} |`),
    '',
    '“Draft” is not a column: every product the import creates is a draft. The third example is out of stock because every size has stock 0.',
    '',
    '## Images',
    '',
    '- **Name:** `<product slug>-<number>.<webp|jpg|jpeg|png>`, e.g. `example-linen-shirt-1.webp`, `example-linen-shirt-2.jpg`. Upper or lower case both match; the number is 1–4 digits.',
    '- **Order:** by the number (2 before 10). Number 1 becomes the main image of an empty gallery.',
    '- **How many:** no limit per product. Two files with the same number for one product hold that product back.',
    '- **A product that already has images** is held back unless you tick “Also add to products that already have images” (they are added after the existing ones).',
    '- **Formats and size:** JPEG, PNG or WebP, under 25 MB each. Every image is turned into a WebP under 150 KB in the browser before upload (longest side 1600 px, then 1400, 1200, 1000, 800; never enlarged). A WebP already under 150 KB and 1600 px is uploaded exactly as it is. An image that cannot fit 150 KB at 800 px is refused: crop it closer.',
    '- **Size to supply:** 1600 px on the longest side is ideal; under 800 px looks soft. Product photos are square on cards.',
    '- **Per size or colour:** not supported — images belong to the product, not to a size or colour. When colours need their own photos, list each colour as its own product (e.g. `meadow-linen-shirt-sage`, `meadow-linen-shirt-white`), as the store already does.',
    '- **Alt text:** set to the product name on upload; change it in the gallery (up to 300 characters).',
    '- **Upload:** Store catalogue → Bulk images, choose the files, read the plan, then upload. The validator checks names against the products file with `--images <folder>`.',
    '',
  );
  return `${lines.join('\n')}\n`;
}
