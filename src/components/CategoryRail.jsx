import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { categories } from '../data/categories.js';

// V2 category navigation — sharp rectangular tiles, thin rule, no pills and no
// circular bubbles. Orientation only: no prices, no counts, no merchandising.
// Reads the live `categories` list; hidden entirely below three categories.
export default function CategoryRail() {
  const items = Array.isArray(categories) ? categories.filter((c) => c && c.slug && c.name) : [];
  if (items.length < 3) return null;

  return (
    <nav className="v2-rail v2-cats" aria-label="Shop by category">
      {items.map((c) => (
        <Link key={c.slug} to={`/category/${c.slug}`} className="v2-cat">
          <span className="v2-cat__tile" aria-hidden="true">
            <Icon name={c.icon || 'leaf'} size={23} stroke={1.5} />
          </span>
          <span className="v2-cat__lb">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}
