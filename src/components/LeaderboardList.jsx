import { useState } from 'react';
import { rankSlot, sanitizeLeaderboard } from '../lib/creatorTiers.js';

// ============================================================
// The leaderboard list — shared by the homepage section and the creator
// portal. It renders exactly what creator_leaderboard() returns: position,
// name, rank, level. There is no figure to show, so none is shown.
//
// `highlightPosition` marks the signed-in creator's own row in the portal;
// the public homepage never passes it.
// ============================================================
export default function LeaderboardList({ rows, initial = 20, highlightPosition = null, emptyText = null }) {
  const list = sanitizeLeaderboard(rows);
  const [open, setOpen] = useState(false);
  if (list.length === 0) return emptyText ? <p className="lb__empty">{emptyText}</p> : null;

  const shown = open ? list : list.slice(0, initial);
  const half = Math.ceil(shown.length / 2);
  return (
    <>
      <ol className={`lb${open ? ' is-open' : ''}`} style={{ '--lb-rows': half }} data-count={list.length}>
        {shown.map((r) => {
          const me = highlightPosition != null && Number(highlightPosition) === r.rank_position;
          return (
            <li
              key={r.rank_position}
              className={`lb__row${r.rank_position <= 3 ? ' is-podium' : ''}${me ? ' is-me' : ''}`}
              data-rank={rankSlot(r.rank_name)}
              aria-current={me ? 'true' : undefined}
            >
              <span className="lb__pos">{String(r.rank_position).padStart(2, '0')}</span>
              <span className="lb__name">{r.display_name}</span>
              <span className="lb__tier">
                <span className="lb__rank">{r.rank_name}</span>
                <span className="lb__level">L{r.level}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {list.length > initial && (
        <button type="button" className="lb__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? `Show top ${initial}` : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
