import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { useStore } from '../../lib/store.jsx';

// ============================================================
// Coupon "ticket" — a compact perforated code chip with a copy action.
//
//     USE CODE
//     ┆ SORAWELCOME ┆ [Copy]
//
//   • The code is always plain visible text — never revealed only on hover.
//   • The button is a real <button> (keyboard + screen-reader operable),
//     >=44px tall on the poster, with an aria-live success confirmation.
//   • `label` renders the small "USE CODE" caption (posters); omit it in
//     tight rows (offer cards, PDP drawer).
//
// The code is DISPLAY ONLY — copying it applies no discount anywhere.
// ============================================================
export default function PromoCopyCode({ code, label = null, className = '' }) {
  const { toast } = useStore();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!code) return null;

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast(`Code ${code} copied`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1900);
    } catch {
      toast('Could not copy — long-press the code to copy it');
    }
  };

  return (
    <span className={`promo-code ${copied ? 'is-copied' : ''} ${className}`}>
      {label && <span className="promo-code__label">{label}</span>}
      <span className="promo-code__row">
        <code className="promo-code__value">{code}</code>
        <button
          type="button"
          className="promo-code__btn"
          onClick={copy}
          aria-label={copied ? `Coupon code ${code} copied` : `Copy coupon code ${code}`}
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          <span aria-hidden="true">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </span>
      <span className="sr-only" aria-live="polite">{copied ? `${code} copied to clipboard` : ''}</span>
    </span>
  );
}
