import Icon from '../Icon.jsx';
import { money } from '../../lib/format.js';
import { deliveryEstimate } from '../../data/pdpContent.js';

// ============================================================
// Compact delivery / service panel for the buying section.
//
//   Get it by <date range>
//   FREE delivery on orders above ₹699
//   Delivering to India · Change
//
// Presentation-safe: the date window is derived client-side from "today"
// (deliveryEstimate). No carrier API, no real-time promise, no PIN logic —
// "Change" points at checkout where the real estimate is confirmed, exactly
// as the previous copy said. If real PIN/SLA logic is added later, only
// deliveryEstimate() and the "Change" target need to change.
// ============================================================
export default function ProductDeliveryInfo({ product }) {
  const est = deliveryEstimate();
  return (
    <div className="pdp-deliver" aria-label="Delivery information">
      <div className="pdp-deliver__row">
        <Icon name="truck" size={18} />
        <span>
          Get it by <strong>{est.range}</strong>
          <em>Typically {est.days} after dispatch</em>
        </span>
      </div>
      <div className="pdp-deliver__row">
        <Icon name="gift" size={18} />
        <span>
          <strong>FREE delivery</strong> on orders above {money(est.freeThreshold, product?.currency)}
          <em>Standard shipping, all across {est.place}</em>
        </span>
      </div>
      <div className="pdp-deliver__row">
        <Icon name="mapPin" size={18} />
        <span>
          Delivering to <strong>{est.place}</strong>
          <em>Enter your PIN code at checkout for an exact date</em>
        </span>
      </div>
    </div>
  );
}
