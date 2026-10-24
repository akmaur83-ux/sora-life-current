// ============================================================
// POST /api/admin/mark-cod-collected   (admin only)
//
//   { orderNumber: 'SORA-…' }
//
// A cash-on-delivery order is placed unpaid and stays that way until the cash
// is collected. Nothing ever recorded that moment, so a COD order never became
// paid: it had no invoice number, it was missing from the admin's paid count,
// its creator commission never qualified, and a signed-in COD buyer counted as
// a first-time customer forever (audit finding 5).
//
// This records it, once, for one order:
//   * the caller must be an admin — decided by the database itself, as the
//     caller: is_sora_admin() run with their own access token;
//   * the order must be cash on delivery, and not cancelled;
//   * it is marked paid in ONE conditional write (unlessPaid), with its invoice
//     number and date issued in that same write — invoicePatchForPaidTransition,
//     exactly as the online payment paths do — so a double click cannot issue
//     two numbers, and a second click simply reports it already paid;
//   * its creator conversion qualifies, as an online payment's does.
// Stock and the coupon use were already taken when the order was placed (0039).
//
// The service-role key is used only after the admin check, and only for that
// one guarded write; nothing about it reaches the browser.
// ============================================================
import { getSupabaseConfig, findOrderByNumber, updateOrderById, setConversionStatus } from '../_lib/supabaseAdmin.js';
import { normalizeOrderNumber } from '../_lib/orderLookup.js';
import { invoicePatchForPaidTransition } from '../_lib/pricing.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';

function fail(res, status, error) { return res.status(status).json({ ok: false, error }); }

/** Only what the admin Orders page needs to redraw the row. */
function view(order) {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    paid_at: order.paid_at ?? null,
    invoice_number: order.invoice_number ?? null,
    invoiced_at: order.invoiced_at ?? null,
  };
}

/** Is the bearer of this access token an admin? The database answers, as them. */
async function callerIsAdmin(authorization, cfg) {
  const apikey = cfg.anonKey || cfg.serviceKey;
  const r = await fetch(`${cfg.url}/rest/v1/rpc/is_sora_admin`, {
    method: 'POST',
    headers: { apikey, Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return false;
  return (await r.json().catch(() => false)) === true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }

  const cfg = getSupabaseConfig();
  if (!(await enforceRateLimit(req, res, { name: 'admin-mark-cod-collected', limit: 30, windowSeconds: 60 }, cfg))) return;
  if (!cfg.configured) return fail(res, 503, 'Recording payments is not available right now.');

  const authorization = String(req.headers?.authorization || '');
  if (!/^Bearer [A-Za-z0-9._-]{20,}$/.test(authorization)) return fail(res, 401, 'Admin sign-in required.');

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return fail(res, 400, 'Invalid request body.'); }
  const orderNumber = normalizeOrderNumber(body?.orderNumber);
  if (!orderNumber || orderNumber.length > 60) return fail(res, 400, 'Missing order number.');

  try {
    if (!(await callerIsAdmin(authorization, cfg))) return fail(res, 403, 'Admin sign-in required.');

    const order = await findOrderByNumber(orderNumber, cfg);
    if (!order) return fail(res, 404, 'That order was not found.');
    if (order.payment_method !== 'cod') return fail(res, 409, 'Only a cash-on-delivery order can be marked as cash collected.');
    if (order.payment_status === 'paid') return res.status(200).json({ ok: true, alreadyPaid: true, order: view(order) });
    if (order.fulfillment_status === 'cancelled') return fail(res, 409, 'This order is cancelled. Un-cancel it first if the cash really was collected.');

    const paid = await updateOrderById(order.id, {
      status: 'paid',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      ...invoicePatchForPaidTransition(order),
    }, cfg, { unlessPaid: true });

    // Another click (or another admin) recorded it first: report that order as it now stands.
    if (!paid) {
      const now = await findOrderByNumber(orderNumber, cfg);
      return res.status(200).json({ ok: true, alreadyPaid: true, order: view(now || order) });
    }

    // A collected COD order qualifies its creator conversion, as a captured payment does. Non-fatal.
    await setConversionStatus(order.id, 'eligible', 'cod_collected', cfg).catch(() => {});
    return res.status(200).json({ ok: true, order: view(paid) });
  } catch (err) {
    console.error('[mark-cod-collected] failed:', err?.message);
    return fail(res, 502, 'The payment could not be recorded. Try again — a second try never records it twice.');
  }
}
