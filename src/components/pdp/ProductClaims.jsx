import { keyClaimsFor } from '../../data/pdpContent.js';

// ============================================================
// Claim pills — short factual badges under the title block.
//
// Strictly what the catalogue stores. keyClaimsFor drops anything longer than
// a badge rather than truncating it, because a clipped claim is a changed
// claim, and the ingest deliberately keeps condition names out of this field:
// a disease rendered as a badge on a product tile reads as a treatment claim.
//
// Nothing to show means nothing rendered — not an empty rail.
// ============================================================
export default function ProductClaims({ product }) {
  const claims = keyClaimsFor(product);
  if (!claims.length) return null;

  return (
    <ul className="pdp-claims" aria-label="Product claims">
      {claims.map((c) => <li key={c} className="pdp-claims__pill">{c}</li>)}
    </ul>
  );
}
