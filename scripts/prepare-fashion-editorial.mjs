// Import the user-supplied editorial artwork without altering the source PNGs.
// Usage: node scripts/prepare-fashion-editorial.mjs --source-dir="C:/path/to/images"
import { mkdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

const sourceArg = process.argv.find((arg) => arg.startsWith('--source-dir='));
if (!sourceArg) throw new Error('Pass --source-dir with the supplied image folder.');
const sourceDir = resolve(sourceArg.slice('--source-dir='.length));
const output = resolve('img/fashion-editorial');
const inputs = [
  ['01_18_11 AM-1', 'men-hero-desktop', [1600, 1000]],
  ['01_18_13 AM-2', 'men-hero-mobile', [900]],
  ['01_24_30 AM-1', 'women-hero-desktop', [1920, 1200]],
  ['01_24_32 AM-2', 'women-hero-mobile', [900]],
  ['01_18_14 AM-3', 'women-hero-alternate', [1600, 1000]],
  ['01_18_15 AM-4', 'women-hero-alternate-mobile', [900]],
  ['01_24_33 AM-3', 'women-category-silk', [480]],
  ['01_24_34 AM-4', 'women-category-cotton', [480]],
  ['01_24_36 AM-5', 'women-category-georgette', [480]],
  ['01_24_37 AM-6', 'women-category-kanjivaram', [480]],
  ['01_24_38 AM-7', 'women-category-party', [480]],
  ['01_24_40 AM-8', 'women-category-handloom', [480]],
  ['01_24_41 AM-9', 'women-editorial-handloom', [1400, 800]],
  ['01_24_42 AM-10', 'women-editorial-banarasi', [1200, 700]],
];
await mkdir(output, { recursive: true });
let originalBytes = 0;
let outputBytes = 0;
for (const [stamp, name, widths] of inputs) {
  const source = join(sourceDir, `ChatGPT Image Oct 4, 2026, ${stamp}.png`);
  originalBytes += (await stat(source)).size;
  const metadata = await sharp(source).metadata();
  for (let i = 0; i < widths.length; i++) {
    const file = `${name}${i ? `-${widths[i]}` : ''}.webp`;
    const result = await sharp(source).rotate().resize({ width: widths[i], withoutEnlargement: true }).webp({ quality: 90, effort: 6 }).toFile(join(output, file));
    outputBytes += result.size;
    console.log(`${file}: ${metadata.width}x${metadata.height} -> ${result.width}x${result.height}, ${(result.size / 1024).toFixed(1)} KB`);
  }
}
console.log(`${inputs.length} originals: ${(originalBytes / 1048576).toFixed(2)} MiB; responsive WebP set: ${(outputBytes / 1048576).toFixed(2)} MiB`);
