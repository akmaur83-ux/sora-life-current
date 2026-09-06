import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useLegalPage } from '../lib/legalPagesApi.js';
import { hasLegalContent } from '../lib/legalPages.js';
import { LegalUpdated } from '../components/LegalPageContent.jsx';
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

function HelpLink({ to, title, note }) {
  return (
    <Link to={to} className="info-more__link">
      <span><strong>{title}</strong><em>{note}</em></span>
      <Icon name="arrowRight" size={16} stroke={1.7} />
    </Link>
  );
}

export default function Contact() {
  const { page } = useLegalPage('contact');
  const info = companyInfo({ ...page, social: companyInfo().social });
  const populated = hasLegalContent('contact', page);
  const channels = hasContactChannel(info);
  const publishedDetails = channels || Boolean(info.legalName || info.hours);
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
          <h1 className="info-title">{page.title || 'Contact & help'}</h1>
          {populated && page.intro && <p className="info-lede">{page.intro}</p>}
          <LegalUpdated page={page}/>
          {!populated && <p className="info-lede">Information for this page will be available soon.</p>}
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
              {info.hours && (
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
            {(page.faqs || []).map((item) => (
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
