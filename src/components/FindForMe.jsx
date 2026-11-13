import Icon from './Icon.jsx';
import { useConsumerCare } from '../lib/consumerCare.js';
import { waNumber } from './SiteAssist.jsx';

// ============================================================
// "Can't find it? We'll look for you" (2026-11-13: new features). Under a search
// that found nothing (Fashion, Home & Living), a WhatsApp message to customer care
// with the search already in it, so a shopper who wanted something specific asks
// instead of leaving. Nothing is shown without a published care number.
// ============================================================
export const findText = (q) => `Hi SORA Lifestyle, I searched for “${String(q || '').trim()}” on your site and couldn’t find it. Can you help me find it?`;

export default function FindForMe({ q, className = '' }) {
  const care = useConsumerCare();
  const n = waNumber(care?.phone);
  if (!n || !String(q || '').trim()) return null;
  return (
    <div className={`hx-find${className ? ` ${className}` : ''}`}>
      <p><b>Can’t find it?</b> Tell us what you’re looking for and we’ll check with our makers.</p>
      <a href={`https://wa.me/${n}?text=${encodeURIComponent(findText(q))}`} target="_blank" rel="noopener noreferrer" className="hx-find__go">
        <Icon name="chat" size={16} /> Ask us on WhatsApp
      </a>
    </div>
  );
}
