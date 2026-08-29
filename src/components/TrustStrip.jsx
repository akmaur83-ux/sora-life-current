import Icon from './Icon.jsx';
import { money } from '../lib/format.js';
import { announcement } from '../lib/settings.js';

// V2 trust strip.
//
// Deliberately minimal: every line here is an operational fact about how the
// store works, or is derived from a real admin setting. No health, purity,
// certification, sourcing or delivery-speed claims are made, because none of
// those are verifiable from data the storefront holds. Replace or extend via
// the `items` prop once the business confirms what it will stand behind.
function defaultItems() {
  const out = [
    { icon: 'lock', title: 'Secure checkout', sub: 'Encrypted payments' },
  ];

  const threshold = Number(announcement.freeShippingThreshold);
  if (Number.isFinite(threshold) && threshold > 0) {
    out.push({ icon: 'truck', title: 'Free shipping', sub: `On orders above ${money(threshold)}` });
  }

  out.push(
    { icon: 'package', title: 'Order tracking', sub: 'In your account' },
    { icon: 'chat', title: 'Help & support', sub: 'Get in touch' },
  );
  return out;
}

export default function TrustStrip({ items }) {
  const list = (Array.isArray(items) && items.length ? items : defaultItems()).slice(0, 4);
  if (!list.length) return null;

  return (
    <ul className="v2-trust">
      {list.map((it) => (
        <li className="v2-trust__it" key={it.title}>
          <Icon name={it.icon} size={19} stroke={1.5} />
          <span>
            <span className="v2-trust__t">{it.title}</span>
            {it.sub && <span className="v2-trust__s">{it.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
