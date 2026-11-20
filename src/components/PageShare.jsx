import { useState } from 'react';
import Icon from './Icon.jsx';

// ============================================================
// Share this page (round 15, 2026-11-20): on the edits and the gift finder, so a list
// can be sent to family or friends — WhatsApp with the link, or the phone's own share
// sheet / copy link. The link is the page as it is, choices included (the gift
// finder's "for him · ₹1,000–2,500" travels with it). Nothing is tracked.
// ============================================================
export const shareText = (title, url) => `${String(title || 'Have a look').trim()} on SORA LIFESTYLE: ${url}`;

export default function PageShare({ title }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
  const more = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, text: `${title} on SORA LIFESTYLE`, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { /* dismissed */ }
  };
  return (
    <p className="sora-pshare">
      <a href={`https://wa.me/?text=${encodeURIComponent(shareText(title, url))}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={15} /> Send on WhatsApp</a>
      <button type="button" onClick={more}><Icon name="copy" size={15} /> {copied ? 'Link copied' : 'Share'}</button>
    </p>
  );
}
