import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { branding } from '../lib/settings.js';
import { companyInfo, policyParagraphs, hasContactChannel, telHref } from '../lib/company.js';

// Shipping remains on its existing, unchanged policy path.
// Privacy, terms and returns are rendered by EditableLegal.

const SHIPPING_METHODS = [
  {
    name: 'Standard',
    fee: '₹0',
    note: 'Free on every eligible order. Delivery time depends on location and courier serviceability.',
  },
];

// key -> { title, blurb, facts[], ownerLabel, showContact }
function documents(name) {
  return {
    shipping: {
  title: 'Shipping Policy',
  blurb: 'How SORA LIFE dispatches and delivers eligible orders across India.',
  methods: SHIPPING_METHODS,
  facts: [
    {
      heading: 'Shipping coverage',
      body: 'SORA LIFE ships eligible orders across India, subject to product availability, courier serviceability and applicable delivery restrictions.',
    },
    {
      heading: 'Dispatch time',
      body: 'Orders are ordinarily dispatched within 2–3 business days after successful order confirmation. Dispatch may take longer during public holidays, unusually high order volumes or circumstances outside our reasonable control.',
    },
    {
      heading: 'Standard delivery',
      body: 'Standard delivery is free on eligible orders and generally takes approximately 6–7 business days. Actual delivery time depends on the customer’s location, courier serviceability and the movement of the shipment after dispatch.',
    },
    {
      heading: 'Delivery estimates',
      body: 'Delivery timelines are estimates and are not guaranteed delivery dates. Weather, public holidays, carrier delays, remote locations, operational disruptions and other circumstances outside our reasonable control may result in additional delivery time.',
    },
    {
      heading: 'Delivery details',
      body: 'Customers are responsible for providing a complete and accurate delivery address, PIN code and contact information. Incorrect or incomplete information may delay delivery.',
    },
    {
      heading: 'Tracking',
      body: (
        <>Once an order ships, its latest status — and a tracking link when tracking information is available —
          appears in <Link to="/account/orders">your orders</Link>.</>
      ),
    },
  ],
  ownerLabel: null,
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
