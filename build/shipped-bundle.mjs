// ============================================================
// Where the shipped client artifact lives, now that it is more than one file.
//
// Admin routes are split into public/chunks/, so "the bundle" is the entry
// public/bundle.js PLUS every chunk beside it. Anything that inspects what
// actually reaches a browser has to read all of them.
//
// This matters most for the two guards that fail OPEN if they only see the
// entry:
//
//   * rollup.config.mjs         verifies the committed artifact still carries
//                               the intended OAuth provider list
//   * test-build-integrity.mjs  asserts no secret value was emitted into the
//                               client artifact
//
// Both would have kept passing while checking a fraction of what ships.
//
// A standalone module rather than an export from rollup.config.mjs, because
// importing that config runs it — dotenv, provider resolution, warnings — and
// a test that greps the bundle should not have build side effects.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

/** Every JS file that reaches a browser, entry first. */
export function shippedBundleFiles(dir = 'public') {
  const files = [];
  const entry = path.join(dir, 'bundle.js');
  if (fs.existsSync(entry)) files.push(entry);
  const chunkDir = path.join(dir, 'chunks');
  if (fs.existsSync(chunkDir)) {
    for (const name of fs.readdirSync(chunkDir).sort()) {
      if (name.endsWith('.js')) files.push(path.join(chunkDir, name));
    }
  }
  return files;
}

/** All of it concatenated, for a plain substring or regex search. */
export function readShippedBundle(dir = 'public') {
  return shippedBundleFiles(dir).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}
