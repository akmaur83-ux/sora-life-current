import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useWeddingEdit } from '../lib/weddingEdit.js';
import { usePageMeta } from '../lib/pageMeta.js';

// /fashion/wedding — the Wedding & Festive edit (weddingEdit.js has what is shown and why).
export default function WeddingEdit() {
  const sections = useWeddingEdit();
  usePageMeta({ title: 'Wedding & festive edit', description: 'Banarasi suits and sarees, dupattas and shawls, clutches, men’s leather jackets and wedding gifts at SORA LIFESTYLE.', path: '/fashion/wedding' });
  return (
    <div className="hx hx-wed">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/fashion">Fashion</Link> <Icon name="chevronRight" size={12} /> <span>Wedding &amp; festive edit</span></nav>
        <header className="hx-wed__hero">
          <p className="hx-wed__eyebrow">Shaadi season</p>
          <h1 className="hx-offers__h">The Wedding &amp; Festive edit</h1>
          <p className="hx-offers__lede">Everything for the functions in one place: outfits, drapes, bags, something for him, and gifts for the couple.</p>
          {sections && sections.length > 1 && (
            <ul className="hx-wed__jump">
              {sections.map((s) => <li key={s.id}><a href={`#wed-${s.id}`}>{s.title}</a></li>)}
            </ul>
          )}
        </header>
        {sections === null ? <p className="hx-offers__empty" role="status">Loading the edit…</p>
          : sections.length === 0 ? <p className="hx-offers__empty">The edit is being put together. <Link to="/fashion">Browse Fashion</Link></p>
            : sections.map((s) => (
              <section key={s.id} className="hx-wed__sec" id={`wed-${s.id}`} aria-labelledby={`wed-${s.id}-h`}>
                <div className="hx-wed__head">
                  <div><h2 id={`wed-${s.id}-h`}>{s.title}</h2><p>{s.note}</p></div>
                  <Link to={s.href} className="hx-wed__all">View all <Icon name="arrowRight" size={15} /></Link>
                </div>
                <ul className="hx-offers__grid">
                  {s.items.map((c, i) => (
                    <li key={c.key}>
                      <Link to={c.href} className="hx-deals__card">
                        <span className="hx-deals__img">{c.image && <img src={c.image} alt="" width="300" height="300" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />}</span>
                        <span className="hx-deals__name">{c.name}</span>
                        <span className="hx-deals__price"><b>{money(c.price)}</b></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
      </div>
    </div>
  );
}

/** The Fashion home's way in to the edit. */
export function WeddingStrip() {
  return (
    <Link to="/fashion/wedding" className="hx-wedstrip fs-sec">
      <span><em>Shaadi season</em><b>The Wedding &amp; Festive edit</b><i>Suits, sarees, shawls, clutches, jackets for him and gifts, in one place</i></span>
      <span className="hx-wedstrip__go">Explore <Icon name="arrowRight" size={16} /></span>
    </Link>
  );
}
