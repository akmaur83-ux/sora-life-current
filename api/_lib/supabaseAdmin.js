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
  return { url, serviceKey, configured: Boolean(url && serviceKey) };
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

export async function insertOrder(order, cfg) {
  const rows = await rest('orders', {
    ...cfg,
    method: 'POST',
    body: order,
    headers: { Prefer: 'return=representation' },
  });
  return Array.isArray(rows) ? rows[0] : rows;
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
