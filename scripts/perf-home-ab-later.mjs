// Wait, then run the interleaved A/B. For a machine that needs to cool down
// before a floor can be judged fairly.
//   node scripts/perf-home-ab-later.mjs <waitSeconds> <urlA> <urlB> [pairs]
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const [wait, A, B, pairs = '5'] = process.argv.slice(2);
console.log(`waiting ${wait}s before measuring…`);
await new Promise((r) => setTimeout(r, Number(wait) * 1000));
const r = spawnSync(process.execPath, [join(HERE, 'perf-home-ab.mjs'), A, B, pairs], { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
