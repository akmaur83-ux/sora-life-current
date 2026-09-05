import { specificationsFor } from '../../data/pdpContent.js';

// ============================================================
// Specifications — a plain key/value table.
//
// No card wrapper and no borders around the block: two columns and a hairline
// between rows is all a spec table needs, and a bordered panel here would turn
// the tail of the page into a stack of boxes.
//
// Rows whose value is empty are dropped upstream, so this can never render a
// label with nothing after it.
// ============================================================
export default function ProductSpecifications({ product }) {
  const { rows } = specificationsFor(product);
  if (!rows.length) return null;

  return (
    <section className="pdp-sec pdp-specs" aria-labelledby="pdp-specs-h">
      <h2 id="pdp-specs-h" className="pdp-sec__title serif">Specifications</h2>
      <dl className="pdp-specs__table">
        {rows.map((r) => (
          <div key={r.key} className="pdp-specs__row">
            <dt>{r.key}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
