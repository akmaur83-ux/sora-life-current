import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { deliveryWindow } from '../../lib/deliveryEstimate.js';
import { PdpNotifyMe } from './PdpEngage.jsx';

// The buy box's delivery line (deliveryEstimate.js has the rule): the estimated
// arrival dates while the item can be bought; "Notify me when it is back" while it
// is out of stock (PdpEngage.jsx). Rendered after mount, so a server render or a
// page left open past midnight never shows a stale date.
export default function PdpDeliveryDate({ className = '', out = false, productKey = '', productName = '', choice = '' }) {
  const [win, setWin] = useState(null);
  useEffect(() => { setWin(deliveryWindow(new Date())); }, []);
  // "Free Size · As shown" says nothing to a customer: only a real size or colour is named.
  const named = String(choice || '').split('·').map((x) => x.trim()).filter((x) => x && !/^(free size|one size|as shown)$/i.test(x)).join(' · ');
  if (out) return <PdpNotifyMe productKey={productKey} productName={productName} choice={named} />;
  if (!win) return null;
  return (
    <p className={`pdpk-eta ${className}`.trim()}>
      <Icon name="truck" size={16} />
      <span>FREE delivery <b>{win.label}</b><em>Estimated delivery date</em></span>
    </p>
  );
}
