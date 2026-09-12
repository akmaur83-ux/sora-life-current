// ============================================================
// SERVE A PAST COMMIT'S BUILD — for an apples-to-apples A/B
//
//   node scripts/serve-commit.mjs <commit> [port=4199]
//
// Copies index.html and public/ from the worktree into a temp directory,
// overwrites the built artifacts with `git show <commit>:…`, and serves that
// with the same SPA fallback the fixture server uses. Nothing in the
// worktree is touched.
//
// Why: measuring production against a local build compares a CDN against a
// node process as much as it compares two builds. Serving both builds from
// the same process on the same machine leaves only the code as the variable.
// ============================================================
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const COMMIT = process.argv[2];
const PORT = Number(process.argv[3] || 4199);
if (!COMMIT) { console.error('usage: serve-commit.mjs <commit> [port]'); process.exit(2); }

const DIR = mkdtempSync(join(tmpdir(), `sora-${COMMIT.slice(0, 7)}-`));
cpSync(join(ROOT, 'index.html'), join(DIR, 'index.html'));
cpSync(join(ROOT, 'public'), join(DIR, 'public'), { recursive: true });
cpSync(join(ROOT, 'media'), join(DIR, 'media'), { recursive: true });

// Every built artifact that commit tracked replaces the copy.
const tracked = execSync(`git ls-tree -r --name-only ${COMMIT} -- public/bundle.js public/bundle.js.map public/app.css public/app-deferred.css public/chunks`, { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
for (const f of tracked) {
  const out = join(DIR, f);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, execSync(`git show ${COMMIT}:${f}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
}
// Chunks the old commit did not have must not linger from the copy.
const oldChunks = new Set(tracked.filter((f) => f.startsWith('public/chunks/')).map((f) => f.slice('public/chunks/'.length)));
for (const f of readdirSync(join(DIR, 'public/chunks'))) {
  if (!oldChunks.has(f)) execSync(`del /q "${join(DIR, 'public/chunks', f)}"`, { shell: 'cmd.exe' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.map': 'application/json', '.mp4': 'video/mp4' };
createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p = normalize(join(DIR, decodeURIComponent(url.pathname)));
  if (!p.startsWith(DIR)) { res.writeHead(403); return res.end(); }
  if (!extname(p) || !existsSync(p)) p = join(DIR, 'index.html');
  if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(PORT, () => {
  const size = statSync(join(DIR, 'public/bundle.js')).size;
  console.log(`serving ${COMMIT.slice(0, 7)} from ${DIR} on http://localhost:${PORT}  (bundle ${size} bytes, ${tracked.length} artifacts)`);
});
