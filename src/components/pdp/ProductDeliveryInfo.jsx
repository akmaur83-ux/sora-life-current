import { useState } from 'react';
import Icon from '../Icon.jsx';
import { deliveryEstimate, deliveryOptions } from '../../data/pdpContent.js';
import { money } from '../../lib/format.js';

// ============================================================
// Delivery panel for the buying section.
//
// The pincode field is deliberately HONEST about what it knows. Sora Life has
// no serviceability table and no carrier API, so checking a pincode cannot
// return a date — and inventing "Arrives Tuesday" for a pincode nobody has
// checked is the kind of promise a customer holds you to. What it does is
// confirm the code is well formed and repeat the real, method-based estimate
// against it. The moment a serviceability source exists, this is the one place
// that has to change.
//
// The three fees are flat at every basket size. Nothing here may imply a
// free-shipping threshold, because there isn't one: Standard is free because
// Standard is free. api/_lib/pricing.js decides what is actually charged.
// ============================================================
const PIN = /^[1-9][0-9]{5}$/;

export default function ProductDeliveryInfo() {
  const est = deliveryEstimate();
  const options = deliveryOptions();
  const [pin, setPin] = useState('');
  const [checked, setChecked] = useState(null);

  const check = (e) => {
    e.preventDefault();
    if (!PIN.test(pin)) {
      setChecked({ ok: false, message: 'Enter a valid 6-digit pincode.' });
      return;
    }
    setChecked({
      ok: true,
      message: `Delivering to ${pin}. ${options[0].eta} on Standard; faster methods are shown at checkout.`,
    });
  };

  return (
    <div className="pdp-deliver" aria-label="Delivery information">
      <div className="pdp-deliver__head">
        <Icon name="truck" size={16} />
        <span>
          <strong>Delivery</strong>
          <em>{est.range} · {est.days}</em>
        </span>
      </div>

      <form className="pdp-deliver__pin" onSubmit={check}>
        <label className="sr-only" htmlFor="pdp-pin">Delivery pincode</label>
        <input
          id="pdp-pin"
          className="pdp-deliver__pininput"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Enter pincode"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setChecked(null); }}
        />
        <button type="submit" className="pdp-deliver__pinbtn" disabled={pin.length !== 6}>Check</button>
      </form>
      {checked && (
        <p className={`pdp-deliver__pinmsg ${checked.ok ? 'is-ok' : 'is-bad'}`} role="status">
          {checked.message}
        </p>
      )}

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
