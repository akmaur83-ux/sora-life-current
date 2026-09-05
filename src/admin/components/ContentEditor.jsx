import { useMemo, useState } from 'react';
import { CONTENT_FIELDS, CONTENT_LABELS, fieldPopulated, validateContent } from '../../lib/productContent.js';

// ============================================================
// ADMIN — per-product PDP content editor (migration 0025 columns)
//
// Every field here renders a section of the PDP, and every section hides
// itself when its field is empty. So this editor's real job is making the
// GAPS visible: the coverage strip at the top says at a glance which of the
// seven fields a product is missing, because "the page looks sparse" is not
// an actionable complaint and "ingredients and how-to-use are empty" is.
//
// Shapes match what the PDP reads, exactly. They are normalised again on save
// in productToDbRow — React throws on an object rendered as a child, so a
// malformed row here is a white screen there, and one validation layer is not
// enough when the CSV importer writes through the same path.
// ============================================================

const rowsFromSpecs = (specs) => {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return [];
  return Object.entries(specs).map(([key, value]) => ({ key, value: String(value ?? '') }));
};

function Repeatable({ rows, onChange, addLabel, render, emptyHint }) {
  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="adm-rep">
      {rows.length === 0 && <p className="muted adm-rep__empty">{emptyHint}</p>}
      {rows.map((row, i) => (
        <div key={i} className="adm-rep__row">
          <div className="adm-rep__fields">{render(row, i)}</div>
          <div className="adm-rep__ctl">
            {/* Order is meaningful — benefits and steps render in this order on
                the PDP — so reordering is a first-class control, not a drag
                interaction that needs a library. */}
            <button type="button" className="btn btn-xs btn-light" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className="btn btn-xs btn-light" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</button>
            <button type="button" className="btn btn-xs btn-light" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-light" onClick={() => onChange([...rows, {}])}>{addLabel}</button>
    </div>
  );
}

export default function ContentEditor({ values, onChange, product, brandOptions = [] }) {
  const [claimDraft, setClaimDraft] = useState('');
  const set = (k, v) => onChange({ ...values, [k]: v });

  const claims = Array.isArray(values.keyClaims) ? values.keyClaims : [];
  const benefits = Array.isArray(values.benefits) ? values.benefits : [];
  const ingredients = Array.isArray(values.ingredients) ? values.ingredients : [];
  const steps = Array.isArray(values.howToUse) ? values.howToUse : [];
  const specRows = useMemo(() => rowsFromSpecs(values.specifications), [values.specifications]);

  // Coverage is computed from the FORM state, not the saved row, so ticking a
  // gap off updates as you type rather than after a save.
  const asProduct = {
    brand: values.brand, netContent: values.netContent, keyClaims: claims,
    benefits, ingredients, howToUse: steps, specifications: values.specifications,
  };
  const errors = validateContent({
    key_claims: claims, benefits, ingredients, how_to_use: steps,
    specifications: values.specifications,
  });

  const addClaim = () => {
    const t = claimDraft.trim();
    if (!t) return;
    if (!claims.includes(t)) set('keyClaims', [...claims, t]);
    setClaimDraft('');
  };

  const setSpecs = (rows) => {
    // Kept as rows in the editor so two blank rows can coexist while typing;
    // collapsed to an object on save by the shared normaliser.
    const obj = {};
    for (const r of rows) if (r.key?.trim()) obj[r.key.trim()] = String(r.value ?? '');
    set('specifications', obj);
  };
  const specAsRows = specRows.length ? specRows : [];

  return (
    <>
      <div className="surface">
        <h2>Content coverage</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Each of these renders a section of the product page. An empty field hides its section.
        </p>
        <div className="adm-cov">
          {CONTENT_FIELDS.map((f) => {
            const on = fieldPopulated(asProduct, f);
            return (
              <span key={f} className={`adm-cov__pill ${on ? 'is-on' : 'is-off'}`}>
                {on ? '●' : '○'} {CONTENT_LABELS[f]}
              </span>
            );
          })}
        </div>
        <p className="muted adm-cov__meta">
          Source: <strong>{product?.contentSource || 'not set'}</strong>
          {product?.contentUpdatedAt
            ? <> · content last updated {new Date(product.contentUpdatedAt).toLocaleString('en-IN')}</>
            : <> · never edited</>}
          {product?.slug && (
            <>
              {' · '}
              <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer">Open the product page ↗</a>
            </>
          )}
        </p>
        {errors.length > 0 && (
          <div className="adm-banner err" style={{ marginTop: 10 }}>
            {errors.map((e) => <div key={e}>{e}</div>)}
          </div>
        )}
      </div>

      <div className="surface">
        <h2>Identity</h2>
        <div className="adm-grid2">
          <div className="field">
            <label className="label">Brand</label>
            <input
              className="input" list="adm-brand-options"
              value={values.brand || ''}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="e.g. Biosash"
            />
            {/* Free text with suggestions rather than a fixed select: this is a
                multi-brand marketplace and a new label must not need a code
                change to become selectable. */}
            <datalist id="adm-brand-options">
              {brandOptions.map((b) => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div className="field">
            <label className="label">Net content</label>
            <input
              className="input"
              value={values.netContent || ''}
              onChange={(e) => set('netContent', e.target.value)}
              placeholder="200ml · 60 tablets · 100 g"
            />
          </div>
        </div>
      </div>

      <div className="surface">
        <h2>Key claims</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Short badges shown under the title. Keep them factual and under 60 characters —
          a condition or disease name here reads as a treatment claim.
        </p>
        <div className="adm-tags">
          {claims.map((c) => (
            <span key={c} className="adm-tag">
              {c}
              <button type="button" onClick={() => set('keyClaims', claims.filter((x) => x !== c))} aria-label={`Remove ${c}`}>✕</button>
            </span>
          ))}
        </div>
        <div className="adm-tags__add">
          <input
            className="input"
            value={claimDraft}
            onChange={(e) => setClaimDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addClaim(); } }}
            placeholder="Paraben Free"
          />
          <button type="button" className="btn btn-sm btn-light" onClick={addClaim}>Add claim</button>
        </div>
      </div>

      <div className="surface">
        <h2>Benefits</h2>
        <Repeatable
          rows={benefits}
          onChange={(r) => set('benefits', r)}
          addLabel="Add benefit"
          emptyHint="No benefits yet — this section is hidden on the product page."
          render={(row, i) => (
            <>
              <input
                className="input" placeholder="Title"
                value={row.title || ''}
                onChange={(e) => set('benefits', benefits.map((b, j) => (j === i ? { ...b, title: e.target.value } : b)))}
              />
              <textarea
                className="textarea" rows={2} placeholder="Description (optional)"
                value={row.description || ''}
                onChange={(e) => set('benefits', benefits.map((b, j) => (j === i ? { ...b, description: e.target.value } : b)))}
              />
            </>
          )}
        />
      </div>

      <div className="surface">
        <h2>Ingredients</h2>
        <Repeatable
          rows={ingredients}
          onChange={(r) => set('ingredients', r)}
          addLabel="Add ingredient"
          emptyHint="No ingredients yet — this section is hidden on the product page."
          render={(row, i) => (
            <>
              <input
                className="input" placeholder="Name"
                value={row.name || ''}
                onChange={(e) => set('ingredients', ingredients.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="input" placeholder="One line about it (optional)"
                value={row.description || ''}
                onChange={(e) => set('ingredients', ingredients.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              />
              <input
                className="input" placeholder="Image URL (optional, https only)"
                value={row.image_url || ''}
                onChange={(e) => set('ingredients', ingredients.map((x, j) => (j === i ? { ...x, image_url: e.target.value } : x)))}
              />
            </>
          )}
        />
      </div>

      <div className="surface">
        <h2>How to use</h2>
        <Repeatable
          rows={steps}
          onChange={(r) => set('howToUse', r)}
          addLabel="Add step"
          emptyHint="No directions yet — this section is hidden on the product page."
          render={(row, i) => (
            <>
              {/* Numbering is derived from position on save, so reordering
                  renumbers and an admin never maintains it by hand. */}
              <span className="adm-rep__num">{i + 1}</span>
              <textarea
                className="textarea" rows={2} placeholder="Step text"
                value={row.text || ''}
                onChange={(e) => set('howToUse', steps.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))}
              />
            </>
          )}
        />
      </div>

      <div className="surface">
        <h2>Specifications</h2>
        <Repeatable
          rows={specAsRows}
          onChange={setSpecs}
          addLabel="Add specification"
          emptyHint="No specifications yet — this section is hidden on the product page."
          render={(row, i) => (
            <>
              <input
                className="input" placeholder="Label — e.g. Shelf life"
                value={row.key || ''}
                onChange={(e) => setSpecs(specAsRows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
              />
              <input
                className="input" placeholder="Value — e.g. 24 months"
                value={row.value || ''}
                onChange={(e) => setSpecs(specAsRows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
            </>
          )}
        />
      </div>
    </>
  );
}
