import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { branding } from '../lib/settings.js';
import { companyInfo, policyParagraphs, hasContactChannel, telHref } from '../lib/company.js';

// ============================================================
// LEGAL / POLICY SURFACES — Privacy, Terms, Shipping, Returns
//
// One component, four documents. The hard rule: this file states only what the
// platform PROVABLY does, and never invents a legal commitment.
//
// Two content sources per document:
//   1. FACTS — operational truths derived from how the app actually behaves
//      (server-verified pricing, Razorpay, the real shipping fees, the data an
//      account stores). These are always shown and are safe by construction.
//   2. OWNER TEXT — the store operator's own policy prose, pasted in Admin →
//      Settings and stored in `contact.policies`. Shown verbatim when present.
//
// What this file deliberately does NOT contain: return windows, refund
// timelines, cancellation guarantees, exchange terms, serviceable areas or
// firm delivery dates. None of those are knowable from code, so they are
// omitted unless the store operator supplies approved policy text.
//
// SHIPPING FEES ARE AUTHORITATIVE: Standard ₹0, Express ₹79, Scheduled ₹49,
// with NO order-value free-shipping threshold. These mirror DELIVERY_FEES in
// api/_lib/pricing.js exactly (asserted by the shipping test).
// ============================================================

const SHIPPING_METHODS = [
  { name: 'Standard', fee: '₹0', note: 'Free on every order, at any basket value.' },
  { name: 'Express', fee: '₹79', note: 'A flat charge, added at checkout.' },
  { name: 'Scheduled', fee: '₹49', note: 'A flat charge for the Scheduled option at checkout.' },
];

// key -> { title, blurb, facts[], ownerLabel, showContact }
function documents(name) {
  return {
    privacy: {
      title: 'Privacy Policy',
      blurb: `How ${name} handles the information you share when you use the store.`,
      facts: [
        { heading: 'What an account stores',
          body: `When you create an account, ${name} keeps your email, any delivery addresses you save, your order history and your wishlist so they are available when you sign in.` },
        { heading: 'What an order records',
          body: 'To fulfil an order we store the delivery details you enter at checkout — name, contact number, address — alongside the order itself. Your order total is calculated on our server.' },
        { heading: 'Payments',
          body: 'Card and online payments are processed by Razorpay. Sora Life never sees or stores your full card details — only the confirmation Razorpay returns for your order.' },
        { heading: 'On this device',
          body: 'Your cart and, for guests, your wishlist are kept in your browser so they persist between visits. A referral link may store a creator attribution identifier in your browser; it holds no personal information.' },
      ],
      ownerLabel: 'privacy',
      showContact: true,
    },
    terms: {
      title: 'Terms & Conditions',
      blurb: `The basis on which you use ${name} and place orders.`,
      facts: [
        { heading: 'Prices and totals',
          body: 'Product prices, discounts, delivery charges and the final payable amount are recalculated on our server at checkout. The amount confirmed there is the amount you are charged.' },
        { heading: 'Placing an order',
          body: 'An order is created once you submit it and is confirmed once payment is completed, or recorded when you choose cash on delivery. Availability is subject to stock at the time of purchase.' },
        { heading: 'Your account',
          body: 'You are responsible for keeping your sign-in details secure. Products, prices and availability are managed by the store and may change.' },
        { heading: 'Creator Program',
          body: (
            <>Participation in the <Link to="/account/creator">Creator Program</Link> is governed by
              the terms presented within the program itself.</>
          ) },
      ],
      ownerLabel: 'terms',
      showContact: true,
    },
    shipping: {
      title: 'Shipping Policy',
      blurb: 'The delivery options offered at checkout, and what each costs.',
      methods: SHIPPING_METHODS,
      facts: [
        { heading: 'Delivery charges',
          body: 'Each method carries the flat charge shown above, applied at checkout regardless of order value. There is no minimum-order threshold for free shipping — Standard delivery is free on every order.' },
        { heading: 'Delivery estimates',
          body: 'Checkout presents the current delivery options and may show an estimated window before payment. No fixed delivery timeline is promised on this page.' },
        { heading: 'Cash on delivery',
          body: 'Cash on delivery is available at checkout where eligible for your order.' },
        { heading: 'Tracking',
          body: (
            <>Once an order ships, its status — and a tracking link, when the seller provides one —
              appears in <Link to="/account/orders">your orders</Link>.</>
          ) },
      ],
      ownerLabel: 'shipping',
      showContact: true,
    },
    returns: {
      title: 'Returns, Refunds & Cancellation',
      blurb: 'How to raise an issue with an order.',
      facts: [
        { heading: 'Raising a request',
          body: (
            <>If something is wrong with an order, contact the store with your order number — you
              can find it in <Link to="/account/orders">your orders</Link> or on your{' '}
              <Link to="/passport">Purchase Passport</Link>. The store will confirm how your request
              is handled.</>
          ) },
        { heading: 'Order status',
          body: 'Every order shows its current status in your account, so you can see where it stands before and after raising a request.' },
      ],
      ownerLabel: 'returns',
      showContact: true,
      // Formal return windows, refund timing and cancellation terms are the
      // store operator's to define. They remain absent until approved.
    },
  };
}

export default function Legal({ doc }) {
  const name = branding?.siteName || 'SORA LIFE';
  const info = companyInfo();
  const spec = documents(name)[doc];
  if (!spec) return null;

  const ownerText = policyParagraphs(info, spec.ownerLabel);
  const canContact = hasContactChannel(info);

  return (
    <div className="info info--legal">
      <div className="v2-wrap info-legal__wrap">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>{spec.title}</strong>
        </nav>

        <header className="info-hero info-hero--legal">
          <h1 className="info-title info-title--legal">{spec.title}</h1>
          <p className="info-lede">{spec.blurb}</p>
        </header>

        {spec.methods && (
          <div className="info-ship" role="table" aria-label="Delivery options and charges">
            <div className="info-ship__row info-ship__row--head" role="row">
              <span role="columnheader">Method</span>
              <span role="columnheader">Charge</span>
              <span role="columnheader">Notes</span>
            </div>
            {spec.methods.map((m) => (
              <div className="info-ship__row" role="row" key={m.name}>
                <span role="cell" className="info-ship__name">{m.name}</span>
                <span role="cell" className="info-ship__fee">{m.fee}</span>
                <span role="cell" className="info-ship__note">{m.note}</span>
              </div>
            ))}
          </div>
        )}

        <div className="info-legal">
          {spec.facts.map((f) => (
            <section className="info-legal__block" key={f.heading}>
              <h2 className="info-legal__h">{f.heading}</h2>
              <p className="info-legal__p">{f.body}</p>
            </section>
          ))}

          {ownerText.length > 0 ? (
            <section className="info-legal__block info-legal__owner">
              <h2 className="info-legal__h">Full policy</h2>
              <div className="info-legal__copy">
                {ownerText.map((para, i) => (
                  <p className="info-legal__p" key={i}>{para}</p>
                ))}
              </div>
            </section>
          ) : null}

          {spec.showContact && (
            <section className="info-legal__block info-legal__contact">
              <h2 className="info-legal__h">Questions about this?</h2>
              <p className="info-legal__p">
                {canContact
                  ? <>See the <Link to="/contact">Contact &amp; help</Link> page for the store&apos;s
                      published contact channels and support hours, when available.</>
                  : <>Visit <Link to="/contact">Contact &amp; help</Link> for available support and
                      order-tracking options.</>}
              </p>
              {(info.legalName || info.address) && (
                <p className="info-legal__p">
                  {info.legalName && <><strong>Business:</strong> {info.legalName}</>}
                  {info.legalName && info.address && <br />}
                  {info.address && <><strong>Published address:</strong> <span className="info-address">{info.address}</span></>}
                </p>
              )}
              {info.email && (
                <p className="info-legal__p">
                  <a href={`mailto:${info.email}`} className="info-legal__mail">{info.email}</a>
                  {info.phone && <> · <a href={telHref(info.phone)} className="info-legal__mail">{info.phone}</a></>}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
