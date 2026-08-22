import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductCard from './ProductCard.jsx';
import Reveal from './Reveal.jsx';

export default function ProductRail({ eyebrow, title, description, products, link, linkLabel = 'View all', limit = 4 }) {
  const items = products.slice(0, limit);
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="sec-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 className="sec-title serif" style={{ marginTop: 8 }}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {link && <Link to={link} className="sec-link">{linkLabel} <Icon name="arrowRight" size={17} /></Link>}
        </div>
        <div className="rail">
          {items.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}><ProductCard product={p} /></Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
