import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';

// Pure-JS toolchain (no native binaries) — Rollup 3 uses the Acorn parser,
// Babel is pure JS. Bundles the React app into a single static file that any
// dumb static server can host.
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
