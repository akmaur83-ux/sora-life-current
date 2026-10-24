// ============================================================
// Shared in-memory Supabase + Razorpay double.
//
// Speaks just enough PostgREST for the real handlers to run unmodified:
// order lookup/insert/patch/delete (including the `unlessPaid` guard
// expressed as an `or=` filter), the payment_transactions unique constraint,
// the coupon RPCs, migration 0039's order holds (reserve / settle / release,
// mirroring the SQL rule for rule), and Razorpay's payment lookup.
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
    // The counted stock 0039 holds besides product_variants: fashion and Home &
    // Living options (catalogue_variants) and Home & Living products without
    // options (catalogue_products).
    catalogueVariants: seed.catalogueVariants ? structuredClone(seed.catalogueVariants) : [],
    catalogueProducts: seed.catalogueProducts ? structuredClone(seed.catalogueProducts) : [],
    holds: [],
    // Every set_conversion_status call, in order (creator commission qualifying).
    conversionStatuses: [],
    // order_admin_events rows (0040); noAuditRpc = 0040 not applied.
    orderEvents: [],
    noAuditRpc: Boolean(seed.noAuditRpc),
    // true = migration 0039 not applied: its functions answer PGRST202.
    noHolds: Boolean(seed.noHolds),
    payments: seed.payments ? structuredClone(seed.payments) : {},
    razorpayOrders: [],
    // Fault injection + interleaving hooks.
    failNextOrderPatch: false,
    failNextRazorpayOrderCreate: false,
    beforeOrderPatch: null,
    // The next N order inserts hit the order_number unique index, as if
    // another checkout had drawn the same number first. Every number the
    // index rejected is recorded.
    clashNextOrderNumbers: 0,
    clashedOrderNumbers: [],
    calls: { orderPatches: 0, txInserts: 0, consumeCoupon: 0, paymentLookups: 0, razorpayOrders: 0, orderInserts: 0, reserve: 0, settle: 0, release: 0, orderDeletes: 0 },
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
    // An "admin-…" token belongs to the store's admin; any other is not a user.
    if (url.pathname === '/auth/v1/user') {
      return /^Bearer admin-/.test(String(init.headers?.Authorization || ''))
        ? json(200, { id: 'admin-user-1', email: 'owner@soralife.test' })
        : json(401, {});
    }

    const rel = url.pathname.replace('/rest/v1/', '');

    if (rel === 'rpc/rate_limit_check') return json(200, { allowed: true, count: 1, limit: 99, reset: 0 });
    if (rel === 'rpc/set_conversion_status') { world.conversionStatuses.push(body); return json(200, { ok: true }); }
    if (rel === 'rpc/record_conversion') return json(200, { ok: true });
    // is_sora_admin() decides from the CALLER's token (auth.uid()); here a
    // token starting "admin-" belongs to an admin and any other does not.
    if (rel === 'rpc/is_sora_admin') return json(200, /^Bearer admin-/.test(String(init.headers?.Authorization || '')));

    // Migration 0040's mark_cod_collected: paid, invoiced and recorded in one step, or
    // null when the guard matches nothing. `noAuditRpc` = 0040 not applied (PGRST202).
    if (rel === 'rpc/mark_cod_collected') {
      if (world.noAuditRpc) return json(404, { code: 'PGRST202', message: 'Could not find the function public.mark_cod_collected' });
      const o = world.orders.find((x) => x.id === body.p_order_id);
      if (!o || o.payment_method !== 'cod' || o.payment_status === 'paid' || o.fulfillment_status === 'cancelled') return json(200, null);
      const now = new Date().toISOString();
      Object.assign(o, { status: 'paid', payment_status: 'paid', paid_at: now, invoice_number: o.invoice_number ?? body.p_invoice_number, invoiced_at: o.invoiced_at ?? now, updated_at: now });
      const email = String(body.p_admin_email ?? '').trim() || null;
      world.orderEvents.push({ order_id: o.id, action: 'cod_collected', admin_user_id: body.p_admin_user_id, admin_email: email });
      return json(200, { id: o.id, order_number: o.order_number, status: o.status, payment_status: o.payment_status, paid_at: o.paid_at, invoice_number: o.invoice_number, invoiced_at: o.invoiced_at, collected_by: email });
    }

    // ---- Migration 0039: order holds. Each mirrors its SQL function. ----
    if (/^rpc\/(reserve|settle|release)_order_holds$/.test(rel)) {
      if (world.noHolds) return json(404, { code: 'PGRST202', message: `Could not find the function public.${rel.slice(4)}` });
      if (rel === 'rpc/reserve_order_holds') { world.calls.reserve += 1; return json(200, holds.reserve(body)); }
      if (rel === 'rpc/settle_order_holds') { world.calls.settle += 1; return json(200, holds.settle(body)); }
      world.calls.release += 1;
      return json(200, holds.release(body));
    }

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
      world.calls.orderInserts += 1;
      // Both unique indexes on orders, with PostgREST's real 23505 bodies:
      // the column in `details`, the constraint name in `message`.
      if (body.idempotency_key
          && world.orders.some((o) => o.idempotency_key === body.idempotency_key)) {
        return json(409, {
          code: '23505',
          details: `Key (idempotency_key)=(${body.idempotency_key}) already exists.`,
          message: 'duplicate key value violates unique constraint "orders_idempotency_key_uniq"',
        });
      }
      if (world.clashNextOrderNumbers > 0
          || world.orders.some((o) => o.order_number === body.order_number)) {
        if (world.clashNextOrderNumbers > 0) world.clashNextOrderNumbers -= 1;
        world.clashedOrderNumbers.push(body.order_number);
        return json(409, {
          code: '23505',
          details: `Key (order_number)=(${body.order_number}) already exists.`,
          message: 'duplicate key value violates unique constraint "orders_order_number_key"',
        });
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

    if (rel === 'orders' && method === 'DELETE') {
      world.calls.orderDeletes += 1;
      const id = (q.get('id') || '').replace('eq.', '');
      const ps = (q.get('payment_status') || '').replace('eq.', '');
      const gone = world.orders.filter((o) => o.id === id && (!ps || o.payment_status === ps));
      world.orders = world.orders.filter((o) => !gone.includes(o));
      // on delete cascade
      world.holds = world.holds.filter((h) => !gone.some((o) => o.id === h.order_id));
      return json(200, structuredClone(gone));
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

  const holds = holdsModel(world);
  return world;
}

/**
 * Migration 0039's functions over the in-memory world, rule for rule:
 * a hold counts while status = 'held' and expires_at is in the future; a
 * refusal writes nothing; stock never goes below zero; a coupon use is
 * counted once per order (the redemption decides). The SQL itself is run on
 * a real Postgres engine separately; this is what the handler suites see.
 */
function holdsModel(world) {
  const live = (h) => h.status === 'held' && Date.parse(h.expires_at) > Date.now();
  const rows = { product_variants: () => world.variants, catalogue_variants: () => world.catalogueVariants, catalogue_products: () => world.catalogueProducts };
  const stockRow = (target, id) => {
    if (!rows[target]) throw new Error(`unknown stock target ${target}`);
    return rows[target]().find((r) => String(r.id) === String(id)) || null;
  };
  const adjust = (target, id, delta) => {
    const row = stockRow(target, id);
    if (!row) return Math.max(-delta, 0);
    const before = Number(row.stock);
    row.stock = Math.max(before + delta, 0);
    return Math.max(-(before + delta), 0);
  };
  const lines = (list) => {
    const by = new Map();
    for (const e of Array.isArray(list) ? list : []) {
      const qty = Number(e.qty);
      if (!(qty > 0)) continue;
      const k = `${e.target}|${e.id}`;
      const seen = by.get(k);
      if (seen) { seen.qty += qty; seen.line = Math.min(seen.line, Number(e.line)); }
      else by.set(k, { target: e.target, id: String(e.id), qty, label: e.label ?? null, line: Number(e.line) });
    }
    return [...by.values()].sort((a, b) => (a.target + a.id).localeCompare(b.target + b.id));
  };
  const couponByCode = (code) => {
    const c = String(code || '').trim().toUpperCase();
    return c ? world.coupons.find((x) => String(x.code).toUpperCase() === c) || null : null;
  };
  const room = (coupon, userId, orderId) => {
    if (!coupon || coupon.is_active !== true) return 'inactive';
    if (coupon.usage_limit != null) {
      const held = world.holds.filter((h) => h.kind === 'coupon' && h.coupon_id === coupon.id && live(h) && h.order_id !== orderId).length;
      if (Number(coupon.used_count || 0) + held >= coupon.usage_limit) return 'exhausted';
    }
    if (coupon.per_user_limit != null && userId) {
      const mine = world.redemptions.filter((r) => r.coupon_id === coupon.id && r.user_id === userId && r.order_id !== orderId).length
        + world.holds.filter((h) => h.kind === 'coupon' && h.coupon_id === coupon.id && h.user_id === userId && live(h) && h.order_id !== orderId).length;
      if (mine >= coupon.per_user_limit) return 'user_limit';
    }
    return 'ok';
  };
  const count = (couponId, orderId, userId) => {
    if (world.redemptions.some((r) => r.coupon_id === couponId && r.order_id === orderId)) return;
    world.redemptions.push({ coupon_id: couponId, order_id: orderId, user_id: userId });
    const c = world.coupons.find((x) => x.id === couponId);
    if (c) c.used_count = Number(c.used_count || 0) + 1;
  };
  const orderOf = (id) => {
    const o = world.orders.find((x) => x.id === id);
    if (!o) throw new Error('order not found');
    return o;
  };

  return {
    reserve(b) {
      const order = orderOf(b.p_order_id);
      if (world.holds.some((h) => h.order_id === order.id)) return { ok: true, already: true, reserved_until: order.reserved_until ?? null };
      const commit = Boolean(b.p_commit);
      if (!commit && !(Number(b.p_hold_minutes) >= 1)) throw new Error('a hold needs a length in minutes');
      const until = commit ? null : new Date(Date.now() + Number(b.p_hold_minutes) * 60_000).toISOString();
      let coupon = null;
      if (String(b.p_coupon_code || '').trim()) {
        coupon = couponByCode(b.p_coupon_code);
        if (!coupon) return { ok: false, reason: 'inactive' };
        const r = room(coupon, b.p_user_id || null, order.id);
        if (r !== 'ok') return { ok: false, reason: r };
      }
      const want = lines(b.p_lines);
      for (const l of want) {
        const row = stockRow(l.target, l.id);
        const held = world.holds.filter((h) => h.kind === 'stock' && h.target === l.target && h.target_id === l.id && live(h)).reduce((n, h) => n + h.qty, 0);
        if (!row || l.qty > Number(row.stock) - held) return { ok: false, reason: 'stock', line: l.line, available: Math.max((row ? Number(row.stock) : 0) - held, 0) };
      }
      const status = commit ? 'committed' : 'held';
      if (coupon) {
        world.holds.push({ order_id: order.id, kind: 'coupon', coupon_id: coupon.id, user_id: b.p_user_id || null, status, expires_at: until });
        if (commit) count(coupon.id, order.id, b.p_user_id || null);
      }
      for (const l of want) {
        world.holds.push({ order_id: order.id, kind: 'stock', target: l.target, target_id: l.id, qty: l.qty, label: l.label, status, expires_at: until });
        if (commit) adjust(l.target, l.id, -l.qty);
      }
      order.reserved_until = until;
      return { ok: true, reserved_until: until };
    },

    settle(b) {
      const order = orderOf(b.p_order_id);
      if (order.fulfillment_status === 'cancelled') return { ok: true, skipped: 'cancelled' };
      if (!world.holds.some((h) => h.order_id === order.id)) {
        const coupon = String(b.p_coupon_code || '').trim() ? couponByCode(b.p_coupon_code) : null;
        if (coupon) world.holds.push({ order_id: order.id, kind: 'coupon', coupon_id: coupon.id, user_id: b.p_user_id || null, status: 'released', expires_at: null });
        for (const l of lines(b.p_lines)) world.holds.push({ order_id: order.id, kind: 'stock', target: l.target, target_id: l.id, qty: l.qty, label: l.label, status: 'released', expires_at: null });
      }
      const open = (h) => h.order_id === order.id && ['held', 'released', 'restored'].includes(h.status);
      const warnings = [];
      let taken = 0;
      for (const h of world.holds.filter((x) => open(x) && x.kind === 'coupon')) {
        if (!live(h)) {
          const coupon = world.coupons.find((c) => c.id === h.coupon_id);
          const r = room(coupon, h.user_id, order.id);
          if (r !== 'ok') { h.status = 'released'; warnings.push({ kind: 'coupon', code: coupon?.code, reason: r }); continue; }
        }
        count(h.coupon_id, order.id, h.user_id);
        h.status = 'committed'; taken += 1;
      }
      for (const h of world.holds.filter((x) => open(x) && x.kind === 'stock').sort((a, c) => (a.target + a.target_id).localeCompare(c.target + c.target_id))) {
        const short = adjust(h.target, h.target_id, -h.qty);
        if (short > 0) warnings.push({ kind: 'stock', label: h.label, qty: h.qty, short });
        h.status = 'committed'; taken += 1;
      }
      if (warnings.length) order.hold_warnings = [...(order.hold_warnings || []), ...warnings];
      return { ok: true, taken, warnings };
    },

    release(b) {
      let n = 0;
      for (const h of world.holds) if (h.order_id === b.p_order_id && h.status === 'held') { h.status = 'released'; n += 1; }
      return n;
    },
  };
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
