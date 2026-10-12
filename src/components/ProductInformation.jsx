import { useEffect, useState } from 'react';
import { getProductDeclarations } from '../lib/productDeclarationsApi.js';
import { declarationRows } from '../lib/productDeclarations.js';
import { useConsumerCare } from '../lib/consumerCare.js';
import { telHref } from '../lib/company.js';

// ============================================================
// "Product information" on the fashion (jewellery included) and Home & Living
// product pages: what the listing declares — generic name, net quantity,
// country of origin, fabric and care, metal and purity, the chosen size's
// weights, stones, who made, packed and imported it — and the store's
// consumer-care contact.
//
// Read after the page renders, on its own (productDeclarationsApi.js): until
// it arrives, or if it fails, the section is simply not there. Only recorded
// values become rows (productDeclarations.js); a listing that declares nothing
// shows no section at all. `prefix` borrows the page's own Details styling
// (fs- or hl-), so the two read alike.
// ============================================================
export default function ProductInformation({ store, productId, variant = null, prefix = 'fs', netQuantity = true }) {
  const [decl, setDecl] = useState(null);
  const care = useConsumerCare();
  useEffect(() => {
    let live = true;
    setDecl(null);
    getProductDeclarations(store, productId).then((row) => { if (live) setDecl(row); }, () => { if (live) setDecl(null); });
    return () => { live = false; };
  }, [store, productId]);

  const rows = declarationRows(decl, { variant, netQuantity });
  if (!rows.length) return null;
  const contacts = [
    care.legalName && <span key="name">{care.legalName}</span>,
    care.phone && <a key="phone" href={telHref(care.phone)}>{care.phone}</a>,
    care.email && <a key="email" href={`mailto:${care.email}`}>{care.email}</a>,
  ].filter(Boolean);
  return (
    <section className={`${prefix}-pdp__section`} aria-labelledby={`${prefix}-info-h`} data-section="product-information">
      <h2 className={`${prefix}-pdp__h2`} id={`${prefix}-info-h`}>Product information</h2>
      <dl className={`${prefix}-pdp__details`}>
        {rows.map((r) => <div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
        {(care.phone || care.email) && <div><dt>Consumer care</dt><dd>{contacts.flatMap((c, i) => (i ? [' · ', c] : [c]))}</dd></div>}
      </dl>
    </section>
  );
}
