import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import CreatorTermsPanel from './creator/CreatorTermsPanel.jsx';
import { LEGAL_PAGES, hasLegalContent } from '../lib/legalPages.js';
import { telHref } from '../lib/company.js';

export function LegalUpdated({ page }) {
  return page.updated_at ? <p className="legal-updated">Last updated {new Date(page.updated_at).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</p> : null;
}
export function LegalFields({ page, officer = false }) {
  const rows = officer ? [
    ['Grievance officer', page.officerName], ['Email', page.officerEmail, 'email'],
    ['Phone', page.officerPhone, 'phone'], ['Address', page.officerAddress],
    ['Acknowledgement', page.acknowledgement], ['Resolution', page.resolution],
  ] : [
    ['Business name', page.legalName], ['Address', page.address], ['Email', page.email, 'email'],
    ['Phone', page.phone, 'phone'], ['Support hours', page.hours],
  ];
  return <dl className="legal-details">{rows.filter(([,value]) => value).map(([label,value,type]) =>
    <div key={label}><dt>{label}</dt><dd>{type === 'email' ? <a href={'mailto:' + value}>{value}</a> : type === 'phone' ? <a href={telHref(value)}>{value}</a> : value}</dd></div>
  )}</dl>;
}
export default function LegalPageContent({ id, page }) {
  const spec = LEGAL_PAGES.find(p => p.id === id);
  const populated = hasLegalContent(id, page);
  return <div className="info info--legal"><div className="v2-wrap info-legal__wrap">
    <nav className="v2-crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><Icon name="chevronRight" size={12}/><strong>{spec.label}</strong></nav>
    <header className="info-hero info-hero--legal"><h1 className="info-title info-title--legal">{page.title || spec.label}</h1>
      {populated && page.intro && <p className="info-lede">{page.intro}</p>}<LegalUpdated page={page}/>
    </header>
    {!populated ? <p className="info-legal__p">Information for this page will be available soon.</p> : spec.kind === 'markdown' ?
      <CreatorTermsPanel terms={page} className="legal-markdown"/> : <>
        <LegalFields page={page}/><LegalFields page={page} officer/>
        {page.responseNote && <p className="info-legal__p legal-preserve">{page.responseNote}</p>}
        <p className="info-legal__p">When writing about an order, include its order number, the nature of your complaint, and any supporting photographs or documents.</p>
      </>}
    <nav className="legal-help" aria-label="Policy help">
      <Link to="/contact">Contact &amp; help</Link><Link to="/account/orders">Your orders</Link>
      <Link to="/passport">Purchase Passport</Link>{id === 'terms' && <Link to="/account/creator">Creator Program</Link>}
    </nav>
  </div></div>;
}
