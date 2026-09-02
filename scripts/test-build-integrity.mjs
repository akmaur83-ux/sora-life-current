// ============================================================
// Build integrity tests.
//
// The build has a deliberate escape hatch: when Supabase config is not
// visible to the build AND a correctly-built bundle is already committed,
// it preserves that bundle rather than overwriting it with an unconfigured
// one. That hatch used to `process.exit(0)` BEFORE compiling anything, so a
// syntactically broken source tree produced a green build that shipped the
// old bundle. These tests pin the fixed behaviour:
//
//   * broken source        -> build FAILS (never silently ships the old bundle)
//   * valid source, no env -> build succeeds, committed bundle untouched
//   * valid source + env   -> build succeeds and refreshes the bundle
//
// Each case runs the REAL rollup config against a scratch source tree. The
// scratch tree lives under .build-check/ (gitignored, .vercelignored) so
// node resolves the repo's own node_modules, and rollup is invoked with that
// directory as its cwd — which is what makes the config see "no .env.local"
// and its own relative input/output paths.
//
// Run: node scripts/test-build-integrity.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SANDBOX = path.join(REPO, '.build-check', 'selftest');
const CONFIG = path.join(REPO, 'rollup.config.mjs');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

const STALE_BUNDLE = '/* the good bundle already committed to the repo */\n';

/**
 * Lay out a scratch project and run the real rollup config against it.
 * `source` becomes src/main.jsx; `env` decides whether the config can see
 * Supabase configuration.
 */
function runBuild({ source, withEnv, withCommittedBundle = true }) {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX, 'src'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX, 'public'), { recursive: true });
  fs.writeFileSync(path.join(SANDBOX, 'src', 'main.jsx'), source);
  if (withCommittedBundle) {
    fs.writeFileSync(path.join(SANDBOX, 'public', 'bundle.js'), STALE_BUNDLE);
  }

  const env = { ...process.env };
  // The config falls back to .env.local, which does not exist in the sandbox.
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (withEnv) {
    env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
    env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-key-not-real';
  }

  const rollup = path.join(REPO, 'node_modules', 'rollup', 'dist', 'bin', 'rollup');
  const r = spawnSync(process.execPath, [rollup, '-c', CONFIG], {
    cwd: SANDBOX, env, encoding: 'utf8',
  });
  const read = (p) => {
    const f = path.join(SANDBOX, p);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  return {
    code: r.status,
    // Rollup reports progress on stderr and warnings on stdout; the tests
    // care about the combined transcript.
    output: `${r.stdout || ''}\n${r.stderr || ''}`,
    stderr: r.stderr || '',
    bundle: read('public/bundle.js'),
    scratch: read('.build-check/bundle.js'),
  };
}

const VALID_SOURCE = 'const app = () => "sora"; console.log(app());\n';
// Unterminated template literal — a parse error, not a runtime one.
const BROKEN_SOURCE = 'const app = () => `unterminated;\nexport default app;\n';

console.log('\n— Build integrity —');

test('a normal configured build succeeds and refreshes the bundle', () => {
  const r = runBuild({ source: VALID_SOURCE, withEnv: true });
  eq(r.code, 0, `build should succeed\n${r.stderr}`);
  ok(r.bundle && r.bundle !== STALE_BUNDLE, 'the bundle must be rebuilt');
  ok(r.bundle.includes('sora'), 'the new bundle must contain the compiled source');
});

test('an unconfigured build preserves the committed bundle', () => {
  const r = runBuild({ source: VALID_SOURCE, withEnv: false });
  eq(r.code, 0, `build should still ship\n${r.stderr}`);
  eq(r.bundle, STALE_BUNDLE, 'the good committed bundle must not be overwritten');
});

test('an unconfigured build STILL COMPILES the source, to a scratch output', () => {
  const r = runBuild({ source: VALID_SOURCE, withEnv: false });
  eq(r.code, 0, r.stderr);
  // Rollup announces its input -> output. Seeing the scratch path proves the
  // compile ran instead of the old exit-before-building short circuit.
  ok(/src[\\/]main\.jsx/.test(r.output), `no compile was reported:\n${r.output}`);
  ok(/\.build-check[\\/]bundle\.js/.test(r.output), `compile did not target the scratch path:\n${r.output}`);
  // And the scratch artifact must not survive into deployable output.
  eq(r.scratch, null, 'the verify-only artifact must be cleaned up after the build');
});

test('BROKEN source fails the build even when a committed bundle exists', () => {
  const r = runBuild({ source: BROKEN_SOURCE, withEnv: false });
  ok(r.code !== 0, 'a compile error MUST fail the build — it used to exit 0 here');
  eq(r.bundle, STALE_BUNDLE, 'and must not have touched the committed bundle');
});

test('BROKEN source fails a normally configured build too', () => {
  const r = runBuild({ source: BROKEN_SOURCE, withEnv: true });
  ok(r.code !== 0, 'a compile error must fail the configured build');
});

test('a stale bundle cannot mask a compile failure', () => {
  // The exact production-shaped scenario: env not visible, a good bundle
  // committed, and a source tree that does not build. Green here would mean
  // deploying code nobody can build.
  const broken = runBuild({ source: BROKEN_SOURCE, withEnv: false });
  const working = runBuild({ source: VALID_SOURCE, withEnv: false });
  ok(broken.code !== 0, 'broken source must fail');
  eq(working.code, 0, 'valid source must pass');
  ok(broken.code !== working.code, 'the two outcomes must be distinguishable');
});

test('the config no longer short-circuits before compiling', () => {
  // Comments are stripped first: the fixed config mentions the old
  // `process.exit(0)` in a comment explaining why it was removed.
  // CRLF is normalised first: `.` does not match \r, so a naive
  // /\/\/.*$/ strip silently does nothing on a CRLF checkout.
  const code = fs.readFileSync(CONFIG, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  ok(!/process\.exit\s*\(\s*0\s*\)/.test(code), 'a live process.exit(0) would skip compilation entirely');
  ok(/verifyOnly/.test(code), 'the verify-only compile path must be present');
});

fs.rmSync(path.join(REPO, '.build-check'), { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
