import Icon from '../Icon.jsx';

// ============================================================
// Creator Program shared UI primitives.
//
// Three small components the whole portal composes from, so every page
// speaks the same visual language and a change lands everywhere at once.
//
// The `tone` prop is the important idea: colour here is MEANING, not
// decoration, and these are the only five it may carry.
//
//   ok      money that is yours         available, paid, done
//   hold    waiting, not yet spendable  held, pending review
//   info    information / performance   analytics, counts
//   brand   creator identity + actions  code, links, campaigns
//   bad     something went backwards    reversed, rejected
//
// Anything without a meaning uses `neutral` and stays quiet.
// ============================================================

export const TONES = ['ok', 'hold', 'info', 'brand', 'bad', 'neutral'];
const toneClass = (tone) => `ck-tone-${TONES.includes(tone) ? tone : 'neutral'}`;

/**
 * A single figure with its meaning attached.
 *
 * `hint` is where the honest caveat goes — "clears after the hold period",
 * "counts every visit through your links" — so a number is never presented
 * without the reader knowing what it actually counts.
 */
export function Metric({ label, value, tone = 'neutral', icon, hint, mono = false, hero = false, children }) {
  return (
    <div className={`ck-metric ${hero ? 'ck-metric--hero' : ''} ${toneClass(tone)}`}>
      <div className="ck-metric__top">
        {icon && <span className="ck-metric__ic" aria-hidden="true"><Icon name={icon} size={15} /></span>}
        <span className="ck-metric__label">{label}</span>
      </div>
      <div className={`ck-metric__value ${mono ? 'is-mono' : ''}`}>{value}</div>
      {hint && <p className="ck-metric__hint">{hint}</p>}
      {children && <div className="ck-metric__foot">{children}</div>}
    </div>
  );
}

/** Section heading with an optional right-hand link. */
export function Section({ title, sub, action, children, className = '' }) {
  return (
    <section className={`ck-section ${className}`}>
      <header className="ck-section__head">
        <div>
          <h2 className="ck-section__title">{title}</h2>
          {sub && <p className="ck-section__sub">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Empty state.
 *
 * An empty creator account is the FIRST thing a new creator sees, and a bare
 * white box reads as broken. `points` is for explaining what will fill this
 * space — never for implying data that does not exist.
 */
export function Empty({ icon = 'sparkle', tone = 'neutral', title, body, points, children }) {
  return (
    <div className={`ck-empty ${toneClass(tone)}`}>
      <span className="ck-empty__ic" aria-hidden="true"><Icon name={icon} size={21} /></span>
      <h3 className="ck-empty__title">{title}</h3>
      {body && <p className="ck-empty__body">{body}</p>}
      {Array.isArray(points) && points.length > 0 && (
        <ul className="ck-empty__points">
          {points.map((p) => (
            <li key={p}><Icon name="check" size={14} /><span>{p}</span></li>
          ))}
        </ul>
      )}
      {children && <div className="ck-empty__foot">{children}</div>}
    </div>
  );
}

/** Status chip. */
export function Pill({ tone = 'neutral', children, dot = true }) {
  return (
    <span className={`ck-pill ${toneClass(tone)}`}>
      {dot && <span className="ck-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * One item in a "what to do next" checklist.
 * `done` is driven by real account state — never optimistic.
 */
export function Step({ done, index, tone = 'neutral', title, body }) {
  return (
    <li className={`ck-step ${done ? 'is-done' : ''} ${toneClass(done ? 'ok' : tone)}`}>
      <span className="ck-step__mark" aria-hidden="true">
        {done ? <Icon name="check" size={13} /> : index}
      </span>
      <div className="ck-step__body">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </li>
  );
}
