import fs from 'node:fs';
import dotenv from 'dotenv';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';
import {
  INTENDED_PROVIDERS, parseEnabledProviders, missingIntendedProviders,
} from './src/lib/oauthProviders.js';

// Pure-JS toolchain (no native binaries) — Rollup 3 uses the Acorn parser,
// Babel is pure JS. Bundles the React app into a single static file that any
// dumb static server can host.
//
// Locally, Supabase config comes from .env.local (gitignored, never
// committed). On Vercel (and any other CI), that file doesn't exist —
// Vercel injects Project Environment Variables directly into process.env
// before this build runs. Only touch process.env via dotenv when the file
// is actually present, so there is zero chance a CI's already-correct
// process.env gets shadowed or interfered with by a no-op/failed dotenv
// load.
// Captured BEFORE dotenv runs. A developer's .env.local is often pulled from
// Vercel (`vercel env pull`) and therefore carries VERCEL/VERCEL_ENV of its
// own — so reading them after the load would make every local build look like
// a production deploy. Only the platform sets these before the build starts,
// so this snapshot is what genuinely identifies a real production build.
const PLATFORM_VERCEL_ENV = process.env.VERCEL_ENV || '';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

// A value that is present but not actually a URL is worse than a missing one:
// src/lib/supabase.js treats any non-empty string as configured, so a
// placeholder gets passed straight to createClient(), which throws at module
// load and renders a blank site. Treating it as "not configured" routes it to
// the same preserve-the-committed-bundle path as an absent value, so a
// placeholder can no longer overwrite a good artifact with a broken one.
function usableSupabaseUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? raw : '';
  } catch { return ''; }
}

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = usableSupabaseUrl(rawSupabaseUrl);
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (rawSupabaseUrl && !supabaseUrl) {
  // Length only — never the value.
  console.warn(
    `\n  WARNING: VITE_SUPABASE_URL is set (${rawSupabaseUrl.length} chars) but is not a\n` +
    `           valid http(s) URL, so it cannot configure this build.\n` +
    `           Treating it as absent rather than inlining a value that would\n` +
    `           make createClient() throw and blank the site.\n`
  );
}

// Set when the committed bundle must be preserved: the source is compiled to
// prove it still builds, but the result is thrown away instead of shipped.
let verifyOnly = false;

// These two values are inlined into the bundle at build time (see the
// `replace` plugin below) — nothing reads them at runtime. Historically a
// missing value threw here, which meant one piece of environment config
// could fail the entire deployment and take the whole storefront offline.
//
// The storefront does not actually need Supabase to render: the catalog,
// categories, hero slides and branding all have complete built-in defaults,
// and every Supabase call is already failure-tolerant. So a missing value is
// now a loud warning rather than a hard build failure — the site still ships,
// and the Supabase-backed features light up as soon as the config is present.
if (!supabaseUrl || !supabasePublishableKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean);
  // Names only — never values.
  const seenViteVars = Object.keys(process.env).filter((k) => k.startsWith('VITE_'));
  const existingBundle = 'public/bundle.js';
  const hasCommittedBundle = fs.existsSync(existingBundle);

  console.warn(
    '\n' +
    '  ============================================================\n' +
    '   WARNING: Supabase configuration is NOT visible to this build\n' +
    '  ============================================================\n' +
    `   Missing: ${missing.join(', ')}\n` +
    `   VITE_* vars visible to this build: ${seenViteVars.length ? seenViteVars.join(', ') : '(none)'}\n` +
    `   Running on Vercel: ${process.env.VERCEL ? 'yes' : 'no'}` +
    (process.env.VERCEL_ENV ? ` (env: ${process.env.VERCEL_ENV})` : '') + '\n' +
    '\n' +
    '   On Vercel, build-time variables must NOT be marked\n' +
    '   "Sensitive" — sensitive values are withheld from the build\n' +
    '   environment and only decrypted at runtime. Check that first.\n' +
    '  ============================================================\n'
  );

  if (hasCommittedBundle) {
    // A previously built, correctly-configured bundle is committed to the
    // repo. Rebuilding now would silently overwrite it with a bundle that
    // has no Supabase config, downgrading production to built-in data only
    // (exactly what happened on deployment 6830ad1). Preserve the good
    // artifact so the deploy still ships.
    //
    // This used to `process.exit(0)` right here, which meant the source was
    // never compiled at all: a syntax error, a bad import, anything — the
    // build "succeeded" and shipped the old bundle. A broken commit could
    // deploy green and nobody would know until the next configured build.
    //
    // So the source is still compiled below; the output is just redirected
    // to a scratch file that nothing serves. Compilation failures fail the
    // build exactly as they should, and the good bundle is left alone.
    //
    // This is self-healing: as soon as the variables are readable by the
    // build, the normal build path below runs and emits a fresh bundle.
    console.warn(
      '   Keeping the existing committed public/bundle.js rather than\n' +
      '   overwriting it with an unconfigured build.\n' +
      '   The source is still compiled to verify it BUILDS — a compile\n' +
      '   error fails this deploy rather than silently shipping the old\n' +
      '   bundle.\n'
    );
    verifyOnly = true;
  } else {
    console.warn(
      '   No existing bundle to preserve — building without Supabase.\n' +
      '   The storefront will run on its built-in data.\n'
    );
  }
}

// ------------------------------------------------------------
// Social sign-in providers: what ships must match what the repo declares.
//
// The provider list used to come ONLY from VITE_OAUTH_PROVIDERS. Any build
// that could not see that variable inlined an empty list, which silently
// removed "Continue with Google" — and since public/bundle.js is the deployed
// artifact, such a bundle could be committed and later shipped by the
// preserve-the-committed-bundle path below. Both halves are now closed:
//
//   * an ABSENT variable falls back to the committed INTENDED_PROVIDERS, so a
//     build can no longer quietly strip a provider off the artifact;
//   * an explicit variable still wins (it remains the override), but if it
//     drops an intended provider that is reported, and refused outright on a
//     production deploy.
//
// Provider NAMES are public configuration. Client ids and secrets live in the
// Supabase Dashboard and are never read or inlined here.
// ------------------------------------------------------------
const IS_PRODUCTION_DEPLOY = PLATFORM_VERCEL_ENV === 'production';
const rawProviders = process.env.VITE_OAUTH_PROVIDERS;
const providersExplicit = typeof rawProviders === 'string' && rawProviders.trim() !== '';
const oauthProviders = providersExplicit
  ? parseEnabledProviders(rawProviders)
  : INTENDED_PROVIDERS.slice();

if (!providersExplicit) {
  console.warn(
    `\n  NOTE: VITE_OAUTH_PROVIDERS is not set for this build.\n` +
    `        Falling back to the committed intent: ${INTENDED_PROVIDERS.join(', ') || '(none)'}\n` +
    `        (declared in src/lib/oauthProviders.js)\n`
  );
}

const droppedProviders = missingIntendedProviders(oauthProviders);
if (droppedProviders.length) {
  const detail =
    `\n  ============================================================\n` +
    `   OAuth provider configuration is INCONSISTENT\n` +
    `  ============================================================\n` +
    `   Declared intent (src/lib/oauthProviders.js): ${INTENDED_PROVIDERS.join(', ')}\n` +
    `   This build would enable:                     ${oauthProviders.join(', ') || '(none)'}\n` +
    `   Missing:                                     ${droppedProviders.join(', ')}\n` +
    `\n   Shipping this would remove a sign-in method customers use.\n` +
    `   Either set VITE_OAUTH_PROVIDERS to include it, or remove it\n` +
    `   from INTENDED_PROVIDERS if turning it off is deliberate.\n` +
    `  ============================================================\n`;
  if (IS_PRODUCTION_DEPLOY) {
    throw new Error(`${detail}\n  Refusing to build a production bundle that drops: ${droppedProviders.join(', ')}`);
  }
  console.warn(detail);
}

// The committed bundle is what actually ships when the preserve path is taken,
// so it must satisfy the same contract. A bundle built before this check
// existed can carry an empty provider list; shipping it would be exactly the
// silent regression this guard exists to stop.
if (verifyOnly) {
  const committed = fs.readFileSync('public/bundle.js', 'utf8');
  // The build inlines the list at the parseEnabledProviders() call site. If
  // the marker is absent the artifact predates this contract or was reshaped
  // by a refactor — report it rather than failing a deploy on a regex.
  const marker = committed.match(/parseEnabledProviders\(\s*(["'])([\s\S]*?)\1\s*\)/);
  if (!marker) {
    console.warn(
      '\n  NOTE: could not read the provider list out of the committed\n' +
      '        public/bundle.js. Its OAuth configuration was not verified.\n'
    );
  } else {
    const missing = missingIntendedProviders(parseEnabledProviders(marker[2]));
    if (missing.length) {
      const detail =
        `\n  ============================================================\n` +
        `   The committed public/bundle.js would ship WITHOUT: ${missing.join(', ')}\n` +
        `  ============================================================\n` +
        `   This build is preserving that bundle because Supabase config\n` +
        `   is not visible, so it is the artifact that reaches customers —\n` +
        `   and it was built with an empty or reduced provider list.\n` +
        `\n   Fix: rebuild and commit public/bundle.js from an environment\n` +
        `   that can see the Supabase variables, then redeploy.\n` +
        `  ============================================================\n`;
      if (IS_PRODUCTION_DEPLOY) {
        throw new Error(`${detail}\n  Refusing to ship a committed bundle missing: ${missing.join(', ')}`);
      }
      console.warn(detail);
    }
  }
}

// Where the compiled output lands. In verify-only mode it goes to a scratch
// path (gitignored, not deployed) purely so compilation is actually exercised.
const OUTPUT_FILE = verifyOnly ? '.build-check/bundle.js' : 'public/bundle.js';

export default {
  input: 'src/main.jsx',
  output: {
    file: OUTPUT_FILE,
    format: 'iife',
    sourcemap: !verifyOnly,
    inlineDynamicImports: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
      // Social sign-in allowlist, resolved above: the explicit environment
      // variable when set, otherwise the committed INTENDED_PROVIDERS. A
      // provider only appears once it is configured in the Supabase Dashboard
      // AND declared in src/lib/oauthProviders.js. Carries no secret —
      // provider client ids/secrets live in Supabase, never here.
      'import.meta.env.VITE_OAUTH_PROVIDERS': JSON.stringify(oauthProviders.join(',')),
    }),
    nodeResolve({ browser: true, extensions: ['.js', '.jsx'] }),
    commonjs({ transformMixedEsModules: true }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.jsx'],
      exclude: 'node_modules/**',
      presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    }),
    // The verify-only artifact has done its job once the build succeeds:
    // it proved the source compiles. Delete it so it cannot be picked up as
    // deployable output (outputDirectory is the repo root).
    verifyOnly && {
      name: 'discard-verify-only-output',
      closeBundle() {
        fs.rmSync('.build-check', { recursive: true, force: true });
      },
    },
  ].filter(Boolean),
  onwarn(warning, warn) {
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};
