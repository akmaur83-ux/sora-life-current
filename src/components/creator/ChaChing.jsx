import { useEffect, useMemo, useState } from 'react';
import Icon from '../Icon.jsx';
import { money2 } from '../../lib/format.js';
import { unseenSales, markSeen, playChaChing, buzz } from '../../lib/creatorGame.js';
import { reducedMotion } from '../../lib/motion.js';

// ============================================================
// Cha-ching (Creator Game v1, owner 2026-11-22). New paid sales since the
// creator last looked arrive as a gold pill; tapping it plays a coin sound,
// a small burst and a buzz (browsers allow sound and vibration only after a
// tap, so the tap IS the reveal). Shows the state an order came from — never
// a customer's name or city. The portal re-checks every 90 s while it is
// open and visible, so a sale can land live.
// ============================================================

const BITS = 18;

export default function ChaChing({ creatorId, recent, holdDays = 7 }) {
  const { fresh, newest, first } = useMemo(() => unseenSales(recent, creatorId), [recent, creatorId]);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  // A first visit: remember where history ends, no party.
  useEffect(() => { if (first && newest) markSeen(creatorId, newest); }, [first, newest, creatorId]);
  // New sales arriving later bring the pill back.
  useEffect(() => { if (fresh.length) setGone(false); }, [fresh.length, newest]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { markSeen(creatorId, newest); setOpen(false); setGone(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, creatorId, newest]);

  if (!fresh.length || gone) return null;
  const total = fresh.reduce((s, r) => s + (Number(r.commission) || 0), 0);
  const calm = reducedMotion();

  const reveal = () => { setOpen(true); playChaChing(); buzz(); };
  const close = () => { markSeen(creatorId, newest); setOpen(false); setGone(true); };

  if (!open) {
    return (
      <button type="button" className="cc-pill" onClick={reveal} aria-live="polite">
        <span className="cc-pill__coin" aria-hidden="true">₹</span>
        <span><b>Cha-ching!</b> {fresh.length} new {fresh.length === 1 ? 'sale' : 'sales'}{total > 0 ? ` · ${money2(total)}` : ''}</span>
        <span className="cc-pill__go">Tap to see <Icon name="arrowRight" size={14} /></span>
      </button>
    );
  }

  return (
    <div className="cc-layer" role="dialog" aria-modal="true" aria-labelledby="cc-h" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      {!calm && <div className="lu-rain cc-rain" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--x': `${(i * 41 + 7) % 100}%`, '--d': `${(i % 6) * 0.18}s`, '--s': `${2.2 + (i % 4) * 0.45}s`, '--r': `${(i % 2 ? 1 : -1) * (240 + i * 17)}deg` }} />)}</div>}
      <div className="cc-card">
        {!calm && (
          <div className="cc-burst" aria-hidden="true">
            {Array.from({ length: BITS }, (_, i) => <i key={i} style={{ '--a': `${(360 / BITS) * i}deg`, '--d': `${70 + (i % 3) * 26}px`, '--t': `${(i % 4) * 40}ms` }} />)}
          </div>
        )}
        <span className="cc-card__coin" aria-hidden="true">₹</span>
        <p className="cc-card__kicker">Cha-ching!</p>
        <h2 className="cc-card__h serif" id="cc-h">
          {total > 0 ? `You earned ${money2(total)}` : `${fresh.length} new ${fresh.length === 1 ? 'sale' : 'sales'}`}
        </h2>
        <ul className="cc-list">
          {fresh.slice(0, 5).map((r) => (
            <li key={r.id}>
              <span className="cc-list__amt">{Number(r.commission) > 0 ? money2(r.commission) : '—'}</span>
              <span className="cc-list__what">
                {r.product || 'An order'}{Number(r.items) > 1 ? ` +${Number(r.items) - 1} more` : ''}
                {r.state ? <em> · from {r.state}</em> : null}
              </span>
            </li>
          ))}
        </ul>
        {fresh.length > 5 && <p className="cc-more">and {fresh.length - 5} more</p>}
        <p className="cc-note">Held until {holdDays} days after delivery, then it’s yours to withdraw.</p>
        <button type="button" className="cg-btn" onClick={close} autoFocus>Keep going</button>
      </div>
    </div>
  );
}
