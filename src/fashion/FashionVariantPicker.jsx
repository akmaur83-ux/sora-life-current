import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { selectionState } from '../lib/fashionPdp.js';

// ============================================================
// The size × colour choice, shared by the PDP and the quick-add sheet.
// Every size is listed — an unavailable one is disabled, not hidden — and
// the colour swatches are the variants' colour_hex. The stock note answers
// for the PAIR: Medium + Sage can be out while Medium + Navy is in.
// ============================================================
export function VariantPicker({ view, size, colour, onChange, compact = false }) {
  const st = selectionState(view, { size, colour });
  return (
    <div className={`fs-pick${compact ? ' fs-pick--compact' : ''}`}>
      <fieldset className="fs-pick__group">
        <legend>Colour{st.colour ? <b>: {st.colour}</b> : null}</legend>
        <div className="fs-pick__swatches">
          {st.colours.map((c) => (
            <button
              key={c.colour} type="button"
              className={`fs-pick__swatch${c.colour === st.colour ? ' is-on' : ''}${c.available ? '' : ' is-out'}`}
              style={{ '--sw': c.hex || '#D9CBB0' }}
              aria-pressed={c.colour === st.colour}
              aria-label={`${c.colour}${c.available ? '' : ' — not available for this size'}`}
              title={c.colour}
              onClick={() => onChange({ size: st.size, colour: c.colour === st.colour ? null : c.colour })}
            ><span /></button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fs-pick__group">
        <legend>Size{st.size ? <b>: {st.size}</b> : null}</legend>
        <div className="fs-pick__sizes">
          {st.sizes.map((s) => (
            <button
              key={s.size} type="button"
              className={`fs-pick__size${s.size === st.size ? ' is-on' : ''}${s.available ? '' : ' is-out'}`}
              aria-pressed={s.size === st.size}
              disabled={!s.available && s.size !== st.size}
              aria-label={`${s.size}${s.available ? '' : ' — out of stock'}`}
              onClick={() => onChange({ size: s.size === st.size ? null : s.size, colour: st.colour })}
            >{s.size}</button>
          ))}
        </div>
      </fieldset>
      <p className={`fs-pick__note is-${st.status}`} role="status">
        {st.stockNote || st.missing || 'In stock'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// Quick-add sheet: the picker in a bottom sheet, one Add button.
// ---------------------------------------------------------------
export function VariantSheet({ view, onAdd, onClose }) {
  const [sel, setSel] = useState({ size: null, colour: null });
  const st = selectionState(view, sel);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fs-sheet" role="dialog" aria-modal="true" aria-label={`Choose size and colour for ${view.name}`}>
      <button type="button" className="fs-sheet__scrim" aria-label="Close" onClick={onClose} />
      <div className="fs-sheet__panel">
        <header className="fs-sheet__head">
          {view.image && <img src={view.image} alt="" width="64" height="64" />}
          <div className="fs-sheet__title">
            <strong>{view.name}</strong>
            <span className="fs-price"><b><span className="fs-price__cur">₹</span>{money(st.price).replace(/^₹\s?/, '')}</b>{view.hasDiscount && <s>{money(view.mrp)}</s>}</span>
          </div>
          <button type="button" className="fs-sheet__x" aria-label="Close" onClick={onClose}><Icon name="x" size={20} /></button>
        </header>
        <VariantPicker view={view} size={sel.size} colour={sel.colour} onChange={setSel} compact />
        <button type="button" className="fs-btn fs-btn--wide" disabled={!st.canAdd} onClick={() => { if (onAdd(st.variant, st)) onClose(); }}>
          <Icon name="bag" size={18} /> {st.canAdd ? 'Add to cart' : st.missing || 'Unavailable'}
        </button>
      </div>
    </div>
  );
}
