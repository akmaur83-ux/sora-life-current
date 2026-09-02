import Icon from '../Icon.jsx';
import { money2 } from '../../lib/format.js';

// ============================================================
// "How you earn" — the real pipeline, in the creator's words.
//
// EVERY number on this page comes from live configuration, never from a
// marketing assumption:
//
//   commission rate       creator_partners.default_commission_rate
//   attribution window    creator_partners.default_attribution_window_days
//   hold period           site_settings.creator_payouts.settlement_hold_days
//   minimum payout        site_settings.creator_payouts.min_payout
//   payout day            site_settings.creator_payouts.payout_day
//
// all surfaced through my_creator_earnings(). If a value is not available
// yet the step says so rather than inventing a figure — an earnings page
// that guesses is worse than one that admits it does not know.
//
// The wording tracks the actual implementation: a campaign can override the
// rate, the rate is SNAPSHOT at the moment a sale qualifies, a refund books
// a reversal at that same snapshot rate, and a payout currently settles the
// whole cleared balance (0023) and is paid manually by an admin — there is
// no automatic bank transfer.
// ============================================================

const ordinal = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const k = v % 100;
  return `${v}${s[(k - 20) % 10] || s[k] || s[0]}`;
};

export default function CreatorHowItWorks({ creator, earnings }) {
  const rate = Number(earnings?.commission_rate ?? creator?.default_commission_rate);
  const holdDays = Number(earnings?.settlement_hold_days);
  const minPayout = Number(earnings?.min_payout);
  const payoutDay = Number(earnings?.payout_day);
  const windowDays = Number(creator?.default_attribution_window_days);

  const has = (n) => Number.isFinite(n) && n > 0;

  const steps = [
    {
      icon: 'externalLink',
      tone: 'brand',
      title: 'Share your link or code',
      body: has(windowDays)
        ? `Every visit through your link is recorded against your account for ${windowDays} days. If that shopper buys within the window, the sale is attributed to you.`
        : 'Every visit through your link is recorded against your account, and a purchase within your attribution window is attributed to you.',
    },
    {
      icon: 'bag',
      tone: 'brand',
      title: 'They shop as normal',
      body: 'Nothing changes for the customer — same price, same checkout. You never see their personal details.',
    },
    {
      icon: 'check',
      tone: 'ok',
      title: 'The sale qualifies',
      body: has(rate)
        ? `Once the order is paid, commission is calculated at ${rate}% of the eligible sale value and locked in at that rate. A campaign link can carry its own rate, and later rate changes never alter commission you have already earned.`
        : 'Once the order is paid, commission is calculated on the eligible sale value at your agreed rate and locked in — later rate changes never alter commission you have already earned.',
    },
    {
      icon: 'clock',
      tone: 'warn',
      title: 'It waits out the hold period',
      body: has(holdDays)
        ? `Commission sits as Held for ${holdDays} days after the sale qualifies. This covers returns and cancellations — if an order is refunded in that time, the commission is reversed at the same rate it was earned.`
        : 'Commission sits as Held for a settlement period after the sale qualifies, covering returns and cancellations.',
    },
    {
      icon: 'card',
      tone: 'ok',
      title: 'It clears to Available',
      body: 'When the hold period passes, the commission moves to your available balance. That is the money you can withdraw.',
    },
    {
      icon: 'shield',
      tone: 'brand',
      title: 'Verify your details once',
      body: 'Submit your KYC and payout details. We store them masked, and an admin verifies them before your first withdrawal.',
    },
    {
      icon: 'arrowRight',
      tone: 'brand',
      title: 'Request your payout',
      body: [
        has(payoutDay) ? `Requests open on the ${ordinal(payoutDay)} of each month` : 'Requests open on the configured payout day each month',
        has(minPayout) ? `once your available balance reaches ${money2(minPayout)}` : 'once your available balance reaches the minimum',
      ].join(', ') + '. A request withdraws your full cleared balance, and that exact amount is reserved against your ledger.',
    },
    {
      icon: 'award',
      tone: 'ok',
      title: 'We verify and pay you',
      body: 'An admin reviews the request and transfers the money to your verified account. The transfer is made manually and then recorded here with its reference — the amount paid always matches the amount approved.',
    },
  ];

  return (
    <section className="crp-hiw">
      <header className="crp-hiw__head">
        <h2 className="crp-hiw__title">How you earn</h2>
        <p className="crp-hiw__lede">
          From a shared link to money in your account — this is exactly what happens, and nothing else.
        </p>
      </header>

      <ol className="crp-hiw__steps">
        {steps.map((s, i) => (
          <li key={s.title} className={`crp-hiw__step is-${s.tone}`}>
            <span className="crp-hiw__num" aria-hidden="true">{i + 1}</span>
            <span className="crp-hiw__ic" aria-hidden="true"><Icon name={s.icon} size={17} /></span>
            <div className="crp-hiw__body">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="crp-hiw__foot">
        <Icon name="circleAlert" size={15} />
        <span>
          Commission is earned on eligible sale value, not on shipping or fees. Self-referred orders don’t
          qualify. Payouts are made manually by our team — SORA LIFE never moves money automatically.
        </span>
      </p>
    </section>
  );
}
