import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { categories } from '../data/categories.js';
import { contact } from '../lib/settings.js';

// ============================================================
// Footer.
//
// RULE FOR THIS FILE: every link goes somewhere real, and every line is
// something the business has actually configured. No placeholders.
//
// The following were REMOVED rather than left as href="#". A link that
// silently does nothing is worse than an absent one, and none of these
// claims were backed by data the storefront holds:
//
//   social icons (Instagram / Facebook / Twitter)  no accounts configured
//   Shipping & returns                             no policy text supplied
//   Contact us                                     replaced by the real
//                                                  contact row below
//   Clean ingredients / Sustainability /
//   Cruelty-free / Journal / About Sora Life       no page content supplied
//   Privacy / Terms / Cookies                      no legal text supplied
//   "Clean, transparent formulas"                  unverifiable claim
//   "Dermatologist & lab tested"                   no certification on record
//   "Carbon-neutral delivery"                      no such programme exists
//   "Easy 15-day returns"                          no returns policy defined
//   "A demo storefront - placeholder products
//    for design preview."                          untrue in production
//
// The trust row now states only operational facts that are true by
// construction: shipping options and payment security are implemented in
// api/_lib/pricing.js and the Razorpay flow; order tracking exists in the
// account area.
//
// The contact row renders ONLY when an admin has set a phone or email in
// Settings, so it can never show an empty promise. To restore any removed
// entry, supply the real destination or the real business fact first.
// ============================================================
export default function Footer() {
  const email = typeof contact?.email === 'string' ? contact.email.trim() : '';
  const phone = typeof contact?.phone === 'string' ? contact.phone.trim() : '';
  const hasContact = Boolean(email || phone);

  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Logo light />
            <p>Modern wellness, beauty and everyday care — delivered to your door.</p>
          </div>

          <div className="ftr__col">
            <h4>Shop</h4>
            {categories.slice(0, 6).map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`}>{c.name}</Link>
            ))}
            <Link to="/shop">All products</Link>
          </div>

          <div className="ftr__col">
            <h4>Care</h4>
            <Link to="/account">My account</Link>
            <Link to="/account">Track my order</Link>
            <Link to="/cart">My cart</Link>
            <Link to="/wishlist">Wishlist</Link>
          </div>

          {hasContact && (
            <div className="ftr__col">
              <h4>Contact</h4>
              {email && <a href={`mailto:${email}`}>{email}</a>}
              {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>}
            </div>
          )}
        </div>

        <div className="ftr__trust">
          <span><Icon name="lock" size={17} /> Secure checkout</span>
          <span><Icon name="truck" size={17} /> Free standard shipping</span>
          <span><Icon name="package" size={17} /> Order tracking in your account</span>
        </div>

        <div className="ftr__bottom">
          <p>© {new Date().getFullYear()} Sora Life.</p>
          <div className="ftr__legal">
            <Link to="/admin/login" className="ftr__admin-link">Admin Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
