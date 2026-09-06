import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { branding, contact } from './settings.js';
import { defaultLegalPage, legalKey, normalizeLegalPage } from './legalPages.js';

export async function fetchLegalPage(id) {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', legalKey(id)).maybeSingle();
  if (error) throw error;
  return data ? normalizeLegalPage(id, data.value) : null;
}
export function useLegalPage(id) {
  const [state, setState] = useState({ id, page: defaultLegalPage(id, contact, branding.siteName), loading: true });
  useEffect(() => {
    let live = true;
    setState({ id, page: defaultLegalPage(id, contact, branding.siteName), loading: true });
    fetchLegalPage(id).then(page => { if (live) setState({ id, page: page ?? defaultLegalPage(id, contact, branding.siteName), loading: false }); })
      .catch(() => { if (live) setState({ id, page: defaultLegalPage(id, contact, branding.siteName), loading: false }); });
    return () => { live = false; };
  }, [id]);
  return state.id === id ? state : { id, page: defaultLegalPage(id, contact, branding.siteName), loading: true };
}
