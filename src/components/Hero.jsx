import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

const BENEFITS = [
  { icon: 'award', a: 'Himalayan', b: 'Superfood' },
  { icon: 'leaf', a: 'Rich in 190+', b: 'Nutrients' },
  { icon: 'shield', a: 'Boosts Immunity', b: '& Wellness' },
];

// Slide 1 keeps the existing sea-buckthorn hero (video + poster).
// Slide 2 uses the approved artwork at /media/hero-slide2.jpg.
const SLIDES = [
  {
    id: 'buckthorn',
    kind: 'video',
    src: '/media/hero.mp4',
    poster: '/media/hero-poster.jpg',
    kicker: 'The Power of',
    title: 'Sea Buckthorn',
    sub: 'Harvested from the Himalayas. Made for your wellness.',
    lede: 'Pure nutrition. Natural radiance. Everyday wellness.',
    cta: { label: 'EXPLORE COLLECTION', to: '/category/wellness' },
    position: 'center',
  },
  {
    id: 'harvest',
    kind: 'image',
    src: '/media/hero-slide2.jpg',
    kicker: 'From the Himalayas',
    title: "Nature's Orange Gold",
    sub: 'Sun-ripened sea buckthorn, gently cold-pressed.',
    lede: 'Nutrient-dense wellness, straight from the mountains.',
    cta: { label: 'SHOP JUICES & DRINKS', to: '/category/juices-drinks' },
    position: 'center',
  },
];

const INTERVAL = 6000;

export default function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((i) => setActive((i + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setActive((a) => (a + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused || reduced || SLIDES.length < 2) return;
    timer.current = setTimeout(next, INTERVAL);
    return () => clearTimeout(timer.current);
  }, [active, paused, reduced, next]);

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
          {s.kind === 'video' ? (
            <video className="bh-hero__media" autoPlay muted loop playsInline poster={s.poster}
              style={{ objectPosition: s.position }}>
              <source src={s.src} type="video/mp4" />
            </video>
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
