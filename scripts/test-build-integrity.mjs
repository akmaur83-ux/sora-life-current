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
import {
  INTENDED_PROVIDERS, parseEnabledProviders, missingIntendedProviders,
} from '../src/lib/oauthProviders.js';

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
function runBuild({
  source, withEnv, withCommittedBundle = true,
  committedBundle = STALE_BUNDLE, oauthProviders, vercelEnv, supabaseUrl,
}) {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX, 'src'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX, 'public'), { recursive: true });
  fs.writeFileSync(path.join(SANDBOX, 'src', 'main.jsx'), source);
  if (withCommittedBundle) {
    fs.writeFileSync(path.join(SANDBOX, 'public', 'bundle.js'), committedBundle);
  }

  const env = { ...process.env };
  // The config falls back to .env.local, which does not exist in the sandbox.
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // The developer's own shell must not leak into these cases.
  delete env.VITE_OAUTH_PROVIDERS;
  delete env.VERCEL_ENV;
  if (withEnv) {
    env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
    env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-key-not-real';
  }
  // Lets a case supply a present-but-unusable URL (the placeholder scenario).
  if (supabaseUrl !== undefined) {
    env.VITE_SUPABASE_URL = supabaseUrl;
    env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'fake-publishable-key-not-real';
  }
  if (oauthProviders !== undefined) env.VITE_OAUTH_PROVIDERS = oauthProviders;
  if (vercelEnv !== undefined) env.VERCEL_ENV = vercelEnv;

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

// ============================================================
// M1 — the shipped artifact must enable the providers the repo declares.
//
// The provider list used to come only from VITE_OAUTH_PROVIDERS, so any build
// that could not see it inlined an empty list and silently removed "Continue
// with Google". Because public/bundle.js IS the deployed artifact, such a
// bundle could then be committed and later shipped by the preserve path.
// ============================================================

// A source file that actually reads the inlined allowlist, so the replace
// plugin's substitution is observable in the built output.
const OAUTH_SOURCE = 'const providers = import.meta.env.VITE_OAUTH_PROVIDERS;\nconsole.log(providers);\n';
// A committed bundle shaped like a real one, with a chosen provider list.
const committedWith = (list) => `/* committed */ function enabledOAuthProviders(){return parseEnabledProviders(${JSON.stringify(list)});}\n`;

console.log('\n— M1: OAuth provider build contract —');

test('M1.1 the declared intent includes google', () => {
  ok(INTENDED_PROVIDERS.includes('google'), 'google must be declared in src/lib/oauthProviders.js');
  ok(Array.isArray(INTENDED_PROVIDERS) && INTENDED_PROVIDERS.length > 0, 'intent must not be empty');
});

test('M1.2 a configured build inlines google', () => {
  const r = runBuild({ source: OAUTH_SOURCE, withEnv: true, oauthProviders: 'google' });
  eq(r.code, 0, `build should succeed\n${r.stderr}`);
  ok(/["']google["']/.test(r.bundle), 'the built bundle must carry the google allowlist');
});

test('M1.3 an ABSENT VITE_OAUTH_PROVIDERS falls back to the declared intent, not to empty', () => {
  // This is the regression that silently stripped google from the committed
  // artifact on every local build.
  const r = runBuild({ source: OAUTH_SOURCE, withEnv: true });
  eq(r.code, 0, r.stderr);
  ok(/["']google["']/.test(r.bundle), 'a build with no OAuth variable must still ship the intended providers');
  ok(!/VITE_OAUTH_PROVIDERS/.test(r.bundle), 'the variable name must be substituted, not left in the bundle');
});

test('M1.4 an empty provider configuration cannot silently produce a google-less artifact', () => {
  const r = runBuild({ source: OAUTH_SOURCE, withEnv: true, oauthProviders: '' });
  eq(r.code, 0, r.stderr);
  ok(/["']google["']/.test(r.bundle), 'an empty value must not be treated as "disable everything"');
});

test('M1.5 a production deploy that would drop google FAILS', () => {
  const r = runBuild({
    source: OAUTH_SOURCE, withEnv: true, oauthProviders: 'apple', vercelEnv: 'production',
  });
  ok(r.code !== 0, 'a production build dropping an intended provider must fail');
  ok(/INCONSISTENT|Refusing/i.test(r.output), `the failure must explain itself:\n${r.output}`);
});

test('M1.6 the same mismatch outside production warns but still builds', () => {
  const r = runBuild({ source: OAUTH_SOURCE, withEnv: true, oauthProviders: 'apple' });
  eq(r.code, 0, `local and preview builds must stay usable\n${r.stderr}`);
  ok(/INCONSISTENT/i.test(r.output), 'the mismatch must still be reported loudly');
});

test('M1.7 the preserve path REFUSES a committed bundle missing google in production', () => {
  // Supabase config invisible + a committed bundle built with no providers:
  // that bundle is what reaches customers, so shipping it is the silent
  // regression this guard exists to stop.
  const r = runBuild({
    source: VALID_SOURCE, withEnv: false,
    committedBundle: committedWith(''), vercelEnv: 'production',
  });
  ok(r.code !== 0, 'shipping a google-less committed bundle must fail a production deploy');
  ok(/WITHOUT: google|Refusing to ship/i.test(r.output), `the failure must name the missing provider:\n${r.output}`);
  eq(r.bundle, committedWith(''), 'the committed bundle itself must not be modified');
});

test('M1.8 the preserve path ACCEPTS a committed bundle that already carries google', () => {
  const r = runBuild({
    source: VALID_SOURCE, withEnv: false,
    committedBundle: committedWith('google'), vercelEnv: 'production',
  });
  eq(r.code, 0, `a correctly built committed bundle must still deploy\n${r.stderr}`);
  eq(r.bundle, committedWith('google'), 'and must be preserved untouched');
});

test('M1.9 no secret material is emitted into the shipped bundle', () => {
  const shipped = fs.readFileSync(path.join(REPO, 'public', 'bundle.js'), 'utf8');
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
    ok(!shipped.includes(name), `${name} must never appear in the client bundle`);
  }
  // Any non-public value the local environment holds must not have leaked in.
  const envFile = path.join(REPO, '.env.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (key.startsWith('VITE_')) continue; // public by design
      const value = rawValue.trim().replace(/^["']|["']$/g, '');
      if (value.length < 12) continue; // too short to be a meaningful secret
      // Report the KEY only — never the value.
      ok(!shipped.includes(value), `the value of ${key} must not appear in public/bundle.js`);
    }
  }
});

test('M1.10 the config verifies the committed bundle before preserving it', () => {
  // The enforcement itself is exercised end-to-end by M1.7/M1.8; this pins the
  // wiring so a refactor cannot quietly drop the check and restore the silent
  // path. Comments are stripped first (CRLF-normalised, as elsewhere here).
  const code = fs.readFileSync(CONFIG, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  ok(/verifyOnly\s*\)?\s*\{[\s\S]*parseEnabledProviders/.test(code)
     || /if\s*\(\s*verifyOnly\s*\)/.test(code) && /missingIntendedProviders/.test(code),
     'the preserve path must check the committed bundle against the declared intent');
  ok(/INTENDED_PROVIDERS/.test(code), 'the build must read the committed provider intent');
});

test('M1.11 a present-but-invalid VITE_SUPABASE_URL is treated as unconfigured', () => {
  // src/lib/supabase.js treats any non-empty string as configured and hands it
  // straight to createClient(), which throws at module load and blanks the
  // site. A placeholder must therefore route to the preserve path rather than
  // overwrite a good committed bundle with an unusable one.
  const r = runBuild({
    source: VALID_SOURCE, withEnv: true, committedBundle: committedWith('google'),
  });
  eq(r.code, 0, r.stderr);
  ok(r.bundle !== committedWith('google'), 'a genuinely configured build still refreshes the bundle');

  const bad = runBuild({
    source: VALID_SOURCE, withEnv: false, committedBundle: committedWith('google'),
    supabaseUrl: 'placeholder',
  });
  eq(bad.code, 0, bad.stderr);
  eq(bad.bundle, committedWith('google'), 'a placeholder URL must NOT overwrite the committed bundle');
  ok(/not a\n?\s*valid http\(s\) URL|not a valid/i.test(bad.output),
     `the invalid value must be reported:\n${bad.output}`);
});

test('M1.12 a valid Supabase URL still takes the normal build path', () => {
  const r = runBuild({ source: VALID_SOURCE, withEnv: true });
  eq(r.code, 0, r.stderr);
  ok(r.bundle && r.bundle !== STALE_BUNDLE, 'a valid configuration must rebuild the bundle');
  ok(!/not a valid http/i.test(r.output), 'and must not report an invalid URL');
});

fs.rmSync(path.join(REPO, '.build-check'), { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
