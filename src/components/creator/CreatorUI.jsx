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

// ---- Data band -------------------------------------------------------
// Replaces one-card-per-number. A single rectangular panel whose cells are
// separated by 1px rules, so four figures read as one object on a shared
// baseline instead of four stacked boxes.
export function Band({ cols, children }) {
  return <div className={`ck-band ${cols === 3 ? 'ck-band--3' : ''}`}>{children}</div>;
}

/** One figure inside a Band. `tone` draws a short rule above the label. */
export function Cell({ label, value, tone, hint, mono = false }) {
  return (
    <div className="ck-band__cell" data-tone={TONES.includes(tone) && tone !== 'neutral' ? tone : undefined}>
      <span className="ck-band__label">{label}</span>
      <div className={`ck-band__fig ${mono ? 'is-mono' : ''}`}>{value}</div>
      {hint && <p className="ck-band__hint">{hint}</p>}
    </div>
  );
}

/**
 * Financial composition: one dominant figure, then a ruled row of the
 * supporting states. The balance a creator can act on should not be one of
 * four equal tiles.
 */
export function Balance({ label, value, hint, children }) {
  return (
    <div className="ck-balance">
      <div className="ck-balance__main">
        <span className="ck-band__label">{label}</span>
        <div className="ck-balance__fig">{value}</div>
        {hint && <p className="ck-balance__hint">{hint}</p>}
      </div>
      <div className="ck-balance__row">{children}</div>
    </div>
  );
}

/** Identity + key terms header. Replaces a row of stat cards. */
export function IdBar({ eyebrow, name, items = [] }) {
  return (
    <header className="ck-idbar">
      {eyebrow && <span className="ck-idbar__eyebrow">{eyebrow}</span>}
      <h1 className="ck-idbar__name">{name}</h1>
      {items.length > 0 && (
        <div className="ck-idbar__meta">
          {items.map((it) => (
            <div className="ck-idbar__item" key={it.k}>
              <span className="ck-idbar__k">{it.k}</span>
              <span className="ck-idbar__v">{it.v}</span>
            </div>
          ))}
        </div>
      )}
    </header>
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
export function Step({ done, next = false, index, tone = 'neutral', title, body }) {
  const label = done ? 'Done' : next ? 'Next' : '';
  return (
    <li className={`ck-step ${done ? 'is-done' : ''} ${next ? 'is-next' : ''} ${toneClass(done ? 'ok' : tone)}`}>
      <span className="ck-step__mark" aria-hidden="true">{String(index).padStart(2, '0')}</span>
      <div className="ck-step__body">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <span className="ck-step__state">{label}</span>
    </li>
  );
}
