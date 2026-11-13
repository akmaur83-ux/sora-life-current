import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';
import { compareApi, useCompareList, COMPARE_MAX } from '../lib/compareList.js';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// Compare (owner, 2026-11-13): the "Compare" button on product pages, the tray at
// the foot of the screen while anything is picked, and the /compare page.
// compareList.js keeps the list (this browser only).
// ============================================================
export function CompareButton({ item }) {
  const list = useCompareList();
  const on = list.some((x) => x.key === item?.key);
  if (!item?.key) return null;
  return (
    <button type="button" className={`sora-cmpbtn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => compareApi.toggle(item)}>
      <Icon name={on ? 'check' : 'plus'} size={15} /> {on ? 'Added to compare' : 'Compare'}
    </button>
  );
}

const HIDE = /^\/(compare|cart|checkout|admin|invoice)(\/|$)/;

export function CompareTray() {
  const list = useCompareList();
  const { pathname } = useLocation();
  if (!list.length || HIDE.test(pathname)) return null;
  return (
    <aside className="sora-cmptray" aria-label="Compare">
      <ul>
        {list.map((p) => (
          <li key={p.key}>
            {p.image && <img src={p.image} alt="" width="44" height="44" />}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => compareApi.remove(p.key)}><Icon name="x" size={12} /></button>
          </li>
        ))}
        {Array.from({ length: COMPARE_MAX - list.length }, (_, i) => <li key={`e${i}`} className="is-empty" aria-hidden="true" />)}
      </ul>
      <p>{list.length < 2 ? 'Add one more to compare' : `${list.length} picked`}</p>
      <Link to="/compare" className={`sora-cmptray__go${list.length < 2 ? ' is-off' : ''}`} aria-disabled={list.length < 2}>Compare now</Link>
      <button type="button" className="sora-cmptray__clear" onClick={compareApi.clear}>Clear</button>
    </aside>
  );
}

const ROWS = [
  ['Price', (p) => <b>{money(p.price)}</b>],
  ['M.R.P.', (p) => (p.mrp > p.price ? <s>{money(p.mrp)}</s> : '—')],
  ['You save', (p) => (p.mrp > p.price ? `${money(p.mrp - p.price)} (${Math.round(((p.mrp - p.price) / p.mrp) * 100)}%)` : '—')],
  ['Brand', (p) => p.brand || '—'],
  ['Category', (p) => p.category || '—'],
  ['Sizes', (p) => p.sizes || '—'],
  ['Colours', (p) => p.colours || '—'],
  ['Delivery', () => 'Free standard delivery'],
];

export default function ComparePage() {
  const list = useCompareList();
  usePageMeta({ title: 'Compare', description: 'Compare products side by side at SORA LIFESTYLE.', path: '/compare' });
  return (
    <div className="hx hx-help">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Compare</span></nav>
        <h1 className="hx-offers__h">Compare</h1>
        {list.length < 2 ? (
          <p className="hx-offers__empty">Pick two to four products with the “Compare” button on their pages, and they line up here.</p>
        ) : (
          <div className="sora-cmp">
            <table>
              <thead>
                <tr><td />{list.map((p) => (
                  <th key={p.key} scope="col">
                    <Link to={p.href} className="sora-cmp__item">{p.image && <img src={p.image} alt="" width="160" height="160" />}<span>{p.name}</span></Link>
                    <button type="button" className="sora-cmp__rm" onClick={() => compareApi.remove(p.key)}>Remove</button>
                  </th>
                ))}</tr>
              </thead>
              <tbody>{ROWS.map(([label, cell]) => <tr key={label}><th scope="row">{label}</th>{list.map((p) => <td key={p.key}>{cell(p)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
