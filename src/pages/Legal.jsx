import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { branding } from '../lib/settings.js';
import { companyInfo, policyParagraphs, hasContactChannel, telHref } from '../lib/company.js';

// Shipping remains on its existing, unchanged policy path.
// Privacy, terms and returns are rendered by EditableLegal.

const SHIPPING_METHODS = [
  { name: 'Standard', fee: '₹0', note: 'Free on every order, at any basket value.' },
  { name: 'Express', fee: '₹79', note: 'A flat charge, added at checkout.' },
  { name: 'Scheduled', fee: '₹49', note: 'A flat charge for the Scheduled option at checkout.' },
];

// key -> { title, blurb, facts[], ownerLabel, showContact }
function documents(name) {
  return {
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
