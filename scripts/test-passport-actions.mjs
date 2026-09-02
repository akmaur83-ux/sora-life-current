// Passport regression checks: real actions only, truthful order data, no network.
// Run: node scripts/test-passport-actions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fulfillmentForDisplay } from '../src/lib/orderFulfillment.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const page = read('src/pages/Passport.jsx');
const adapterSource = read('src/data/passport.js');
const app = read('src/App.jsx');
const css = read('src/styles/passport.css');

let pass = 0;
let fail = 0;
const ok = (name, condition) => {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
  }
};

console.log('\n— Passport actions are genuine —');
ok('Passport has no href="#"', !page.includes('href="#"'));
ok('no anchor suppresses navigation with preventDefault', !/<a[\s\S]{0,300}preventDefault\s*\(/.test(page));
ok('no empty click handler remains', !/onClick=\{\(\)\s*=>\s*\{\s*\}\}/.test(page));
ok('the only preventDefault is the real lookup form submit', (page.match(/preventDefault\s*\(/g) || []).length === 1 && page.includes('<form className="surface pad-lg" onSubmit={submit}>'));
ok('fake PDF toast and coming-soon copy are absent', !/PDF export is coming soon|Download Passport/.test(page));
ok('print action invokes the browser print dialog', page.includes('const printPassport = () => window.print()') && page.includes('Print / Save as PDF'));
ok('print stylesheet removes interactive Passport chrome', /@media print[\s\S]*\.psp__side[\s\S]*\.psp__tabs[\s\S]*\.no-print/.test(css));
ok('no invented courier action or URL remains', !/Track on Courier Website|courier[^\n]*(?:https?:|href)/i.test(page));
ok('unsupported guide, recommendation and care CTAs are absent', !/View Detailed Guide|Explore Recommendations|Explore Sora Life Care/.test(page));
ok('support action is derived from configured contact data', page.includes('mailto:${email}') && page.includes('tel:${phone}') && page.includes('{support &&'));

console.log('\n— Passport route and lookup behavior remain available —');
ok('Passport route still supports an optional real order/passport ID', app.includes('<Route path="/passport/:passportId?" element={<Passport />} />'));
ok('guest lookup still posts order number and checkout email', adapterSource.includes("fetch('/api/orders/lookup'") && adapterSource.includes('body: JSON.stringify({ orderNumber, email })'));
ok('signed-in lookup still relies on orders RLS', adapterSource.includes(".from('orders')") && adapterSource.includes(".eq('order_number', on)") && adapterSource.includes('.maybeSingle()'));

// Evaluate only the pure adapter with inert dependencies. No fetch or Supabase
// call is made; this verifies the actual mapping used by both lookup paths.
const executableAdapter = adapterSource
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/\bexport\s+/g, '');
const makeAdapter = new Function('productById', 'supabase', 'fulfillmentForDisplay', `${executableAdapter}\nreturn { mapOrderToPassport };`);

const order = {
  orderNumber: 'SORA-REAL-1001',
  status: 'paid',
  paymentStatus: 'paid',
  paymentMethod: 'razorpay',
  amount: 619,
  items: [{ product_id: 'retired-product', name: 'Retired catalogue item', qty: 2, unit_price: 309.5 }],
  customer: { firstName: 'Asha', lastName: 'Rai', address: '12 Cedar Road', city: 'Shimla', state: 'HP', pin: '171001' },
  createdAt: '2026-08-23T10:10:00.000Z',
};
const adapter = makeAdapter({}, {}, fulfillmentForDisplay);
const mapped = adapter.mapOrderToPassport(order);
const mappedJson = JSON.stringify(mapped);

ok('retired catalogue product keeps its real order-line name', mapped.product.name === 'Retired catalogue item');
ok('retired catalogue product has a safe null image fallback', mapped.product.image === null);
ok('real quantity, amount and order status are preserved', mapped.product.qty === 2 && mapped.order.amount === 619 && mapped.status === 'Payment Confirmed');
ok('only the recorded order event is rendered', mapped.timeline.length === 1 && mapped.timeline[0].key === 'ordered');
ok('old orders receive no invented tracking or fulfillment data', mapped.fulfillment === null && !/carrier|trackingId|packed|shipped|out_for_delivery|deliveredOn|eta/.test(mappedJson));
ok('fabricated care, returns, identity, experience and reminders are absent', !/"care"|"returns"|"identity"|"experience"|"reminder"/.test(mappedJson));

const tracked = adapter.mapOrderToPassport({
  ...order,
  fulfillment: {
    fulfillmentStatus: 'shipped',
    carrierName: 'Example Carrier',
    trackingNumber: 'REAL-123',
    trackingUrl: 'https://tracking.example/REAL-123',
    shippedAt: '2026-08-24T09:30:00.000Z',
  },
});
ok('stored fulfillment is preserved without inferred milestones', tracked.fulfillment?.trackingNumber === 'REAL-123' && tracked.timeline.map((step) => step.key).join(',') === 'ordered,shipped');
ok('tracking CTA is conditional on a validated stored URL', page.includes('{fulfillment?.trackingUrl &&') && page.includes('href={fulfillment.trackingUrl}'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
