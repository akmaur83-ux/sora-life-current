// ============================================================
// HOMEPAGE SCROLL — interleaved A/B
//
//   node scripts/perf-home-ab.mjs <urlA> <urlB> [pairs=4]
//
// Runs perf-home-scroll's measurement for A, then B, then A, then B… so
// both see the same machine at the same moment. A single-condition run
// cannot tell a slow build from a slow afternoon; this can. Each run is a
// fresh Chrome, as before.
// ============================================================
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [A, B] = [process.argv[2], process.argv[3]];
const PAIRS = Number(process.argv[4] || 4);
if (!A || !B) { console.error('usage: perf-home-ab.mjs <urlA> <urlB> [pairs]'); process.exit(2); }

const one = (url, label) => {
  const r = spawnSync(process.execPath, [join(HERE, 'perf-home-scroll.mjs'), '1', url, label], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/scroll FPS\s+median ([\d.]+)/);
  const lt = (r.stdout || '').match(/long tasks\s+median (\d+)/);
  return { fps: m ? Number(m[1]) : NaN, longTasks: lt ? Number(lt[1]) : NaN };
};

const a = []; const b = [];
for (let i = 0; i < PAIRS; i++) {
  a.push(one(A, 'A')); process.stdout.write('A');
  b.push(one(B, 'B')); process.stdout.write('B');
}
const med = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
const show = (label, url, runs) => {
  const fps = runs.map((r) => r.fps);
  console.log(`\n${label}  ${url}`);
  console.log(`   FPS  median ${med(fps)}  worst ${Math.min(...fps)}  runs [${fps.join(', ')}]`);
  console.log(`   long tasks  [${runs.map((r) => r.longTasks).join(', ')}]`);
  return { median: med(fps), worst: Math.min(...fps) };
};
console.log('');
const ra = show('A', A, a);
const rb = show('B', B, b);
console.log(`\nΔ median (B − A): ${(rb.median - ra.median).toFixed(1)} fps`);
console.log(`B worst ${rb.worst} vs 60 floor → ${rb.worst >= 60 ? 'PASS' : 'BELOW'}  (A worst ${ra.worst} under the same conditions)\n`);
