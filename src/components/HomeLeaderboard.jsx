import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LeaderboardList from './LeaderboardList.jsx';
import { getCreatorLeaderboard } from '../lib/creatorApi.js';

// ============================================================
// HOMEPAGE — creator leaderboard. The dark block that closes the page.
//
// Public by design: creator_leaderboard() is the only thing it calls and the
// only thing that function returns is position, name, rank and level. The
// section renders nothing until there is at least one creator with confirmed
// sales — an empty dark band would be a claim the programme can't back yet.
// ============================================================
export default function HomeLeaderboard({ rows: preloaded = null }) {
  const [rows, setRows] = useState(preloaded);

  useEffect(() => {
    if (preloaded) return undefined;
    let live = true;
    getCreatorLeaderboard().then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [preloaded]);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="v2-sec hm-section hm-leaderboard sl-dark" data-home-section="leaderboard" aria-labelledby="hm-leaderboard-h">
      <div className="v2-wrap">
        <div className="hm-leaderboard__head">
          <p className="v2-eyebrow">SORA LIFE Creator Program</p>
          <h2 className="v2-h2" id="hm-leaderboard-h">Creator leaderboard</h2>
          <p className="hm-leaderboard__copy">
            The top {Math.min(rows.length, 100)} creators, ranked by confirmed sales through their own links.
            Names, ranks and levels only — never anyone’s earnings.
          </p>
        </div>

        <LeaderboardList rows={rows} initial={20} />

        <div className="hm-leaderboard__foot">
          <span>Ranks rise with confirmed lifetime sales. Ties go to whoever reached the level first.</span>
          <Link to="/account/creator">Join the programme →</Link>
        </div>
      </div>
    </section>
  );
}
