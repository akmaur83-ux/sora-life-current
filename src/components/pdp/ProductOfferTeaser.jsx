import { useId, useState } from 'react';
import Icon from '../Icon.jsx';
import { offersFor } from '../../data/pdpContent.js';
import { promosForPlacement } from '../../lib/promotions.js';
import PromoCopyCode from '../promo/PromoCopyCode.jsx';

// ============================================================
// PDP offer teaser — the entry point into the promotions system (Part 2).
//
// Collapsed: a single premium row ("Offers & payment benefits · View").
// Expanded:
//   • real store-wide policy rows (free shipping / COD) — always shown
//   • active PDP promotions (title + short copy + copyable code) when any
//     exist; otherwise a "coming soon" line.
//
// DISPLAY ONLY. Codes are copyable, never auto-applied. No total changes.
// ============================================================
export default function ProductOfferTeaser({ product }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const staticRows = offersFor(product).filter((o) => o.real); // keep only the real policy rows
  const staticTitles = new Set(staticRows.map((o) => o.title.trim().toLowerCase()));
  // Don't repeat a promo that just restates a policy row already shown above.
  const promos = promosForPlacement('pdp').filter((p) => !staticTitles.has(p.title.trim().toLowerCase()));

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
            <em>{promos.length ? `${promos.length} offer${promos.length > 1 ? 's' : ''} available` : 'Save more at checkout'}</em>
          </span>
        </span>
        <span className="pdp-offers__toggle">
          {open ? 'Hide' : 'View'}
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
        </span>
      </button>

      <div id={uid} className="pdp-offers__panel" hidden={!open}>
        <ul className="pdp-offers__list">
          {staticRows.map((o) => (
            <li key={o.title} className="pdp-offers__row">
              <Icon name={o.icon} size={17} />
              <span>
                <strong>{o.title}</strong>
                <em>{o.note}</em>
              </span>
            </li>
          ))}

          {promos.length > 0 ? (
            promos.map((p) => (
              <li key={p.id} className="pdp-offers__row pdp-offers__row--promo">
                <Icon name={p.badgeText === 'Free shipping' ? 'truck' : 'gift'} size={17} />
                <span>
                  <strong>{p.title}</strong>
                  {p.subtitle && <em>{p.subtitle}</em>}
                  {p.couponCode && <PromoCopyCode code={p.couponCode} className="pdp-offers__code" />}
                </span>
              </li>
            ))
          ) : (
            <li className="pdp-offers__row" data-preview="true">
              <Icon name="tag" size={17} />
              <span>
                <strong>Coupons &amp; bank offers</strong>
                <em>Promo codes and card offers are added by the store.</em>
              </span>
              <span className="pdp-offers__soon">Soon</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
