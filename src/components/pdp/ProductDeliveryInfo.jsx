import Icon from '../Icon.jsx';
import { money } from '../../lib/format.js';
import { deliveryEstimate } from '../../data/pdpContent.js';

// ============================================================
// Compact delivery / service panel for the buying section.
//
//   Delivery timing confirmed at checkout
//   FREE delivery on orders above ₹699
//   Available delivery methods shown at checkout
//
// Presentation-safe: no carrier date or geographic scope is guessed. If real
// PIN/SLA logic is added later, deliveryEstimate() is the single display seam.
// ============================================================
export default function ProductDeliveryInfo({ product }) {
  const est = deliveryEstimate();
  return (
    <div className="pdp-deliver" aria-label="Delivery information">
      <div className="pdp-deliver__row">
        <Icon name="truck" size={18} />
        <span>
          <strong>Delivery timing</strong>
          <em>{est.range} · {est.days}</em>
        </span>
      </div>
      <div className="pdp-deliver__row">
        <Icon name="gift" size={18} />
        <span>
          <strong>Free shipping</strong> on orders above {money(est.freeThreshold, product?.currency)}
          <em>Applied automatically when the order qualifies</em>
        </span>
      </div>
      <div className="pdp-deliver__row">
        <Icon name="package" size={18} />
        <span>
          <strong>Delivery methods</strong>
          <em>Available options are shown at checkout</em>
        </span>
      </div>
    </div>
  );
}
