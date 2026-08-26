// ============================================================
// Live rate-limit verification (SAFE — no data written)
//
//   node scripts/test-rate-limit-live.mjs [baseUrl]
//
// Bursts each protected endpoint with a payload that is REJECTED before any
// write happens (empty cart -> 400, junk verify -> 404, unknown lookup -> 404),
// so no order/customer data is ever created. The only thing that changes is
// the limiter's own counter row. Confirms:
//   * requests under the limit get the normal rejection (NOT 429) -> real
//     customers are not blocked
//   * requests over the limit get HTTP 429
// ============================================================
const BASE = (process.argv[2] || 'https://sora-life-current.vercel.app').replace(/\/$/, '');

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };

async function burst(path, body, n) {
  const codes = [];
  for (let i = 0; i < n; i++) {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeof body === 'function' ? body(i) : body),
    });
    codes.push(r.status);
  }
  return codes;
}

// name, path, safe-rejected body, configured limit
const targets = [
  ['create-order', '/api/razorpay/create-order', { items: [] }, 12],           // empty cart -> 400, never inserts
  ['orders/lookup', '/api/orders/lookup', (i) => ({ orderNumber: `RL-${i}`, email: 'x@y.com' }), 15], // unknown -> 404
  ['verify', '/api/razorpay/verify', {}, 30],                                    // missing details -> 400
];

console.log(`\n=== LIVE RATE-LIMIT VERIFICATION vs ${BASE} ===`);
console.log('(payloads are rejected pre-write; no orders created)\n');

for (const [name, path, body, limit] of targets) {
  const n = limit + Math.max(4, Math.ceil(limit * 0.3)); // enough to cross the limit
  const codes = await burst(path, body, n);
  const first = codes[0];
  const got429 = codes.includes(429);
  const firstReject = codes.find((c) => c !== 429);
  console.log(`  ${name}: sent ${n} (limit ${limit}) -> statuses ${codes.join(',')}`);
  if (firstReject && firstReject !== 429) ok(`${name}: under-limit request returns normal rejection (${firstReject}), not 429`);
  else bad(`${name}: under-limit behaviour unexpected (first=${first})`);
  if (got429) ok(`${name}: exceeding the limit returns 429`);
  else bad(`${name}: never saw 429 — rate limiting NOT active for this route`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
