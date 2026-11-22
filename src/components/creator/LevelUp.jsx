import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { motionOk } from './gameMotion.js';
import { playChaChing, buzz } from '../../lib/creatorGame.js';

// ============================================================
// Level up! (owner, 2026-11-22: "more beautiful n animations add kro").
// When the creator's level (from my_creator_game, confirmed sales) is higher
// than the last level this browser saw, a full-screen moment: rays, the new
// medal dropping in, gold rain. The first visit only remembers the level.
// ============================================================

const key = (cid) => `sora.creator.level.${cid}`;
const read = (cid) => { try { const v = window.localStorage.getItem(key(cid)); return v == null ? null : Number(v); } catch { return null; } };
const write = (cid, lv) => { try { window.localStorage.setItem(key(cid), String(lv)); } catch { /* private mode */ } };

/** Pure: should a level-up show? First visit (null) never does. */
export const levelUpFrom = (seen, level) => (seen != null && Number.isFinite(seen) && Number(level) > seen ? seen : null);

const RAIN = 26;

export default function LevelUp({ creatorId, level, rank, rate }) {
  const [from, setFrom] = useState(null);
  useEffect(() => {
    if (!creatorId || !level) return;
    const seen = read(creatorId);
    if (seen == null) { write(creatorId, level); return; }
    setFrom(levelUpFrom(seen, level));
  }, [creatorId, level]);
  const close = () => { write(creatorId, level); setFrom(null); };
  useEffect(() => {
    if (from == null) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { write(creatorId, level); setFrom(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [from, creatorId, level]);

  if (from == null) return null;
  const go = () => { playChaChing(); buzz(); close(); };
  const motion = motionOk();

  return (
    <div className="lu-layer" role="dialog" aria-modal="true" aria-labelledby="lu-h" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      {motion && <div className="lu-rain" aria-hidden="true">{Array.from({ length: RAIN }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.22}s`, '--s': `${2.6 + (i % 5) * 0.4}s`, '--r': `${(i % 2 ? 1 : -1) * (200 + i * 13)}deg` }} />)}</div>}
      <div className="lu-card">
        <span className="lu-rays" aria-hidden="true" />
        <p className="lu-kicker">Level up!</p>
        <span className="lu-medal" aria-hidden="true">
          <span className="lu-medal__shine" />
          <Icon name="crown" size={26} />
          <b className="serif">{rank || 'Rise'}</b>
          <small>Level {level}</small>
        </span>
        <h2 className="lu-h serif" id="lu-h">You’ve reached Level {level}</h2>
        <p className="lu-sub">
          Up from Level {from}.{Number(rate) > 0 ? <> New sales now earn <b>{rate}%</b>.</> : null}
        </p>
        <button type="button" className="cg-btn cg-btn--gold lu-btn" onClick={go} autoFocus>Let’s go <Icon name="arrowRight" size={16} /></button>
      </div>
    </div>
  );
}
