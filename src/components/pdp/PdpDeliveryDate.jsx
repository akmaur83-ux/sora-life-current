import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { deliveryWindow } from '../../lib/deliveryEstimate.js';
import { PdpNotifyMe } from './PdpEngage.jsx';
import { useStorefrontSection } from '../../lib/storefrontSections.js';
import { OFFER_COUNTDOWN, parseIndiaTime, timeLeft } from '../../lib/offerCountdown.js';
import { useConsumerCare } from '../../lib/consumerCare.js';
import { waLink } from '../SiteAssist.jsx';

/** "Questions? Ask us on WhatsApp" with this product named (SiteAssist.waLink); nothing without a number. */
function AskWhatsApp({ productName }) {
  const care = useConsumerCare();
  const [href, setHref] = useState('');
  useEffect(() => { setHref(waLink(care?.phone, window.location.pathname, productName, window.location.href.split('#')[0])); }, [care?.phone, productName]);
  if (!href) return null;
  return (
    <a className="pdpk-ask" href={href} target="_blank" rel="noopener noreferrer">
      <Icon name="chat" size={16} /> Questions about this product? <b>Ask us on WhatsApp</b>
    </a>
  );
}

/** The admin's offer line with the time left (offerCountdown.js); nothing once it ends. */
function OfferCountdown() {
  const o = useStorefrontSection('wellness', 'offerCountdown', OFFER_COUNTDOWN);
  const [now, setNow] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const end = parseIndiaTime(o.endsAt);
  const left = now == null ? '' : timeLeft(end - now);
  if (o.hidden || !left) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(o.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard off */ } };
  return (
    <p className="pdpk-offer" role="note">
      <Icon name="tag" size={16} />
      <span>{o.title} {o.code && <button type="button" className="pdpk-offer__code" onClick={copy} aria-label={`Copy code ${o.code}`}>{copied ? 'Copied' : o.code}</button>}<em>Ends in <b>{left}</b></em></span>
    </p>
  );
}

// The buy box's delivery line (deliveryEstimate.js has the rule): the estimated
// arrival dates while the item can be bought; "Notify me when it is back" while it
// is out of stock (PdpEngage.jsx). Rendered after mount, so a server render or a
// page left open past midnight never shows a stale date.
export default function PdpDeliveryDate({ className = '', out = false, productKey = '', productName = '', choice = '' }) {
  const [win, setWin] = useState(null);
  useEffect(() => { setWin(deliveryWindow(new Date())); }, []);
  // "Free Size · As shown" says nothing to a customer: only a real size or colour is named.
  const named = String(choice || '').split('·').map((x) => x.trim()).filter((x) => x && !/^(free size|one size|as shown)$/i.test(x)).join(' · ');
  if (out) return <><PdpNotifyMe productKey={productKey} productName={productName} choice={named} /><AskWhatsApp productName={productName} /></>;
  if (!win) return null;
  return (
    <>
    <OfferCountdown />
    <p className={`pdpk-eta ${className}`.trim()}>
      <Icon name="truck" size={16} />
      <span>FREE delivery <b>{win.label}</b><em>Estimated delivery date</em></span>
    </p>
    <AskWhatsApp productName={productName} />
    </>
  );
}
