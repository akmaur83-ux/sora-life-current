import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  adminListProductMedia, adminCommitStagedProductMedia, adminEnsurePrimaryMedia,
  adminUpdateProductMedia, adminSetPrimaryMedia, adminReorderProductMedia,
  adminDeleteProductMedia, adminReplaceProductMedia,
  validateMediaFile, adminDiscoverMedia, adminImportMedia,
} from '../../lib/adminApi.js';
import { mediaFailureMessage } from '../../lib/productMediaOperations.js';

// ============================================================
// ADMIN — Product Media Gallery manager
//
// Two modes, one component:
//   • LIVE   (productId set)  — every action persists immediately through the
//                               admin-only product_media RPC/RLS.
//   • STAGED (productId null) — for the New Product flow: images are held in
//                               memory and committed (uploaded + rows created)
//                               right after the product row is inserted, via
//                               the imperative commitStaged(newId) handle.
//
// Display/CRUD only — no pricing, cart, variant or attribution logic.
// ============================================================

let tmpSeq = 0;
const tmpId = () => `tmp_${Date.now()}_${tmpSeq++}`;

const MediaGallery = forwardRef(function MediaGallery({ productId = null, productName = '', legacyGalleryUrls = [], initialCleanupPending = [], onPrimaryChange }, ref) {
  const live = !!productId;
  const operation = useRef(false);
  const [working, setWorking] = useState(false);
  const cleanupRef = useRef(initialCleanupPending);
  const [cleanupPending, setCleanupPending] = useState(initialCleanupPending);
  const rememberCleanup = (result) => {
    if (result?.cleanupPending?.length) { cleanupRef.current = result.cleanupPending; setCleanupPending(result.cleanupPending); }
  };
  const beginWork = () => { if (operation.current || cleanupRef.current.length) return false; operation.current = true; setWorking(true); return true; };
  const endWork = () => { operation.current = false; setWorking(false); };
  // item shape: { id, url, alt, isPrimary, sortOrder, file?, status?, error? }
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(live);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const dragId = useRef(null);
  const fileInput = useRef(null);
  const replaceInputs = useRef({});

  // Importer (live products only)
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState(null); // null | [{url, host}]
  const [selected, setSelected] = useState(() => new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const emitPrimary = useCallback((list) => {
    if (!onPrimaryChange) return;
    const p = list.find((x) => x.isPrimary);
    if (p || list.length === 0) onPrimaryChange(p ? p.url : '');
  }, [onPrimaryChange]);

  const load = useCallback(async () => {
    if (!live) { setLoading(false); return []; }
    setLoading(true);
    let list = [];
    try { list = await adminListProductMedia(productId); setItems(list); emitPrimary(list); }
    catch (e) { setErr((previous) => [previous, e.message || String(e)].filter(Boolean).join(' ')); list = null; }
    setLoading(false);
    return list;
  }, [live, productId, emitPrimary]);
  useEffect(() => { load(); }, [load]);

  // Revoke object URLs on unmount (staged previews).
  useEffect(() => () => { items.forEach((it) => it.url?.startsWith('blob:') && URL.revokeObjectURL(it.url)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    hasStaged: () => !live && items.length > 0,
    isBusy: () => operation.current,
    // First successful row establishes a fallback primary. The requested
    // primary and image_url are then checked against authoritative rows.
    async commitStaged(newProductId) {
      if (live) return { ok: true, created: [], failed: [], primaryError: null, syncError: null, cleanupPending: [] };
      if (!beginWork()) return { ok: false, created: [], failed: [], primaryError: 'A media operation is still running.', syncError: null, cleanupPending: [] };
      try {
        return await adminCommitStagedProductMedia(newProductId, items);
      } finally {
        items.forEach((it) => it.url?.startsWith('blob:') && URL.revokeObjectURL(it.url));
        endWork();
      }
    },
  }), [live, items]);

  // ---- add files (upload for live, stage for new) ----
  const addFiles = useCallback(async (fileList) => {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length || operation.current || cleanupRef.current.length) return;
    setErr('');
    if (!live) {
      setItems((cur) => {
        const next = [...cur];
        for (const file of files) {
          try { validateMediaFile(file); } catch (e) { setErr(e.message); continue; }
          next.push({ id: tmpId(), file, url: URL.createObjectURL(file), alt: '', isPrimary: next.length === 0, sortOrder: next.length });
        }
        emitPrimary(next);
        return next;
      });
      return;
    }
    if (!beginWork()) return;
    const previews = files.map((file) => ({ id: tmpId(), file, url: URL.createObjectURL(file), status: 'uploading' }));
    setItems((cur) => [...cur, ...previews]);
    try {
      const result = await adminCommitStagedProductMedia(productId, previews);
      rememberCleanup(result);
      if (!result.ok) setErr(mediaFailureMessage(result));
    } catch (e) { rememberCleanup(e); setErr(e.message || String(e)); }
    finally {
      await load();
      previews.forEach((item) => URL.revokeObjectURL(item.url));
      setItems((cur) => cur.filter((item) => !previews.some((preview) => preview.id === item.id)));
      endWork();
    }
  }, [live, productId, emitPrimary, load]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); };

  // ---- reorder (drag thumbnails) ----
  const onTileDragStart = (id) => { dragId.current = id; };
  const onTileDrop = async (targetId) => {
    if (operation.current) return;
    const from = dragId.current; dragId.current = null;
    if (!from || from === targetId) return;
    setItems((cur) => {
      const fromIdx = cur.findIndex((x) => x.id === from);
      const toIdx = cur.findIndex((x) => x.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return cur;
      const next = [...cur];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const ordered = next.map((x, i) => ({ ...x, sortOrder: i }));
      if (live) adminReorderProductMedia(productId, ordered.filter((x) => !x.status).map((x) => x.id)).catch((e) => setErr(e.message));
      emitPrimary(ordered);
      return ordered;
    });
  };

  // ---- set primary ----
  const setPrimary = async (id) => {
    if (operation.current) return;
    if (!live) { setItems((cur) => { const next = cur.map((x) => ({ ...x, isPrimary: x.id === id })); emitPrimary(next); return next; }); return; }
    if (!beginWork()) return;
    setErr('');
    try {
      await adminSetPrimaryMedia(productId, id);
    } catch (e) { setErr(e.message || String(e)); }
    finally { await load(); endWork(); }
  };

  const retryPrimarySync = async () => {
    if (!live || !beginWork()) return;
    setErr('');
    try { await adminEnsurePrimaryMedia(productId); }
    catch (e) { setErr(e.message || String(e)); }
    finally { await load(); endWork(); }
  };

  // ---- alt text ----
  const setAlt = (id, alt) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, alt } : x)));
  const commitAlt = async (id, alt) => { if (live) { try { await adminUpdateProductMedia(productId, id, { altText: alt }); } catch (e) { setErr(e.message); } } };

  // ---- replace ----
  const onReplaceFile = async (id, file) => {
    if (!file || operation.current) return;
    try { validateMediaFile(file); } catch (e) { setErr(e.message); return; }
    if (!live) {
      const preview = URL.createObjectURL(file);
      setItems((cur) => cur.map((x) => { if (x.id !== id) return x; x.url?.startsWith('blob:') && URL.revokeObjectURL(x.url); return { ...x, file, url: preview }; }));
      return;
    }
    if (!beginWork()) return;
    setErr('');
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status: 'uploading' } : x)));
    try {
      await adminReplaceProductMedia(productId, id, file);
    } catch (e) { rememberCleanup(e); setErr(e.message || String(e)); }
    finally { await load(); endWork(); }
  };

  // ---- delete ----
  const removeItem = async (id) => {
    if (operation.current || cleanupRef.current.length) return;
    const item = items.find((x) => x.id === id);
    if (live && item && !item.status && !window.confirm('Delete this image? This cannot be undone.')) return;
    if (item?.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setItems((cur) => { const next = cur.filter((x) => x.id !== id); if (!live) emitPrimary(next); return next; });
    if (live && item && !item.status) {
      if (!beginWork()) return;
      setErr('');
      try {
        await adminDeleteProductMedia(productId, id);
      } catch (e) { rememberCleanup(e); setErr(e.message || String(e)); }
      finally { await load(); endWork(); }
    }
  };

  // ---- importer (discover then import selected) ----
  const discover = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setDiscovering(true); setErr(''); setImportMsg(''); setCandidates(null); setSelected(new Set());
    try {
      const data = await adminDiscoverMedia(url);
      setCandidates(data.images || []);
      if (!data.images?.length) setImportMsg('No product images were found on that page.');
    } catch (e) { setErr(e.message || String(e)); }
    setDiscovering(false);
  };
  const toggleSelect = (url) => setSelected((cur) => { const next = new Set(cur); next.has(url) ? next.delete(url) : next.add(url); return next; });
  const httpOnly = (u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  const legacyCandidates = [...new Set((legacyGalleryUrls || []).filter(httpOnly).map((u) => u.trim()))];
  const allChosen = (urls) => urls.length > 0 && urls.every((u) => selected.has(u));
  const toggleAll = (urls) => setSelected((cur) => {
    const next = new Set(cur);
    if (urls.every((u) => next.has(u))) urls.forEach((u) => next.delete(u));
    else urls.forEach((u) => next.add(u));
    return next;
  });
  const doImport = async () => {
    const urls = [...selected];
    if (!urls.length || !live || !beginWork()) return;
    setImporting(true); setErr(''); setImportMsg('');
    try {
      const data = await adminImportMedia(productId, urls);
      const n = data.imported?.length || 0;
      const s = data.skipped?.length || 0;
      setImportMsg(`Imported ${n} image${n === 1 ? '' : 's'} into our storage${s ? ` · ${s} skipped` : ''}.`);
      setSelected(new Set((data.skipped || []).map((item) => item.url)));
      if (!s) { setCandidates(null); setImportUrl(''); }
      if (s) setErr(data.skipped.map((item) => item.reason).join(' '));
    } catch (e) {
      const data = e.details;
      rememberCleanup(data);
      const n = data?.imported?.length || 0;
      setErr([n ? `${n} image(s) saved, but the operation needs attention.` : '', e.message,
        mediaFailureMessage(data || {}), ...(data?.skipped || []).map((item) => item.reason)].filter(Boolean).join(' '));
      // Do not offer a blind retry after an ambiguous response or partial save.
      setSelected(new Set());
    } finally { await load(); setImporting(false); endWork(); }
  };

  const anyUploading = items.some((x) => x.status === 'uploading');

  return (
    <div className="surface ap-media">
      <div className="ap-media__head">
        <h2>Media Gallery</h2>
        <span className="hint">{items.length} image{items.length === 1 ? '' : 's'}{anyUploading ? ' · uploading…' : ''}</span>
      </div>
      {err && <div className="adm-banner err" role="alert" style={{ marginBottom: 12 }}>{err}
        {live && <div style={{ marginTop: 8 }}><button type="button" className="btn btn-xs btn-light" disabled={working || loading} onClick={retryPrimarySync}>Verify primary &amp; retry image sync</button></div>}
      </div>}
      {cleanupPending.length > 0 && <div className="adm-banner err" role="alert" style={{ marginBottom: 12, overflowWrap: 'anywhere' }}>
        Media changes are blocked until these Storage paths are reconciled: {cleanupPending.join(', ')}. Re-uploading may create duplicates.
      </div>}
      {!live && <p className="hint" style={{ marginTop: 0 }}>Add images now — they upload automatically when you create the product.</p>}

      {/* Dropzone */}
      <div
        className={`ap-media__drop ${dragOver ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => { if (!working && !loading) fileInput.current?.click(); }}
        role="button" tabIndex={0} aria-disabled={working || loading}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!working && !loading) fileInput.current?.click(); } }}
      >
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <strong>Drop images here</strong>
        <span className="hint">or click to browse · JPEG/PNG/WebP/GIF/AVIF · up to 8MB each · multiple allowed</span>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: 14 }}>Loading media…</p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>No images yet. The primary image is what shows in the catalog and cart.</p>
      ) : (
        <div className="ap-media__grid">
          {items.map((it, i) => (
            <figure
              key={it.id}
              className={`ap-media__tile ${it.isPrimary ? 'is-primary' : ''} ${it.status === 'error' ? 'is-error' : ''}`}
              draggable={!it.status && !working}
              onDragStart={() => onTileDragStart(it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onTileDrop(it.id)}
            >
              <div className="ap-media__thumb">
                <img src={it.url} alt={it.alt || ''} />
                {it.status === 'uploading' && <span className="ap-media__status">Uploading…</span>}
                {it.status === 'error' && <span className="ap-media__status err" title={it.error}>Failed — remove &amp; retry</span>}
                {it.isPrimary && <span className="ap-media__badge">★ Primary</span>}
                <span className="ap-media__order">{i + 1}</span>
              </div>
              <input
                className="input ap-media__alt"
                placeholder="Alt text (accessibility / SEO)"
                value={it.alt || ''}
                onChange={(e) => setAlt(it.id, e.target.value)}
                onBlur={(e) => commitAlt(it.id, e.target.value)}
                disabled={working || it.status === 'uploading'}
              />
              <div className="ap-media__actions">
                <button type="button" className="btn btn-xs btn-light" disabled={working || it.isPrimary || !!it.status} onClick={() => setPrimary(it.id)}>Set primary</button>
                <input ref={(el) => (replaceInputs.current[it.id] = el)} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden
                  onChange={(e) => { onReplaceFile(it.id, e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn btn-xs btn-light" disabled={working || it.status === 'uploading'} onClick={() => replaceInputs.current[it.id]?.click()}>Replace</button>
                <button type="button" className="btn btn-xs btn-light ap-media__del" disabled={working} onClick={() => removeItem(it.id)}>Delete</button>
              </div>
            </figure>
          ))}
        </div>
      )}
      {items.length > 1 && <p className="hint" style={{ marginTop: 10 }}>Drag thumbnails to reorder. The ★ primary image leads the gallery and represents the product everywhere else.</p>}

      {/* Import candidates — the product's saved source images and/or a pasted
          official page. Nothing is copied until the admin selects and confirms;
          every imported image is copied into OUR storage (never hotlinked). */}
      <div className="ap-media__import">
        {!live ? (
          <p className="hint">Save the product first to import images from a source URL.</p>
        ) : !importOpen ? (
          <button type="button" className="btn btn-sm btn-light" onClick={() => setImportOpen(true)}>
            Import product media{legacyCandidates.length ? ` · ${legacyCandidates.length} saved source image${legacyCandidates.length === 1 ? '' : 's'}` : ' from a source URL'}…
          </button>
        ) : (
          <div className="ap-media__importbox">
            <div className="ap-media__importhead">
              <strong>Import product media</strong>
              <button type="button" className="btn btn-xs btn-light" onClick={() => { setImportOpen(false); setCandidates(null); setImportUrl(''); setSelected(new Set()); }}>Close</button>
            </div>
            <p className="hint">Selected images are copied into our own Supabase Storage — third-party URLs are never hotlinked. Nothing is copied until you press Import.</p>

            {/* Legacy source images already saved on this product */}
            {legacyCandidates.length > 0 && (
              <div className="ap-media__group">
                <div className="ap-media__grouphead">
                  <span>This product's saved source images ({legacyCandidates.length})</span>
                  <button type="button" className="btn btn-xs btn-light" onClick={() => toggleAll(legacyCandidates)}>{allChosen(legacyCandidates) ? 'Clear all' : 'Select all'}</button>
                </div>
                <div className="ap-media__candidates">
                  {legacyCandidates.map((url) => (
                    <button type="button" key={url}
                      className={`ap-media__cand ${selected.has(url) ? 'is-sel' : ''}`}
                      onClick={() => toggleSelect(url)} title={url}>
                      <img src={url} alt="" loading="lazy" />
                      {selected.has(url) && <span className="ap-media__cand-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Discover more from an official product page */}
            <div className="ap-media__group">
              <div className="ap-media__grouphead"><span>Discover from an official product page</span></div>
              <div className="ap-media__importrow">
                <input className="input" value={importUrl} placeholder="https://biosash.com/product/…"
                  onChange={(e) => setImportUrl(e.target.value)} disabled={discovering || importing} />
                <button type="button" className="btn btn-sm" onClick={discover} disabled={discovering || importing || !importUrl.trim()}>{discovering ? 'Inspecting…' : 'Discover images'}</button>
              </div>
              {candidates && candidates.length > 0 && (
                <>
                  <div className="ap-media__grouphead">
                    <span>{candidates.length} found</span>
                    <button type="button" className="btn btn-xs btn-light" onClick={() => toggleAll(candidates.map((c) => c.url))}>{allChosen(candidates.map((c) => c.url)) ? 'Clear all' : 'Select all'}</button>
                  </div>
                  <div className="ap-media__candidates">
                    {candidates.map((c) => (
                      <button type="button" key={c.url}
                        className={`ap-media__cand ${selected.has(c.url) ? 'is-sel' : ''}`}
                        onClick={() => toggleSelect(c.url)} title={c.url}>
                        <img src={c.url} alt="" loading="lazy" />
                        {selected.has(c.url) && <span className="ap-media__cand-check">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {importMsg && <p className="hint" style={{ color: 'var(--color-success, #2F855A)' }}>{importMsg}</p>}
            <div className="ap-media__importrow">
              <span className="hint">{selected.size} selected</span>
              <button type="button" className="btn btn-sm" onClick={doImport} disabled={working || loading || selected.size === 0}>{importing ? 'Importing…' : `Import ${selected.size || ''} into our storage`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MediaGallery;
