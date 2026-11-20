import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// /guides/leather-care (owner, 2026-11-20: round 11). Everyday care for the leather
// jackets, bags, wallets and belts our partners make. Plain, general good practice —
// no claims about how long anything lasts — and the product's own care line always
// comes first.
// ============================================================
export const CARE_SECTIONS = Object.freeze([
  ['Day to day', [
    'Hang jackets on a broad, shaped hanger so the shoulders keep their line.',
    'Give leather room to breathe: a cotton dust bag or cover, never a plastic one.',
    'Keep it out of direct sun and away from heaters — heat dries leather out and fades it.',
  ]],
  ['If it gets wet', [
    'Blot off the water with a soft, dry cloth; do not rub.',
    'Let it dry naturally at room temperature, on its hanger or stuffed with paper — no hair dryer, heater or iron.',
    'Once dry, a little leather conditioner helps it stay supple.',
  ]],
  ['Cleaning', [
    'Wipe off dust with a soft, dry cloth.',
    'For marks and stains, use a cleaner made for leather, or take it to a leather cleaner — not household detergent.',
    'Where the product page says “professional leather clean only”, follow that.',
  ]],
  ['Conditioning', [
    'Now and then, work in a thin layer of leather conditioner with a soft cloth, then buff.',
    'Try any new product on a hidden spot first.',
  ]],
  ['Suede and nubuck', [
    'Brush gently with a suede brush to lift the nap and loosen dirt.',
    'Keep suede away from water; for stains, a professional suede clean.',
  ]],
  ['Bags, wallets and belts', [
    'Stuff empty bags with paper so they hold their shape; do not overfill them in use.',
    'Store belts rolled loosely or hanging straight, not folded tight.',
    'Keep pens and anything sharp in an inner pocket.',
  ]],
  ['New leather', [
    'A leather smell is normal in a new piece and fades with wear; air it out on a hanger.',
    'Creases form where you move — that is how leather takes your shape.',
  ]],
]);

export default function LeatherCare() {
  usePageMeta({ title: 'How to care for leather · SORA LIFESTYLE', description: 'Everyday care for leather jackets, bags, wallets and belts: storing, drying, cleaning and conditioning, and suede.', path: '/guides/leather-care' });
  return (
    <div className="sora-guide">
      <div className="container">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Leather care</span></nav>
        <header className="sora-guide__head">
          <p className="sora-sell__eyebrow">Care guide</p>
          <h1 className="serif">How to care for leather</h1>
          <p>Good leather gets better with wear when it is looked after. A few simple habits for the jackets, bags, wallets and belts from our makers. Always follow the care line on the product page first.</p>
        </header>
        {CARE_SECTIONS.map(([h, items]) => (
          <section key={h} className="sora-guide__sec">
            <h2 className="serif">{h}</h2>
            <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
        <p className="sora-guide__more">
          <Link to="/fashion/search?q=leather" className="btn">Shop leather <Icon name="arrowRight" size={15} /></Link>
        </p>
      </div>
    </div>
  );
}
