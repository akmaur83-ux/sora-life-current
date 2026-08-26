// ============================================================
// Regression tests for the Content-Security-Policy in vercel.json.
//
//   node scripts/test-csp.mjs
//
// Guards the media-src fix (Supabase-hosted hero video) AND that no other
// directive regressed. Parses the REAL vercel.json shipped to production.
// ============================================================
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const has = (v, m) => (v ? ok(m) : bad(m));

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
const headers = cfg.headers?.[0]?.headers || [];
const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';

// Parse directives into { name: [sources...] }
const directives = Object.fromEntries(
  csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...src] = d.split(/\s+/);
    return [name, src];
  }),
);

console.log('\n— media-src fix (the hero video) —');
has(!!directives['media-src'], 'media-src directive exists');
has(directives['media-src']?.includes("'self'"), "media-src allows 'self' (bundled hero.mp4)");
has(directives['media-src']?.includes('https://*.supabase.co'), 'media-src allows https://*.supabase.co (Supabase-hosted hero video)');
has(!directives['media-src']?.includes("'unsafe-inline'") && !directives['media-src']?.includes('*'),
  'media-src stays tight (no wildcard / unsafe-inline)');

console.log('\n— every other directive unchanged —');
const expected = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'script-src': ["'self'", 'https://checkout.razorpay.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://*.razorpay.com', 'https://lumberjack.razorpay.com'],
  'frame-src': ['https://*.razorpay.com', 'https://checkout.razorpay.com'],
  'form-action': ["'self'", 'https://*.razorpay.com'],
};
for (const [name, srcs] of Object.entries(expected)) {
  const actual = directives[name] || [];
  const same = actual.length === srcs.length && srcs.every((s) => actual.includes(s));
  has(same, `${name} = ${srcs.join(' ')}`);
}

console.log('\n— no scripts weakened, no obvious footguns —');
has(!directives['script-src']?.includes("'unsafe-inline'") && !directives['script-src']?.includes("'unsafe-eval'"),
  "script-src has no 'unsafe-inline' / 'unsafe-eval'");
has(directives['object-src']?.includes("'none'") && directives['frame-ancestors']?.includes("'none'"),
  "object-src and frame-ancestors are 'none'");
// exactly the expected directives (11 baseline) plus media-src, nothing else.
const wantCount = Object.keys(expected).length + 1; // + media-src
has(Object.keys(directives).length === wantCount,
  `CSP has exactly ${wantCount} directives (baseline + media-src), got ${Object.keys(directives).length}`);

// other security headers still declared
const keys = headers.map((h) => h.key);
for (const k of ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  has(keys.includes(k), `header present: ${k}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
