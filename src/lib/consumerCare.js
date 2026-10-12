import { useEffect, useState } from 'react';
import { branding, contact } from './settings.js';
import { fetchLegalPage } from './legalPagesApi.js';
import { defaultLegalPage } from './legalPages.js';
import { companyInfo } from './company.js';

// ============================================================
// The store's consumer-care contact — who a customer can reach about a
// purchase — exactly as the Contact & help page publishes it (the admin's
// Contact page, falling back to the contact settings). The footer shows it on
// every page; a product page repeats it beside the listing's declarations.
//
// One read of that page per visit, shared by every caller, so a product page
// does not ask twice. Every value is optional and none is ever invented
// (company.js): an unset one is simply absent.
// ============================================================
let shared = null;
function contactPage() {
  if (!shared) shared = fetchLegalPage('contact').catch(() => null);
  return shared;
}

export function useConsumerCare() {
  const [page, setPage] = useState(null);
  useEffect(() => {
    let live = true;
    contactPage().then((loaded) => { if (live && loaded) setPage(loaded); });
    return () => { live = false; };
  }, []);
  return companyInfo({ ...(page || defaultLegalPage('contact', contact, branding.siteName)), social: companyInfo().social });
}
