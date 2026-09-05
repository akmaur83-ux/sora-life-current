import Icon from '../Icon.jsx';
import { ingredientsFor } from '../../data/pdpContent.js';

// ============================================================
// "Key ingredients" — real product.ingredients ONLY.
//
// Small cards: name, one line where the catalogue has one, and a thumbnail
// where a real image exists. Every image_url reaching this component has
// already been checked by the ingest — a URL that did not serve an image was
// nulled there — so the leaf mark below is the ONLY fallback and no ingredient
// can render a broken tile.
//
// If the catalogue has no ingredient data the section renders nothing: no
// hero card, no guessed botanical.
// ============================================================
export default function ProductIngredients({ product }) {
  const { items } = ingredientsFor(product);
  if (!items.length) return null;

  return (
    <section className="pdp-sec pdp-ingredients" aria-labelledby="pdp-ingredients-h">
      <h2 id="pdp-ingredients-h" className="pdp-sec__title serif">Key ingredients</h2>
      <ul className={`pdp-ingredients__list ${items.length === 1 ? 'is-single' : ''}`}>
        {items.map((ing) => (
          <li key={ing.name} className="pdp-ingredients__card">
            <span className="pdp-ingredients__ic">
              {ing.image
                ? <img src={ing.image} alt="" loading="lazy" decoding="async" />
                : <Icon name="leaf" size={18} />}
            </span>
            <div className="pdp-ingredients__body">
              <strong>{ing.name}</strong>
              {ing.note && <p>{ing.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
