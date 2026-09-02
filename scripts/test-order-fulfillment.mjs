// Order fulfillment foundation — offline regression checks only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FULFILLMENT_STATUSES,
  fulfillmentForDisplay,
  normalizeFulfillmentStatus,
  safeTrackingUrl,
  validateFulfillmentInput,
} from '../src/lib/orderFulfillment.js';
import { sanitizeOrderForCustomer } from '../api/_lib/orderLookup.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const sql = read('supabase/migrations/0022_order_fulfillment.sql');
const customerOrdersSql = read('supabase/migrations/0004_customer_orders.sql');
const adminApi = read('src/lib/adminApi.js');
const adminOrders = read('src/admin/pages/Orders.jsx');
const account = read('src/pages/Account.jsx');
const passport = read('src/pages/Passport.jsx');
const passportData = read('src/data/passport.js');
const guestLookup = read('api/orders/lookup.js');

let pass = 0;
let fail = 0;
const ok = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};
const rejects = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('\n— Status and URL validation —');
ok('the status vocabulary is closed and explicit', FULFILLMENT_STATUSES.join(',') === 'unfulfilled,processing,shipped,delivered,cancelled');
ok('valid status normalizes', normalizeFulfillmentStatus(' SHIPPED ') === 'shipped');
ok('invalid status is rejected by admin input validation', rejects(() => validateFulfillmentInput({ fulfillmentStatus: 'in-transit' })));
ok('a public HTTPS tracking URL is accepted', safeTrackingUrl('https://carrier.example/track/ABC-1') === 'https://carrier.example/track/ABC-1');
for (const bad of ['http://carrier.example/1', 'javascript:alert(1)', '//carrier.example/1', 'https://user:pass@carrier.example/1', 'https://localhost/1', 'https://intranet/1', 'https://127.0.0.1/1', 'https://192.168.1.5/1', 'https://[::ffff:127.0.0.1]/1']) {
  ok(`unsafe tracking URL rejected: ${bad}`, safeTrackingUrl(bad) === null);
}
ok('tracking URL is never synthesized from carrier or number', validateFulfillmentInput({ carrierName: 'Carrier', trackingNumber: 'ABC' }).trackingUrl === null);

console.log('\n— Migration safety —');
for (const column of ['fulfillment_status', 'carrier_name', 'tracking_number', 'tracking_url', 'shipped_at', 'delivered_at']) {
  ok(`${column} is additive`, sql.includes(`add column if not exists ${column}`));
}
ok('legacy orders remain valid because fulfillment fields are nullable', !/add column if not exists (?:fulfillment_status|carrier_name|tracking_number|tracking_url|shipped_at|delivered_at)[^,;]*not null/i.test(sql));
ok('database status constraint mirrors the closed vocabulary', FULFILLMENT_STATUSES.every((status) => sql.includes(`'${status}'`)) && sql.includes('orders_fulfillment_status_check'));
ok('database requires explicit HTTPS tracking URLs', sql.includes('orders_tracking_url_check') && sql.includes("tracking_url ~ '^https://"));
ok('delivered timestamp cannot precede shipped timestamp', sql.includes('delivered_at >= shipped_at'));
ok('admin RPC is SECURITY DEFINER with a fixed search path', /admin_update_order_fulfillment[\s\S]*security definer[\s\S]*set search_path = public, pg_temp/i.test(sql));
ok('admin membership is checked inside the RPC', sql.includes('if not public.is_sora_admin()'));
ok('anonymous callers have no RPC execution', /revoke all on function public\.admin_update_order_fulfillment[\s\S]*from public, anon/i.test(sql));
ok('the RPC is executable only through an authenticated admin session', /grant execute on function public\.admin_update_order_fulfillment[\s\S]*to authenticated;/i.test(sql) && !/to authenticated, service_role/.test(sql));
ok('customers retain no direct order write grants', sql.includes('revoke insert, update, delete on public.orders from anon, authenticated'));
ok('signed-in customers can still read only orders.user_id = auth.uid()', customerOrdersSql.includes('user_id = auth.uid()') && !/for (?:update|insert|delete)/i.test(customerOrdersSql));
const orderUpdate = sql.match(/update public\.orders[\s\S]*?where id = p_order_id/i)?.[0] || '';
ok('RPC update is limited to fulfillment columns', ['fulfillment_status', 'carrier_name', 'tracking_number', 'tracking_url', 'shipped_at', 'delivered_at', 'updated_at'].every((field) => orderUpdate.includes(field)));
ok('RPC never updates payment, amount, coupon or delivery pricing fields', !/payment_|amount|coupon|shipping_fee|delivery_method/.test(orderUpdate));

console.log('\n— Customer and Admin behavior —');
const oldOrder = {
  order_number: 'SORA-OLD', status: 'paid', payment_status: 'paid', payment_method: 'razorpay',
  amount_paise: 61900, currency: 'INR', items: [], customer: { email: 'owner@example.com' },
  created_at: '2026-08-01T00:00:00.000Z', paid_at: '2026-08-01T00:01:00.000Z',
};
const oldSafe = sanitizeOrderForCustomer(oldOrder);
ok('old order response is unchanged and carries no fake fulfillment object', !('fulfillment' in oldSafe));
const trackedSafe = sanitizeOrderForCustomer({
  ...oldOrder, fulfillment_status: 'shipped', carrier_name: 'Example Carrier', tracking_number: 'ABC-1',
  tracking_url: 'https://carrier.example/track/ABC-1', shipped_at: '2026-08-02T10:00:00.000Z',
});
ok('owned/verified lookup returns validated stored tracking', trackedSafe.fulfillment?.trackingNumber === 'ABC-1' && trackedSafe.fulfillment?.trackingUrl === 'https://carrier.example/track/ABC-1');
ok('guest tracking is returned only after order/email ownership proof', guestLookup.indexOf('customerEmailMatches(order, email)') < guestLookup.indexOf('sanitizeOrderForCustomer(order)'));
ok('invalid stored URL is suppressed from customers', fulfillmentForDisplay({ fulfillment_status: 'shipped', tracking_url: 'javascript:alert(1)' })?.trackingUrl == null);
ok('Admin writes use only the narrow fulfillment RPC', adminApi.includes("supabase.rpc('admin_update_order_fulfillment'") && !adminApi.includes(".from('orders').update("));
ok('Admin supports details plus mark-shipped and mark-delivered actions', /Carrier[\s\S]*Tracking number[\s\S]*Tracking URL/.test(adminOrders) && adminOrders.includes("save('shipped')") && adminOrders.includes("save('delivered')"));
ok('Account query is own-row RLS based and selects fulfillment fields', account.includes(".from('orders')") && account.includes('fulfillment_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at'));
ok('Account tracking link requires safeTrackingUrl', account.includes('const trackingUrl = safeTrackingUrl(o.tracking_url)') && account.includes('{trackingUrl &&'));
ok('Passport authenticated lookup selects the six real fields', passportData.includes('fulfillment_status, carrier_name, tracking_number, tracking_url, shipped_at, delivered_at'));
ok('Passport renders a carrier link only from validated mapped data', passport.includes('{fulfillment?.trackingUrl &&') && passport.includes('href={fulfillment.trackingUrl}'));
ok('Passport does not generate a courier URL', !/trackingNumber[^\n]*(?:https?:|trackingUrl\s*=)|carrierName[^\n]*(?:https?:|trackingUrl\s*=)/.test(passportData));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
