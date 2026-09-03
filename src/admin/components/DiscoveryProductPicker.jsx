import { useMemo, useState } from 'react';
import { productGallery } from '../../data/products.js';
import { MAX_CONCERN_PRODUCTS, searchCatalogueForPicker } from '../../lib/homeDiscovery.js';

// ============================================================
// Admin picker: which products a discovery card opens.
//
// Search-driven on purpose. The catalogue is well past a hundred products, so
// a <select> listing all of them would be unusable — you would be hunting a
// name in a scroll box. Here you type, see at most a handful of real matches
// with their photo, and click to add.
//
// Only the product SLUG is stored (see homeDiscovery.js). Names, prices and
// photos are read live from the catalogue every time this renders, so nothing
// shown here can drift from what the storefront will show.
// ============================================================

const RESULT_LIMIT = 8;

function thumbUrl(product) {
  const first = productGallery(product)[0];
  return first?.url || product?.image || '';
}

function Thumb({ product }) {
  const url = thumbUrl(product);
  return (
    <span className="adm-pp__thumb">
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : null}
    </span>
  );
}

export default function DiscoveryProductPicker({ label, catalogue, value, onChange, fallbackHint }) {
  const [term, setTerm] = useState('');
  const selected = Array.isArray(value) ? value : [];
  const full = selected.length >= MAX_CONCERN_PRODUCTS;

  const bySlug = useMemo(
    () => new Map((catalogue || []).map((p) => [p.slug, p])),
    [catalogue],
  );

  const results = useMemo(
    () => searchCatalogueForPicker(catalogue, term, { exclude: selected, limit: RESULT_LIMIT }),
    [term, catalogue, selected],
  );

  const add = (slug) => { if (!full && !selected.includes(slug)) onChange([...selected, slug]); setTerm(''); };
  const remove = (slug) => onChange(selected.filter((s) => s !== slug));
  const move = (index, delta) => {
    const next = [...selected];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="adm-pp">
      <label className="label" htmlFor={`pp-${label}`}>Linked products</label>
      <p className="hint">
        {selected.length
          ? `${selected.length} chosen — this card opens exactly these, in this order.`
          : fallbackHint}
      </p>

      <input
        id={`pp-${label}`}
        className="input"
        type="search"
        autoComplete="off"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={full ? `Limit of ${MAX_CONCERN_PRODUCTS} reached` : 'Search products by name…'}
        disabled={full}
        aria-label={`Search products to link to ${label}`}
      />

      {term.trim() && (
        <ul className="adm-pp__results">
          {results.length ? results.map((p) => (
            <li key={p.slug}>
              <button type="button" className="adm-pp__result" onClick={() => add(p.slug)}>
                <Thumb product={p} />
                <span className="adm-pp__name">{p.name}{p.form ? <em> · {p.form}</em> : null}</span>
                <span className="adm-pp__add">Add</span>
              </button>
            </li>
          )) : <li className="adm-pp__none">No product matches “{term.trim()}”.</li>}
        </ul>
      )}

      {selected.length > 0 && (
        <ol className="adm-pp__chosen">
          {selected.map((slug, i) => {
            const product = bySlug.get(slug);
            return (
              <li key={slug}>
                {/* A slug with no product is shown rather than hidden: it is
                    the only way an admin can see a stale row and clear it.
                    The storefront already skips it silently. */}
                {product ? <Thumb product={product} /> : <span className="adm-pp__thumb" />}
                <span className="adm-pp__name">
                  {product ? product.name : <em>Not in the catalogue — {slug}</em>}
                </span>
                <span className="adm-pp__order">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    aria-label={`Move ${product?.name || slug} up`}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1}
                    aria-label={`Move ${product?.name || slug} down`}>↓</button>
                </span>
                <button type="button" className="adm-pp__rm" onClick={() => remove(slug)}
                  aria-label={`Remove ${product?.name || slug} from ${label}`}>×</button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
