import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { branding } from '../lib/settings.js';
import { companyInfo, hasContactChannel, telHref, socialLinks } from '../lib/company.js';

// ============================================================
// CONTACT / HELP
//
// NO CONTACT FORM. The platform has no general-purpose contact-submission
// backend (the only real inbound endpoint is the newsletter), and shipping a
// form that silently drops messages would be a lie. Instead this page surfaces
// the contact channels an admin has actually configured, plus the real
// self-service help that already exists (order tracking, account, creator).
//
// Every channel renders ONLY when its value is set and valid. With nothing
// configured, the page still stands on its own — the help links and the FAQ
// are always true — and simply shows no phone/email/address block.
//
// The FAQ answers are operational facts, each pointing at the feature that
// makes it true. None of them invents a policy, a timeline or a guarantee.
// ============================================================

const FAQS = [
  {
    q: 'How do I track my order?',
    a: (
      <>Open <Link to="/account/orders">your orders</Link> to see each order&apos;s verified
        status. When the seller adds a tracking link, a “Track shipment” button appears there.
        You can also look up a single order from the{' '}
        <Link to="/passport">Purchase Passport</Link> page using its order number and email.</>
    ),
  },
  {
    q: 'Do I need an account to buy?',
    a: (
      <>You can check out as a guest. Creating an <Link to="/account">account</Link> keeps your
        order history, saved addresses and <Link to="/wishlist">wishlist</Link> together and
        lets you reorder more easily.</>
    ),
  },
  {
    q: 'What are the delivery options and charges?',
    a: (
      <>Standard, Express and Scheduled delivery are offered, each with its own charge. The
        current options and any delivery estimate are shown at checkout before you pay. See the{' '}
        <Link to="/shipping">Shipping page</Link> for the full breakdown.</>
    ),
  },
  {
    q: 'How is my payment handled?',
    a: (
      <>Your order total is recalculated on our server before payment, and online payments are
        processed by Razorpay — Sora Life does not receive or store your full card details. Cash
        on delivery is also presented as a payment option at checkout.</>
    ),
  },
  {
    q: 'What is the Creator Program?',
    a: (
      <>It lets you share products you believe in and follow your attribution and application
        status from your account. Start from{' '}
        <Link to="/account/creator">the Creator Program</Link>.</>
    ),
  },
];

function HelpLink({ to, title, note }) {
  return (
    <Link to={to} className="info-more__link">
      <span><strong>{title}</strong><em>{note}</em></span>
      <Icon name="arrowRight" size={16} stroke={1.7} />
    </Link>
  );
}

export default function Contact() {
  const name = branding?.siteName || 'SORA LIFE';
  const info = companyInfo();
  const channels = hasContactChannel(info);
  const publishedDetails = channels || Boolean(info.legalName);
  const socials = socialLinks(info);

  return (
    <div className="info info--contact">
      <div className="v2-wrap">
        <nav className="v2-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chevronRight" size={12} stroke={1.7} />
          <strong>Contact &amp; help</strong>
        </nav>

        <header className="info-hero">
          <p className="info-eyebrow">Contact &amp; help</p>
          <h1 className="info-title">We&apos;re here to help.</h1>
          <p className="info-lede">
            {channels
              ? <>Find quick answers below, track an order from your account, or reach {name} through the published contact channels.</>
              : <>Find quick answers below, track an order, or use the available account and programme support tools.</>}
          </p>
        </header>

        {publishedDetails && (
          <section className="info-sec" aria-labelledby="contact-reach">
            <div className="info-sechead">
              <h2 id="contact-reach" className="info-h2">Reach us</h2>
            </div>
            <div className="info-channels">
              {info.legalName && (
                <div className="info-channel info-channel--static">
                  <span className="info-channel__ic"><Icon name="package" size={20} stroke={1.5} /></span>
                  <span className="info-channel__body">
                    <span className="info-channel__label">Business name</span>
                    <span className="info-channel__value">{info.legalName}</span>
                  </span>
                </div>
              )}
              {info.email && (
                <a className="info-channel" href={`mailto:${info.email}`}>
                  <span className="info-channel__ic"><Icon name="mail" size={20} stroke={1.5} /></span>
                  <span className="info-channel__body">
                    <span className="info-channel__label">Email</span>
                    <span className="info-channel__value">{info.email}</span>
                  </span>
                </a>
              )}
              {info.phone && (
                <a className="info-channel" href={telHref(info.phone)}>
                  <span className="info-channel__ic"><Icon name="phone" size={20} stroke={1.5} /></span>
                  <span className="info-channel__body">
                    <span className="info-channel__label">Phone</span>
                    <span className="info-channel__value">{info.phone}</span>
                  </span>
                </a>
              )}
              {info.address && (
                <div className="info-channel info-channel--static">
                  <span className="info-channel__ic"><Icon name="mapPin" size={20} stroke={1.5} /></span>
                  <span className="info-channel__body">
                    <span className="info-channel__label">Address</span>
                    <span className="info-channel__value info-channel__value--multiline">{info.address}</span>
                  </span>
                </div>
              )}
              {info.hours && channels && (
                <div className="info-channel info-channel--static">
                  <span className="info-channel__ic"><Icon name="clock" size={20} stroke={1.5} /></span>
                  <span className="info-channel__body">
                    <span className="info-channel__label">Support hours</span>
                    <span className="info-channel__value">{info.hours}</span>
                  </span>
                </div>
              )}
            </div>
            {socials.length > 0 && (
              <div className="info-social">
                {socials.map((s) => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                    className="info-social__link" aria-label={s.label}>
                    <Icon name={s.icon} size={18} stroke={1.6} /> <span>{s.label}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="info-sec" aria-labelledby="contact-self">
          <div className="info-sechead">
            <h2 id="contact-self" className="info-h2">Self-service</h2>
            <p className="info-sub">Order, account and programme tools available on the platform.</p>
          </div>
          <nav className="info-more" aria-label="Help links">
            <HelpLink to="/account/orders" title="Track an order" note="Status and tracking in your account" />
            <HelpLink to="/passport" title="Purchase Passport" note="Look up one order by number and email" />
            <HelpLink to="/account" title="Your account" note="Orders, addresses and profile" />
            <HelpLink to="/wishlist" title="Wishlist" note="Products you have saved" />
            <HelpLink to="/account/creator" title="Creator Program" note="Join and track your status" />
            <HelpLink to="/shipping" title="Shipping" note="Delivery options and charges" />
          </nav>
        </section>

        <section className="info-sec" aria-labelledby="contact-faq">
          <div className="info-sechead">
            <h2 id="contact-faq" className="info-h2">Common questions</h2>
          </div>
          <div className="info-faq">
            {FAQS.map((item) => (
              <details key={item.q} className="info-faq__item">
                <summary className="info-faq__q">
                  <span>{item.q}</span>
                  <Icon name="chevronDown" size={16} stroke={1.8} />
                </summary>
                <div className="info-faq__a">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
