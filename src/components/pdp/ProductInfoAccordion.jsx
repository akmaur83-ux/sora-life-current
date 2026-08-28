import { useId, useState } from 'react';
import Icon from '../Icon.jsx';

// ============================================================
// Accessible, mobile-first disclosure list for the PDP information block.
//
//   • Each row is a real <button> (native Enter/Space/focus), with
//     aria-expanded + aria-controls pointing at its region.
//   • Multiple panels may be open at once; `defaultOpen` seeds initial state.
//   • Height animates via the grid-rows 0fr→1fr trick (no JS measuring);
//     prefers-reduced-motion is handled globally in base.css.
//
// Pure presentation — takes a `sections` array and renders whatever has
// content. Empty sections must be filtered out by the caller.
// ============================================================
export default function ProductInfoAccordion({ sections }) {
  const uid = useId();
  const [open, setOpen] = useState(() => {
    const init = {};
    sections.forEach((s, i) => { if (s.defaultOpen) init[i] = true; });
    return init;
  });
  if (!sections.length) return null;

  return (
    <div className="pdp-acc">
      {sections.map((s, i) => {
        const isOpen = !!open[i];
        const btnId = `${uid}-h${i}`;
        const panelId = `${uid}-p${i}`;
        return (
          <div key={s.title} className={`pdp-acc__item ${isOpen ? 'is-open' : ''}`}>
            <h3 className="pdp-acc__h">
              <button
                type="button"
                id={btnId}
                className="pdp-acc__btn"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
              >
                <span className="pdp-acc__title">
                  {s.icon && <Icon name={s.icon} size={17} />}
                  {s.title}
                </span>
                <span className="pdp-acc__sign" aria-hidden="true">
                  <Icon name={isOpen ? 'minus' : 'plus'} size={16} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className="pdp-acc__panel"
              hidden={!isOpen}
            >
              <div className="pdp-acc__inner">{s.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
