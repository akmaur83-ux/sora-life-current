import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { usePageMeta } from '../lib/pageMeta.js';
import { products } from '../data/products.js';
import SkeletonGrid from '../components/Skeleton.jsx';
import PageShare from '../components/PageShare.jsx';
import { RECIPIENTS, BUDGETS, inBudget, budgetCounts, useGiftCards } from '../lib/giftFinder.js';

// /gifts — the gift finder (round 13, 2026-11-20); giftFinder.js has the rules.
export default function Gifts() {
  const [params, setParams] = useSearchParams();
  const who = RECIPIENTS.some((r) => r.id === params.get('for')) ? params.get('for') : 'her';
  const budget = BUDGETS.some((b) => b.id === params.get('budget')) ? params.get('budget') : '';
  const cards = useGiftCards(who, products);
  const counts = cards ? budgetCounts(cards) : {};
  const shown = cards ? inBudget(cards, budget) : [];
  const set = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k === 'for') p.delete('budget'); setParams(p, { replace: true }); };
  usePageMeta({ title: 'Gift finder', description: 'Find a gift by who it is for and what you want to spend: shawls, wallets, leather, home and wellness gifts at SORA LIFESTYLE.', path: '/gifts' });
  return (
    <div className="hx hx-wed sora-gifts">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Gift finder</span></nav>
        <header className="hx-wed__hero">
          <p className="hx-wed__eyebrow">Gifting season</p>
          <h1 className="hx-offers__h">Find a gift</h1>
          <p className="hx-offers__lede">Who is it for, and what would you like to spend? Everything shown is in stock today.</p>
          {/* Send these gift ideas, choices included (round 15, 2026-11-20). */}
          <PageShare title={`Gift ideas ${(RECIPIENTS.find((r) => r.id === who) || {}).label?.toLowerCase() || ''}${budget ? `, ${(BUDGETS.find((b) => b.id === budget) || {}).label}` : ''}`} />
        </header>
        <div className="sora-gifts__pick" role="group" aria-label="Who is it for">
          {RECIPIENTS.map((r) => <button key={r.id} type="button" aria-pressed={who === r.id} className={`hx-offers__chip${who === r.id ? ' is-on' : ''}`} onClick={() => set('for', r.id)}>{r.label}</button>)}
        </div>
        <div className="sora-gifts__pick" role="group" aria-label="Budget">
          <button type="button" aria-pressed={!budget} className={`hx-offers__chip${!budget ? ' is-on' : ''}`} onClick={() => set('budget', '')}>Any budget</button>
          {BUDGETS.map((b) => (
            <button key={b.id} type="button" aria-pressed={budget === b.id} disabled={cards && !counts[b.id]} className={`hx-offers__chip${budget === b.id ? ' is-on' : ''}`} onClick={() => set('budget', b.id)}>
              {b.label}{cards ? <em>{counts[b.id] || 0}</em> : null}
            </button>
          ))}
        </div>
        {cards === null ? <SkeletonGrid label="Finding gifts…" />
          : shown.length === 0 ? <p className="hx-offers__empty">Nothing in this budget right now. Try another budget, or <Link to="/hamper">build a hamper</Link>.</p>
            : (
              <>
                <p className="sora-gifts__count" role="status">{shown.length < (budget ? counts[budget] : cards.length) ? `The ${shown.length} lowest-priced of ${budget ? counts[budget] : cards.length}` : `${shown.length} gift${shown.length === 1 ? '' : 's'}`}, lowest price first</p>
                <ul className="hx-offers__grid">
                  {shown.map((c, i) => (
                    <li key={c.key}>
                      <Link to={c.href} className="hx-deals__card">
                        <span className="hx-deals__img"><img src={c.image} alt="" width="300" height="300" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" /></span>
                        <span className="hx-deals__name">{c.name}</span>
                        <span className="hx-deals__price"><b>{money(c.price)}</b></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
        <p className="sora-gifts__more">Want several things in one box? <Link to="/hamper">Build a hamper</Link> · Ordering many? <Link to="/sell#bulk">Bulk &amp; corporate gifting</Link></p>
      </div>
    </div>
  );
}
