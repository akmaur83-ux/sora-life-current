import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { breadcrumbFor, stockMatrix } from '../lib/fashion.js';
import { useFashionCatalogue } from './FashionCatalogue.jsx';
import { CategoryChips } from './FashionLayout.jsx';
import { Breadcrumb } from './FashionListing.jsx';
import { Stars } from './FashionProductCard.jsx';

// ============================================================
// /fashion/p/<slug> — a stub until the PDP phase: the image, the price, the
// rating, and the size × colour availability read straight from the
// variants (Medium/Sage out, Medium/Navy in). No add-to-bag yet: the shared
// cart prices lines against the wellness catalogue, and that seam is the
// PDP phase's first job.
// ============================================================
export default function FashionProductStub() {
  const { slug } = useParams();
  const { status, tree, bySlug } = useFashionCatalogue();
  const view = bySlug.get(String(slug || ''));
  if (!view) {
    return (
      <div className="fs-listing">
        <CategoryChips />
        <div className="fs-empty">
          <p>{status === 'loading' ? 'Loading the catalogue…' : `There is no “${slug}” in the fashion store.`}</p>
          <Link to="/fashion" className="fs-btn">Back to fashion</Link>
        </div>
      </div>
    );
  }
  const node = view.category_id ? tree.byId.get(view.category_id) : null;
  const trail = [...breadcrumbFor(tree, node), { name: view.name }];
  const m = stockMatrix(view);
  return (
    <div className="fs-pdp">
      <CategoryChips />
      <Breadcrumb trail={trail} />
      <div className="fs-pdp__grid">
        <div className="fs-pdp__media">{view.image && <img src={view.image} alt={view.name} width="900" height="900" decoding="async" />}</div>
        <div className="fs-pdp__body">
          {view.brand && <p className="fs-pdp__brand">{view.brand}</p>}
          <h1 className="fs-pdp__h serif">{view.name}</h1>
          <p className="fs-rating"><b>{view.rating.toFixed(1)}</b><Stars value={view.rating} size={15} /><span className="fs-rating__count">({view.reviewCount.toLocaleString('en-IN')})</span></p>
          <p className="fs-price fs-price--lg">
            <strong><span className="fs-price__cur">₹</span>{money(view.price).replace(/^₹\s?/, '')}</strong>
            {view.hasDiscount && <><span className="fs-price__mrp">M.R.P: <s>{money(view.mrp)}</s></span><span className="fs-badge">{view.discountPct}% OFF</span></>}
          </p>
          {view.description && <p className="fs-pdp__desc">{view.description}</p>}
          <table className="fs-matrix" aria-label="Availability by size and colour">
            <thead><tr><th scope="col">Size</th>{m.colours.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {m.sizes.map((s) => (
                <tr key={s}>
                  <th scope="row">{s}</th>
                  {m.colours.map((c) => {
                    const v = m.get(s, c);
                    return <td key={c} data-stock={v ? (v.stock > 0 ? 'in' : 'out') : 'none'}>{!v ? '—' : v.stock > 0 ? `In stock${v.price_override != null ? ` · ${money(v.price_override)}` : ''}` : 'Out of stock'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fs-pdp__soon"><Icon name="clock" size={15} /> Size and colour selection, and Add to bag, arrive with the product page in the next phase.</p>
        </div>
      </div>
    </div>
  );
}
