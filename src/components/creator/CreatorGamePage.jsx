import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { money } from '../../lib/format.js';
import { tierProgress } from '../../lib/creatorTiers.js';
import {
  badgeList, leagueOf, daysLeft, yatraTiles, vanityProblem, VANITY_REASON,
  wrappedLines, drawWrapped, monthName, countdownParts, overtake, STATE_TILES,
} from '../../lib/creatorGame.js';
import { useInView, inViewClass, useCountUp, motionOk, newBadgeIds, rememberBadges, useNow } from './gameMotion.js';

// ============================================================
// Creator Game v1 (owner, 2026-11-22: "Creator Game v1 bana do"; then
// "beautiful n attractive bnao isko animations ke sath"):
// hero with the rank medallion · badges · Bharat Yatra · league podium ·
// Wrapped card · custom code · Discoverer · mystery hamper.
// Every number is my_creator_game() (0050); this page only arranges it.
// Sales mean paid, non-self-referred orders — never clicks.
// Motion: transform and opacity only, entrances once per visit, loops only
// while their section is on screen, nothing at all for reduced motion.
// ============================================================

const TILE = 44; const GAP = 6;
const initials = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '·';

export default function CreatorGamePage({ game, creator, standing, catalog = [], onVanity, nowMs }) {
  const [motion, setMotion] = useState(false);
  useEffect(() => { setMotion(motionOk()); }, []);
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
    <section className={`cg${motion ? ' cg--motion' : ''}`} aria-labelledby="cg-h">
      <Hero game={game} standing={standing} season={season} league={league} nowMs={nowMs} />

      <Stats items={[
        { icon: 'award', label: 'Badges', value: earned, of: badges.length },
        { icon: 'mapPin', label: 'States visited', value: yatra.visited, of: yatra.total },
        { icon: 'flame', label: 'Week streak', value: Number(game.streak?.current || 0), note: game.streak?.best ? `Best ${game.streak.best}` : null },
        { icon: 'crown', label: league.name, value: me ? me.pos : null, prefix: '#', note: me ? `${Number(me.points || 0).toLocaleString('en-IN')} pts` : null },
      ]} />

      <div className="cg-row">
        <Badges badges={badges} creatorId={creator?.id} />
        <League season={season} league={league} left={left} />
      </div>

      <Yatra yatra={yatra} />

      <div className="cg-row">
        <Wrapped game={game} creator={creator} standing={standing} />
        <div className="cg-col">
          <Vanity game={game} standing={standing} onVanity={onVanity} />
          <Discovered list={game.discovered} />
          {nextHamper && <Hamper reward={nextHamper} />}
        </div>
      </div>
    </section>
  );
}

// ---- Hero: the rank medallion ----------------------------------------
function Hero({ game, standing, season, league, nowMs }) {
  const [ref, seen, live] = useInView();
  const now = useNow(30000, nowMs ?? null);
  const cd = countdownParts(season.ends_at, now);
  const [flip, setFlip] = useState(0);
  const prog = tierProgress(standing || { lifetime_confirmed_sales: game.confirmed_sales, threshold: 0, next_threshold: null });
  const R = 54; const C = 2 * Math.PI * R;
  const offset = C * (1 - (seen ? prog.fraction : 0));
  const rank = standing?.rank || game.rank || 'Rise';
  const level = standing?.level || game.level || 1;
  return (
    <header ref={ref} className={`cg-hero cg-reveal${inViewClass(seen, live)}`}>
      <span className="cg-hero__glow" aria-hidden="true" />
      <span className="cg-hero__sparks" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
      <div className="cg-hero__text">
        <p className="cg-hero__eyebrow">Creator Game · Season {monthName(season.month)}</p>
        <h1 className="cg-hero__h serif" id="cg-h">Play to <em>grow</em></h1>
        <p className="cg-hero__sub">Every badge, tile and point here comes from real, paid orders. Shares and clicks never count — so neither can tricks.</p>
        <div className="cg-hero__chips">
          <span className="cg-chip" style={{ '--league': league.tone }}><i aria-hidden="true" />{league.name}</span>
          {cd && (
            <span className="cg-chip cg-chip--clock" aria-label={`${cd.d} days ${cd.h} hours ${cd.m} minutes left in the season`}>
              <Icon name="clock" size={13} />
              <span className="cg-cd" aria-hidden="true">
                {[[cd.d, 'd'], [cd.h, 'h'], [cd.m, 'm']].map(([v, u]) => <span key={u} className="cg-cd__u"><b key={v}>{String(v).padStart(2, '0')}</b>{u}</span>)}
              </span>
              <span className="cg-cd__l">left</span>
            </span>
          )}
          {Number(game.streak?.current) > 0 && <span className="cg-chip"><Icon name="leaf" size={13} />{game.streak.current}-week streak</span>}
        </div>
      </div>
      <div className="cg-medal" role="img" onClick={() => setFlip((f) => f + 1)} aria-label={`${rank}, level ${level}${prog.atTop ? '' : `, ${Math.round(prog.fraction * 100)}% of the way to level ${standing?.next_level ?? level + 1}`}`}>
        <span className="cg-medal__rays" aria-hidden="true" />
        <span className="cg-medal__orbit" aria-hidden="true"><i /></span>
        <svg viewBox="0 0 132 132" className="cg-medal__ring" aria-hidden="true">
          <defs>
            <linearGradient id="cg-ring-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F7E2A8" /><stop offset=".55" stopColor="#E4C482" /><stop offset="1" stopColor="#C79A45" />
            </linearGradient>
          </defs>
          <circle cx="66" cy="66" r={R} className="cg-medal__track" />
          <circle cx="66" cy="66" r={R} className="cg-medal__fill" stroke="url(#cg-ring-g)" strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 66 66)" />
        </svg>
        <span className="cg-medal__core" key={flip} data-flip={flip > 0 ? '1' : undefined}>
          <span className="cg-medal__shine" aria-hidden="true" />
          <Icon name="crown" size={22} />
          <b className="serif">{rank}</b>
          <small>Level {level}</small>
        </span>
        <p className="cg-medal__next">{prog.atTop ? 'Top of the ladder' : `${money(prog.remaining)} to Level ${standing?.next_level ?? level + 1}`}</p>
      </div>
    </header>
  );
}

// ---- Stats: numbers that climb in --------------------------------------
function Stats({ items }) {
  const [ref, seen, live] = useInView();
  return (
    <div ref={ref} className={`cg-stats cg-reveal${inViewClass(seen, live)}`} role="list">
      {items.map((s, i) => <Stat key={s.label} {...s} run={seen} i={i} />)}
    </div>
  );
}
function Stat({ icon, label, value, of, prefix = '', note, run, i }) {
  const n = useCountUp(value ?? 0, run);
  return (
    <div className="cg-stat" role="listitem" style={{ '--i': i }}>
      <span className={`cg-stat__ic${icon === 'flame' ? ' is-flame' : ''}`} aria-hidden="true">{icon === 'flame' ? <Flame /> : <Icon name={icon} size={18} />}</span>
      <span className="cg-stat__v">{value == null ? '—' : <>{prefix}{n}{of != null && <small>/{of}</small>}</>}</span>
      <span className="cg-stat__l">{label}{note ? <em> · {note}</em> : null}</span>
    </div>
  );
}

// ---- Badges: medals that pop, shine, and celebrate new ones -------------
function Badges({ badges, creatorId }) {
  const [ref, seen, live] = useInView();
  const earnedIds = badges.filter((b) => b.earned).map((b) => b.id);
  const key = earnedIds.join(',');
  const [fresh, setFresh] = useState([]);
  const [tap, setTap] = useState(null); // { id, n }
  const tapped = tap ? badges.find((b) => b.id === tap.id) : null;
  const onTap = (b) => setTap((t) => ({ id: b.id, n: (t?.n || 0) + 1 }));
  useEffect(() => { setFresh(newBadgeIds(creatorId, earnedIds)); }, [creatorId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!seen || !fresh.length) return undefined;
    const t = setTimeout(() => rememberBadges(creatorId, earnedIds), 4000);
    return () => clearTimeout(t);
  }, [seen, fresh.length, creatorId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={`cd-panel cg-badges cg-reveal${inViewClass(seen, live)}`} aria-labelledby="cg-badges-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cg-badges-h">Badges</h2>
          <p className="cd-panel__sub">Earned ones shine on your card. The rest show how close you are.</p>
        </div>
        <span className="cg-count"><b>{earnedIds.length}</b>/{badges.length}</span>
      </header>
      <ul className="cg-badges__grid">
        {badges.map((b, i) => {
          const isNew = fresh.includes(b.id);
          return (
            <li key={b.id} className={`cg-badge${b.earned ? ' is-earned' : ''}${isNew ? ' is-new' : ''}${tap?.id === b.id ? ' is-tapped' : ''}`} style={{ '--i': i }}
              role="button" tabIndex={0} aria-label={`${b.name}: ${b.hint}${b.earned ? ', earned' : `, ${b.target - b.progress} to go`}`}
              onClick={() => onTap(b)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(b); } }}>
              {isNew && <span className="cg-badge__ribbon">New</span>}
              <span className="cg-badge__medal" aria-hidden="true" key={tap?.id === b.id ? `t${tap.n}` : 'm'}>
                <Icon name={b.icon} size={20} />
                {b.earned && <span className="cg-badge__shine" />}
                {(isNew || (tap?.id === b.id && b.earned)) && <span className="cg-badge__burst">{Array.from({ length: 10 }, (_, k) => <i key={k} style={{ '--a': `${k * 36}deg` }} />)}</span>}
              </span>
              <span className="cg-badge__name">{b.name}</span>
              <span className="cg-badge__hint">{b.hint}</span>
              {!b.earned && (
                <span className="cg-badge__bar" role="progressbar" aria-label={`${b.name} progress`} aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={b.progress}>
                  <i style={{ '--f': b.fraction }} />
                </span>
              )}
              {!b.earned && <span className="cg-badge__left">{b.money ? `${money(b.target - b.progress)} to go` : `${b.target - b.progress} to go`}</span>}
            </li>
          );
        })}
      </ul>
      <p className={`cg-toast${tapped ? ' is-on' : ''}`} role="status" key={tap ? tap.n : 0}>
        {tapped ? (tapped.earned
          ? <><Icon name="checkCircle" size={15} /><b>{tapped.name}</b> · {tapped.hint} — earned</>
          : <><Icon name="clock" size={15} /><b>{tapped.name}</b> · {tapped.money ? money(tapped.target - tapped.progress) : tapped.target - tapped.progress} to go</>) : null}
      </p>
    </div>
  );
}

// ---- League: a podium, then the table ----------------------------------
function League({ season, league, left }) {
  const [ref, seen, live] = useInView();
  const members = Array.isArray(season.members) ? season.members : [];
  const top = members.filter((m) => m.pos <= 3);
  const podium = [top.find((m) => m.pos === 2), top.find((m) => m.pos === 1), top.find((m) => m.pos === 3)].filter(Boolean);
  const rest = members.filter((m) => m.pos > 3);
  const chase = overtake(members);
  return (
    <div ref={ref} className={`cd-panel cg-league cg-reveal${inViewClass(seen, live)}`} style={{ '--league': league.tone }} aria-labelledby="cg-league-h">
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
      {podium.length > 0 && (
        <ol className="cg-podium" aria-label="Top three this season">
          {podium.map((m) => (
            <li key={m.pos} className={`cg-podium__step is-p${m.pos}${m.me ? ' is-me' : ''}`}>
              <span className="cg-podium__av" aria-hidden="true">{initials(m.name)}{m.pos === 1 && <Icon name="crown" size={14} />}</span>
              <span className="cg-podium__name">{m.name}{m.me ? <em> (you)</em> : null}</span>
              <span className="cg-podium__pts">{Number(m.points || 0).toLocaleString('en-IN')} pts</span>
              <span className="cg-podium__bar"><b>{m.pos}</b></span>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <ol className="cg-table" start={4}>
          {rest.map((m, i) => (
            <li key={`${m.pos}-${m.name}`} className={`cg-table__row${m.me ? ' is-me' : ''}`} style={{ '--i': i }}>
              <span className="cg-table__pos">{m.pos}</span>
              <span className="cg-table__name">{m.name}{m.me ? <em> (you)</em> : null}</span>
              <span className="cg-table__pts">{Number(m.points || 0).toLocaleString('en-IN')}<small> pts</small></span>
            </li>
          ))}
        </ol>
      )}
      {chase && members.length > 1 && (
        <p className={`cg-chase${chase.leading ? ' is-lead' : ''}`}>
          <span className="cg-chase__ic" aria-hidden="true"><Icon name={chase.leading ? 'crown' : 'arrowRight'} size={15} /></span>
          {chase.leading
            ? <span>You’re leading <b>{league.name}</b>. Hold the crown till the 1st.</span>
            : <span><b>{money(chase.rupees)}</b> more in sales to pass <b className="cg-cap">{chase.name}</b> for #{chase.pos}.</span>}
        </p>
      )}
      {members.length <= 1 && <p className="cg-note">You’re the first in this league. As more creators join, the podium fills up.</p>}
    </div>
  );
}

// ---- Bharat Yatra: tiles that wave in; the busiest state pulses -----------
function Yatra({ yatra }) {
  const [ref, seen, live] = useInView();
  const [hover, setHover] = useState(null);
  const cols = 9; const rows = 7;
  const w = cols * TILE + (cols - 1) * GAP; const h = rows * TILE + (rows - 1) * GAP;
  const lit = yatra.tiles.filter((t) => t.lit).sort((a, b) => b.orders - a.orders);
  const star = lit[0]?.code;
  const shown = hover ? yatra.tiles.find((t) => t.code === hover) : null;
  const travel = useRef(null);
  const route = lit.slice(0, 8);
  const routeKey = route.map((t) => t.code).join(',');
  useEffect(() => {
    const el = travel.current;
    if (!el || !seen || route.length < 2 || !motionOk() || typeof el.animate !== 'function') return undefined;
    const pt = (t) => `translate(${t.c * (TILE + GAP) + TILE / 2}px, ${t.r * (TILE + GAP) + TILE / 2}px)`;
    const stops = [...route, route[0]];
    const frames = [];
    stops.forEach((t, i) => {
      const at = i / (stops.length - 1);
      frames.push({ transform: `${pt(t)} scale(1)`, offset: at });
      if (i < stops.length - 1) frames.push({ transform: `${pt(t)} scale(1)`, offset: at + 0.35 / (stops.length - 1) });
    });
    const anim = el.animate(frames, { duration: 1600 * (stops.length - 1), iterations: Infinity, easing: 'ease-in-out', delay: 1400 });
    return () => anim.cancel();
  }, [seen, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const anims = travel.current?.getAnimations?.() || [];
    anims.forEach((a) => (live ? a.play() : a.pause()));
  }, [live]);
  const goal = yatra.visited < 5 ? ['Paanch Pradesh', 5] : yatra.visited < 10 ? ['Bharat Darshan', 10] : ['all of India', 36];
  return (
    <div ref={ref} className={`cd-panel cg-yatra cg-reveal${inViewClass(seen, live)}`} aria-labelledby="cg-yatra-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cg-yatra-h">Bharat Yatra</h2>
          <p className="cd-panel__sub">Every state an order of yours reaches lights up.</p>
        </div>
        <span className="cg-count"><b>{yatra.visited}</b>/{yatra.total}</span>
      </header>
      <div className="cg-yatra__wrap">
        <div className="cg-yatra__stage">
          <svg className="cg-yatra__map" viewBox={`-6 -6 ${w + 12} ${h + 12}`} role="img" aria-label={`${yatra.visited} of ${yatra.total} states and union territories reached`} onMouseLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="cg-tile-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F3DC9F" /><stop offset=".6" stopColor="#D9B061" /><stop offset="1" stopColor="#B8873A" />
              </linearGradient>
            </defs>
            {yatra.tiles.map((t) => (
              <g key={t.code} transform={`translate(${t.c * (TILE + GAP)} ${t.r * (TILE + GAP)})`}>
                <g className={`cg-tile${t.lit ? ' is-lit' : ''}${t.code === star ? ' is-star' : ''}${hover === t.code ? ' is-hover' : ''}`}
                  style={{ '--i': t.r + t.c, '--heat': t.heat }} onMouseEnter={() => setHover(t.code)} onClick={() => setHover(t.code)}>
                  <title>{t.name}{t.lit ? ` · ${t.orders} ${t.orders === 1 ? 'order' : 'orders'}` : ''}</title>
                  {t.code === star && <rect className="cg-tile__pulse" width={TILE} height={TILE} rx="10" />}
                  <rect className="cg-tile__bg" width={TILE} height={TILE} rx="10" fill={t.lit ? 'url(#cg-tile-g)' : undefined} />
                  <text x={TILE / 2} y={TILE / 2 + 4.5} textAnchor="middle">{t.code}</text>
                </g>
              </g>
            ))}
            {route.length >= 2 && (
              <g className="cg-traveller" ref={travel} style={{ transform: `translate(${route[0].c * (TILE + GAP) + TILE / 2}px, ${route[0].r * (TILE + GAP) + TILE / 2}px)` }}>
                <circle r="11" className="cg-traveller__halo" />
                <circle r="5" className="cg-traveller__dot" />
              </g>
            )}
          </svg>
          <p className="cg-yatra__cap" aria-live="polite">
            {shown ? <><b>{shown.name}</b>{shown.lit ? ` · ${shown.orders} ${shown.orders === 1 ? 'order' : 'orders'}` : ' · not yet'}</> : 'Tap or hover a tile to see its state'}
          </p>
        </div>
        <div className="cg-yatra__side">
          <div className="cg-yatra__goal">
            <span><Icon name="mapPin" size={15} /> Next: <b>{goal[0]}</b></span>
            <span className="cg-yatra__goalbar"><i style={{ '--f': Math.min(1, yatra.visited / goal[1]) }} /></span>
            <small>{yatra.visited} of {goal[1]} states</small>
          </div>
          {lit.length ? (
            <ul className="cg-yatra__list">
              {lit.slice(0, 8).map((t, i) => (
                <li key={t.code} style={{ '--i': i, '--f': t.heat }}><span>{t.name}</span><b>{t.orders}</b></li>
              ))}
            </ul>
          ) : <p className="cg-note">No state yet — your first order lights the first tile.</p>}
        </div>
      </div>
    </div>
  );
}

// ---- Wrapped: a card that tilts toward your finger ---------------------
function Wrapped({ game, creator, standing }) {
  const [ref, seen, live] = useInView();
  const cardRef = useRef(null);
  const [which, setWhich] = useState('this');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const stats = game.wrapped?.[which] || {};
  const lines = useMemo(() => wrappedLines(stats, {
    name: creator?.display_name, rank: standing?.rank || game.rank, league: game.season?.league, code: game.vanity?.code || creator?.creator_code,
  }), [stats, creator, standing, game]);

  const tilt = (e) => {
    const el = cardRef.current;
    if (!el || e.pointerType === 'touch' || !motionOk()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    el.style.setProperty('--sx', `${(x * 120).toFixed(1)}%`);
  };
  const untilt = () => { const el = cardRef.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--sx', '-60%'); };

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
    <div ref={ref} className={`cd-panel cg-wrapped cg-reveal${inViewClass(seen, live)}`} aria-labelledby="cg-wrapped-h">
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
      <div className="cg-card-stage" onPointerMove={tilt} onPointerLeave={untilt}>
        <div ref={cardRef} key={which} className="cg-holo">
        <figure className="cg-card" aria-label={`${lines.title}: ${lines.big} ${lines.bigLabel}`}>
          <span className="cg-card__sheen" aria-hidden="true" />
          <span className="cg-card__orb" aria-hidden="true" />
          <p className="cg-card__kicker">SORA LIFESTYLE · CREATOR PROGRAM</p>
          <p className="cg-card__title serif">{lines.title}</p>
          {lines.name && <p className="cg-card__name">{lines.name}</p>}
          <p className="cg-card__big serif">{lines.big}<small>{lines.bigLabel}</small></p>
          <dl className="cg-card__rows">
            {lines.rows.map(([k, v], i) => <div key={k} style={{ '--i': i }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {lines.top && <p className="cg-card__top"><span>Most loved</span>{lines.top}</p>}
          {lines.code && <p className="cg-card__code">Shop with my code <b>{lines.code}</b></p>}
        </figure>
        </div>
      </div>
      <button type="button" className="cg-btn cg-btn--gold" onClick={share} disabled={busy}>
        <Icon name="download" size={16} /> {busy ? 'Making your card…' : 'Share my Wrapped'}
      </button>
      {msg && <p className="cg-note" role="status">{msg}</p>}
    </div>
  );
}

// ---- Custom code ---------------------------------------------------------
function Vanity({ game, standing, onVanity }) {
  const [ref, seen, live] = useInView();
  const v = game.vanity || {};
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : [];
  const eliteAt = Number(ladder.find((l) => Number(l.level) === Number(v.min_level || 5))?.threshold);
  const have = Number(standing?.lifetime_confirmed_sales ?? game.confirmed_sales ?? 0);
  const toGo = Number.isFinite(eliteAt) ? Math.max(0, eliteAt - have) : null;
  const frac = Number.isFinite(eliteAt) && eliteAt > 0 ? Math.min(1, have / eliteAt) : 0;
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
    <div ref={ref} className={`cd-panel cg-vanity cg-reveal${v.eligible ? ' is-open' : ' is-locked'}${inViewClass(seen, live)}`} aria-labelledby="cg-vanity-h">
      <div className="cg-vanity__top">
        <span className="cg-vanity__lock" aria-hidden="true"><Icon name={v.eligible ? 'sparkle' : 'lock'} size={18} /></span>
        <div>
          <p className="cg-eyebrow">{v.eligible ? 'Unlocked' : `Unlocks at Elite · Level ${v.min_level || 5}`}</p>
          <h2 className="cg-panel-h serif" id="cg-vanity-h">Your own code</h2>
        </div>
      </div>
      <p className="cg-vanity__now"><span>Now</span><b className="cg-code">{v.code}</b></p>
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
        <>
          <p className="cg-note">Swap <b>{v.code}</b> for a code like <b className="cg-code cg-code--ghost">GHEEQUEEN</b>.</p>
          {toGo != null && toGo > 0 && (
            <div className="cg-vanity__prog">
              <span className="cg-vanity__bar"><i style={{ '--f': frac }} /></span>
              <small>{money(toGo)} more in confirmed sales</small>
            </div>
          )}
        </>
      )}
      {msg && <p className={`cg-msg is-${msg.tone}`} role="status">{msg.text}</p>}
    </div>
  );
}

function Discovered({ list }) {
  const [ref, seen, live] = useInView();
  const items = Array.isArray(list) ? list : [];
  return (
    <div ref={ref} className={`cd-panel cg-disc cg-reveal${inViewClass(seen, live)}`} aria-labelledby="cg-disc-h">
      <p className="cg-eyebrow">Discoverer</p>
      <h2 className="cg-panel-h serif" id="cg-disc-h">First sold by you</h2>
      {items.length ? (
        <>
          <p className="cg-note">Your name shows on these product pages for good.</p>
          <ul className="cg-disc__list">{items.slice(0, 6).map((n, i) => <li key={n} style={{ '--i': i }}><Icon name="sparkle" size={13} />{n}</li>)}</ul>
          {items.length > 6 && <p className="cg-note">+{items.length - 6} more</p>}
        </>
      ) : (
        <p className="cg-note">Be the first creator to sell a product and your name goes on its page for good. New launches are the easiest race to win.</p>
      )}
    </div>
  );
}

function Hamper({ reward }) {
  const [ref, seen, live] = useInView();
  return (
    <div ref={ref} className={`cd-panel cg-hamper cg-reveal${inViewClass(seen, live)}`}>
      <svg className="cg-gift" viewBox="0 0 80 80" aria-hidden="true">
        <g className="cg-gift__sparks"><circle cx="12" cy="18" r="2" /><circle cx="68" cy="14" r="2.4" /><circle cx="70" cy="44" r="1.6" /><circle cx="9" cy="48" r="1.6" /></g>
        <rect x="16" y="36" width="48" height="34" rx="4" className="cg-gift__box" />
        <rect x="36" y="36" width="8" height="34" className="cg-gift__ribbon" />
        <g className="cg-gift__lid">
          <rect x="12" y="26" width="56" height="12" rx="3" className="cg-gift__box cg-gift__box--lid" />
          <rect x="36" y="26" width="8" height="12" className="cg-gift__ribbon" />
          <path d="M40 26c-6-10-18-10-16-2 1 4 10 3 16 2Zm0 0c6-10 18-10 16-2-1 4-10 3-16 2Z" className="cg-gift__bow" />
        </g>
      </svg>
      <div>
        <p className="cg-eyebrow">Level {reward.level} unlock</p>
        <h3 className="cg-panel-h serif">Mystery hamper</h3>
        <p className="cg-note">What’s inside is a surprise. {reward.value ? `Worth ${reward.value}.` : ''}</p>
      </div>
    </div>
  );
}

// ---- Small pieces ----------------------------------------------------------
function Flame() {
  return (
    <svg className="cg-flame" viewBox="0 0 24 24" width="20" height="20">
      <path className="cg-flame__out" d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.2 1.6 1 2.6 2 3C10.6 8.6 11 5 12 2Z" />
      <path className="cg-flame__in" d="M12 11c.6 1.8 2.6 2.8 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.3.7-2.2 1.4-2.8.2.8.6 1.3 1.1 1.5-.3-1.5 0-2.7.1-3.7Z" />
    </svg>
  );
}

/**
 * The game on the dashboard: a small dark card with the medal and three
 * numbers, linking to the full game. Shown only when the game has loaded.
 */
export function GameTeaser({ game, standing, Link }) {
  const [ref, seen, live] = useInView();
  if (!game || game.ok === false) return null;
  const badges = badgeList(game);
  const earned = badges.filter((b) => b.earned).length;
  const visited = yatraTiles(game.map).visited;
  const me = (game.season?.members || []).find((m) => m.me);
  const league = leagueOf(game.season?.league);
  return (
    <section ref={ref} className={`cg-teaser${inViewClass(seen, live)}`} aria-label="Creator Game">
      <span className="cg-hero__sparks" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</span>
      <span className="cg-teaser__medal" aria-hidden="true">
        <span className="cg-medal__shine" />
        <Icon name="crown" size={16} />
        <b className="serif">{standing?.rank || game.rank || 'Rise'}</b>
      </span>
      <div className="cg-teaser__body">
        <p className="cg-hero__eyebrow">Creator Game</p>
        <p className="cg-teaser__h serif">Play to <em>grow</em></p>
        <ul className="cg-teaser__stats">
          <li><b>{earned}</b>/{badges.length} badges</li>
          <li><b>{visited}</b>/{STATE_TILES.length} states</li>
          <li>{me ? <><b>#{me.pos}</b> in {league.name}</> : league.name}</li>
        </ul>
      </div>
      <Link to="/creator/game" className="cg-btn cg-btn--gold cg-teaser__go">Play <Icon name="arrowRight" size={15} /></Link>
    </section>
  );
}
