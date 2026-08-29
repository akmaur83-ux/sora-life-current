import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { announcement } from '../lib/settings.js';

// Icons cycle with the notices; purely decorative, so they carry no label.
const NOTICE_ICONS = ['truck', 'card', 'shield'];
const INTERVAL = 5000;

// V2 announcement bar — extracted from Header so it is its own concern.
// Content comes entirely from the admin-editable `announcement` setting; no
// copy is authored here. Renders nothing when there are no notices.
export default function AnnouncementBar() {
  const notices = Array.isArray(announcement.notices)
    ? announcement.notices.filter((n) => typeof n === 'string' && n.trim())
    : [];

  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // Auto-rotation is moving content, so it is disabled entirely for
  // reduced-motion users — who instead get every notice at once (below), so
  // no information is lost.
  useEffect(() => {
    if (reduced || notices.length < 2) return undefined;
    const t = setTimeout(() => setI((n) => (n + 1) % notices.length), INTERVAL);
    return () => clearTimeout(t);
  }, [i, reduced, notices.length]);

  if (!notices.length) return null;

  const shown = reduced ? notices : [notices[i % notices.length]];

  return (
    <div className="v2-ann" role="region" aria-label="Store announcements">
      <div className="v2-ann__viewport">
        {shown.map((n, idx) => (
          <span className="v2-ann__item" key={`${idx}-${n}`}>
            <Icon name={NOTICE_ICONS[(reduced ? idx : i) % NOTICE_ICONS.length]} size={13} stroke={1.5} />
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
