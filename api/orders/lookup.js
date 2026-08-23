// ============================================================
// POST /api/orders/lookup
//
// Guest order lookup for the Purchase Passport screen. There is no
// customer login in this app, so ownership is proven by knowing BOTH
// the order number and the email address used at checkout — the same
// "track my order" trust model used by most guest-checkout stores.
//
// Runs entirely server-side with the service-role key (like
// create-order.js and verify.js). The browser never queries the
// `orders` table directly — RLS on that table grants SELECT to admins
// only, and this route does not change that. It reads with the
// service-role key (which bypasses RLS by design, same as the other
// order routes) and returns a sanitized subset ONLY when the supplied
// email matches the order's stored customer email.
//
// A wrong order number and a wrong email return the exact same 404 —
// never reveal which one was wrong, so this can't be used to test
// whether a given order number exists.
// ============================================================
import { getSupabaseConfig, findOrderByNumber } from '../_lib/supabaseAdmin.js';
import { normalizeOrderNumber, customerEmailMatches, sanitizeOrderForCustomer } from '../_lib/orderLookup.js';

const NOT_FOUND_MESSAGE = "We couldn't find an order matching that order number and email.";

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed.');
  }

  const sb = getSupabaseConfig();
  if (!sb.configured) {
    console.error('[orders/lookup] Supabase server env missing (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return fail(res, 503, 'Order lookup is not available right now. Please try again later.');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderNumber = normalizeOrderNumber(body.orderNumber);
    const email = typeof body.email === 'string' ? body.email : '';

    if (!orderNumber || !email) {
      return fail(res, 400, 'Enter both your order number and the email used at checkout.');
    }
    if (orderNumber.length > 60 || email.length > 200) {
      return fail(res, 400, 'That order number or email looks invalid.');
    }

    const order = await findOrderByNumber(orderNumber, sb);
    if (!order || !customerEmailMatches(order, email)) {
      // Same response whether the order doesn't exist or the email is
      // wrong — never let this endpoint confirm an order number is real.
      return fail(res, 404, NOT_FOUND_MESSAGE);
    }

    return res.status(200).json({ order: sanitizeOrderForCustomer(order) });
  } catch (err) {
    console.error('[orders/lookup] failed:', err?.message);
    return fail(res, 500, 'We could not look up that order. Please try again.');
  }
}
