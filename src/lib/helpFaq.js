// ============================================================
// Help & FAQ (2026-11-13: more features) — the questions shoppers ask, answered
// only with what the site's own policies and features already say: the Shipping
// Policy's dispatch and delivery times, where orders are tracked, where coupons go.
// Anything the policies own (returns, refunds) is answered by a link to that
// policy, never restated, so an edit there can never leave this page wrong.
// ============================================================
export const HELP_TOPICS = Object.freeze([
  Object.freeze({ id: 'orders', title: 'Orders & delivery', items: [
    { q: 'How much does delivery cost?', a: 'Standard delivery is free on eligible orders across India.', link: { to: '/shipping', label: 'Shipping Policy' } },
    { q: 'When will my order be dispatched?', a: 'Orders are ordinarily dispatched within 2–3 business days of confirmation. Public holidays and very busy periods can add time.' },
    { q: 'How long does delivery take?', a: 'Standard delivery generally takes about 6–7 business days, depending on your location and the courier. Delivery dates shown are estimates, not guarantees.' },
    { q: 'How do I track my order?', a: 'Once your order ships, its latest status and a tracking link (when the courier provides one) appear in your orders. You can also look it up with your order number.', link: { to: '/passport', label: 'Track your order' } },
    { q: 'Can I get help with a specific order?', a: 'Yes. In My Orders, tap “Help with this order” to message us on WhatsApp with your order number already filled in.', link: { to: '/account/orders', label: 'My Orders' } },
  ] }),
  Object.freeze({ id: 'returns', title: 'Returns & refunds', items: [
    { q: 'Can I return a product?', a: 'Returns and refunds follow our Returns Policy, which sets out what can be returned, the time limits and how refunds are made.', link: { to: '/returns', label: 'Returns & refunds' } },
  ] }),
  Object.freeze({ id: 'payments', title: 'Payments, offers & invoices', items: [
    { q: 'How can I pay?', a: 'The payment options available for your order are shown at checkout, and payment is processed securely.' },
    { q: 'Where do I enter a coupon code?', a: 'In the coupon box at checkout. Running offers and every discounted product are on the Offers page.', link: { to: '/offers', label: 'Offers & deals' } },
    { q: 'Where is my invoice?', a: 'Open My Orders and choose “View Invoice” on the order.', link: { to: '/account/orders', label: 'My Orders' } },
  ] }),
  Object.freeze({ id: 'shopping', title: 'Shopping', items: [
    { q: 'How do I choose the right size?', a: 'On fashion product pages with letter sizes, open “Size guide” and use “Find my size”: type your chest or bust in inches and it suggests a size. Between two sizes, choose the larger.' },
    { q: 'Do you take bulk orders?', a: 'Yes. On any product page, tap “Ask for a bulk price” to message us on WhatsApp for a bulk price and delivery time.' },
    { q: 'Which brands do you sell?', a: 'Our own range plus partner brands such as Biosash, Atomy, Weavers Villa, Leather Factory, Taj Leather and Ansari Fashion, each at its own prices.', link: { to: '/brands', label: 'Our brands' } },
    { q: 'Can I reorder something I bought before?', a: 'Yes. In My Orders, “Buy it again” puts the items that are still in stock back in your bag.', link: { to: '/account/orders', label: 'My Orders' } },
    { q: 'How do I delete my account?', a: 'Ask us on WhatsApp or by email from the number or address on your account; we confirm it is you and delete it within 30 days.', link: { to: '/delete-account', label: 'Delete your account' } },
    { q: 'How do I save products for later?', a: 'Tap the heart on any product. Your wishlist also tells you when a saved product’s price has dropped.', link: { to: '/wishlist', label: 'Wishlist' } },
  ] }),
]);

/** The topics and questions matching a search (question or answer text), empty topics dropped. Pure. */
export function filterHelp(topics, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return topics;
  return topics
    .map((t) => ({ ...t, items: t.items.filter((i) => { const hay = `${i.q} ${i.a}`.toLowerCase(); return words.every((w) => hay.includes(w)); }) }))
    .filter((t) => t.items.length);
}

/** schema.org FAQPage for the questions. Pure. */
export function faqLd(topics) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: topics.flatMap((t) => t.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}
