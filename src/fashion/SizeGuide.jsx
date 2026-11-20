import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

// ============================================================
// Size guide on clothing pages (owner, 2026-11-09: more features). Shown only
// when a product is sold in letter sizes (XS–XXL). A general guide to body
// measurements in inches, as Indian brands commonly size; the product's own
// details, where they give measurements, come first — the dialog says so.
// ============================================================
export const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
/**
 * A size's letter, however the brand writes it (2026-11-20): "M", "S (42)", "M-44",
 * "2XL-50" → M, S, M, XXL; '' when it is not a letter size. Pure.
 */
export function letterOf(size) {
  const t = String(size || '').trim().toUpperCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/[\s-]+\d+(\.\d+)?$/, '');
  const l = t === '2XL' ? 'XXL' : t;
  return LETTER_SIZES.includes(l) ? l : '';
}
export const hasLetterSizes = (sizes = []) => sizes.some((s) => letterOf(s));

/**
 * A brand's own size chart (2026-11-20), used in place of the general one on that
 * brand's products — copied from the chart on the brand's own shop. Body measurements
 * in inches. `inclusive`: the brand's rule is "chest 34–35 → S", so a measurement at a
 * row's top end stays in that row.
 */
export const BRAND_CHARTS = Object.freeze({
  'diamond leather': {
    title: 'Diamond Leather size chart',
    measure: 'chest',
    inclusive: true,
    head: ['Size', 'Chest', 'Waist', 'Hips', 'Shoulder', 'Sleeve', 'Length'],
    rows: [['XS', '32–33', '30–31', '32–33', '16', '24', '25'], ['S', '34–35', '32–33', '34–35', '16', '24', '25'], ['M', '36–37', '34–35', '36–37', '17', '24.5', '26.5'], ['L', '38–39', '36–37', '38–39', '18', '25', '27'], ['XL', '40–41', '38–39', '40–41', '18.5', '25.5', '28'], ['XXL', '42–43', '40–41', '42–43', '18.5', '26', '28'], ['3XL', '44–45', '42–43', '44–45', '19', '26.5', '28'], ['4XL', '46–47', '44–45', '46–47', '19.5', '26.5', '28.5'], ['5XL', '48–49', '46–47', '48–49', '20', '26.5', '29.5']],
    how: [['Chest', 'take it over bare skin or a thin layer, around the fullest part, tape level under the arms — not over a heavy layer.'], ['Choose by chest', 'the brand sizes by your chest measurement: chest 34–35 in is an S, 36–37 in an M, and so on.']],
    note: "Diamond Leather's own chart. The number in a size's name on this page (S (42), M (44)…) is the brand's label; choose your size by your chest measurement in this chart.",
  },
});
export const brandChart = (brand) => BRAND_CHARTS[String(brand || '').trim().toLowerCase()] || null;

export const SIZE_CHART = Object.freeze({
  women: { head: ['Size', 'Bust', 'Waist', 'Hip'], rows: [['XS', '30–32', '24–26', '33–35'], ['S', '32–34', '26–28', '35–37'], ['M', '34–36', '28–30', '37–39'], ['L', '36–38', '30–32', '39–41'], ['XL', '38–40', '32–34', '41–43'], ['XXL', '40–42', '34–36', '43–45']] },
  men: { head: ['Size', 'Chest', 'Waist', 'Shoulder'], rows: [['S', '36–38', '28–30', '17'], ['M', '38–40', '30–32', '17.5'], ['L', '40–42', '32–34', '18'], ['XL', '42–44', '34–36', '18.5'], ['XXL', '44–46', '36–38', '19']] },
});

/**
 * Find my size (2026-11-13: more features): the chart's size for a chest or bust
 * measurement in inches — the first row whose range reaches it; between two sizes
 * the larger (the guide's own advice). '' outside the chart. Pure.
 */
export function suggestSize(chart, inches) {
  const n = Number(String(inches).replace(',', '.'));
  if (!chart || !Number.isFinite(n) || n <= 0) return '';
  const rows = chart.rows.map((r) => { const [lo, hi] = String(r[1]).split('–').map(Number); return { size: r[0], lo, hi: Number.isFinite(hi) ? hi : lo }; });
  if (n < rows[0].lo - 2 || n > rows[rows.length - 1].hi + 1) return '';
  // A brand chart's rows run 34–35, 36–37…: 35.5 is past the S row and in no row, so the next size up.
  const hit = chart.inclusive ? rows.find((r) => n <= r.hi) : rows.find((r) => n < r.hi);
  return (hit || rows[rows.length - 1]).size;
}

export default function SizeGuide({ sizes, department = 'women', brand = '' }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(department === 'men' ? 'men' : 'women');
  const [inches, setInches] = useState('');
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
  const own = brandChart(brand);
  const chart = own || SIZE_CHART[tab];
  const pick = suggestSize(chart, inches);
  const sold = sizes.map(letterOf).filter(Boolean);
  const chest = own ? own.measure === 'chest' : tab === 'men';
  const pickSold = pick && sold.includes(pick);
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
            {own ? <p className="fs-sizeguide__brand">{own.title}</p> : (
              <div className="fs-sizeguide__tabs" role="tablist">
                {[['women', 'Women'], ['men', 'Men']].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>
            )}
            <div className="fs-sizeguide__find">
              <label htmlFor="fs-sizeguide-in">Find my size: your {chest ? 'chest' : 'bust'} in inches</label>
              <input id="fs-sizeguide-in" type="number" inputMode="decimal" min="20" max="60" step="0.5" placeholder={chest ? 'e.g. 38' : 'e.g. 35'}
                value={inches} onChange={(e) => setInches(e.target.value)} />
              <p role="status" aria-live="polite">
                {!inches ? 'Measure as below, then type it in.'
                  : !pick ? 'That is outside this chart. Ask us on WhatsApp and we’ll help.'
                    : <>Suggested size: <b>{pick}</b>{pickSold ? '' : ' (not made in this product; try the next size or ask us)'}</>}
              </p>
            </div>
            <table className={`fs-sizeguide__table${own ? ' is-wide' : ''}`}>
              <caption>Body measurements in inches</caption>
              <thead><tr>{chart.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{chart.rows.map((r) => <tr key={r[0]} className={`${sold.includes(r[0]) ? 'is-sold' : ''}${r[0] === pick ? ' is-pick' : ''}`.trim()}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
            </table>
            {own ? (
              <ul className="fs-sizeguide__how">{own.how.map(([b, t]) => <li key={b}><b>{b}:</b> {t}</li>)}</ul>
            ) : (
            <ul className="fs-sizeguide__how">
              <li><b>Chest / bust:</b> around the fullest part, tape level under the arms.</li>
              <li><b>Waist:</b> around the natural waistline, where you usually wear a belt.</li>
              <li><b>Hip:</b> around the fullest part of the hips.</li>
              <li>Between two sizes? Choose the larger for a relaxed fit.</li>
            </ul>
            )}
            {own ? <p className="fs-sizeguide__note">{own.note} Highlighted rows are the sizes this product comes in.</p> : <p className="fs-sizeguide__note">A general guide. Where a product lists its own measurements in its details, follow those. Highlighted rows are the sizes this product comes in.</p>}
          </div>
        </div>
      )}
    </>
  );
}
