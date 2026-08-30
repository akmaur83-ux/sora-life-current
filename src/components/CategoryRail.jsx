import { Link } from 'react-router-dom';
import { categories } from '../data/categories.js';

const CATEGORY_IMAGES = {
  wellness: '/public/category-images/wellness.webp',
  'body-building': '/public/category-images/body-building.webp',
  'juices-drinks': '/public/category-images/juices-drinks.webp',
  supplements: '/public/category-images/supplements.webp',
  'skin-care': '/public/category-images/skin-care.webp',
  'hair-care': '/public/category-images/hair-care.webp',
  'bath-body': '/public/category-images/bath-body.webp',
  'mens-care': '/public/category-images/mens-care.webp',
  'personal-care': '/public/category-images/personal-care.webp',
};

const CATEGORY_MARKS = {
  wellness: <><path d="M16 28V12M16 22C6 23 5 17 5 14c7-1 11 3 11 8ZM16 17c8 0 11-5 11-10-7 0-11 4-11 10Z" /><circle cx="10" cy="7" r="2" /></>,
  'body-building': <><path d="m10 22 12-12M6 18l8 8M18 6l8 8M4 20l8 8M20 4l8 8M4 24l4 4M24 4l4 4" /></>,
  'juices-drinks': <><path d="M10 4h7v5l3 4v15H7V13l3-4V4ZM10 8h7M7 17h13M10 21h7" /></>,
  supplements: <><path d="m7 15 8-8a6 6 0 0 1 9 9l-8 8a6 6 0 0 1-9-9ZM11 11l9 9" /></>,
  'skin-care': <><path d="M6 16h20v12H6V16ZM8 12h16v4H8V12ZM10 21h12" /></>,
  'hair-care': <><path d="M5 5h9v21H5V5ZM9 9h5M9 13h5M9 17h5M9 21h5" /></>,
  'bath-body': <><rect x="5" y="14" width="23" height="14" rx="2" /><path d="M9 19c4-4 10 4 15 0" /></>,
  'mens-care': <><path d="M7 5h19v7H7V5ZM10 8h13M12 12v5h9v-5" /></>,
  'personal-care': <><path d="M5 12h11l-2 16H7L5 12ZM8 8h5v4" /></>,
};

function CategoryMark({ category }) {
  const mark = CATEGORY_MARKS[category.slug];

  if (!mark) {
    return (
      <span className="v2-cat__initials">
        {category.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('')}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mark}
    </svg>
  );
}

export default function CategoryRail() {
  const items = Array.isArray(categories)
    ? categories.filter((c) => c && c.slug && c.name)
    : [];

  if (items.length < 3) return null;

  const renderCategory = (c, duplicate = false) => {
    const image = CATEGORY_IMAGES[c.slug];

    return (
      <Link
        key={`${duplicate ? 'duplicate-' : ''}${c.slug}`}
        to={`/category/${c.slug}`}
        className={`v2-cat v2-cat--${c.slug}`}
        aria-hidden={duplicate ? 'true' : undefined}
        tabIndex={duplicate ? -1 : undefined}
      >
        <span className="v2-cat__visual" aria-hidden="true">
          <span className="v2-cat__tile">
            <CategoryMark category={c} />
          </span>

          {image && (
            <img
              className="v2-cat__photo"
              src={image}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </span>

        <span className="v2-cat__lb">{c.name}</span>
      </Link>
    );
  };

  return (
    <nav className="v2-cats-marquee" aria-label="Shop by category">
      <div className="v2-cats-track">
        <div className="v2-cats-set">
          {items.map((c) => renderCategory(c))}
        </div>

        <div className="v2-cats-set" aria-hidden="true">
          {items.map((c) => renderCategory(c, true))}
        </div>
      </div>
    </nav>
  );
}