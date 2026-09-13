import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import LeaderboardList from '../LeaderboardList.jsx';
import { money2 } from '../../lib/format.js';
import { CountUp } from './CreatorUI.jsx';
import { rankSlot, rupees, tierProgress } from '../../lib/creatorTiers.js';
import {
  CLAIM_STATUS_LABEL, REWARD_TYPE_LABEL, claimHistory, claimableLevels, friendlyClaimError,
} from '../../lib/creatorRewards.js';

// ============================================================
// Creator portal — tier, rewards, leaderboard, withdrawals notice.
//
// Every figure here comes from my_creator_standing() / my_creator_rewards():
// the ledger decides the level, the rate and the position. This file only
// explains them. The dark treatment (.sl-dark, leaderboard.css) is shared with
// the homepage leaderboard so the two read as one system.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—');

// ---------------------------------------------------------------
// Withdrawals closed — said up front, wherever money is shown.
// ---------------------------------------------------------------
export function WithdrawalsNotice({ open, compact = false }) {
  if (open) return null;
  return (
    <div className={`ctier-notice${compact ? ' is-compact' : ''}`} role="status" data-withdrawals="closed">
      <span className="ctier-notice__mark" aria-hidden="true"><Icon name="lock" size={14} /></span>
      <div>
        <strong>Withdrawals aren’t open yet.</strong>{' '}
        Your commission is accruing and stays yours — every confirmed sale is recorded against your account.
        Payout requests open once SORA LIFE’s tax registration is complete; we’ll tell you here the day they do.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Rank badge — the rank name in its own colour, with a soft glow behind it.
// `current` adds the shimmer: only the creator's OWN present rank shimmers.
// ---------------------------------------------------------------
export function RankBadge({ rank, level, current = false, size = 'md' }) {
  if (!rank) return null;
  return (
    <span className={`ck-rank is-${size}${current ? ' is-current' : ''}`} data-rank={rankSlot(rank)}>
      <span className="ck-rank__glow" aria-hidden="true" />
      <span className="ck-rank__label">{rank}</span>
      {level != null && <span className="ck-rank__lv">L{level}</span>}
    </span>
  );
}

// ---------------------------------------------------------------
// Standing — rank, level, rate, progress, the four figures.
// ---------------------------------------------------------------
export function TierStanding({ standing, compact = false, holdDays = 7 }) {
  if (!standing || standing.ok === false) return null;
  const progress = tierProgress(standing);
  const slot = rankSlot(standing.rank);
  const pos = standing.leaderboard_position;

  return (
    <section className={`ctier sl-dark${compact ? ' is-compact' : ''}`} data-rank={slot} aria-label="Your tier">
      <span className="ctier__glow" aria-hidden="true" />
      <div className="ctier__head">
        <div>
          <p className="ctier__eyebrow">Your rank</p>
          <h2 className="ctier__rank">{standing.rank}</h2>
          <p className="ctier__level">
            <RankBadge rank={standing.rank} level={standing.level} current size="sm" />
            <span><strong>{Number(standing.rate)}%</strong> commission on new sales</span>
          </p>
        </div>
        {!compact && (
          <div className="ctier__pos">
            <span className="ctier__pos-l">Leaderboard</span>
            <span className="ctier__pos-v">{pos ? `#${pos}` : '—'}</span>
            <span className="ctier__pos-h">{pos ? `of ${standing.leaderboard_total}` : 'after your first confirmed sale'}</span>
          </div>
        )}
      </div>

      <div className="ctier__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}
        aria-label={progress.atTop ? 'Top level reached' : `Progress to level ${standing.next_level}`}>
        <span className="ctier__bar"><span className="ctier__fill" style={{ transform: `scaleX(${progress.fraction})` }} /></span>
        <span className="ctier__progress-copy">
          {progress.atTop
            ? <>Top of the ladder — {Number(standing.rate)}% on every new sale.</>
            : <><strong>{rupees(progress.remaining)}</strong> more in confirmed sales to Level {standing.next_level}
                {standing.next_rate != null && Number(standing.next_rate) !== Number(standing.rate) ? <> · unlocks <strong>{Number(standing.next_rate)}%</strong></> : null}</>}
        </span>
      </div>

      {!compact && (
        <dl className="ctier__stats">
          <div><dt>Lifetime confirmed sales</dt><dd><CountUp value={standing.lifetime_confirmed_sales} format={money2} /></dd></div>
          <div><dt>Pending commission</dt><dd><CountUp value={standing.pending_commission} format={money2} /></dd><dd className="ctier__hint">Confirms {holdDays} days after delivery</dd></div>
          <div><dt>Confirmed commission</dt><dd><CountUp value={standing.confirmed_commission} format={money2} /></dd></div>
          <div><dt>Awaiting confirmation</dt><dd><CountUp value={standing.pending_sales} format={money2} /></dd><dd className="ctier__hint">Sales not yet counted</dd></div>
        </dl>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Ladder — every level, the current one marked.
// ---------------------------------------------------------------
export function TierLadder({ standing }) {
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : [];
  if (ladder.length === 0) return null;
  const current = Number(standing.level);
  const top = ladder[ladder.length - 1];
  return (
    <section className="crp__panel ctier-ladder" aria-label="Tier ladder">
      <h2 className="crp__panel-h">How the ladder works</h2>
      <p className="crp__meta">Your rate is set by confirmed lifetime sales through your links. It applies to every sale after you cross a threshold — earlier sales keep the rate they were recorded at.</p>
      <ol className="ctier-ladder__list">
        {ladder.map((l) => {
          const lv = Number(l.level);
          const state = lv === current ? 'is-current' : lv < current ? 'is-done' : '';
          return (
            <li key={lv} className={`ctier-ladder__row ${state}`} data-rank={rankSlot(l.rank)}>
              <span className="ctier-ladder__lv">L{lv}</span>
              <span className="ctier-ladder__rank"><span className="ctier-ladder__dot" aria-hidden="true" />{l.rank}</span>
              <span className="ctier-ladder__th">{rupees(l.threshold)}</span>
              <span className="ctier-ladder__rate">{Number(l.rate)}%</span>
            </li>
          );
        })}
      </ol>
      {top && standing.beyond_step > 0 && (
        <p className="crp__foot-note">Beyond Level {top.level}: a new level every {rupees(standing.beyond_step)} in confirmed sales, at {Number(top.rate)}%.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Rewards — the three-option chooser for each unlocked level, and history.
// A level with no options configured is simply not here.
// ---------------------------------------------------------------
export function RewardChooser({ rewards, onClaim, onChanged }) {
  const levels = claimableLevels(rewards);
  const [busy, setBusy] = useState(null);   // `${level}:${id}`
  const [confirm, setConfirm] = useState(null); // { level, option }
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  if (levels.length === 0) return null;

  const claim = async (level, option) => {
    setBusy(`${level}:${option.id}`); setErr('');
    try {
      const res = await onClaim(level, option.id);
      if (!res || res.ok === false) { setErr(friendlyClaimError(res?.reason)); }
      else { setDone({ level, label: option.label }); setConfirm(null); await onChanged(); }
    } catch { setErr('Something went wrong. Please try again.'); }
    setBusy(null);
  };

  return (
    <section className="ctier-rewards sl-dark" aria-label="Rewards to claim">
      {levels.map((lv) => (
        <div key={lv.level} className="ctier-rewards__level" data-rank={rankSlot(lv.rank)} data-level={lv.level}>
          <div className="ctier-rewards__head">
            <p className="ctier__eyebrow">Level {lv.level} reward{lv.rank ? ` · ${lv.rank}` : ''}</p>
            <h3 className="ctier-rewards__h">Choose one</h3>
            <p className="ctier-rewards__copy">You unlocked this level. Pick the reward you want — the choice is final once made.</p>
          </div>
          <div className="ctier-rewards__options" role="list">
            {lv.options.map((o) => {
              const pending = confirm && confirm.level === lv.level && confirm.option.id === o.id;
              const key = `${lv.level}:${o.id}`;
              return (
                <div key={o.id} className={`ctier-option${pending ? ' is-pending' : ''}`} role="listitem">
                  <span className="ctier-option__type">{REWARD_TYPE_LABEL[o.reward_type] || 'Reward'}</span>
                  <h4 className="ctier-option__label">{o.label}</h4>
                  {o.value && <p className="ctier-option__value">{o.value}</p>}
                  {o.description && <p className="ctier-option__desc">{o.description}</p>}
                  {pending ? (
                    <div className="ctier-option__confirm">
                      <p>Confirm <strong>{o.label}</strong> for Level {lv.level}? You can’t change it later.</p>
                      <div className="ctier-option__acts">
                        <button type="button" className="ctier-btn" disabled={busy === key} onClick={() => claim(lv.level, o)}>
                          {busy === key ? 'Claiming…' : 'Yes, claim it'}
                        </button>
                        <button type="button" className="ctier-btn is-ghost" disabled={busy === key} onClick={() => setConfirm(null)}>Back</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="ctier-btn is-ghost" disabled={!!busy} onClick={() => { setErr(''); setConfirm({ level: lv.level, option: o }); }}>
                      Choose
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {err && <p className="ctier-rewards__err" role="alert">{err}</p>}
      {done && !err && <p className="ctier-rewards__ok" role="status">Claimed: {done.label} for Level {done.level}. Our team will be in touch to fulfil it.</p>}
    </section>
  );
}

export function RewardHistory({ rewards }) {
  const claims = claimHistory(rewards);
  if (claims.length === 0) return null;
  return (
    <section className="crp__panel ctier-history" aria-label="Reward history">
      <h2 className="crp__panel-h">Your rewards</h2>
      <ul className="ctier-history__list">
        {claims.map((c) => (
          <li key={c.id || c.level} className={`ctier-history__row is-${c.status}`}>
            <span className="ctier-history__lv">Level {c.level}</span>
            <span className="ctier-history__label">{c.label}{c.value ? <em> · {c.value}</em> : null}</span>
            <span className="ctier-history__when">{fmtDate(c.claimed_at)}</span>
            <span className={`crp__pill is-${c.status === 'fulfilled' ? 'ok' : c.status === 'cancelled' ? 'bad' : 'warn'}`}>{CLAIM_STATUS_LABEL[c.status]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------
// Portal leaderboard — the public list, with the creator's own row marked.
// ---------------------------------------------------------------
export function PortalLeaderboard({ rows, standing }) {
  const pos = standing?.leaderboard_position || null;
  const total = standing?.leaderboard_total || 0;
  return (
    <section className="ctier-board sl-dark" aria-labelledby="ctier-board-h">
      <div className="ctier-board__head">
        <p className="ctier__eyebrow">Creator leaderboard</p>
        <h2 className="ctier-board__h" id="ctier-board-h">{pos ? `You’re #${pos} of ${total}` : 'Top creators'}</h2>
        <p className="ctier-board__copy">Ranked by confirmed sales. The board shows names, ranks and levels only — your figures stay private.</p>
      </div>
      <LeaderboardList rows={rows} initial={10} highlightPosition={pos} emptyText="The board opens with the first confirmed sale." />
      {pos && pos > 100 && <p className="ctier-board__foot">You’re outside the top 100 — every confirmed sale moves you up.</p>}
    </section>
  );
}

// ---------------------------------------------------------------
// The whole tab.
// ---------------------------------------------------------------
export default function CreatorTier({ standing, rewards, leaderboard, holdDays = 7, onClaim, onChanged }) {
  const open = !!standing?.withdrawals_open;
  return (
    <>
      <h1 className="serif crp__h1">My tier</h1>
      <p className="crp__lede">
        Your rank is earned on confirmed sales through your own links — no teams, no referrals. Every level
        raises your commission on the sales that follow.
      </p>
      <WithdrawalsNotice open={open} />
      <TierStanding standing={standing} holdDays={holdDays} />
      <RewardChooser rewards={rewards} onClaim={onClaim} onChanged={onChanged} />
      <RewardHistory rewards={rewards} />
      <PortalLeaderboard rows={leaderboard} standing={standing} />
      <TierLadder standing={standing} />
      <p className="crp__foot-note">
        Sales count once the order is delivered and the {holdDays}-day return window has passed. See <Link to="/creator/how-it-works">how you earn</Link>.
      </p>
    </>
  );
}
