import { useMemo, useState } from 'react';
import Icon from '../Icon.jsx';
import { money } from '../../lib/format.js';
import {
  badgeList, leagueOf, daysLeft, yatraTiles, vanityProblem, VANITY_REASON,
  wrappedLines, drawWrapped, monthName,
} from '../../lib/creatorGame.js';

// ============================================================
// Creator Game v1 (owner, 2026-11-22: "Creator Game v1 bana do"):
// badges · Bharat Yatra · season & league · Wrapped card · custom code ·
// Discoverer. Every number is my_creator_game() (0050); this page only
// arranges it. Sales mean paid, non-self-referred orders — never clicks.
// ============================================================

const TILE = 44; const GAP = 6;

export default function CreatorGamePage({ game, creator, standing, catalog = [], onVanity, nowMs }) {
  const now = nowMs ? new Date(nowMs) : new Date();
  if (!game || game.ok === false) {
    return (
      <section className="cg">
        <div className="cd-panel"><p className="muted">The game board couldn’t load just now. Refresh to try again.</p></div>
      </section>
    );
  }
  const badges = badgeList(game);
  const earned = badges.filter((b) => b.earned).length;
  const yatra = yatraTiles(game.map);
  const season = game.season || {};
  const league = leagueOf(season.league);
  const me = (season.members || []).find((m) => m.me);
  const left = daysLeft(season.ends_at, now);
  const nextHamper = (catalog || []).find((o) => o.reward_type === 'mystery' && Number(o.level) > Number(game.level || 1));

  return (
    <section className="cg" aria-labelledby="cg-h">
      <header className="cg-head">
        <div>
          <p className="cg-eyebrow">Creator Game · Season {monthName(season.month)}</p>
          <h1 className="cg-h serif" id="cg-h">Play to grow</h1>
          <p className="cg-sub">Every badge, tile and point here comes from real, paid orders. Shares and clicks never count, so neither can tricks.</p>
        </div>
      </header>

      <div className="cg-stats" role="list">
        <Stat icon="award" label="Badges" value={`${earned}/${badges.length}`} />
        <Stat icon="mapPin" label="States visited" value={`${yatra.visited}/${yatra.total}`} />
        <Stat icon="leaf" label="Week streak" value={String(game.streak?.current || 0)} note={game.streak?.best ? `Best ${game.streak.best}` : null} />
        <Stat icon="crown" label={league.name} value={me ? `#${me.pos}` : '—'} note={me ? `${me.points.toLocaleString('en-IN')} pts` : null} />
      </div>

      <div className="cg-row">
        <Badges badges={badges} />
        <League season={season} league={league} left={left} />
      </div>

      <Yatra yatra={yatra} />

      <div className="cg-row">
        <Wrapped game={game} creator={creator} standing={standing} />
        <div className="cg-col">
          <Vanity game={game} standing={standing} onVanity={onVanity} />
          <Discovered list={game.discovered} />
          {nextHamper && (
            <div className="cd-panel cg-hamper">
              <span className="cg-hamper__box" aria-hidden="true"><Icon name="gift" size={26} /></span>
              <div>
                <p className="cg-eyebrow">Level {nextHamper.level} unlock</p>
                <h3 className="cg-panel-h serif">Mystery hamper</h3>
                <p className="cg-note">What’s inside is a surprise. {nextHamper.value ? `Worth ${nextHamper.value}.` : ''}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, note }) {
  return (
    <div className="cg-stat" role="listitem">
      <span className="cg-stat__ic" aria-hidden="true"><Icon name={icon} size={17} /></span>
      <span className="cg-stat__v">{value}</span>
      <span className="cg-stat__l">{label}{note ? <em> · {note}</em> : null}</span>
    </div>
  );
}

function Badges({ badges }) {
  return (
    <div className="cd-panel cg-badges" aria-labelledby="cg-badges-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cg-badges-h">Badges</h2>
          <p className="cd-panel__sub">Earned ones show on your card. The rest show how close you are.</p>
        </div>
      </header>
      <ul className="cg-badges__grid">
        {badges.map((b) => (
          <li key={b.id} className={`cg-badge${b.earned ? ' is-earned' : ''}`}>
            <span className="cg-badge__medal" aria-hidden="true"><Icon name={b.icon} size={20} /></span>
            <span className="cg-badge__name">{b.name}</span>
            <span className="cg-badge__hint">{b.hint}</span>
            {!b.earned && (
              <span className="cg-badge__bar" role="progressbar" aria-label={`${b.name} progress`} aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={b.progress}>
                <i style={{ transform: `scaleX(${b.fraction})` }} />
              </span>
            )}
            {!b.earned && <span className="cg-badge__left">{b.money ? `${money(b.target - b.progress)} to go` : `${b.target - b.progress} to go`}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function League({ season, league, left }) {
  const members = Array.isArray(season.members) ? season.members : [];
  return (
    <div className="cd-panel cg-league" style={{ '--league': league.tone }} aria-labelledby="cg-league-h">
      <header className="cd-panel__head">
        <div>
          <p className="cg-eyebrow">{league.en} · {league.levels}</p>
          <h2 className="cd-panel__h serif" id="cg-league-h">{league.name}</h2>
          <p className="cd-panel__sub">
            {left == null ? 'This month’s season.' : left === 0 ? 'Last day of this season.' : `${left} ${left === 1 ? 'day' : 'days'} left in this season.`}
            {' '}1 point for every ₹10 of sales. Points reset on the 1st; your rank never does.
          </p>
        </div>
      </header>
      <ol className="cg-table">
        {members.map((m) => (
          <li key={`${m.pos}-${m.name}`} className={`cg-table__row${m.me ? ' is-me' : ''}${m.pos <= 3 ? ` is-top is-top${m.pos}` : ''}`}>
            <span className="cg-table__pos">{m.pos}</span>
            <span className="cg-table__name">{m.name}{m.me ? <em> (you)</em> : null}</span>
            <span className="cg-table__pts">{Number(m.points || 0).toLocaleString('en-IN')}<small> pts</small></span>
          </li>
        ))}
      </ol>
      {members.length <= 1 && <p className="cg-note">You’re the first in this league. As more creators join, this table fills up.</p>}
    </div>
  );
}

function Yatra({ yatra }) {
  const cols = 9; const rows = 7;
  const w = cols * TILE + (cols - 1) * GAP; const h = rows * TILE + (rows - 1) * GAP;
  const lit = yatra.tiles.filter((t) => t.lit).sort((a, b) => b.orders - a.orders);
  return (
    <div className="cd-panel cg-yatra" aria-labelledby="cg-yatra-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cg-yatra-h">Bharat Yatra</h2>
          <p className="cd-panel__sub">Every state an order of yours reaches lights up. {yatra.visited} of {yatra.total} so far.</p>
        </div>
        <span className="cg-yatra__count"><b>{yatra.visited}</b>/{yatra.total}</span>
      </header>
      <div className="cg-yatra__wrap">
        <svg className="cg-yatra__map" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${yatra.visited} of ${yatra.total} states and union territories reached`}>
          {yatra.tiles.map((t) => (
            <g key={t.code} transform={`translate(${t.c * (TILE + GAP)} ${t.r * (TILE + GAP)})`} className={`cg-tile${t.lit ? ' is-lit' : ''}`} style={t.lit ? { '--heat': t.heat } : undefined}>
              <title>{t.name}{t.lit ? ` · ${t.orders} ${t.orders === 1 ? 'order' : 'orders'}` : ''}</title>
              <rect width={TILE} height={TILE} rx="9" />
              <text x={TILE / 2} y={TILE / 2 + 4.5} textAnchor="middle">{t.code}</text>
            </g>
          ))}
        </svg>
        <div className="cg-yatra__side">
          <p className="cg-yatra__goal"><Icon name="mapPin" size={15} /> Next: <b>{yatra.visited < 5 ? 'Paanch Pradesh' : yatra.visited < 10 ? 'Bharat Darshan' : 'all 36'}</b> at {yatra.visited < 5 ? 5 : yatra.visited < 10 ? 10 : 36} states</p>
          {lit.length ? (
            <ul className="cg-yatra__list">
              {lit.slice(0, 8).map((t) => <li key={t.code}><span>{t.name}</span><b>{t.orders}</b></li>)}
            </ul>
          ) : <p className="cg-note">No state yet — your first order lights the first tile.</p>}
        </div>
      </div>
    </div>
  );
}

function Wrapped({ game, creator, standing }) {
  const [which, setWhich] = useState('this');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const stats = game.wrapped?.[which] || {};
  const lines = useMemo(() => wrappedLines(stats, {
    name: creator?.display_name, rank: standing?.rank || game.rank, league: game.season?.league, code: game.vanity?.code || creator?.creator_code,
  }), [stats, creator, standing, game]);

  const share = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await drawWrapped(lines);
      if (!blob) throw new Error('no image');
      const file = new File([blob], `sora-${stats.month || 'wrapped'}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: lines.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setMsg('Saved — post it to your story.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg('Couldn’t make the image. Try again.');
    }
    setBusy(false);
  };

  return (
    <div className="cd-panel cg-wrapped" aria-labelledby="cg-wrapped-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cg-wrapped-h">Your Wrapped</h2>
          <p className="cd-panel__sub">A card of your month, ready for your story.</p>
        </div>
        <div className="cg-seg" role="group" aria-label="Month">
          <button type="button" aria-pressed={which === 'this'} onClick={() => setWhich('this')}>This month</button>
          <button type="button" aria-pressed={which === 'last'} onClick={() => setWhich('last')}>Last month</button>
        </div>
      </header>
      <figure className="cg-card" aria-label={`${lines.title}: ${lines.big} ${lines.bigLabel}`}>
        <p className="cg-card__kicker">SORA LIFESTYLE · CREATOR PROGRAM</p>
        <p className="cg-card__title serif">{lines.title}</p>
        {lines.name && <p className="cg-card__name">{lines.name}</p>}
        <p className="cg-card__big serif">{lines.big}<small>{lines.bigLabel}</small></p>
        <dl className="cg-card__rows">
          {lines.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {lines.top && <p className="cg-card__top"><span>Most loved</span>{lines.top}</p>}
        {lines.code && <p className="cg-card__code">Shop with my code {lines.code}</p>}
      </figure>
      <button type="button" className="cg-btn" onClick={share} disabled={busy}>
        <Icon name="download" size={16} /> {busy ? 'Making your card…' : 'Share my Wrapped'}
      </button>
      {msg && <p className="cg-note" role="status">{msg}</p>}
    </div>
  );
}

function Vanity({ game, standing, onVanity }) {
  const v = game.vanity || {};
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : [];
  const eliteAt = Number(ladder.find((l) => Number(l.level) === Number(v.min_level || 5))?.threshold);
  const toGo = Number.isFinite(eliteAt) ? Math.max(0, eliteAt - Number(standing?.lifetime_confirmed_sales || game.confirmed_sales || 0)) : null;
  const cooling = v.next_change_at && new Date(v.next_change_at) > new Date();

  const submit = async (e) => {
    e.preventDefault();
    const problem = vanityProblem(code);
    if (problem) { setMsg({ tone: 'err', text: problem }); return; }
    setBusy(true); setMsg(null);
    const res = await onVanity(code.trim().toUpperCase());
    if (res?.ok) { setMsg({ tone: 'ok', text: `Done — your code is now ${res.code}. Links with ${res.old_code || 'your old code'} still work.` }); setCode(''); }
    else setMsg({ tone: 'err', text: VANITY_REASON[res?.reason] || 'Couldn’t change it just now. Try again.' });
    setBusy(false);
  };

  return (
    <div className={`cd-panel cg-vanity${v.eligible ? '' : ' is-locked'}`} aria-labelledby="cg-vanity-h">
      <p className="cg-eyebrow">{v.eligible ? 'Unlocked' : `Unlocks at Elite · Level ${v.min_level || 5}`}</p>
      <h2 className="cg-panel-h serif" id="cg-vanity-h">Your own code</h2>
      <p className="cg-vanity__now">Now: <b>{v.code}</b></p>
      {v.eligible ? (
        cooling ? (
          <p className="cg-note">You can change it again on {new Date(v.next_change_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.</p>
        ) : (
          <form className="cg-vanity__form" onSubmit={submit}>
            <label className="sr-only" htmlFor="cg-vanity-in">New code</label>
            <input id="cg-vanity-in" className="cg-input" value={code} maxLength={16} autoComplete="off" spellCheck="false"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="e.g. GHEEQUEEN" />
            <button type="submit" className="cg-btn" disabled={busy || !code}>{busy ? 'Saving…' : 'Claim'}</button>
          </form>
        )
      ) : (
        <p className="cg-note">
          Pick a code like <b>GHEEQUEEN</b> instead of {v.code}.
          {toGo != null && toGo > 0 ? ` ${money(toGo)} more in confirmed sales to get there.` : ''}
        </p>
      )}
      {msg && <p className={`cg-msg is-${msg.tone}`} role="status">{msg.text}</p>}
    </div>
  );
}

function Discovered({ list }) {
  const items = Array.isArray(list) ? list : [];
  return (
    <div className="cd-panel cg-disc" aria-labelledby="cg-disc-h">
      <p className="cg-eyebrow">Discoverer</p>
      <h2 className="cg-panel-h serif" id="cg-disc-h">First sold by you</h2>
      {items.length ? (
        <>
          <p className="cg-note">Your name shows on these product pages for good.</p>
          <ul className="cg-disc__list">{items.slice(0, 6).map((n) => <li key={n}><Icon name="sparkle" size={13} />{n}</li>)}</ul>
          {items.length > 6 && <p className="cg-note">+{items.length - 6} more</p>}
        </>
      ) : (
        <p className="cg-note">Be the first creator to sell a product and your name goes on its page for good. New launches are the easiest race to win.</p>
      )}
    </div>
  );
}
