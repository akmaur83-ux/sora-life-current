import { Link } from 'react-router-dom';
import { categories } from '../data/categories.js';

// Homepage-only line illustrations. These identify category types, never
// product ingredients, benefits or certifications. The live category list
// remains the sole source of names, ordering and links.
const CATEGORY_MARKS = {
  wellness: <><path d="M16 28V12M16 22C6 23 5 17 5 14c7-1 11 3 11 8ZM16 17c8 0 11-5 11-10-7 0-11 4-11 10Z" /><circle cx="10" cy="7" r="2" /></>,
  'body-building': <><path d="m10 22 12-12M6 18l8 8M18 6l8 8M4 20l8 8M20 4l8 8M4 24l4 4M24 4l4 4" /></>,
  'juices-drinks': <><path d="M10 4h7v5l3 4v15H7V13l3-4V4ZM10 8h7M7 17h13M10 21h7" /><path d="M25 15a6 6 0 0 1 0 12M25 15v12m0-6 4-4m-4 4 4 4" /></>,
  supplements: <><path d="m7 15 8-8a6 6 0 0 1 9 9l-8 8a6 6 0 0 1-9-9ZM11 11l9 9M18 8l3 1" /><circle cx="25" cy="26" r="1.5" /></>,
  'skin-care': <><path d="M6 16h20v12H6V16ZM8 12h16v4H8V12ZM10 21h12M19 6c0 2-1 3-3 3s-3-1-3-3l3-4 3 4Z" /></>,
  'hair-care': <><path d="M5 5h9v21H5V5ZM9 9h5M9 13h5M9 17h5M9 21h5M21 4c-6 8 10 11 3 24M26 5c-3 5 6 11 3 17" /></>,
  'bath-body': <><rect x="5" y="14" width="23" height="14" rx="2" /><path d="M9 19c4-4 10 4 15 0M9 24h14" /><circle cx="10" cy="8" r="3" /><circle cx="21" cy="6" r="2" /></>,
  'mens-care': <><path d="M7 5h19v7H7V5ZM10 8h13M12 12v5h9v-5M15 17l-2 11h6l2-11" /></>,
  'personal-care': <><path d="M5 12h11l-2 16H7L5 12ZM8 8h5v4M23 28V7h5V4h-5v3M23 10h5M23 13h5M23 16h5M8 18h5" /></>,
};

function CategoryMark({ category }) {
  const mark = CATEGORY_MARKS[category.slug];
  // An unrecognised future category gets its own name-derived monogram,
  // not a repeated generic leaf or an invented category.
  if (!mark) return <span className="v2-cat__initials">{category.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('')}</span>;
  return <svg viewBox="0 0 32 32" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">{mark}</svg>;
}

// Reads the live list; hidden entirely below three categories. The desktop
// tile dimensions stay unchanged while using the same distinct category marks.
export default function CategoryRail() {
  const items = Array.isArray(categories) ? categories.filter((c) => c && c.slug && c.name) : [];
  if (items.length < 3) return null;

  return (
    <nav className="v2-rail v2-cats" aria-label="Shop by category">
      {items.map((c) => (
        <Link key={c.slug} to={`/category/${c.slug}`} className={`v2-cat v2-cat--${c.slug}`}>
          <span className="v2-cat__tile" aria-hidden="true">
            <CategoryMark category={c} />
          </span>
          <span className="v2-cat__lb">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}
