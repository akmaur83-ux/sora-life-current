import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { deliveryWindow } from '../../lib/deliveryEstimate.js';

// The estimated arrival dates in the buy box (deliveryEstimate.js has the rule).
// Rendered after mount, so a server render or a page left open past midnight
// never shows a stale date.
export default function PdpDeliveryDate({ className = '' }) {
  const [win, setWin] = useState(null);
  useEffect(() => { setWin(deliveryWindow(new Date())); }, []);
  if (!win) return null;
  return (
    <p className={`pdpk-eta ${className}`.trim()}>
      <Icon name="truck" size={16} />
      <span>FREE delivery <b>{win.label}</b><em>Estimated delivery date</em></span>
    </p>
  );
}
