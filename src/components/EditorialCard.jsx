import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

// V2 editorial card — the brand talking, not a product tile.
//
// Content is admin-configured only (settings.homepage.editorials). Nothing is
// authored in this component, so an unconfigured store renders no editorial
// section at all rather than inventing marketing copy.
//
// Expected item shape:
//   { id, kicker, title, note, href, image }
// `image` is optional: without one the card falls back to the warm neutral
// ground rather than borrowing unrelated product art.
export default function EditorialCard({ item }) {
  if (!item || !item.title || !item.href) return null;
  const { kicker, title, note, href, image, alt } = item;

  return (
    <Link to={href} className="v2-ed">
      <div className="v2-ed__media">
        <div className="v2-pimg">
          {image && <img src={image} alt={alt || ''} loading="lazy" decoding="async" />}
        </div>
        <span className="v2-ed__scrim" aria-hidden="true" />
      </div>
      <div className="v2-ed__ui">
        <div>
          {kicker && <p className="v2-ed__k">{kicker}</p>}
          <h3 className="v2-ed__h">{title}</h3>
          {note && <p className="v2-ed__note">{note}</p>}
        </div>
        <span className="v2-ed__cta">
          Shop now <Icon name="arrowRight" size={11} stroke={1.8} />
        </span>
      </div>
    </Link>
  );
}
