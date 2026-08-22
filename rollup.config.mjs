import fs from 'node:fs';
import dotenv from 'dotenv';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';

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
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

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
  console.warn(
    '\n' +
    '  ============================================================\n' +
    '   WARNING: building WITHOUT Supabase configuration\n' +
    '  ============================================================\n' +
    `   Missing: ${missing.join(', ')}\n` +
    `   VITE_* vars visible to this build: ${seenViteVars.length ? seenViteVars.join(', ') : '(none)'}\n` +
    `   Running on Vercel: ${process.env.VERCEL ? 'yes' : 'no'}` +
    (process.env.VERCEL_ENV ? ` (env: ${process.env.VERCEL_ENV})` : '') + '\n' +
    '\n' +
    '   The public storefront will still build and run using its\n' +
    '   built-in data. Supabase-backed features (admin dashboard,\n' +
    '   live catalog/hero/branding) will be inactive until these\n' +
    '   variables are readable by the BUILD step.\n' +
    '\n' +
    '   On Vercel, build-time variables must NOT be marked\n' +
    '   "Sensitive" — sensitive values are withheld from the build\n' +
    '   environment and are only decrypted at runtime.\n' +
    '  ============================================================\n'
  );
}

export default {
  input: 'src/main.jsx',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
    }),
    nodeResolve({ browser: true, extensions: ['.js', '.jsx'] }),
    commonjs({ transformMixedEsModules: true }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.jsx'],
      exclude: 'node_modules/**',
      presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    }),
  ],
  onwarn(warning, warn) {
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};
