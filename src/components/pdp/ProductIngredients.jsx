import Icon from '../Icon.jsx';
import { ingredientsFor } from '../../data/pdpContent.js';

// ============================================================
// "Key ingredients" — real product.ingredients ONLY.
//
// If the catalogue has no ingredient data for this product the section
// renders nothing (no hero card, no guessed botanical). A single real
// ingredient gets a full-width card rather than a half-empty grid.
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
            <span className="pdp-ingredients__ic"><Icon name="leaf" size={20} /></span>
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
