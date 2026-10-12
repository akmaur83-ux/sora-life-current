#!/usr/bin/env node
// ============================================================
// The catalogue loading kit. Run from the repository root:
//
//   node scripts/catalogue-kit/kit.mjs build [--check]
//   node scripts/catalogue-kit/kit.mjs validate --kit fashion|jewellery --products p.csv [--variants v.csv]
//        [--stones s.csv] [--companies c.csv] [--categories paths.txt | --live-categories]
//        [--existing-products export.csv] [--existing-variants export.csv] [--images folder] [--report out.md]
//   node scripts/catalogue-kit/kit.mjs map --kit fashion|jewellery --supplier <name> --in <file.csv|.xlsx>
//        [--sheet <name>] [--categories paths.txt | --live-categories]
//   node scripts/catalogue-kit/kit.mjs convert --supplier <name> --in <file.csv|.xlsx> [--sheet <name>]
//        [--categories paths.txt | --live-categories] [--companies c.csv]
//
// Supplier work lives in catalogue-work.local/<supplier>/ (mapping.json, out/):
// git and Vercel both ignore *.local, so a supplier's file is never committed
// or deployed. See README.md and FIELD-GUIDE.md beside this file.
// ============================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templates, fieldGuide } from './build.mjs';
import { validateKit, formatReport, readCategoriesFile, fetchLiveCategories, publicSupabaseConfig, existingFromExports } from './validate.mjs';
import { proposeMapping, convertSupplier, reportMarkdown, openDecisions } from './map.mjs';
import { readSheetFile, toCsv } from './sheets.mjs';
import { columnsFor, KITS, sheetsFor } from './spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const WORK = join(ROOT, 'catalogue-work.local');

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) out[k] = true; else { out[k] = next; i += 1; } }
    else out._.push(a);
  }
  return out;
}
const readText = (path) => (path ? readFileSync(resolve(path), 'utf8') : null);
async function loadCategories(opts) {
  if (opts.categories) return readCategoriesFile(resolve(opts.categories));
  if (opts['live-categories']) return fetchLiveCategories(publicSupabaseConfig(ROOT));
  return null;
}
const supplierDir = (name) => {
  if (!name || name === true || !/^[a-z0-9][a-z0-9-]{0,60}$/i.test(name)) throw new Error('--supplier needs a short name: letters, numbers and hyphens (e.g. aurum-atelier).');
  return join(WORK, name.toLowerCase());
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const opts = args(rest);
  if (command === 'build') {
    const files = [...templates(), { path: 'FIELD-GUIDE.md', text: fieldGuide() }];
    // Line endings aside: a Windows checkout (core.autocrlf) holds these files with CRLF.
    const lf = (s) => s.replace(/\r\n/g, '\n');
    const stale = files.filter((f) => !existsSync(join(HERE, f.path)) || lf(readFileSync(join(HERE, f.path), 'utf8')) !== f.text);
    if (opts.check) {
      if (stale.length) { console.error(`Out of date: ${stale.map((f) => f.path).join(', ')}. Run: node scripts/catalogue-kit/kit.mjs build`); process.exit(1); }
      console.log('Templates and FIELD-GUIDE.md match spec.mjs.');
      return;
    }
    mkdirSync(join(HERE, 'templates'), { recursive: true });
    for (const f of files) writeFileSync(join(HERE, f.path), f.text);
    console.log(`Wrote ${files.map((f) => f.path).join(', ')}.`);
    return;
  }
  if (command === 'validate') {
    const kit = opts.kit;
    if (!KITS[kit]) throw new Error('--kit fashion or --kit jewellery.');
    if (!opts.products && !opts.variants) throw new Error('Give at least --products or --variants.');
    for (const k of ['products', 'variants', 'stones', 'companies']) if (opts[k] && /\.xlsx?$/i.test(opts[k])) throw new Error(`--${k}: the admin import reads CSV. Save the sheet as "CSV UTF-8" and validate that file.`);
    const categories = await loadCategories(opts);
    const existing = existingFromExports(readText(opts['existing-products']), readText(opts['existing-variants']), categories || []);
    const result = validateKit({
      kit, products: readText(opts.products), variants: readText(opts.variants), stones: readText(opts.stones), companies: readText(opts.companies),
      categories, existing, imagesDir: opts.images ? resolve(opts.images) : null,
    });
    process.stdout.write(formatReport(result, { kit }));
    if (opts.report) { writeFileSync(resolve(opts.report), formatReport(result, { kit, markdown: true })); console.log(`Report written to ${opts.report}`); }
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  if (command === 'map') {
    const kit = opts.kit;
    if (!KITS[kit]) throw new Error('--kit fashion or --kit jewellery.');
    const dir = supplierDir(opts.supplier);
    const file = opts.in && resolve(opts.in);
    if (!file || !existsSync(file)) throw new Error('--in <the supplier’s .csv or .xlsx>.');
    mkdirSync(dir, { recursive: true });
    const mappingPath = join(dir, 'mapping.json');
    const previous = existsSync(mappingPath) ? JSON.parse(readFileSync(mappingPath, 'utf8')) : null;
    if (previous && previous.kit !== kit) throw new Error(`${mappingPath} is for the ${previous.kit} kit. Use another --supplier name for a ${kit} file.`);
    const rows = readSheetFile(file, { sheet: opts.sheet || previous?.sheet || null });
    const { mapping, decisions } = proposeMapping(rows, { kit, supplier: opts.supplier, sheet: opts.sheet || previous?.sheet || null, categories: await loadCategories(opts), previous });
    writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
    console.log(`${basename(file)}: ${rows.length - 1} row(s). Layout: ${mapping.layout}.`);
    console.log('\nTheir column → ours');
    for (const [h, m] of Object.entries(mapping.columns)) console.log(`  ${h.padEnd(32)} → ${(m.to ? `${m.to}${m.group ? ` (stone ${m.group})` : ''}` : '—').padEnd(22)} ${m.how}${m.note ? `  ${m.note}` : ''}`);
    console.log(decisions.length ? `\nDecide before converting (${decisions.length}):\n${decisions.map((d) => `  - ${d}`).join('\n')}` : '\nNothing to decide.');
    console.log(`\nEdit ${mappingPath}, then run: node scripts/catalogue-kit/kit.mjs convert --supplier ${opts.supplier} --in ${opts.in}`);
    return;
  }
  if (command === 'convert') {
    const dir = supplierDir(opts.supplier);
    const mappingPath = join(dir, 'mapping.json');
    if (!existsSync(mappingPath)) throw new Error(`No ${mappingPath}. Run "map" first.`);
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
    const file = opts.in && resolve(opts.in);
    if (!file || !existsSync(file)) throw new Error('--in <the supplier’s .csv or .xlsx>.');
    const rows = readSheetFile(file, { sheet: opts.sheet || mapping.sheet || null });
    const result = convertSupplier(rows, mapping);
    const out = join(dir, 'out');
    mkdirSync(out, { recursive: true });
    const kit = mapping.kit;
    const written = {};
    for (const sheet of sheetsFor(kit)) {
      const columns = columnsFor(sheet, kit).map((c) => c.key);
      written[sheet] = toCsv(columns, result[sheet]);
      writeFileSync(join(out, `${sheet}.csv`), written[sheet]);
    }
    writeFileSync(join(out, 'images.csv'), toCsv(['product_slug', 'number', 'file_name', 'url'], result.images));
    writeFileSync(join(out, 'report.csv'), toCsv(['line', 'product', 'column', 'action', 'before', 'after', 'reason'], result.report));
    const categories = await loadCategories(opts);
    const validation = validateKit({ kit, products: written.products, variants: written.variants, stones: written.stones ?? null, companies: readText(opts.companies), categories });
    const md = reportMarkdown({ supplier: opts.supplier, kit, file: basename(file), mapping, result, validation: formatReport(validation, { kit, markdown: true }) });
    writeFileSync(join(out, 'report.md'), md);
    const by = (a) => result.report.filter((x) => x.action === a).length;
    console.log(`${result.products.length} product(s), ${result.variants.length} size/colour row(s)${kit === 'jewellery' ? `, ${result.stones.length} stone row(s)` : ''} → ${out}`);
    console.log(`${by('converted')} converted · ${by('flagged')} flagged · ${by('skipped')} row(s) skipped. Validation: ${validation.counts.error} to fix, ${validation.counts.claim} claim(s), ${validation.counts.later} for later.`);
    const pending = openDecisions(mapping);
    if (pending.length) console.log(`Still undecided in mapping.json: ${pending.length} (listed in report.md).`);
    console.log(`Read ${join(out, 'report.md')}.`);
    return;
  }
  console.log(readFileSync(join(HERE, 'README.md'), 'utf8'));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
