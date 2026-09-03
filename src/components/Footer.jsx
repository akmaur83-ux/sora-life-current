import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { categories } from '../data/categories.js';
import { branding } from '../lib/settings.js';
import { companyInfo, socialLinks, telHref } from '../lib/company.js';

// ============================================================
// Footer.
//
// RULE FOR THIS FILE: every link goes somewhere real, and every line is
// something the business has actually configured. No placeholders.
//
// The information architecture below intentionally contains only real routes.
// Optional contact/social details are sanitized and render only when an admin
// has configured them. The trust row states operational facts implemented by
// server pricing, checkout and customer order history — not marketing claims.
// ============================================================
export default function Footer() {
  const info = companyInfo();
  const socials = socialLinks(info);
  const name = branding?.siteName || 'SORA LIFE';

  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Logo light />
            <p>A marketplace for wellness, personal care and everyday essentials.</p>
            {(info.email || info.phone) && (
              <div className="ftr__contact" aria-label="Store contact details">
                {info.email && <a href={`mailto:${info.email}`}>{info.email}</a>}
                {info.phone && <a href={telHref(info.phone)}>{info.phone}</a>}
              </div>
            )}
            {socials.length > 0 && (
              <div className="ftr__social" aria-label="Official social profiles">
                {socials.map((social) => (
                  <a key={social.key} href={social.url} target="_blank" rel="noopener noreferrer nofollow"
                    aria-label={social.label} className="ftr__social-link">
                    <Icon name={social.icon} size={17} stroke={1.6} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="ftr__col">
            <h4>Shop</h4>
            <Link to="/shop">All products</Link>
            {categories.slice(0, 3).map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`}>{c.name}</Link>
            ))}
          </div>

          <div className="ftr__col">
            <h4>Account</h4>
            <Link to="/account">My account</Link>
            <Link to="/account/orders">Orders</Link>
            <Link to="/wishlist">Wishlist</Link>
          </div>

          <div className="ftr__col">
            <h4>Company</h4>
            <Link to="/about">About {name}</Link>
            <Link to="/contact">Contact &amp; help</Link>
            <Link to="/account/creator">Creator Program</Link>
          </div>

          <div className="ftr__col">
            <h4>Legal</h4>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/shipping">Shipping</Link>
            <Link to="/returns">Returns &amp; refunds</Link>
          </div>
        </div>

        <div className="ftr__trust">
          <span><Icon name="lock" size={17} /> Secure checkout</span>
          <span><Icon name="truck" size={17} /> Free standard shipping</span>
          <span><Icon name="package" size={17} /> Order tracking in your account</span>
        </div>

        <div className="ftr__bottom">
          <p>© {new Date().getFullYear()} {info.legalName || name}.</p>
          <div className="ftr__legal">
            <Link to="/admin/login" className="ftr__admin-link">Admin Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
