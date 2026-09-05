import Icon from '../Icon.jsx';
import { howToUseFor } from '../../data/pdpContent.js';

// ============================================================
// "How to use" — the product's own directions.
//
// Numbered steps when the catalogue carries them, a single paragraph when a
// hand-edited row still holds one string. Renders ONLY real data: no generic
// "read the pack / storage / safety" filler, and nothing at all when the
// product has no directions.
// ============================================================
export default function ProductHowToUse({ product }) {
  const { text, steps } = howToUseFor(product);
  if (!text && !steps.length) return null;

  return (
    <section className="pdp-sec pdp-howto" aria-labelledby="pdp-howto-h">
      <h2 id="pdp-howto-h" className="pdp-sec__title serif">How to use</h2>
      {steps.length ? (
        <ol className="pdp-howto__steps">
          {steps.map((s) => (
            <li key={s.step} className="pdp-howto__step">
              <span className="pdp-howto__num" aria-hidden="true">{s.step}</span>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="pdp-howto__body">
          <span className="pdp-howto__ic"><Icon name="droplet" size={20} /></span>
          <p className="pdp-howto__text">{text}</p>
        </div>
      )}
    </section>
  );
}
