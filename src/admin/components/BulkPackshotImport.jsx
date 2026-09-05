import { useMemo, useRef, useState } from 'react';
import { adminGetSetting, adminSetSetting } from '../../lib/adminApi.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';
import { products } from '../../data/products.js';
import { normalizeCategoryExperience, categoryExperiencePayload } from '../../lib/categoryExperience.js';
import {
  IMPORT_STATUS, planImport, parseMappingCsv, applyUploads, mergeIntoHomepage,
  buildSummaryText, countByStatus,
} from '../../lib/spotlightImport.js';
import { processSpotlightPackshot } from '../../lib/spotlightPackshotProcessing.js';

// ============================================================
// BULK SPOTLIGHT PACKSHOT IMPORT
//
// Drop a folder of packshots named <product-slug>.png and this uploads each
// one through the SAME authenticated admin path a single upload uses
// (uploadHomepageImage -> the browser's signed-in Supabase client), then
// assigns the returned SORA-hosted URL as that product's spotlight image.
//
// No service-role key, no RLS change, and nothing is ever hotlinked: the file
// is re-hosted first and only the SORA URL is stored.
//
// SAFETY OF THE SAVE. Uploads run one at a time and a failure never stops the
// batch. The settings write happens ONCE, at the end, and re-reads the whole
// homepage object immediately beforehand so discovery, the visuals and every
// other homepage key are carried through untouched.
// ============================================================

export default function BulkPackshotImport({ onImported }) {
  const [files, setFiles] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvName, setCsvName] = useState('');
  const [rows, setRows] = useState([]);        // live plan, mutated as we go
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [catReport, setCatReport] = useState([]);
  const urlsRef = useRef(new Map());
  const cancelRef = useRef(false);

  const plan = useMemo(
    () => (rows.length ? rows : planImport({ files, products, csvRows }).plan),
    [files, csvRows, rows],
  );
  const counts = useMemo(() => countByStatus(plan), [plan]);
  const uploadedCount = counts[IMPORT_STATUS.UPLOADED] || 0;

  // What the import will actually do, per category, before it runs. One
  // product can belong to several categories, so the number of ASSIGNMENTS is
  // legitimately higher than the number of images — they are counted, and
  // named, separately.
  const preflight = useMemo(() => {
    const byCat = new Map();
    let assignments = 0;
    for (const r of plan) {
      if (r.status !== IMPORT_STATUS.MATCHED) continue;
      for (const c of r.categories || []) {
        byCat.set(c, (byCat.get(c) || 0) + 1);
        assignments += 1;
      }
    }
    return {
      assignments,
      categories: [...byCat.entries()]
        .map(([category, n]) => ({ category, n }))
        .sort((a, b) => b.n - a.n),
    };
  }, [plan]);
  const totalToUpload = plan.filter((r) => r.status === IMPORT_STATUS.MATCHED
    || r.status === IMPORT_STATUS.UPLOADING
    || r.status === IMPORT_STATUS.UPLOADED
    || r.status === IMPORT_STATUS.FAILED).length;

  function pickImages(e) {
    const picked = [...(e.target.files || [])].filter((f) => /^image\//.test(f.type));
    setFiles(picked);
    setRows([]);
    setDone(false);
    setErr('');
    setSaveNote('');
    setCatReport([]);
    urlsRef.current = new Map();
  }

  async function pickCsv(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const parsed = parseMappingCsv(await f.text());
      setCsvRows(parsed);
      setCsvName(`${f.name} — ${parsed.length} row${parsed.length === 1 ? '' : 's'}`);
      setRows([]);
    } catch {
      setErr('Could not read that mapping file.');
    }
  }

  async function run() {
    setRunning(true);
    setErr('');
    setSaveNote('');
    cancelRef.current = false;
    urlsRef.current = new Map();

    // Freeze the plan so the table stops recomputing under us.
    const live = planImport({ files, products, csvRows }).plan.map((r) => ({ ...r }));
    setRows(live);

    const uploads = [];
    for (let i = 0; i < live.length; i += 1) {
      if (cancelRef.current) break;
      const row = live[i];
      if (row.status !== IMPORT_STATUS.MATCHED) continue;

      live[i] = { ...row, status: IMPORT_STATUS.UPLOADING };
      setRows([...live]);

      try {
        // CPU-only browser preprocessing happens before the existing upload:
        // edge-connected white is removed, transparent excess is cropped and
        // the result is encoded as a SORA-hosted PNG. No storefront runtime
        // performs pixel analysis.
        const processed = await processSpotlightPackshot(row.file);
        const url = await uploadHomepageImage(processed.file);
        urlsRef.current.set(row.slug, url);
        uploads.push({
          slug: row.slug, url, categories: row.categories,
          autoTheme: {
            background: processed.theme.background,
            gradient: processed.theme.gradient,
          },
        });
        live[i] = { ...row, status: IMPORT_STATUS.UPLOADED, url };
      } catch (ex) {
        // One bad file must not end the batch.
        live[i] = { ...row, status: IMPORT_STATUS.FAILED, reason: ex?.message || 'Upload failed.' };
      }
      setRows([...live]);
    }

    if (uploads.length) {
      try {
        // Re-read immediately before writing so a concurrent edit to
        // discovery or the homepage visuals is carried through, not clobbered.
        const currentHomepage = (await adminGetSetting('homepage')) || {};
        const existing = normalizeCategoryExperience(currentHomepage.categoryExperience);
        const { categories, report } = applyUploads(existing, uploads);
        const payload = categoryExperiencePayload(categories);
        await adminSetSetting('homepage', mergeIntoHomepage(currentHomepage, payload));
        setCatReport(report);
        const assignments = report.reduce((n, c) => n + c.updated.length + c.created.length, 0);
        setSaveNote(
          `${uploads.length} source image${uploads.length === 1 ? '' : 's'} uploaded, `
          + `${assignments} category assignment${assignments === 1 ? '' : 's'} created. Saved. `
          + 'Packshots are ready. Review each category and turn Spotlight enabled on when you '
          + 'are ready to publish it — nothing is live until you do.',
        );
        onImported?.();
      } catch (ex) {
        setErr(
          `${uploads.length} image${uploads.length === 1 ? '' : 's'} uploaded, but saving the assignment failed: `
          + `${ex?.message || 'unknown error'}. The images are stored — run the import again to assign them.`,
        );
      }
    } else {
      setSaveNote('Nothing was uploaded, so no settings were changed.');
    }

    setRunning(false);
    setDone(true);
  }

  function downloadSummary() {
    const text = buildSummaryText(plan, { uploadedUrls: urlsRef.current });
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spotlight-import-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const matched = counts[IMPORT_STATUS.MATCHED] || 0;

  return (
    <div className="card adm-bpi">
      <h2 className="adm-cx__h2">Bulk import spotlight packshots</h2>
      <p className="hint">
        Select a folder of packshots named after their product — <code>aloe-vera-protein-shampoo.png</code>.
        Each file is uploaded to SORA LIFE’s own media storage and assigned as that product’s
        spotlight image. Files are matched on the exact product slug; nothing is guessed.
      </p>
      <p className="hint">
        Importing never publishes anything. A category you have not switched on stays off,
        and one that was already on stays on — you decide when each goes live.
      </p>

      <div className="adm-bpi__pickers">
        <div className="field">
          <label className="label" htmlFor="bpi-files">Packshot images</label>
          <input
            id="bpi-files" type="file" multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={pickImages} disabled={running}
          />
          {files.length > 0 && <p className="hint">{files.length} image{files.length === 1 ? '' : 's'} selected.</p>}
        </div>
        <div className="field">
          <label className="label" htmlFor="bpi-csv">Mapping file (optional)</label>
          <input id="bpi-csv" type="file" accept=".csv,text/csv" onChange={pickCsv} disabled={running} />
          <p className="hint">
            {csvName || 'If you have _MAPPING.csv, add it and the import will refuse anything it disagrees with.'}
          </p>
        </div>
      </div>

      {plan.length > 0 && (
        <>
          <div className="adm-bpi__counts" role="status" aria-live="polite">
            <Tally label="Matched" n={matched} />
            <Tally label="Uploading" n={counts[IMPORT_STATUS.UPLOADING] || 0} />
            <Tally label="Uploaded" n={uploadedCount} tone="ok" />
            <Tally label="Skipped" n={counts[IMPORT_STATUS.SKIPPED] || 0} />
            <Tally label="Failed" n={counts[IMPORT_STATUS.FAILED] || 0} tone="bad" />
            <Tally label="Ambiguous" n={counts[IMPORT_STATUS.AMBIGUOUS] || 0} tone="warn" />
            <Tally label="Unmatched" n={counts[IMPORT_STATUS.UNMATCHED] || 0} />
          </div>

          {/* Shown before the run so the shape of the import is clear. Every
              matched product is assigned — there is no cap — and a product in
              two categories produces two assignments from one image. */}
          {!running && !done && matched > 0 && (
            <div className="adm-bpi__preflight">
              <p className="hint">
                <strong>{matched}</strong> image{matched === 1 ? '' : 's'} will be uploaded and
                assigned, creating <strong>{preflight.assignments}</strong> category
                assignment{preflight.assignments === 1 ? '' : 's'}
                {preflight.assignments > matched
                  && ' — some products belong to more than one category, so they are assigned in each'}.
              </p>
              <p className="hint adm-bpi__cats-line">
                {preflight.categories.map((c) => `${c.category} (${c.n})`).join(' · ')}
              </p>
            </div>
          )}

          {(running || done) && totalToUpload > 0 && (
            <p className="adm-bpi__progress" role="status" aria-live="polite">
              <strong>{uploadedCount} / {totalToUpload}</strong> uploaded
              {counts[IMPORT_STATUS.FAILED] > 0 && ` · ${counts[IMPORT_STATUS.FAILED]} failed`}
            </p>
          )}

          <div className="adm-bpi__list">
            {plan.map((r) => (
              <div key={r.filename} className={`adm-bpi__row adm-bpi__row--${r.status}`}>
                <span className="adm-bpi__file">{r.filename}</span>
                <span className="adm-bpi__status">{r.status}</span>
                <span className="adm-bpi__note">{r.reason || (r.product ? r.product.name : '')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {catReport.length > 0 && (
        <div className="adm-bpi__cats">
          <h3 className="adm-bpi__h3">Categories changed</h3>
          {catReport.map((c) => (
            <p key={c.category} className="hint">
              <strong>{c.category}</strong>: {c.updated.length} updated, {c.created.length} added
              {c.enabled ? ' · live' : ' · READY — NOT LIVE'}
            </p>
          ))}
        </div>
      )}

      {saveNote && <p className="hint ok">{saveNote}</p>}
      {err && <p className="hint err">{err}</p>}

      <div className="adm-bpi__actions">
        <button className="btn" onClick={run} disabled={running || matched === 0}>
          {running ? 'Importing…' : `Import ${matched || ''} packshot${matched === 1 ? '' : 's'}`.trim()}
        </button>
        {running && (
          <button className="btn btn-light" onClick={() => { cancelRef.current = true; }}>
            Stop after this file
          </button>
        )}
        {done && plan.length > 0 && (
          <button className="btn btn-light" onClick={downloadSummary}>Download summary</button>
        )}
      </div>
    </div>
  );
}

function Tally({ label, n, tone }) {
  return (
    <span className={`adm-bpi__tally${tone ? ` adm-bpi__tally--${tone}` : ''}${n ? '' : ' is-zero'}`}>
      <strong>{n}</strong> {label}
    </span>
  );
}
