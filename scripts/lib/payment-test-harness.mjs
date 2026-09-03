// ============================================================
// Shared in-memory Supabase + Razorpay double.
//
// Speaks just enough PostgREST for the real handlers to run unmodified:
// order lookup/insert/patch (including the `unlessPaid` guard expressed as
// an `or=` filter), the payment_transactions unique constraint, the coupon
// RPCs, and Razorpay's payment lookup.
//
// Used by scripts/test-payment-hardening.mjs (behavioural cases) and
// scripts/test-payment-concurrency.mjs (repeated race exercise), so both
// exercise ONE implementation of the fake rather than two that can drift.
//
// Contains no real credentials.
// ============================================================
import crypto from 'node:crypto';

// Fake environment. None of these are real credentials; they exist only so
// the handlers' env gates pass and the HMACs are self-consistent.
export function installFakeEnv() {
  process.env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-not-a-real-key';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_fake';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_not_real';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_not_real';
}
installFakeEnv();

export const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
export const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/** A pending Razorpay order, as create-order would have written it. */
export const PENDING_ORDER = {
  id: 'ord_1', order_number: 'SORA-TEST1', status: 'pending', payment_status: 'pending',
  razorpay_order_id: 'order_RZ1', amount_paise: 47200, payment_method: 'razorpay',
  coupon_code: null, user_id: null,
};

export function makeWorld(seed = {}) {
  const world = {
    orders: seed.orders ? structuredClone(seed.orders) : [],
    transactions: [],
    redemptions: [],
    coupons: seed.coupons ? structuredClone(seed.coupons) : [],
    products: seed.products ? structuredClone(seed.products) : [],
    variants: seed.variants ? structuredClone(seed.variants) : [],
    payments: seed.payments ? structuredClone(seed.payments) : {},
    razorpayOrders: [],
    // Fault injection + interleaving hooks.
    failNextOrderPatch: false,
    failNextRazorpayOrderCreate: false,
    beforeOrderPatch: null,
    calls: { orderPatches: 0, txInserts: 0, consumeCoupon: 0, paymentLookups: 0, razorpayOrders: 0 },
  };

  const json = (status, body) => new Response(JSON.stringify(body ?? null), {
    status, headers: { 'Content-Type': 'application/json' },
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    const q = url.searchParams;

    // ---- Razorpay ----
    if (url.host === 'api.razorpay.com') {
      const m = url.pathname.match(/^\/v1\/payments\/(.+)$/);
      if (m && method === 'GET') {
        world.calls.paymentLookups += 1;
        const p = world.payments[decodeURIComponent(m[1])];
        if (!p) return json(404, { error: { description: 'not found' } });
        if (p.__networkError) throw new Error('simulated network failure');
        return json(200, p);
      }
      if (url.pathname === '/v1/orders' && method === 'POST') {
        world.calls.razorpayOrders += 1;
        if (world.failNextRazorpayOrderCreate) {
          world.failNextRazorpayOrderCreate = false;
          return json(500, { error: { description: 'simulated Razorpay order failure' } });
        }
        const order = { id: `order_fake_${world.calls.razorpayOrders}`, ...body };
        world.razorpayOrders.push(order);
        return json(200, order);
      }
      throw new Error(`unhandled razorpay call: ${method} ${url.pathname}`);
    }

    // ---- Supabase ----
    if (url.pathname === '/auth/v1/user') return json(401, {});

    const rel = url.pathname.replace('/rest/v1/', '');

    if (rel === 'rpc/rate_limit_check') return json(200, { allowed: true, count: 1, limit: 99, reset: 0 });
    if (rel === 'rpc/record_conversion' || rel === 'rpc/set_conversion_status') return json(200, { ok: true });

    if (rel === 'rpc/consume_coupon') {
      world.calls.consumeCoupon += 1;
      const code = String(body.p_code || '').toUpperCase();
      const coupon = world.coupons.find((c) => c.code.toUpperCase() === code && c.is_active);
      if (!coupon) return json(200, 'no_coupon');
      // Mirrors migration 0009: idempotent per order, then the caps.
      if (body.p_order_id && world.redemptions.some((r) => r.coupon_id === coupon.id && r.order_id === body.p_order_id)) {
        return json(200, 'already');
      }
      if (coupon.per_user_limit != null && body.p_user_id) {
        const uses = world.redemptions.filter((r) => r.coupon_id === coupon.id && r.user_id === body.p_user_id).length;
        if (uses >= coupon.per_user_limit) return json(200, 'user_limit');
      }
      if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return json(200, 'exhausted');
      coupon.used_count += 1;
      world.redemptions.push({ coupon_id: coupon.id, order_id: body.p_order_id, user_id: body.p_user_id });
      return json(200, 'consumed');
    }

    if (rel === 'products') {
      const m = /in\.\((.*)\)/.exec(q.get('biosash_id') || q.get('id') || '');
      const ids = m ? m[1].split(',').map((s) => s.replace(/"/g, '')) : [];
      return json(200, world.products.filter(
        (p) => ids.includes(String(p.biosash_id)) || ids.includes(String(p.id))
      ));
    }
    if (rel === 'product_variants') {
      const m = /in\.\((.*)\)/.exec(q.get('id') || '');
      const ids = m ? m[1].split(',').map((s) => s.replace(/"/g, '')) : [];
      return json(200, world.variants.filter((v) => ids.includes(String(v.id))));
    }
    if (rel === 'coupons') {
      const code = (q.get('code') || '').replace('eq.', '').toUpperCase();
      return json(200, world.coupons.filter((c) => c.code.toUpperCase() === code && c.is_active));
    }

    if (rel === 'payment_transactions' && method === 'POST') {
      world.calls.txInserts += 1;
      if (world.transactions.some((t) => t.gateway_payment_id === body.gateway_payment_id)) {
        return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      }
      world.transactions.push(body);
      return json(201, [body]);
    }

    if (rel === 'orders' && method === 'POST') {
      if (body.idempotency_key
          && world.orders.some((o) => o.idempotency_key === body.idempotency_key)) {
        return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      }
      const now = new Date().toISOString();
      const row = {
        id: `ord_${world.orders.length + 1}`,
        created_at: body.created_at || now,
        updated_at: body.updated_at || now,
        ...body,
      };
      world.orders.push(row);
      return json(201, [row]);
    }

    if (rel === 'orders' && method === 'GET') {
      const byRz = (q.get('razorpay_order_id') || '').replace('eq.', '');
      const byKey = (q.get('idempotency_key') || '').replace('eq.', '');
      const byNum = (q.get('order_number') || '').replace('eq.', '');
      let rows = world.orders;
      if (byRz) rows = rows.filter((o) => o.razorpay_order_id === byRz);
      if (byKey) rows = rows.filter((o) => o.idempotency_key === byKey);
      if (byNum) rows = rows.filter((o) => o.order_number === byNum);
      return json(200, structuredClone(rows.slice(0, 1)));
    }

    if (rel === 'orders' && method === 'PATCH') {
      if (world.beforeOrderPatch) { const h = world.beforeOrderPatch; world.beforeOrderPatch = null; await h(); }
      world.calls.orderPatches += 1;
      if (world.failNextOrderPatch) {
        world.failNextOrderPatch = false;
        return json(500, { message: 'simulated transient database failure' });
      }
      const id = (q.get('id') || '').replace('eq.', '');
      // The `unlessPaid` guard is expressed as an `or=` filter.
      const guarded = (q.get('or') || '').includes('payment_status');
      const razorpayMissing = q.get('razorpay_order_id') === 'is.null';
      const hits = world.orders.filter(
        (o) => o.id === id
          && (!guarded || o.payment_status !== 'paid')
          && (!razorpayMissing || !o.razorpay_order_id)
      );
      for (const row of hits) Object.assign(row, body);
      return json(200, structuredClone(hits));
    }

    throw new Error(`unhandled supabase call: ${method} ${rel}`);
  };

  return world;
}

// ---- Request/response doubles ---------------------------------------
export function mockRes() {
  const r = {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return r;
}
export const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

export function webhookReq(event, entity) {
  const raw = JSON.stringify({ event, payload: { payment: { entity } } });
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw, 'utf8').digest('hex');
  return { method: 'POST', headers: { 'x-razorpay-signature': signature }, body: raw };
}
