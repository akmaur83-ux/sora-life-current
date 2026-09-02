// ============================================================
// Flake hunter.
//
// Runs a suite repeatedly and captures EVERYTHING the moment it exits
// non-zero: iteration number, exit code, signal, stdout, stderr. Without
// this, an intermittent failure shows up as a bare exit code in a sweep and
// is gone by the time you look.
//
// Nothing here prints environment variables, and the suites it runs use
// fake credentials only.
//
//   node scripts/flake-hunt.mjs [iterations] [suite]
//
// Defaults: 200 iterations of scripts/test-payment-hardening.mjs
// ============================================================
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iterations = Number(process.argv[2] || 200);
const suite = process.argv[3] || 'scripts/test-payment-hardening.mjs';
const outDir = path.join(REPO, '.flake-reports');

let failures = 0;
let firstFailure = null;
const codes = new Map();
const started = Date.now();

for (let i = 1; i <= iterations; i += 1) {
  const r = spawnSync(process.execPath, [path.join(REPO, suite)], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env },
  });
  const code = r.status;
  codes.set(code, (codes.get(code) || 0) + 1);

  // A clean run must exit 0 AND report zero failures. Both are checked, so
  // a suite that swallowed a failure but still exited 0 is caught too.
  const summary = (r.stdout || '').match(/(\d+) passed, (\d+) failed/);
  const reportedFailures = summary ? Number(summary[2]) : null;
  const bad = code !== 0 || reportedFailures === null || reportedFailures > 0;

  if (bad) {
    failures += 1;
    mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `iteration-${i}.txt`);
    writeFileSync(file, [
      `iteration: ${i} of ${iterations}`,
      `suite:     ${suite}`,
      `exitCode:  ${code}`,
      `signal:    ${r.signal || '(none)'}`,
      `summary:   ${summary ? summary[0] : '(no summary line printed)'}`,
      '',
      '===== STDOUT =====',
      r.stdout || '(empty)',
      '',
      '===== STDERR =====',
      r.stderr || '(empty)',
    ].join('\n'), 'utf8');

    if (!firstFailure) firstFailure = { i, code, file };
    console.log(`\n  FAIL on iteration ${i} — exit ${code}, signal ${r.signal || 'none'}`);
    // The failing test name and stack, straight to the console.
    const lines = (r.stdout || '').split('\n').filter((l) => /FAIL|FATAL/.test(l));
    for (const l of lines.slice(0, 12)) console.log(`    ${l.trim()}`);
    const errLines = (r.stderr || '').split('\n').filter(Boolean);
    for (const l of errLines.slice(0, 12)) console.log(`    stderr: ${l.trim()}`);
    console.log(`    full capture: ${path.relative(REPO, file)}`);
  }

  if (i % 25 === 0) {
    process.stdout.write(`  ...${i}/${iterations} (${failures} failure${failures === 1 ? '' : 's'})\n`);
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${iterations - failures}/${iterations} clean runs in ${secs}s`);
console.log(`exit-code distribution: ${[...codes.entries()].map(([c, n]) => `${c}×${n}`).join(', ')}`);
if (firstFailure) {
  console.log(`FIRST FAILURE: iteration ${firstFailure.i}, exit ${firstFailure.code} -> ${path.relative(REPO, firstFailure.file)}`);
}
process.exit(failures === 0 ? 0 : 1);
