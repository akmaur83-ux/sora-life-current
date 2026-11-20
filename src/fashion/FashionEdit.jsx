import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { FASHION_EDITS, useFashionEdit } from '../lib/fashionEdits.js';
import { usePageMeta } from '../lib/pageMeta.js';
import SkeletonGrid from '../components/Skeleton.jsx';

// /fashion/winter and /fashion/leather (round 12, 2026-11-20) — fashionEdits.js has what
// is shown and why. The same page as the Wedding edit, with the edit's own sections.
export default function FashionEdit({ id }) {
  const edit = FASHION_EDITS[id];
  const sections = useFashionEdit(id);
  const { hash } = useLocation();
  // A link to one section (e.g. /fashion/leather#leather-bags) lands on it once the sections are in.
  useEffect(() => {
    if (!sections || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [sections, hash]);
  usePageMeta({ title: edit ? edit.title : 'Fashion', description: edit?.meta, path: edit?.path });
  if (!edit) return null;
  return (
    <div className="hx hx-wed">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/fashion">Fashion</Link> <Icon name="chevronRight" size={12} /> <span>{edit.title}</span></nav>
        <header className="hx-wed__hero">
          <p className="hx-wed__eyebrow">{edit.eyebrow}</p>
          <h1 className="hx-offers__h">{edit.title}</h1>
          <p className="hx-offers__lede">{edit.lede}</p>
          {edit.care && <p className="hx-offers__lede"><Link to="/guides/leather-care" className="sora-origin__care">How to care for leather <Icon name="arrowRight" size={13} /></Link></p>}
          {sections && sections.length > 1 && (
            <ul className="hx-wed__jump">
              {sections.map((s) => <li key={s.id}><a href={`#${id}-${s.id}`}>{s.title}</a></li>)}
            </ul>
          )}
        </header>
        {sections === null ? <SkeletonGrid label="Loading the edit…" />
          : sections.length === 0 ? <p className="hx-offers__empty">The edit is being put together. <Link to="/fashion">Browse Fashion</Link></p>
            : sections.map((s) => (
              <section key={s.id} className="hx-wed__sec" id={`${id}-${s.id}`} aria-labelledby={`${id}-${s.id}-h`}>
                <div className="hx-wed__head">
                  <div><h2 id={`${id}-${s.id}-h`}>{s.title}</h2><p>{s.note}</p></div>
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

/** The Fashion home's ways in to the edits: winter and leather, side by side. */
export function EditStrips() {
  return (
    <div className="sora-editstrips fs-sec">
      <Link to="/fashion/winter" className="hx-wedstrip">
        <span><em>Winter is here</em><b>The Winter edit</b><i>Leather jackets and coats, shawls, stoles, mufflers and caps</i></span>
        <span className="hx-wedstrip__go">Explore <Icon name="arrowRight" size={16} /></span>
      </Link>
      <Link to="/fashion/leather" className="hx-wedstrip">
        <span><em>The leather store</em><b>Everything leather</b><i>Jackets, coats, bags, wallets and belts from our leather makers</i></span>
        <span className="hx-wedstrip__go">Explore <Icon name="arrowRight" size={16} /></span>
      </Link>
    </div>
  );
}
