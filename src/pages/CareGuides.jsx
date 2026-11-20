import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// Care guides (round 14, 2026-11-20): the shawl and stole guide and the guides hub,
// beside the leather guide (LeatherCare.jsx). General good practice only — the care
// label and the product page come first — and no promises about how long anything lasts.
// ============================================================
export const SHAWL_SECTIONS = Object.freeze([
  ['Storing', [
    'Fold loosely, with tissue paper in the folds, and keep in a cotton bag or wrapped in muslin — not plastic.',
    'Keep shawls dry and out of direct sun, which fades colour.',
    'Dried neem leaves, cedar or lavender sachets in the cupboard help keep moths away from wool.',
  ]],
  ['Washing', [
    'Follow the care label: many woollen and embroidered shawls are dry clean only.',
    'Where hand washing is allowed: cold water and a mild wool wash, a short soak, no rubbing or wringing.',
    'Roll in a towel to press the water out, then dry flat in the shade — never on a hanger while wet.',
  ]],
  ['Ironing', [
    'Steam lightly, or iron on low heat with a thin cotton cloth between the iron and the shawl.',
    'Iron embroidery and zari from the reverse side.',
  ]],
  ['Wearing', [
    'Watch for snags from rings, brooches, bag zips and velcro.',
    'Air a shawl on a chair back between wears instead of washing it each time.',
    'Spray perfume on before you put the shawl on, not onto it.',
  ]],
  ['Embroidered, zari and phulkari pieces', [
    'Dry clean, and store flat or loosely rolled, away from damp.',
    'Keep zari wrapped in muslin so it does not rub against other pieces.',
  ]],
  ['Bobbles on wool', [
    'Some wool forms small bobbles where it rubs; lift them off gently with a fabric comb or shaver.',
  ]],
]);

export const GUIDES = Object.freeze([
  { href: '/guides/leather-care', title: 'How to care for leather', text: 'Jackets, coats, bags, wallets and belts: storing, drying, cleaning, conditioning and suede.' },
  { href: '/guides/shawl-care', title: 'How to care for shawls & stoles', text: 'Wool, woven and embroidered pieces: storing, washing, ironing and keeping moths away.' },
]);

export function ShawlCare() {
  usePageMeta({ title: 'How to care for shawls & stoles · SORA LIFESTYLE', description: 'Storing, washing, ironing and wearing woollen, woven and embroidered shawls, stoles and dupattas.', path: '/guides/shawl-care' });
  return (
    <div className="sora-guide">
      <div className="container">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <Link to="/guides">Care guides</Link> <Icon name="chevronRight" size={12} /> <span>Shawls &amp; stoles</span></nav>
        <header className="sora-guide__head">
          <p className="sora-sell__eyebrow">Care guide</p>
          <h1 className="serif">How to care for shawls &amp; stoles</h1>
          <p>A good shawl is worn for many winters. A few habits for the woollen, woven and embroidered shawls, stoles and dupattas in our Fashion store. The care label and the product page always come first.</p>
        </header>
        {SHAWL_SECTIONS.map(([h, items]) => (
          <section key={h} className="sora-guide__sec">
            <h2 className="serif">{h}</h2>
            <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
        <p className="sora-guide__more"><Link to="/fashion/winter#winter-shawls" className="btn">Shop shawls &amp; stoles <Icon name="arrowRight" size={15} /></Link></p>
      </div>
    </div>
  );
}

export function GuidesHub() {
  usePageMeta({ title: 'Care guides · SORA LIFESTYLE', description: 'How to look after leather, shawls and stoles from SORA LIFESTYLE.', path: '/guides' });
  return (
    <div className="sora-guide">
      <div className="container">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Care guides</span></nav>
        <header className="sora-guide__head">
          <p className="sora-sell__eyebrow">Look after what you love</p>
          <h1 className="serif">Care guides</h1>
        </header>
        <ul className="sora-guides">
          {GUIDES.map((g) => (
            <li key={g.href}><Link to={g.href}><b className="serif">{g.title}</b><span>{g.text}</span><i>Read the guide <Icon name="arrowRight" size={14} /></i></Link></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
