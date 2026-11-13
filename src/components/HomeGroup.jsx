// ============================================================
// A homepage group band (2026-11-13 redesign: "homepage cleanup"). The homepage is
// four parts — Offers, Shop by store, Our brands, For you — and each opens with this
// band: a small warm label and a serif title between two hairlines (sora-ds.css).
// ============================================================
export default function HomeGroup({ eyebrow, title }) {
  return (
    <div className="sora-group">
      <div className="sora-group__in">
        <h2 className="sora-group__t"><small>{eyebrow}</small><span>{title}</span></h2>
      </div>
    </div>
  );
}
