// ============================================================
// A pre-change tree to compare against. `exportBaseline(sha)` extracts the
// source of that commit into the OS temp dir once (git archive + tar) and
// lends it this checkout's node_modules, so the SSR harnesses can render
// the old pages (FASHION_SRC_ROOT / GROCERY_SRC_ROOT) and the suites can
// run themselves against the old tree to prove they are not vacuous.
// ============================================================
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function exportBaseline(sha, paths = ['src', 'scripts', 'img', 'public', 'supabase', 'build', 'api', 'package.json']) {
  const dir = join(tmpdir(), `sora-baseline-${sha}`);
  if (!existsSync(join(dir, 'src'))) {
    mkdirSync(dir, { recursive: true });
    execFileSync('git', ['archive', '--format=tar', '-o', join(dir, 'tree.tar'), sha, ...paths], { cwd: REPO });
    execFileSync('tar', ['-xf', 'tree.tar'], { cwd: dir }); // relative: Windows tar reads a drive letter as a host
  }
  if (!existsSync(join(dir, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

/** The file at that commit, LF-normalised. */
export const atCommit = (sha, rel) => execFileSync('git', ['show', `${sha}:${rel}`], { cwd: REPO, encoding: 'utf8' }).replace(/\r\n/g, '\n');
