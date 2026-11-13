import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { useNewArrivals } from '../lib/newArrivals.js';
import LoadMore, { useShowMore } from '../components/LoadMore.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// /new — every product flagged new, across wellness, fashion and Home & Living,
// newest first (2026-11-13: new features). The homepage row shows twelve; this is
// all of them, filterable by store. The same flag and rule as the row (newArrivals.js).
// ============================================================
export const NEW_PAGE_LIMIT = 400;
export const NEW_STORES = [
  { id: 'all', label: 'All' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'homeliving', label: 'Home & Living' },
];

export default function NewArrivalsPage() {
  const [params, setParams] = useSearchParams();
  const store = NEW_STORES.some((s) => s.id === params.get('store')) ? params.get('store') : 'all';
  const all = useNewArrivals(NEW_PAGE_LIMIT);
  const list = (all || []).filter((c) => store === 'all' || c.store === store);
  const paging = useShowMore(list.length, store);
  usePageMeta({ title: 'New arrivals', description: 'The newest products at SORA LIFESTYLE across wellness, fashion and home.', path: '/new' });
  const counts = Object.fromEntries(NEW_STORES.map((s) => [s.id, s.id === 'all' ? (all || []).length : (all || []).filter((c) => c.store === s.id).length]));
  const pick = (id) => { const next = new URLSearchParams(params); if (id === 'all') next.delete('store'); else next.set('store', id); setParams(next, { replace: true }); };
  return (
    <div className="hx hx-offers">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>New arrivals</span></nav>
        <h1 className="hx-offers__h">New arrivals</h1>
        <p className="hx-offers__lede">Just landed across wellness, fashion and home, newest first.</p>
        <div className="hx-offers__tabs" role="tablist" aria-label="Store">
          {NEW_STORES.filter((s) => s.id === 'all' || s.id === store || !all || counts[s.id] > 0).map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={store === s.id} className={`hx-offers__tab${store === s.id ? ' is-on' : ''}`} onClick={() => pick(s.id)}>
              {s.label}{all ? <em>{counts[s.id]}</em> : null}
            </button>
          ))}
        </div>
        {all === null ? <p className="hx-offers__empty" role="status">Loading the new arrivals…</p>
          : list.length === 0 ? <p className="hx-offers__empty">Nothing new here this week. New pieces appear the moment they go live.</p>
            : (
              <>
                <ul className="hx-offers__grid">
                  {list.slice(0, paging.shown).map((c, i) => (
                    <li key={c.key}>
                      <Link to={c.href} className="hx-deals__card">
                        <span className="hx-deals__img">
                          {c.image && <img src={c.image} alt="" width="300" height="300" loading={i < 8 ? 'eager' : 'lazy'} decoding="async" />}
                          <b className="hx-deals__pct hx-new__tag">New</b>
                        </span>
                        <span className="hx-deals__name">{c.name}</span>
                        <span className="hx-deals__price"><b>{money(c.price)}</b></span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <LoadMore shown={paging.shown} total={list.length} onMore={paging.more} />
              </>
            )}
      </div>
    </div>
  );
}
