import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useConsumerCare } from '../lib/consumerCare.js';
import { waNumber } from '../components/SiteAssist.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// /delete-account (2026-11-13: the SORA app on Google Play). Play requires a web
// page where anyone with an account can ask for it and its data to be deleted,
// app installed or not. A request goes to customer care (WhatsApp or email, the
// published channels), who confirm it is the account holder and delete it. This
// page deletes nothing by itself; nothing in sign-in or payment changes.
// ============================================================
export const DELETE_TEXT = 'Hi SORA Lifestyle, please delete my SORA LIFESTYLE account and its personal data. My account email / phone: ';

export function deleteLinks(care) {
  const n = waNumber(care?.phone);
  const email = String(care?.email || '').trim();
  return {
    wa: n ? `https://wa.me/${n}?text=${encodeURIComponent(DELETE_TEXT)}` : '',
    mail: email ? `mailto:${email}?subject=${encodeURIComponent('Delete my SORA LIFESTYLE account')}&body=${encodeURIComponent(DELETE_TEXT)}` : '',
    email,
  };
}

export default function DeleteAccount() {
  const care = useConsumerCare();
  const { wa, mail, email } = deleteLinks(care);
  usePageMeta({ title: 'Delete your account', description: 'How to ask SORA LIFESTYLE to delete your account and personal data.', path: '/delete-account' });
  return (
    <div className="hx hx-help">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Delete your account</span></nav>
        <h1 className="hx-offers__h">Delete your SORA LIFESTYLE account</h1>
        <p className="hx-offers__lede">This applies to accounts made on www.soralifestyle.in and in the SORA LIFESTYLE app: they are the same account.</p>
        <div className="hx-help__topics">
          <section className="hx-help__topic" aria-labelledby="hx-del-how">
            <h2 id="hx-del-how">How to ask</h2>
            <p className="hx-del__p">Send us a request from the WhatsApp number or email address on your account, saying which email or phone number you signed up with. We confirm it is your account before deleting anything.</p>
            <div className="hx-help__ask-go">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="hx-offers__btn hx-offers__btn--wa"><Icon name="chat" size={16} /> Request on WhatsApp</a>}
              {mail && <a href={mail} className="hx-offers__btn"><Icon name="mail" size={16} /> Request by email</a>}
            </div>
            {email && <p className="hx-del__p hx-del__small">Or write to <b>{email}</b> with the subject “Delete my SORA LIFESTYLE account”.</p>}
          </section>
          <section className="hx-help__topic" aria-labelledby="hx-del-what">
            <h2 id="hx-del-what">What is deleted</h2>
            <ul className="hx-del__list">
              <li>Your account and sign-in</li>
              <li>Your name, phone number, email address and saved addresses</li>
              <li>Your wishlist and saved preferences</li>
            </ul>
          </section>
          <section className="hx-help__topic" aria-labelledby="hx-del-kept">
            <h2 id="hx-del-kept">What is kept, and for how long</h2>
            <p className="hx-del__p">Records of orders you placed (invoices, payment and delivery records) are kept only for as long as tax and accounting law requires, and are not used for anything else. Read more in our <Link to="/privacy">Privacy Policy</Link>.</p>
          </section>
          <section className="hx-help__topic" aria-labelledby="hx-del-when">
            <h2 id="hx-del-when">How long it takes</h2>
            <p className="hx-del__p">We act on a confirmed request within 30 days and tell you when it is done. An order still being delivered or returned is completed first.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
