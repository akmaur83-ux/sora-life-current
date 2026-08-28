import { useId, useState } from 'react';
import Icon from '../Icon.jsx';
import { offersFor } from '../../data/pdpContent.js';

// ============================================================
// PDP offer teaser — the visual entry point for the Part 2 coupon system.
//
// Collapsed: a single premium row ("Offers & payment benefits · View").
// Expanded: a short list of offer rows. The first rows are REAL store-wide
// policy; any row with `real:false` is an explicit "coming soon" stub.
//
// No coupon codes, no discount math, nothing wired into cart/checkout.
// Part 2 replaces offersFor() + this panel body with the real coupon list.
// ============================================================
export default function ProductOfferTeaser({ product }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const offers = offersFor(product);

  return (
    <div className={`pdp-offers ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="pdp-offers__bar"
        aria-expanded={open}
        aria-controls={uid}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pdp-offers__lead">
          <Icon name="tag" size={18} />
          <span>
            <strong>Offers &amp; payment benefits</strong>
            <em>Save more at checkout</em>
          </span>
        </span>
        <span className="pdp-offers__toggle">
          {open ? 'Hide' : 'View'}
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
        </span>
      </button>

      <div id={uid} className="pdp-offers__panel" hidden={!open}>
        <ul className="pdp-offers__list">
          {offers.map((o) => (
            <li key={o.title} className="pdp-offers__row" data-preview={o.real ? undefined : 'true'}>
              <Icon name={o.icon} size={17} />
              <span>
                <strong>{o.title}</strong>
                <em>{o.note}</em>
              </span>
              {!o.real && <span className="pdp-offers__soon">Soon</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
