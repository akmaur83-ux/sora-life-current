// ============================================================
// Rate limiting — unit tests (offline)
//
// Models the fixed-window algorithm of rate_limit_check (migration 0009) and
// verifies the JS guard's fail-open behaviour. The DB function does the same
// arithmetic atomically via an upsert; here we prove the window logic and the
// "never block a normal customer / fail open" guarantees.
//
//   node scripts/test-rate-limit.mjs
// ============================================================
let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const eq = (a, b, m) => (a === b ? ok(m) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

// Model of rate_limit_check: fixed window keyed by (key, floor(t/window)).
function makeLimiter(limit, windowSeconds) {
  const buckets = new Map();
  return (key, tSeconds) => {
    const bkey = `${key}:${Math.floor(tSeconds / windowSeconds)}`;
    const count = (buckets.get(bkey) || 0) + 1;
    buckets.set(bkey, count);
    return { allowed: count <= limit, count };
  };
}

console.log('\n— Fixed-window rate limiting —');

// 1. Under the limit -> all allowed
{
  const hit = makeLimiter(5, 60);
  const res = Array.from({ length: 5 }, () => hit('create-order:1.1.1.1', 100).allowed);
  eq(res.every(Boolean), true, '5 requests under a limit of 5 are all allowed');
}

// 2. Over the limit -> excess blocked (429)
{
  const hit = makeLimiter(5, 60);
  const res = Array.from({ length: 8 }, () => hit('create-order:1.1.1.1', 100).allowed);
  eq(res.filter(Boolean).length, 5, 'first 5 allowed');
  eq(res.filter((x) => !x).length, 3, 'requests 6–8 are blocked');
}

// 3. Separate clients (IPs) are independent
{
  const hit = makeLimiter(3, 60);
  for (let i = 0; i < 3; i++) hit('orders-lookup:1.1.1.1', 100); // exhaust IP A
  const aBlocked = !hit('orders-lookup:1.1.1.1', 100).allowed;
  const bAllowed = hit('orders-lookup:2.2.2.2', 100).allowed;   // IP B is fresh
  eq(aBlocked, true, 'client A is limited after its quota');
  eq(bAllowed, true, 'a different client is unaffected');
}

// 4. Window reset — next window starts fresh
{
  const hit = makeLimiter(2, 60);
  hit('verify:9.9.9.9', 30); hit('verify:9.9.9.9', 45);          // window 0 (t/60=0)
  const blockedInWindow0 = !hit('verify:9.9.9.9', 59).allowed;
  const allowedInWindow1 = hit('verify:9.9.9.9', 61).allowed;    // window 1 (t/60=1)
  eq(blockedInWindow0, true, 'third hit in the same window is blocked');
  eq(allowedInWindow1, true, 'the next window allows requests again');
}

// 5. Guard fails OPEN when there is no DB config (limiter unavailable)
{
  const { enforceRateLimit } = await import('../api/_lib/rateLimit.js');
  let statusCalled = false;
  const res = { setHeader() {}, status() { statusCalled = true; return { json() {} }; } };
  const cont = await enforceRateLimit({ headers: {} }, res, { name: 'x', limit: 1, windowSeconds: 60 }, { configured: false });
  eq(cont, true, 'unconfigured limiter allows the request (fail-open)');
  eq(statusCalled, false, 'no 429 is sent when the limiter cannot run');
}

// 6. getClientIp prefers the first x-forwarded-for hop
{
  const { getClientIp } = await import('../api/_lib/rateLimit.js');
  eq(getClientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }), '203.0.113.7', 'client IP taken from first XFF hop');
  eq(getClientIp({ headers: {} }), 'unknown', 'missing IP degrades to "unknown"');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
