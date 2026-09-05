import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListProducts, adminUpdateProduct } from '../../lib/adminApi.js';
import { CONTENT_FIELDS, CONTENT_LABELS, contentScore } from '../../lib/productContent.js';
import { productsToCsv, planImport, CSV_COLUMNS } from '../../lib/productContentCsv.js';

// ============================================================
// ADMIN — product content coverage, and the bulk CSV round-trip.
//
// This is the work queue. Products are listed worst-first, because the useful
// question is never "what does coverage look like" but "which twenty do I fix
// next", and a sorted list answers it without anyone doing arithmetic.
//
// The importer is DRY-RUN FIRST, always. It parses and validates the whole
// file, shows every field that would change with before and after, and only
// writes after an explicit confirmation. Fill-only is the default: a blank
// cell means "no opinion", never "clear this". Accidental mass-blanking is the
// failure mode that costs the most here, because the Biosash ingest is
// fill-only too and will never restore what a bad import destroys.
// ============================================================

const dbKeyToForm = {
  brand: 'brand',
  net_content: 'netContent',
  key_claims: 'keyClaims',
  benefits: 'benefits',
  ingredients: 'ingredients',
  how_to_use: 'howToUse',
  specifications: 'specifications',
};

export default function ContentCoverage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  const [plan, setPlan] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await adminListProducts()); setErr(''); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const scored = useMemo(() => products
    .filter((p) => (onlyActive ? p.isActive : true))
    .map((p) => ({ p, s: contentScore(p) }))
    .sort((a, b) => a.s.count - b.s.count || a.p.name.localeCompare(b.p.name)),
  [products, onlyActive]);

  const totals = useMemo(() => {
    const t = {};
    for (const f of CONTENT_FIELDS) t[f] = scored.filter(({ p }) => contentScore(p).populated.includes(f)).length;
    return t;
  }, [scored]);

  function exportCsv() {
    const rows = scored.map(({ p }) => p);
    const blob = new Blob([productsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sora-product-content-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileText(text);
    setFileName(file.name);
    setPlan(planImport(text, products, { overwrite }));
    setMsg('');
  }

  // Re-plan when the overwrite toggle changes, so the preview always matches
  // the switch the admin is looking at.
  useEffect(() => {
    if (fileText) setPlan(planImport(fileText, products, { overwrite }));
  }, [overwrite, fileText, products]);

  async function applyPlan() {
    if (!plan?.changes?.length) return;
    if (!window.confirm(
      `Apply content changes to ${plan.changes.length} product(s)?\n\n`
      + `${overwrite ? 'EXISTING VALUES WILL BE OVERWRITTEN.' : 'Fill-only: existing values are kept.'}\n\n`
      + 'Prices, stock and active status are never touched.',
    )) return;

    setApplying(true);
    let ok = 0; const failed = [];
    for (const c of plan.changes) {
      // Written through adminUpdateProduct so these rows go down exactly the
      // same path as the editor: same normalisation, same updated_at stamp,
      // same stale-write precondition. A second write path for bulk edits is
      // how the two drift apart.
      const current = products.find((p) => String(p.dbId) === String(c.dbId));
      if (!current) { failed.push(`${c.slug}: no longer in the catalogue`); continue; }
      const payload = { ...current };
      for (const [dbKey, value] of Object.entries(c.patch)) payload[dbKeyToForm[dbKey]] = value;
      try {
        await adminUpdateProduct(c.dbId, payload, current.updatedAt);
        ok += 1;
      } catch (ex) {
        failed.push(`${c.slug}: ${ex.isStaleWrite ? 'changed since the file was planned — re-export and retry' : (ex.message || String(ex))}`);
      }
    }
    setApplying(false);
    setPlan(null); setFileText(''); setFileName('');
    setMsg(`Updated ${ok} product(s).${failed.length ? ` ${failed.length} failed.` : ''}`);
    if (failed.length) setErr(failed.join(' · '));
    await load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Product content</h1>
          <p>
            {scored.length} products · what each one is missing, worst first.
            Empty fields hide their section on the product page.
          </p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <div className="surface">
        <h2>Coverage</h2>
        <div className="adm-cov">
          {CONTENT_FIELDS.map((f) => (
            <span key={f} className="adm-cov__pill">
              {CONTENT_LABELS[f]}: <strong>{totals[f]}</strong> / {scored.length}
            </span>
          ))}
        </div>
        <label className="adm-cov__meta" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Active products only
        </label>
      </div>

      <div className="surface">
        <h2>Bulk edit</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Export, edit in a spreadsheet, import back. Structured fields are JSON in their cell —
          leave a cell blank to say &ldquo;no opinion&rdquo;; blank never clears a field.
        </p>
        <div className="adm-actions" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-sm" onClick={exportCsv}>Export CSV ({scored.length})</button>
          <label className="btn btn-sm btn-light" style={{ cursor: 'pointer' }}>
            Choose CSV to import
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          </label>
        </div>
        <p className="muted" style={{ fontSize: 11 }}>Columns: {CSV_COLUMNS.join(', ')}</p>

        {plan && (
          <div className="adm-import">
            <h3>Dry run — {fileName}</h3>
            {!plan.ok && <div className="adm-banner err">{plan.reason}</div>}

            {plan.ok && (
              <>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '10px 0' }}>
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>Overwrite existing values.</strong>
                    <br />
                    <span className="muted">
                      Off by default. With this off, a product that already has a value keeps it
                      and the incoming value is skipped.
                    </span>
                  </span>
                </label>

                <p>
                  <strong>{plan.changes.length}</strong> product(s) would change
                  {plan.skipped.length > 0 && <> · <strong>{plan.skipped.length}</strong> row(s) skipped</>}
                </p>

                {plan.skipped.length > 0 && (
                  <div className="adm-banner err">
                    {plan.skipped.slice(0, 12).map((sk) => (
                      <div key={sk.line}>Line {sk.line} ({sk.slug || '—'}): {sk.reason}</div>
                    ))}
                    {plan.skipped.length > 12 && <div>… and {plan.skipped.length - 12} more</div>}
                  </div>
                )}

                <div className="adm-import__list">
                  {plan.changes.slice(0, 40).map((c) => (
                    <div key={c.dbId} className="adm-import__item">
                      <strong>{c.name}</strong> <span className="muted">({c.slug})</span>
                      {c.diffs.map((d) => (
                        <div key={d.field} className={`adm-import__diff ${d.skipped ? 'is-skip' : ''}`}>
                          <span className="adm-import__field">{CONTENT_LABELS[d.field]}</span>
                          {d.skipped
                            ? <span className="muted"> — kept, {d.reason}</span>
                            : (
                              <>
                                <span className="adm-import__before">{d.before || '(empty)'}</span>
                                <span aria-hidden="true"> → </span>
                                <span className="adm-import__after">{d.after}</span>
                              </>
                            )}
                        </div>
                      ))}
                    </div>
                  ))}
                  {plan.changes.length > 40 && <p className="muted">… and {plan.changes.length - 40} more products</p>}
                </div>

                <div className="adm-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-sm" onClick={applyPlan} disabled={applying || !plan.changes.length}>
                    {applying ? 'Applying…' : `Apply to ${plan.changes.length} product(s)`}
                  </button>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => { setPlan(null); setFileText(''); setFileName(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="surface">
        <h2>Work queue</h2>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Fields</th>
              <th>Missing</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scored.map(({ p, s }) => (
              <tr key={p.dbId}>
                <td>
                  {p.name}
                  {!s.hasDescription && <span className="badge badge-out" style={{ marginLeft: 6 }}>no description</span>}
                </td>
                <td><strong>{s.count}</strong> / {s.total}</td>
                <td className="muted">{s.missing.map((f) => CONTENT_LABELS[f]).join(', ') || '—'}</td>
                <td className="muted">{p.contentSource || '—'}</td>
                <td><Link className="btn btn-xs btn-light" to={`/admin/products/${p.dbId}/edit`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
