import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { HELP_TOPICS, filterHelp, faqLd } from '../lib/helpFaq.js';
import { useConsumerCare } from '../lib/consumerCare.js';
import { waNumber } from '../components/SiteAssist.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// /help — Help & FAQ (helpFaq.js has the answers and where they come from).
export default function Help() {
  const [q, setQ] = useState('');
  const care = useConsumerCare();
  usePageMeta({ title: 'Help & FAQ', description: 'Answers on delivery, tracking, returns, payments, coupons, sizes and bulk orders at SORA LIFESTYLE.', path: '/help' });
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json'; el.dataset.faq = '1';
    el.textContent = JSON.stringify(faqLd(HELP_TOPICS));
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  const topics = filterHelp(HELP_TOPICS, q);
  const n = waNumber(care?.phone);
  return (
    <div className="hx hx-help">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Help &amp; FAQ</span></nav>
        <h1 className="hx-offers__h">Help &amp; FAQ</h1>
        <p className="hx-offers__lede">Quick answers on orders, delivery, returns and shopping with us.</p>
        <label className="hx-help__search">
          <Icon name="search" size={18} />
          <span className="hx-help__sr">Search the help pages</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. delivery, coupon, size" />
        </label>
        <div className="hx-help__topics">
          {topics.map((t) => (
            <section key={t.id} className="hx-help__topic" aria-labelledby={`hx-help-${t.id}`}>
              <h2 id={`hx-help-${t.id}`}>{t.title}</h2>
              {t.items.map((i) => (
                <details key={i.q} className="hx-help__qa" open={Boolean(q)}>
                  <summary>{i.q}<Icon name="chevronDown" size={16} /></summary>
                  <p>{i.a}{i.link && <> <Link to={i.link.to}>{i.link.label} <Icon name="arrowRight" size={13} /></Link></>}</p>
                </details>
              ))}
            </section>
          ))}
          {!topics.length && <p className="hx-offers__empty">No answer matches that. Ask us directly below.</p>}
        </div>
        <div className="hx-help__ask">
          <div><b>Still need help?</b><span>{care?.hours ? `We’re here ${care.hours}.` : 'We’re happy to help.'}</span></div>
          <div className="hx-help__ask-go">
            {n && <a href={`https://wa.me/${n}?text=${encodeURIComponent('Hi SORA Lifestyle, I need some help.')}`} target="_blank" rel="noopener noreferrer" className="hx-offers__btn hx-offers__btn--wa"><Icon name="chat" size={16} /> WhatsApp us</a>}
            <Link to="/contact" className="hx-offers__btn">Contact &amp; help</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
