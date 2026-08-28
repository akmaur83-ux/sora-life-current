import Icon from '../Icon.jsx';
import { TRUST_ITEMS } from '../../data/pdpContent.js';

// ============================================================
// Trust / assurance strip. Every line mirrors a promise the store already
// makes elsewhere (announcement bar, footer, current PDP copy) — no new
// policy is invented here. Compact icon + title + one-line description.
// ============================================================
export default function ProductTrustList() {
  return (
    <section className="pdp-sec pdp-trust" aria-labelledby="pdp-trust-h">
      <h2 id="pdp-trust-h" className="pdp-sec__title serif">The SORA LIFE promise</h2>
      <ul className="pdp-trust__list">
        {TRUST_ITEMS.map(([icon, title, desc]) => (
          <li key={title} className="pdp-trust__item">
            <span className="pdp-trust__ic"><Icon name={icon} size={20} /></span>
            <span className="pdp-trust__txt">
              <strong>{title}</strong>
              <em>{desc}</em>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
