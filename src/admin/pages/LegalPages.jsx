import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { LEGAL_PAGES, CONTACT_FIELDS, GRIEVANCE_FIELDS, legalKey, defaultLegalPage, normalizeLegalPage, validateLegalPage, hasLegalContent } from '../../lib/legalPages.js';
import { LegalUpdated } from '../../components/LegalPageContent.jsx';

export default function LegalPagesAdmin() {
  const { pageId } = useParams();
  return <LegalPagesEditor key={pageId || 'overview'} pageId={pageId}/>;
}
function LegalPagesEditor({ pageId }) {
  const spec = LEGAL_PAGES.find(p => p.id === pageId);
  const [records, setRecords] = useState({});
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState([]);
  useEffect(() => {
    let live = true;
    Promise.all([adminGetSetting('contact'), adminGetSetting('branding'), ...LEGAL_PAGES.map(p => adminGetSetting(legalKey(p.id)))])
      .then(([contact, branding, ...values]) => {
        if (!live) return;
        const next = Object.fromEntries(LEGAL_PAGES.map((p, i) => [p.id, values[i] == null ? defaultLegalPage(p.id, contact || {}, branding?.siteName) : normalizeLegalPage(p.id, values[i])]));
        setRecords(next); setForm(spec ? next[spec.id] : null);
        setMissing(LEGAL_PAGES.filter((p,i) => values[i] == null).map(p => p.id));
      }).catch(e => { if(live) { setErr(e.message || String(e)); setLoadFailed(true); } })
      .finally(() => { if(live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function save(e) {
    e.preventDefault(); setSaving(true); setErr(''); setMsg('');
    try {
      const next = { ...validateLegalPage(spec.id, form), updated_at: new Date().toISOString() };
      await adminSetSetting(legalKey(spec.id), next);
      // Confirm the stored value rather than marking a failed write as published.
      const stored = await adminGetSetting(legalKey(spec.id));
      if (!stored) throw new Error('The saved record could not be read back. Please reload before retrying.');
      const confirmed = normalizeLegalPage(spec.id, stored);
      setForm(confirmed); setRecords(r => ({ ...r, [spec.id]: confirmed }));
      setMissing(m => m.filter(id => id !== spec.id)); setMsg('Saved. The public page now uses this content.');
    } catch(ex) { setErr(ex.message || String(ex)); }
    setSaving(false);
  }
  const field = (key, label, type = 'text') => <div className="field" key={key}>
    <label className="label" htmlFor={'legal-' + key}>{label}</label>
    {type === 'textarea' ? <textarea id={'legal-' + key} className="textarea" rows={key === 'body' ? 24 : 3} maxLength={key === 'body' ? 60000 : 2000} value={form[key] || ''} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}/>
      : <input id={'legal-' + key} className="input" type={type} maxLength={key === 'title' ? 160 : 2000} value={form[key] || ''} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}/>}
  </div>;
  return <div className="adm-form">
    <div className="adm__head"><div><h1>{spec ? spec.label : 'Legal Pages'}</h1><p>Edit the public policies and contact information.</p></div>
      {spec && <a className="btn btn-outline" href={'/' + spec.id} target="_blank" rel="noopener noreferrer">Preview live page ↗</a>}
    </div>
    {loading ? <p className="muted">Loading…</p> : <>
      {err && <div className="adm-banner err" role="alert">{err}</div>}
      {msg && <div className="adm-banner ok" role="status">{msg}</div>}
      {!loadFailed && missing.length > 0 && <div className="adm-banner">Some records have not been seeded. Current page content is preserved as a fallback. Apply the legal-pages SQL before publishing edits.</div>}
      {!spec ? <div className="surface"><ul className="legal-admin-list">{LEGAL_PAGES.map(p => <li key={p.id}>
        <Link to={'/admin/legal-pages/' + p.id}>{p.label}</Link>
        <span>{loadFailed ? 'Unavailable' : hasLegalContent(p.id, records[p.id]) ? 'Has content' : 'Empty'}{missing.includes(p.id) ? ' · fallback' : ''}</span>
        {records[p.id] && <LegalUpdated page={records[p.id]}/>}
      </li>)}</ul></div> : form && <form onSubmit={save}>
        <p className="muted">Saved status: {hasLegalContent(spec.id, records[spec.id]) ? 'Has content' : 'Empty'}. Empty pages remain reachable and show a short message.</p>
        <p className="muted">{form.updated_at ? 'Last updated ' + new Date(form.updated_at).toLocaleString('en-IN') : 'Last updated: original content; no edits saved yet.'}</p>
        <fieldset disabled={saving || loadFailed || missing.includes(spec.id)} className="legal-admin-fields">
          <div className="surface">{field('title', 'Page heading')}{field('intro', 'Introduction', 'textarea')}
            {spec.kind === 'markdown' ? <>{field('body', 'Page content (markdown)', 'textarea')}<p className="hint">Use #, ## or ### headings, - bullets, numbered lists and blank lines. Other formatting is displayed as plain text. HTML is never executed.</p></> : <>
              {CONTACT_FIELDS.map(args => field(...args))}
              {spec.id === 'grievance' && GRIEVANCE_FIELDS.map(args => field(...args))}
            </>}
          </div>
          {spec.id === 'contact' && <div className="surface"><h2>Common questions</h2>
            {(form.faqs || []).map((faq,i) => <div key={i} className="legal-admin-faq">
              <label className="label" htmlFor={'faq-q-' + i}>Question {i+1}</label>
              <input id={'faq-q-' + i} className="input" value={faq.q} maxLength={300} onChange={e=>setForm(f=>({...f,faqs:f.faqs.map((v,j)=>j===i?{...v,q:e.target.value}:v)}))}/>
              <label className="label" htmlFor={'faq-a-' + i}>Answer {i+1}</label>
              <textarea id={'faq-a-' + i} className="textarea" rows={4} value={faq.a} maxLength={4000} onChange={e=>setForm(f=>({...f,faqs:f.faqs.map((v,j)=>j===i?{...v,a:e.target.value}:v)}))}/>
              <button type="button" className="btn btn-outline btn-sm" onClick={()=>setForm(f=>({...f,faqs:f.faqs.filter((_,j)=>j!==i)}))}>Remove question {i+1}</button>
            </div>)}
            <button type="button" className="btn btn-outline" disabled={(form.faqs || []).length >= 30} onClick={()=>setForm(f=>({...f,faqs:[...(f.faqs || []),{q:'',a:''}]}))}>Add question</button>
          </div>}
          <div className="adm-actions"><button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save page'}</button><Link to="/admin/legal-pages">All legal pages</Link></div>
        </fieldset>
      </form>}
    </>}
  </div>;
}
