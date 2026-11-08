import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

// ============================================================
// Size guide on clothing pages (owner, 2026-11-09: more features). Shown only
// when a product is sold in letter sizes (XS–XXL). A general guide to body
// measurements in inches, as Indian brands commonly size; the product's own
// details, where they give measurements, come first — the dialog says so.
// ============================================================
export const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const hasLetterSizes = (sizes = []) => sizes.some((s) => LETTER_SIZES.includes(String(s).trim().toUpperCase()));

export const SIZE_CHART = Object.freeze({
  women: { head: ['Size', 'Bust', 'Waist', 'Hip'], rows: [['XS', '30–32', '24–26', '33–35'], ['S', '32–34', '26–28', '35–37'], ['M', '34–36', '28–30', '37–39'], ['L', '36–38', '30–32', '39–41'], ['XL', '38–40', '32–34', '41–43'], ['XXL', '40–42', '34–36', '43–45']] },
  men: { head: ['Size', 'Chest', 'Waist', 'Shoulder'], rows: [['S', '36–38', '28–30', '17'], ['M', '38–40', '30–32', '17.5'], ['L', '40–42', '32–34', '18'], ['XL', '42–44', '34–36', '18.5'], ['XXL', '44–46', '36–38', '19']] },
});

export default function SizeGuide({ sizes, department = 'women' }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(department === 'men' ? 'men' : 'women');
  const closer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closer.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!hasLetterSizes(sizes)) return null;
  const chart = SIZE_CHART[tab];
  return (
    <>
      <button type="button" className="fs-sizeguide__open" onClick={() => setOpen(true)}><Icon name="sliders" size={15} /> Size guide</button>
      {open && (
        <div className="fs-sizeguide" role="dialog" aria-modal="true" aria-labelledby="fs-sizeguide-h" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="fs-sizeguide__box">
            <div className="fs-sizeguide__top">
              <h2 id="fs-sizeguide-h">Size guide</h2>
              <button type="button" ref={closer} className="fs-sizeguide__x" onClick={() => setOpen(false)} aria-label="Close size guide"><Icon name="x" size={20} /></button>
            </div>
            <div className="fs-sizeguide__tabs" role="tablist">
              {[['women', 'Women'], ['men', 'Men']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <table className="fs-sizeguide__table">
              <caption>Body measurements in inches</caption>
              <thead><tr>{chart.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{chart.rows.map((r) => <tr key={r[0]} className={sizes.map((s) => String(s).toUpperCase()).includes(r[0]) ? 'is-sold' : ''}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
            </table>
            <ul className="fs-sizeguide__how">
              <li><b>Chest / bust:</b> around the fullest part, tape level under the arms.</li>
              <li><b>Waist:</b> around the natural waistline, where you usually wear a belt.</li>
              <li><b>Hip:</b> around the fullest part of the hips.</li>
              <li>Between two sizes? Choose the larger for a relaxed fit.</li>
            </ul>
            <p className="fs-sizeguide__note">A general guide. Where a product lists its own measurements in its details, follow those. Highlighted rows are the sizes this product comes in.</p>
          </div>
        </div>
      )}
    </>
  );
}
