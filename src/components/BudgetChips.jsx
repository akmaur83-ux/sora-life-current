import { Link } from 'react-router-dom';

// ============================================================
// "Shop by budget" on the Fashion and Home & Living homes (owner, 2026-11-09:
// more features): four price bands, each opening the store's whole range filtered
// to it (the listings' own ?price= filter: FASHION_PRICE_BANDS / PRICE_BANDS).
// ============================================================
export const BUDGETS = Object.freeze([
  { id: 'under-500', top: 'Under', amount: '₹499' },
  { id: '500-999', top: 'Under', amount: '₹999' },
  { id: '1000-1999', top: 'Under', amount: '₹1,999' },
  { id: '2000-plus', top: 'Premium', amount: '₹2,000+' },
]);

export default function BudgetChips({ base, title = 'Shop by budget', wrap = '' }) {
  return (
    <section className={`hx-budget${wrap ? ` ${wrap}` : ''}`} aria-labelledby={`hx-budget-${base.replace(/\W+/g, '')}`}>
      <h2 className="hx-budget__h" id={`hx-budget-${base.replace(/\W+/g, '')}`}>{title}</h2>
      <ul className="hx-budget__row">
        {BUDGETS.map((b) => (
          <li key={b.id}>
            <Link to={`${base}?price=${b.id}`} className="hx-budget__chip">
              <span>{b.top}</span><b>{b.amount}</b>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
