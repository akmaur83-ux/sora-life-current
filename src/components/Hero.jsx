import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { heroSlides } from '../lib/settings.js';

const BENEFITS = [
  { icon: 'award', a: 'Himalayan', b: 'Superfood' },
  { icon: 'leaf', a: 'Rich in 190+', b: 'Nutrients' },
  { icon: 'shield', a: 'Boosts Immunity', b: '& Wellness' },
];

const INTERVAL = 6000;

export default function Hero() {
  const SLIDES = heroSlides;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState({}); // { [slideId]: true } — fall back to poster on load error
  const timer = useRef(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((i) => setActive((i + SLIDES.length) % SLIDES.length), [SLIDES.length]);
  const next = useCallback(() => setActive((a) => (a + 1) % SLIDES.length), [SLIDES.length]);

  useEffect(() => {
    if (paused || reduced || SLIDES.length < 2) return;
    timer.current = setTimeout(next, INTERVAL);
    return () => clearTimeout(timer.current);
  }, [active, paused, reduced, next, SLIDES.length]);

  return (
    <section
      className="bh-hero bh-hero--carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Sora Life featured"
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`bh-slide ${i === active ? 'is-active' : ''}`}
          aria-hidden={i !== active}
        >
          {s.kind === 'video' && !videoFailed[s.id] && s.src ? (
            <video
              className="bh-hero__media"
              autoPlay muted loop playsInline preload="metadata"
              poster={s.poster}
              style={{ objectPosition: s.position }}
              onError={() => setVideoFailed((v) => ({ ...v, [s.id]: true }))}
            >
              <source src={s.src} type="video/mp4" />
            </video>
          ) : s.kind === 'video' ? (
            // Video missing/failed to load — never show a blank hero, use the poster instead.
            s.poster
              ? <img className="bh-hero__media" src={s.poster} alt={s.title} style={{ objectPosition: s.position }} />
              : <div className="bh-hero__media" style={{ background: 'var(--forest-700)' }} />
          ) : (
            <img className="bh-hero__media" src={s.src} alt={s.title} loading={i === 0 ? 'eager' : 'lazy'}
              style={{ objectPosition: s.position }} />
          )}
          <div className="bh-hero__scrim" />
          <div className="container bh-hero__inner">
            <div className="bh-hero__copy">
              <p className="bh-hero__kicker">{s.kicker}</p>
              <h1 className="bh-hero__title">{s.title}</h1>
              <p className="bh-hero__sub">{s.sub}</p>
              <p className="bh-hero__lede">{s.lede}</p>
              <Link to={s.cta.to} className="btn btn-lg bh-hero__cta">{s.cta.label} <Icon name="arrowRight" size={18} /></Link>
              <div className="bh-hero__benefits">
                {BENEFITS.map((b, bi) => (
                  <div key={b.b} className="bh-hero__benefit">
                    <Icon name={b.icon} size={22} />
                    <span>{b.a}<br />{b.b}</span>
                    {bi < BENEFITS.length - 1 && <i className="bh-hero__bdiv" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Arrows */}
      <button className="bh-hero__arrow bh-hero__arrow--prev" onClick={() => go(active - 1)} aria-label="Previous slide"><Icon name="chevronLeft" size={22} /></button>
      <button className="bh-hero__arrow bh-hero__arrow--next" onClick={() => go(active + 1)} aria-label="Next slide"><Icon name="chevronRight" size={22} /></button>

      {/* Dots */}
      <div className="bh-hero__dots">
        {SLIDES.map((s, i) => (
          <button key={s.id} className={i === active ? 'active' : ''} onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`} aria-current={i === active} />
        ))}
      </div>
    </section>
  );
}
