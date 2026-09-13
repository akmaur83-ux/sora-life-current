import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import LeaderboardList from '../LeaderboardList.jsx';
import { CountUp } from './CreatorUI.jsx';
import { RewardChooser, RewardHistory } from './CreatorTier.jsx';
import { money2 } from '../../lib/format.js';
import { RANK_BADGES, rankSlot, rupees, tierProgress, sanitizeLeaderboard } from '../../lib/creatorTiers.js';
import { REWARD_TYPE_LABEL } from '../../lib/creatorRewards.js';
import { barChartGeometry, bucketLabel } from '../../lib/creatorSeries.js';

// ============================================================
// My Tier — the studio page.
//
// Everything is the ladder's own data: creator_tier_levels through
// my_creator_standing(), the creator's claims and the reward catalogue, the
// public board. Rank medallions are images where a badge has been supplied
// (RANK_BADGES) and a CSS rosette otherwise. Charts are hand-built SVG.
// ============================================================

const isZero = (v) => !(Number(v) > 0);
const DISMISS_KEY = 'crp.withdrawals-notice.dismissed';

// ---------------------------------------------------------------
// Dismissible amber bar. Dismissal lasts the session — the notice is about
// money, so it returns on the next visit rather than vanishing for good.
// ---------------------------------------------------------------
export function WithdrawalsBar({ open, initiallyDismissed = false }) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  useEffect(() => {
    try { if (window.sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true); } catch { /* storage unavailable */ }
  }, []);
  if (open || dismissed) return null;
  const dismiss = () => { setDismissed(true); try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* fine */ } };
  return (
    <div className="ct-bar" role="status" data-withdrawals="closed">
      <span className="ct-bar__ic" aria-hidden="true"><Icon name="lock" size={15} /></span>
      <p><strong>Withdrawals aren’t open yet.</strong> Your commission is accruing and stays yours; payout requests open once SORA LIFE’s tax registration is complete.</p>
      <button type="button" className="ct-bar__x" onClick={dismiss} aria-label="Dismiss for this session"><Icon name="x" size={16} /></button>
    </div>
  );
}

// ---------------------------------------------------------------
// Medallion: the supplied badge for this rank, else a CSS rosette.
// ---------------------------------------------------------------
export function RankMedallion({ rank, size = 112 }) {
  const slot = rankSlot(rank);
  const src = RANK_BADGES[slot];
  if (src) {
    return <img className="ct-medal ct-medal--img" src={src} width={size} height={size} alt={`${rank} rank badge`} data-rank={slot} loading="lazy" decoding="async" />;
  }
  return (
    <span className="ct-medal ct-medal--css" data-rank={slot} style={{ width: size, height: size }} role="img" aria-label={`${rank} rank`}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
        <circle className="ct-medal__halo" cx="40" cy="40" r="38" />
        <path className="ct-medal__rosette" d="M40 10l6.5 5.4 8.3-1.6 3.4 7.8 7.8 3.4-1.6 8.3L70 40l-5.6 6.7 1.6 8.3-7.8 3.4-3.4 7.8-8.3-1.6L40 70l-6.5-5.4-8.3 1.6-3.4-7.8-7.8-3.4 1.6-8.3L10 40l5.6-6.7-1.6-8.3 7.8-3.4 3.4-7.8 8.3 1.6z" />
        <circle className="ct-medal__inner" cx="40" cy="40" r="17" />
        <path className="ct-medal__mark" d="M40 29l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3-6.5-3.5-6.5 3.5 1.3-7.3-5.3-5.1 7.3-1z" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------
// Your current tier
// ---------------------------------------------------------------
export function CurrentTierCard({ standing }) {
  const p = tierProgress(standing);
  const pct = Math.round(p.fraction * 100);
  return (
    <section className="ct-panel ct-now" aria-labelledby="ct-now-h" data-rank={rankSlot(standing.rank)}>
      <h2 className="ct-panel__h" id="ct-now-h">Your current tier</h2>
      <div className="ct-now__body">
        <RankMedallion rank={standing.rank} />
        <div className="ct-now__txt">
          <div className="ct-now__rankline">
            <h3 className="ct-now__rank serif">{standing.rank}</h3>
            <span className="ct-chip">Level {standing.level}</span>
          </div>
          <p className="ct-now__rate"><strong>{Number(standing.rate)}%</strong> commission on every new sale</p>
          <div className="ct-now__prog">
            <div className="ct-now__prog-l">
              <span>{p.atTop ? 'Top of the ladder' : `Progress to Level ${standing.next_level}`}</span>
              <b>{pct}%</b>
            </div>
            <div className="cd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={p.atTop ? 'Top level reached' : `Progress to level ${standing.next_level}`}>
              <span className="cd-bar__fill" style={{ transform: `scaleX(${p.fraction})` }} />
            </div>
            <p className="ct-now__left">
              {p.atTop
                ? <>{rupees(standing.lifetime_confirmed_sales)} confirmed · {Number(standing.rate)}% on every sale from here</>
                : <><strong>{rupees(p.remaining)}</strong> more in confirmed sales to reach Level {standing.next_level}{standing.next_rate != null ? <> · unlocks {Number(standing.next_rate)}%</> : null}</>}
            </p>
          </div>
        </div>
      </div>
      <span className="ct-now__leaf" aria-hidden="true" />
    </section>
  );
}

// ---------------------------------------------------------------
// Your progression — bars of sales by period, latest in gold
// ---------------------------------------------------------------
export function ProgressionCard({ series }) {
  const points = Array.isArray(series?.sales) ? series.sales : [];
  // Money axis: never shorter than ₹1,000, so an empty chart reads in rupees.
  const g = barChartGeometry(points, { width: 360, height: 160, minMax: 1000 });
  const labels = Array.isArray(series?.labels) ? series.labels : [];
  const every = Math.max(1, Math.ceil(g.n / 6));
  return (
    <section className={`ct-panel ct-prog${g.empty ? ' is-empty' : ''}`} aria-labelledby="ct-prog-h">
      <div className="ct-panel__head">
        <h2 className="ct-panel__h" id="ct-prog-h">Your progression</h2>
        <span className="ct-panel__sub">{series?.available ? 'Sales attributed to you, by week' : 'Fills in as sales arrive'}</span>
      </div>
      <svg className="ct-bars" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={g.empty ? 'No sales in this period yet' : 'Attributed sales by week, latest week highlighted'}>
        {g.ticks.map((t) => <line key={t.v} className="ct-bars__grid" x1={g.padL} x2={g.width - g.padR} y1={t.y} y2={t.y} />)}
        {g.ticks.map((t) => <text key={`t${t.v}`} className="ct-bars__ytick" x={g.padL - 6} y={t.y + 3.5} textAnchor="end">{t.label}</text>)}
        {g.bars.map((b, i) => (
          <g key={i}>
            <rect className={`ct-bars__bar${i === g.n - 1 ? ' is-now' : ''}${b.h === 0 ? ' is-zero' : ''}`} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 2)} rx="3" />
            {(i % every === 0 || i === g.n - 1) && <text className="ct-bars__xtick" x={b.x + b.w / 2} y={g.height - 6} textAnchor="middle">{bucketLabel(labels[i], series?.unit)}</text>}
          </g>
        ))}
      </svg>
      {g.empty && <p className="ct-panel__empty">No attributed sales yet — each bar fills in as orders arrive through your links.</p>}
    </section>
  );
}

// ---------------------------------------------------------------
// Four stat cards
// ---------------------------------------------------------------
export function TierStats({ standing, holdDays = 7 }) {
  const cards = [
    { key: 'lifetime_confirmed_sales', icon: 'award', label: 'Lifetime Confirmed Sales', tone: 'ok', line: 'Counts toward your tier' },
    { key: 'pending_commission', icon: 'clock', label: 'Pending Commission', tone: 'hold', line: `Confirms ${holdDays} days after delivery` },
    { key: 'confirmed_commission', icon: 'checkCircle', label: 'Confirmed Commission', tone: 'ok', line: 'Earned at the rate of the day' },
    { key: 'pending_sales', icon: 'package', label: 'Awaiting Confirmation', tone: 'hold', line: 'Sales not yet counted' },
  ];
  return (
    <div className="ct-stats">
      {cards.map((c) => {
        const v = Number(standing?.[c.key] ?? 0);
        return (
          <article key={c.key} className={`ct-stat${isZero(v) ? ' is-zero' : ''}`} data-tone={c.tone}>
            <span className="ct-stat__tile" aria-hidden="true"><Icon name={c.icon} size={18} /></span>
            <span className="ct-stat__label">{c.label}</span>
            <div className="ct-stat__fig"><CountUp value={v} format={money2} /></div>
            <span className="ct-stat__line">{c.line}</span>
          </article>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------
// The ladder — every level, current highlighted, scrollable + expandable
// ---------------------------------------------------------------
export function LadderTable({ standing }) {
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : [];
  const [open, setOpen] = useState(false);
  if (ladder.length === 0) return null;
  const current = Number(standing.level);
  const top = ladder[ladder.length - 1];
  return (
    <section className="ct-panel ct-ladder" aria-labelledby="ct-ladder-h">
      <div className="ct-panel__head">
        <h2 className="ct-panel__h" id="ct-ladder-h">Tier ladder</h2>
        <span className="ct-panel__sub">{ladder.length} levels · your rate follows confirmed lifetime sales</span>
      </div>
      <div className={`ct-ladder__scroll${open ? ' is-open' : ''}`}>
        <table className="ct-table">
          <thead><tr><th>Level</th><th>Rank</th><th className="ta-r">Commission</th><th className="ta-r">Required confirmed sales</th></tr></thead>
          <tbody>
            {ladder.map((l) => {
              const lv = Number(l.level);
              const state = lv === current ? 'is-current' : lv < current ? 'is-done' : '';
              return (
                <tr key={lv} className={state} data-rank={rankSlot(l.rank)} aria-current={lv === current ? 'true' : undefined}>
                  <td><span className="ct-table__lv">L{lv}</span></td>
                  <td><span className="ct-table__rank"><i className="ct-dot" aria-hidden="true" />{l.rank}{lv === current && <em className="ct-table__you">You</em>}</span></td>
                  <td className="ta-r"><b>{Number(l.rate)}%</b></td>
                  <td className="ta-r">{rupees(l.threshold)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="ct-ladder__foot">
        <button type="button" className="ct-ladder__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Collapse the ladder' : `Show all ${ladder.length} levels`}</button>
        {standing.beyond_step > 0 && top && <span className="ct-panel__sub">Beyond Level {top.level}: a new level every {rupees(standing.beyond_step)}, at {Number(top.rate)}%.</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Rewards at milestones
// ---------------------------------------------------------------
export function MilestoneRewards({ standing, rewards, catalog, onClaim, onChanged }) {
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : [];
  const current = Number(standing?.level ?? 1);
  const upcoming = ladder.filter((l) => Number(l.level) > current).slice(0, 3);
  const byLevel = new Map();
  for (const r of Array.isArray(catalog) ? catalog : []) {
    const lv = Number(r?.level); if (!Number.isInteger(lv)) continue;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(r);
  }
  const next = upcoming[0] || null;
  const nextOptions = next ? byLevel.get(Number(next.level)) || [] : [];
  const remaining = next ? Math.max(0, Number(next.threshold) - Number(standing.lifetime_confirmed_sales || 0)) : 0;
  return (
    <section className="ct-panel ct-rewards" aria-labelledby="ct-rewards-h">
      <div className="ct-panel__head">
        <h2 className="ct-panel__h" id="ct-rewards-h">Rewards at milestones</h2>
        <span className="ct-panel__sub">Every level carries a reward. You choose one of three when you reach it.</span>
      </div>

      <RewardChooser rewards={rewards} onClaim={onClaim} onChanged={onChanged} />

      {next ? (
        <div className="ct-next" data-rank={rankSlot(next.rank)}>
          <span className="ct-next__ic" aria-hidden="true"><Icon name="gift" size={18} /></span>
          <div className="ct-next__txt">
            <strong>Next milestone: Level {next.level} · {next.rank}</strong>
            <span>{rupees(remaining)} more in confirmed sales · {Number(next.rate)}% commission from then on</span>
          </div>
          <span className={`ct-chip${nextOptions.length ? ' is-live' : ' is-soon'}`}>{nextOptions.length ? `${nextOptions.length} option${nextOptions.length === 1 ? '' : 's'} to choose from` : 'Coming soon'}</span>
        </div>
      ) : (
        <div className="ct-next is-top"><span className="ct-next__ic" aria-hidden="true"><Icon name="crown" size={18} /></span><div className="ct-next__txt"><strong>You’ve reached the top of the ladder</strong><span>{Number(standing.rate)}% on every new sale</span></div></div>
      )}

      {upcoming.length > 0 && (
        <div className="ct-milestones">
          {upcoming.map((l) => {
            const opts = byLevel.get(Number(l.level)) || [];
            return (
              <article key={l.level} className="ct-milestone" data-rank={rankSlot(l.rank)}>
                <span className="ct-milestone__lv">Level {l.level}</span>
                <h3 className="ct-milestone__rank serif">{l.rank}</h3>
                <p className="ct-milestone__req">{rupees(l.threshold)} confirmed · {Number(l.rate)}%</p>
                {opts.length > 0 ? (
                  <ul className="ct-milestone__opts">
                    {opts.slice(0, 3).map((o) => <li key={o.id || o.option_index}><span className="ct-milestone__type">{REWARD_TYPE_LABEL[o.reward_type] || 'Reward'}</span>{o.label}</li>)}
                  </ul>
                ) : (
                  <span className="ct-chip is-soon">Coming soon</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Leaderboard strip: top three + you
// ---------------------------------------------------------------
export function LeaderboardStrip({ rows, standing }) {
  const list = sanitizeLeaderboard(rows);
  const pos = standing?.leaderboard_position || null;
  const [open, setOpen] = useState(false);
  const top = list.slice(0, 3);
  const me = pos && pos > 3 ? list.find((r) => r.rank_position === pos) : null;
  return (
    <section className="ct-panel ct-board" aria-labelledby="ct-board-h">
      <div className="ct-panel__head">
        <h2 className="ct-panel__h" id="ct-board-h">Creator leaderboard</h2>
        <span className="ct-panel__sub">{pos ? `You’re #${pos} of ${standing.leaderboard_total}` : 'You join the board with your first confirmed sale'}</span>
      </div>
      {list.length === 0 ? (
        <p className="ct-panel__empty">The board opens with the first confirmed sale.</p>
      ) : (
        <ol className="ct-strip">
          {top.map((r) => (
            <li key={r.rank_position} className={`ct-strip__row${pos === r.rank_position ? ' is-me' : ''}`} data-rank={rankSlot(r.rank_name)}>
              <span className="ct-strip__pos">{String(r.rank_position).padStart(2, '0')}</span>
              <span className="ct-strip__name serif">{r.display_name}</span>
              <span className="ct-strip__tier"><i className="ct-dot" aria-hidden="true" />{r.rank_name} · L{r.level}</span>
            </li>
          ))}
          {me && (
            <li className="ct-strip__row is-me" data-rank={rankSlot(me.rank_name)}>
              <span className="ct-strip__pos">{String(me.rank_position).padStart(2, '0')}</span>
              <span className="ct-strip__name serif">{me.display_name}</span>
              <span className="ct-strip__tier"><i className="ct-dot" aria-hidden="true" />{me.rank_name} · L{me.level}</span>
            </li>
          )}
          {pos && pos > 100 && <li className="ct-strip__row is-me is-out"><span className="ct-strip__pos">#{pos}</span><span className="ct-strip__name">You — outside the top 100</span><span className="ct-strip__tier">every confirmed sale moves you up</span></li>}
        </ol>
      )}
      {list.length > 3 && (
        <div className="ct-board__more">
          <button type="button" className="ct-ladder__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Hide the full board' : 'View the full board'}</button>
        </div>
      )}
      {open && <div className="ct-board__full sl-dark"><LeaderboardList rows={list} initial={20} highlightPosition={pos} /></div>}
    </section>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorTierPage({ standing, rewards, catalog = [], leaderboard, series, holdDays = 7, onClaim, onChanged, noticeDismissed = false }) {
  if (!standing || standing.ok === false) {
    return (
      <>
        <h1 className="crp__h1 serif">My Tier</h1>
        <p className="crp__lede">Your tier appears once your account is active.</p>
      </>
    );
  }
  return (
    <div className="ct">
      <div className="ct-head">
        <div>
          <h1 className="crp__h1 serif">My Tier</h1>
          <p className="crp__lede">Your rank is earned on confirmed sales through your own links — no teams, no referrals. Every level raises your commission on the sales that follow.</p>
        </div>
        <p className="ct-head__line serif">Every confirmed sale lifts your rank — <br />and your rate with it.</p>
      </div>

      <WithdrawalsBar open={!!standing.withdrawals_open} initiallyDismissed={noticeDismissed} />

      <div className="ct-row ct-row--top">
        <CurrentTierCard standing={standing} />
        <ProgressionCard series={series} />
      </div>

      <TierStats standing={standing} holdDays={holdDays} />

      <div className="ct-row ct-row--mid">
        <LadderTable standing={standing} />
        <MilestoneRewards standing={standing} rewards={rewards} catalog={catalog} onClaim={onClaim} onChanged={onChanged} />
      </div>

      <RewardHistory rewards={rewards} />
      <LeaderboardStrip rows={leaderboard} standing={standing} />

      <p className="crp__foot-note">
        Sales count once the order is delivered and the {holdDays}-day return window has passed. See <Link to="/creator/how-it-works">how you earn</Link>.
      </p>
    </div>
  );
}
