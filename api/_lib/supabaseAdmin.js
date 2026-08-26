// ============================================================
// Server-only Supabase access for order writes.
//
// Uses the service-role key, which bypasses RLS. This module must ONLY
// ever be imported by server-side API routes — never by anything that is
// bundled for the browser. The orders table has no public insert/update
// policy, so this is the only path that can create or mark an order paid.
// ============================================================

const REST_TIMEOUT_MS = 10000;

export function getSupabaseConfig() {
  // The Supabase URL is already configured for the frontend build; the same
  // value is reused at runtime here. The service-role key is server-only.
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Anon/publishable key, used only as the apikey when validating a
  // customer's access token (least privilege). Optional — falls back to the
  // service key server-side if unset. Never sent to the browser.
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || null;
  return { url, serviceKey, anonKey, configured: Boolean(url && serviceKey) };
}

/**
 * Resolve the authenticated customer's user id from a Supabase access token
 * carried in the `Authorization: Bearer <token>` header — or null when there
 * is no token / it is invalid / expired / cannot be checked.
 *
 * Security: the id is taken from Supabase's own /auth/v1/user response AFTER
 * it validates the JWT's signature. A client-supplied user_id is NEVER
 * trusted (this function ignores the request body entirely). Failure is
 * intentionally non-fatal and returns null, so a bad/missing token simply
 * produces a guest order rather than blocking checkout.
 */
export async function getUserIdFromToken(authHeader, cfg) {
  const raw = typeof authHeader === 'string' ? authHeader : '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return null;

  const apikey = cfg?.anonKey || cfg?.serviceKey;
  if (!cfg?.url || !apikey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && typeof user.id === 'string' ? user.id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function rest(path, { method = 'GET', body, headers = {}, url, serviceKey } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(data?.message || `Supabase responded ${res.status}`);
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Load the trusted product rows for a set of cart ids (biosash_id or numeric id). */
export async function fetchProductsForCart(ids, cfg) {
  const quoted = ids.map((i) => `"${String(i).replace(/"/g, '')}"`).join(',');
  const numeric = ids.filter((i) => /^\d+$/.test(String(i)));

  const select = 'id,biosash_id,name,original_price,discount_percent,sale_price,is_active';
  const byBiosash = await rest(
    `products?select=${select}&biosash_id=in.(${quoted})`,
    cfg
  );
  let byId = [];
  if (numeric.length) {
    byId = await rest(`products?select=${select}&id=in.(${numeric.join(',')})`, cfg);
  }

  const merged = new Map();
  [...byBiosash, ...byId].forEach((r) => merged.set(r.id, r));
  return [...merged.values()];
}

// Columns introduced by migration 0006. If that migration has not been run
// on this project yet, PostgREST rejects the insert with PGRST204 ("column
// not found"). Checkout must not break because a migration is pending, so the
// insert is retried once without them — the order is still created with a
// correct, server-computed amount_paise, just without the itemised billing.
const OPTIONAL_ORDER_COLUMNS = [
  'billing', 'mrp_total', 'item_total', 'product_discount', 'coupon_code',
  'coupon_discount', 'shipping_fee', 'platform_fee', 'packaging_fee',
  'taxable_amount', 'tax_total', 'tax_mode', 'billing_address',
  'invoice_number', 'invoiced_at',
];

export async function insertOrder(order, cfg) {
  try {
    const rows = await rest('orders', {
      ...cfg,
      method: 'POST',
      body: order,
      headers: { Prefer: 'return=representation' },
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (err) {
    const unknownColumn = err?.details?.code === 'PGRST204'
      || /column .* does not exist/i.test(err?.message || '');
    if (!unknownColumn) throw err;

    const stripped = { ...order };
    for (const c of OPTIONAL_ORDER_COLUMNS) delete stripped[c];
    console.warn('[orders] billing columns missing — run migration 0006. Inserting core order only.');
    const rows = await rest('orders', {
      ...cfg,
      method: 'POST',
      body: stripped,
      headers: { Prefer: 'return=representation' },
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }
}

export async function findOrderByRazorpayOrderId(razorpayOrderId, cfg) {
  const rows = await rest(
    `orders?select=*&razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&limit=1`,
    cfg
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Used by the guest order-lookup route (Purchase Passport). Returns the
 * full row — callers must check ownership (email match) before returning
 * anything to the browser, and must sanitize before sending it. */
export async function findOrderByNumber(orderNumber, cfg) {
  const rows = await rest(
    `orders?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
    cfg
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function updateOrderById(id, patch, cfg) {
  const rows = await rest(`orders?id=eq.${encodeURIComponent(id)}`, {
    ...cfg,
    method: 'PATCH',
    body: { ...patch, updated_at: new Date().toISOString() },
    headers: { Prefer: 'return=representation' },
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

// ============================================================
// Variants, coupons and payment transactions.
//
// All of these read tables introduced by migration 0006. Until that
// migration is applied the tables do not exist and PostgREST answers 404 /
// PGRST205. Every helper below therefore degrades to "no data" instead of
// throwing, so an un-migrated deployment keeps checking out exactly as it
// does today (base product prices, no tax block) rather than erroring.
// ============================================================

/** True when the failure means "relation does not exist", not a real fault. */
function isMissingRelation(err) {
  const code = err?.details?.code;
  return err?.status === 404 || code === 'PGRST205' || code === '42P01';
}

/**
 * Trusted variant rows for the variant ids present in the cart.
 * Only active variants are returned; an inactive one simply will not resolve
 * and computeOrderTotal then rejects the line.
 */
export async function fetchVariantsForCart(variantIds, cfg) {
  const ids = [...new Set((variantIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const quoted = ids.map((i) => `"${i.replace(/"/g, '')}"`).join(',');
  const select = 'id,product_id,label,sku,mrp,sale_price,gst_rate,stock,is_active,weight_grams,volume_ml,image_url';
  try {
    return await rest(`product_variants?select=${select}&id=in.(${quoted})`, cfg);
  } catch (err) {
    if (isMissingRelation(err)) {
      console.warn('[variants] product_variants table not present — run migration 0006. Falling back to base prices.');
      return [];
    }
    throw err;
  }
}

/** All active variants for a product (admin/PDP hydration). */
export async function fetchVariantsForProducts(productIds, cfg) {
  const ids = [...new Set((productIds || []).filter((n) => /^\d+$/.test(String(n))))];
  if (!ids.length) return [];
  const select = 'id,product_id,label,size,unit,sku,mrp,sale_price,gst_rate,stock,is_active,sort_order,image_url';
  try {
    return await rest(
      `product_variants?select=${select}&product_id=in.(${ids.join(',')})&is_active=eq.true&order=sort_order.asc`,
      cfg
    );
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}

/**
 * Resolve a coupon code to its trusted record. Returns null for unknown,
 * inactive, not-yet-started, expired or exhausted coupons — the browser
 * never decides whether a coupon is valid.
 */
export async function fetchCouponByCode(code, cfg) {
  const clean = typeof code === 'string' ? code.trim().toUpperCase().slice(0, 40) : '';
  if (!clean) return null;
  try {
    const rows = await rest(
      `coupons?select=*&code=eq.${encodeURIComponent(clean)}&is_active=eq.true&limit=1`,
      cfg
    );
    const c = rows?.[0];
    if (!c) return null;
    const now = Date.now();
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return null;
    if (c.expires_at && new Date(c.expires_at).getTime() < now) return null;
    if (c.usage_limit != null && Number(c.used_count) >= Number(c.usage_limit)) return null;
    return c;
  } catch (err) {
    if (isMissingRelation(err)) return null;
    throw err;
  }
}

/**
 * Record a gateway event. gateway_payment_id is UNIQUE, so a replayed
 * webhook conflicts instead of inserting a second row. Returns
 * { inserted: false, duplicate: true } on replay rather than throwing.
 */
export async function recordPaymentTransaction(tx, cfg) {
  try {
    const rows = await rest('payment_transactions', {
      ...cfg,
      method: 'POST',
      body: tx,
      headers: { Prefer: 'return=representation' },
    });
    return { inserted: true, duplicate: false, row: rows?.[0] || null };
  } catch (err) {
    // 23505 = unique_violation -> this payment id was already recorded.
    if (err?.details?.code === '23505') return { inserted: false, duplicate: true, row: null };
    if (isMissingRelation(err)) {
      console.warn('[payments] payment_transactions table not present — run migration 0006.');
      return { inserted: false, duplicate: false, row: null };
    }
    throw err;
  }
}

/**
 * Call a Postgres function (RPC) with the service-role key. Used for the
 * atomic coupon-consume and rate-limit functions, which run their logic
 * inside the database where it can be made race-safe.
 */
export async function callRpc(fn, args, cfg) {
  return rest(`rpc/${fn}`, {
    ...cfg,
    method: 'POST',
    body: args || {},
    headers: { Prefer: 'return=representation' },
  });
}

/**
 * Consume a coupon for an order that has just been CONFIRMED PAID.
 *
 * All the enforcement lives in the DB function consume_coupon (migration
 * 0009): it locks the coupon row, so concurrent orders cannot exceed
 * usage_limit, and it is idempotent per order, so a duplicate verify/webhook
 * for the same order never double-counts. This wrapper is deliberately
 * non-fatal: the order is already paid, so a coupon-ledger hiccup (or a
 * pending 0009 migration) must never break payment confirmation.
 *
 * Returns { status } where status is one of:
 *   'consumed' | 'already' | 'exhausted' | 'user_limit' | 'no_coupon' | 'skipped'
 */
export async function consumeCouponForOrder(order, cfg) {
  const code = order?.coupon_code;
  if (!code) return { status: 'no_coupon' };
  try {
    const result = await callRpc('consume_coupon', {
      p_code: code,
      p_order_id: order.id ?? null,
      p_user_id: order.user_id ?? null,
      p_order_number: order.order_number ?? null,
    }, cfg);
    // The function returns a bare text value; PostgREST delivers it as a JSON
    // string (or, defensively, a single-element array).
    const status = typeof result === 'string'
      ? result
      : (Array.isArray(result) ? result[0] : (result?.consume_coupon ?? 'unknown'));
    return { status: status || 'unknown' };
  } catch (err) {
    // Missing function (0009 not applied yet) answers PGRST202 / 404 — treat
    // exactly like the other "migration pending" paths: log and carry on.
    console.warn('[coupon] consume skipped:', err?.message);
    return { status: 'skipped' };
  }
}

/**
 * Creator Program Part 2 — record an attributed-sale conversion for an order.
 *
 * Non-fatal by contract: attribution must NEVER block a legitimate order. The
 * creator identity and amounts are resolved/validated inside the DB function;
 * this passes only the order id, the opaque visitor id, the authenticated
 * user id, and the SERVER-computed totals (never browser amounts).
 */
export async function recordConversion({ orderId, orderNumber, visitorId, userId, totals, items }, cfg) {
  try {
    const out = await callRpc('record_conversion', {
      p_order_id: orderId,
      p_order_number: orderNumber ?? null,
      p_visitor_id: visitorId ?? null,
      p_user_id: userId ?? null,
      p_totals: totals || {},
      p_items: items || [],
    }, cfg);
    return (out && typeof out === 'object' && !Array.isArray(out)) ? out : (Array.isArray(out) ? out[0] : { ok: false });
  } catch (err) {
    // Missing table/function (0013 not applied) or any hiccup: skip silently.
    console.warn('[attribution] conversion skipped:', err?.message);
    return { ok: false, reason: 'skipped' };
  }
}

/** Transition an order's conversion (e.g. pending -> eligible on paid). Non-fatal. */
export async function setConversionStatus(orderId, status, reason, cfg) {
  try {
    return await callRpc('set_conversion_status', { p_order_id: orderId, p_status: status, p_reason: reason ?? null }, cfg);
  } catch (err) {
    console.warn('[attribution] status transition skipped:', err?.message);
    return { ok: false, reason: 'skipped' };
  }
}

/** Payment trail for one order (admin order detail). */
export async function fetchPaymentTransactions(orderId, cfg) {
  if (!orderId) return [];
  try {
    return await rest(
      `payment_transactions?select=*&order_id=eq.${encodeURIComponent(orderId)}&order=created_at.desc`,
      cfg
    );
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}
