import Icon from '../Icon.jsx';
import { deliveryEstimate, deliveryOptions } from '../../data/pdpContent.js';
import { money } from '../../lib/format.js';

// ============================================================
// Delivery panel for the buying section.
//
// Shows the three methods the customer can actually pick, with the fee each
// one actually costs. The previous version said only "Free standard shipping"
// and "options shown at checkout", which left the customer to discover the
// Express and Scheduled fees at the payment step.
//
// The fee is FLAT at every basket size, so nothing here may imply a
// free-shipping threshold — there isn't one. Standard is free because Standard
// is free, not because a basket reached some amount. api/_lib/pricing.js
// decides what is actually charged; deliveryOptions() is the display seam.
//
// Timing is still deferred to checkout: the PDP has no address and no carrier
// response, so a date promised here would be invented.
// ============================================================
export default function ProductDeliveryInfo() {
  const est = deliveryEstimate();
  const options = deliveryOptions();

  return (
    <div className="pdp-deliver" aria-label="Delivery information">
      <div className="pdp-deliver__head">
        <Icon name="truck" size={16} />
        <span>
          <strong>Delivery</strong>
          <em>{est.range} · {est.days}</em>
        </span>
      </div>
      <ul className="pdp-deliver__methods">
        {options.map((o) => (
          <li key={o.id} className="pdp-deliver__method">
            <span className="pdp-deliver__label">{o.label}</span>
            <span className="pdp-deliver__eta">{o.eta}</span>
            <span className={`pdp-deliver__fee ${o.price === 0 ? 'is-free' : ''}`}>
              {o.price === 0 ? 'Free' : money(o.price)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
