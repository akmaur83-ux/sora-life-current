import { r as reactExports, E as adminListProductMedia, H as adminCommitStagedProductMedia, I as validateMediaFile, J as mediaFailureMessage, j as jsxRuntimeExports, K as adminReorderProductMedia, M as adminSetPrimaryMedia, P as adminEnsurePrimaryMedia, Q as adminUpdateProductMedia, R as adminReplaceProductMedia, S as adminDeleteProductMedia, T as adminDiscoverMedia, U as adminImportMedia, V as validateContent, W as CONTENT_FIELDS, X as fieldPopulated, Y as CONTENT_LABELS, u as useParams, Z as useNavigate, _ as useLocation, i as adminListProducts, b as Link, y as categories, s as money, $ as adminUpdateProduct, a0 as adminCreateProduct } from '../bundle.js';

let tmpSeq = 0;
const tmpId = () => `tmp_${Date.now()}_${tmpSeq++}`;
const MediaGallery = /*#__PURE__*/reactExports.forwardRef(function MediaGallery({
  productId = null,
  productName = '',
  legacyGalleryUrls = [],
  initialCleanupPending = [],
  onPrimaryChange
}, ref) {
  const live = !!productId;
  const operation = reactExports.useRef(false);
  const [working, setWorking] = reactExports.useState(false);
  const cleanupRef = reactExports.useRef(initialCleanupPending);
  const [cleanupPending, setCleanupPending] = reactExports.useState(initialCleanupPending);
  const rememberCleanup = result => {
    if (result?.cleanupPending?.length) {
      cleanupRef.current = result.cleanupPending;
      setCleanupPending(result.cleanupPending);
    }
  };
  const beginWork = () => {
    if (operation.current || cleanupRef.current.length) return false;
    operation.current = true;
    setWorking(true);
    return true;
  };
  const endWork = () => {
    operation.current = false;
    setWorking(false);
  };
  // item shape: { id, url, alt, isPrimary, sortOrder, file?, status?, error? }
  const [items, setItems] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(live);
  const [err, setErr] = reactExports.useState('');
  const [dragOver, setDragOver] = reactExports.useState(false);
  const dragId = reactExports.useRef(null);
  const fileInput = reactExports.useRef(null);
  const replaceInputs = reactExports.useRef({});

  // Importer (live products only)
  const [importOpen, setImportOpen] = reactExports.useState(false);
  const [importUrl, setImportUrl] = reactExports.useState('');
  const [discovering, setDiscovering] = reactExports.useState(false);
  const [candidates, setCandidates] = reactExports.useState(null); // null | [{url, host}]
  const [selected, setSelected] = reactExports.useState(() => new Set());
  const [importing, setImporting] = reactExports.useState(false);
  const [importMsg, setImportMsg] = reactExports.useState('');
  const emitPrimary = reactExports.useCallback(list => {
    if (!onPrimaryChange) return;
    const p = list.find(x => x.isPrimary);
    if (p || list.length === 0) onPrimaryChange(p ? p.url : '');
  }, [onPrimaryChange]);
  const load = reactExports.useCallback(async () => {
    if (!live) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    let list = [];
    try {
      list = await adminListProductMedia(productId);
      setItems(list);
      emitPrimary(list);
    } catch (e) {
      setErr(previous => [previous, e.message || String(e)].filter(Boolean).join(' '));
      list = null;
    }
    setLoading(false);
    return list;
  }, [live, productId, emitPrimary]);
  reactExports.useEffect(() => {
    load();
  }, [load]);

  // Revoke object URLs on unmount (staged previews).
  reactExports.useEffect(() => () => {
    items.forEach(it => it.url?.startsWith('blob:') && URL.revokeObjectURL(it.url));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  reactExports.useImperativeHandle(ref, () => ({
    hasStaged: () => !live && items.length > 0,
    isBusy: () => operation.current,
    // First successful row establishes a fallback primary. The requested
    // primary and image_url are then checked against authoritative rows.
    async commitStaged(newProductId) {
      if (live) return {
        ok: true,
        created: [],
        failed: [],
        primaryError: null,
        syncError: null,
        cleanupPending: []
      };
      if (!beginWork()) return {
        ok: false,
        created: [],
        failed: [],
        primaryError: 'A media operation is still running.',
        syncError: null,
        cleanupPending: []
      };
      try {
        return await adminCommitStagedProductMedia(newProductId, items);
      } finally {
        items.forEach(it => it.url?.startsWith('blob:') && URL.revokeObjectURL(it.url));
        endWork();
      }
    }
  }), [live, items]);

  // ---- add files (upload for live, stage for new) ----
  const addFiles = reactExports.useCallback(async fileList => {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length || operation.current || cleanupRef.current.length) return;
    setErr('');
    if (!live) {
      setItems(cur => {
        const next = [...cur];
        for (const file of files) {
          try {
            validateMediaFile(file);
          } catch (e) {
            setErr(e.message);
            continue;
          }
          next.push({
            id: tmpId(),
            file,
            url: URL.createObjectURL(file),
            alt: '',
            isPrimary: next.length === 0,
            sortOrder: next.length
          });
        }
        emitPrimary(next);
        return next;
      });
      return;
    }
    if (!beginWork()) return;
    const previews = files.map(file => ({
      id: tmpId(),
      file,
      url: URL.createObjectURL(file),
      status: 'uploading'
    }));
    setItems(cur => [...cur, ...previews]);
    try {
      const result = await adminCommitStagedProductMedia(productId, previews);
      rememberCleanup(result);
      if (!result.ok) setErr(mediaFailureMessage(result));
    } catch (e) {
      rememberCleanup(e);
      setErr(e.message || String(e));
    } finally {
      await load();
      previews.forEach(item => URL.revokeObjectURL(item.url));
      setItems(cur => cur.filter(item => !previews.some(preview => preview.id === item.id)));
      endWork();
    }
  }, [live, productId, emitPrimary, load]);
  const onDrop = e => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  // ---- reorder (drag thumbnails) ----
  const onTileDragStart = id => {
    dragId.current = id;
  };
  const onTileDrop = async targetId => {
    if (operation.current) return;
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    setItems(cur => {
      const fromIdx = cur.findIndex(x => x.id === from);
      const toIdx = cur.findIndex(x => x.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return cur;
      const next = [...cur];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const ordered = next.map((x, i) => ({
        ...x,
        sortOrder: i
      }));
      if (live) adminReorderProductMedia(productId, ordered.filter(x => !x.status).map(x => x.id)).catch(e => setErr(e.message));
      emitPrimary(ordered);
      return ordered;
    });
  };

  // ---- set primary ----
  const setPrimary = async id => {
    if (operation.current) return;
    if (!live) {
      setItems(cur => {
        const next = cur.map(x => ({
          ...x,
          isPrimary: x.id === id
        }));
        emitPrimary(next);
        return next;
      });
      return;
    }
    if (!beginWork()) return;
    setErr('');
    try {
      await adminSetPrimaryMedia(productId, id);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      await load();
      endWork();
    }
  };
  const retryPrimarySync = async () => {
    if (!live || !beginWork()) return;
    setErr('');
    try {
      await adminEnsurePrimaryMedia(productId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      await load();
      endWork();
    }
  };

  // ---- alt text ----
  const setAlt = (id, alt) => setItems(cur => cur.map(x => x.id === id ? {
    ...x,
    alt
  } : x));
  const commitAlt = async (id, alt) => {
    if (live) {
      try {
        await adminUpdateProductMedia(productId, id, {
          altText: alt
        });
      } catch (e) {
        setErr(e.message);
      }
    }
  };

  // ---- replace ----
  const onReplaceFile = async (id, file) => {
    if (!file || operation.current) return;
    try {
      validateMediaFile(file);
    } catch (e) {
      setErr(e.message);
      return;
    }
    if (!live) {
      const preview = URL.createObjectURL(file);
      setItems(cur => cur.map(x => {
        if (x.id !== id) return x;
        x.url?.startsWith('blob:') && URL.revokeObjectURL(x.url);
        return {
          ...x,
          file,
          url: preview
        };
      }));
      return;
    }
    if (!beginWork()) return;
    setErr('');
    setItems(cur => cur.map(x => x.id === id ? {
      ...x,
      status: 'uploading'
    } : x));
    try {
      await adminReplaceProductMedia(productId, id, file);
    } catch (e) {
      rememberCleanup(e);
      setErr(e.message || String(e));
    } finally {
      await load();
      endWork();
    }
  };

  // ---- delete ----
  const removeItem = async id => {
    if (operation.current || cleanupRef.current.length) return;
    const item = items.find(x => x.id === id);
    if (live && item && !item.status && !window.confirm('Delete this image? This cannot be undone.')) return;
    if (item?.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setItems(cur => {
      const next = cur.filter(x => x.id !== id);
      if (!live) emitPrimary(next);
      return next;
    });
    if (live && item && !item.status) {
      if (!beginWork()) return;
      setErr('');
      try {
        await adminDeleteProductMedia(productId, id);
      } catch (e) {
        rememberCleanup(e);
        setErr(e.message || String(e));
      } finally {
        await load();
        endWork();
      }
    }
  };

  // ---- importer (discover then import selected) ----
  const discover = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setDiscovering(true);
    setErr('');
    setImportMsg('');
    setCandidates(null);
    setSelected(new Set());
    try {
      const data = await adminDiscoverMedia(url);
      setCandidates(data.images || []);
      if (!data.images?.length) setImportMsg('No product images were found on that page.');
    } catch (e) {
      setErr(e.message || String(e));
    }
    setDiscovering(false);
  };
  const toggleSelect = url => setSelected(cur => {
    const next = new Set(cur);
    next.has(url) ? next.delete(url) : next.add(url);
    return next;
  });
  const httpOnly = u => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  const legacyCandidates = [...new Set((legacyGalleryUrls || []).filter(httpOnly).map(u => u.trim()))];
  const allChosen = urls => urls.length > 0 && urls.every(u => selected.has(u));
  const toggleAll = urls => setSelected(cur => {
    const next = new Set(cur);
    if (urls.every(u => next.has(u))) urls.forEach(u => next.delete(u));else urls.forEach(u => next.add(u));
    return next;
  });
  const doImport = async () => {
    const urls = [...selected];
    if (!urls.length || !live || !beginWork()) return;
    setImporting(true);
    setErr('');
    setImportMsg('');
    try {
      const data = await adminImportMedia(productId, urls);
      const n = data.imported?.length || 0;
      const s = data.skipped?.length || 0;
      setImportMsg(`Imported ${n} image${n === 1 ? '' : 's'} into our storage${s ? ` · ${s} skipped` : ''}.`);
      setSelected(new Set((data.skipped || []).map(item => item.url)));
      if (!s) {
        setCandidates(null);
        setImportUrl('');
      }
      if (s) setErr(data.skipped.map(item => item.reason).join(' '));
    } catch (e) {
      const data = e.details;
      rememberCleanup(data);
      const n = data?.imported?.length || 0;
      setErr([n ? `${n} image(s) saved, but the operation needs attention.` : '', e.message, mediaFailureMessage(data || {}), ...(data?.skipped || []).map(item => item.reason)].filter(Boolean).join(' '));
      // Do not offer a blind retry after an ambiguous response or partial save.
      setSelected(new Set());
    } finally {
      await load();
      setImporting(false);
      endWork();
    }
  };
  const anyUploading = items.some(x => x.status === 'uploading');
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "surface ap-media",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-media__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Media Gallery"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
        className: "hint",
        children: [items.length, " image", items.length === 1 ? '' : 's', anyUploading ? ' · uploading…' : '']
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      style: {
        marginBottom: 12
      },
      children: [err, live && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        style: {
          marginTop: 8
        },
        children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-xs btn-light",
          disabled: working || loading,
          onClick: retryPrimarySync,
          children: "Verify primary & retry image sync"
        })
      })]
    }), cleanupPending.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      style: {
        marginBottom: 12,
        overflowWrap: 'anywhere'
      },
      children: ["Media changes are blocked until these Storage paths are reconciled: ", cleanupPending.join(', '), ". Re-uploading may create duplicates."]
    }), !live && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      style: {
        marginTop: 0
      },
      children: "Add images now \u2014 they upload automatically when you create the product."
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: `ap-media__drop ${dragOver ? 'is-over' : ''}`,
      onDragOver: e => {
        e.preventDefault();
        setDragOver(true);
      },
      onDragLeave: () => setDragOver(false),
      onDrop: onDrop,
      onClick: () => {
        if (!working && !loading) fileInput.current?.click();
      },
      role: "button",
      tabIndex: 0,
      "aria-disabled": working || loading,
      onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!working && !loading) fileInput.current?.click();
        }
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
        ref: fileInput,
        type: "file",
        accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
        multiple: true,
        hidden: true,
        onChange: e => {
          addFiles(e.target.files);
          e.target.value = '';
        }
      }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "Drop images here"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "hint",
        children: "or click to browse \xB7 JPEG/PNG/WebP/GIF/AVIF \xB7 up to 8MB each \xB7 multiple allowed"
      })]
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      style: {
        marginTop: 14
      },
      children: "Loading media\u2026"
    }) : items.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      style: {
        marginTop: 14
      },
      children: "No images yet. The primary image is what shows in the catalog and cart."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "ap-media__grid",
      children: items.map((it, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("figure", {
        className: `ap-media__tile ${it.isPrimary ? 'is-primary' : ''} ${it.status === 'error' ? 'is-error' : ''}`,
        draggable: !it.status && !working,
        onDragStart: () => onTileDragStart(it.id),
        onDragOver: e => e.preventDefault(),
        onDrop: () => onTileDrop(it.id),
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__thumb",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("img", {
            src: it.url,
            alt: it.alt || ''
          }), it.status === 'uploading' && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-media__status",
            children: "Uploading\u2026"
          }), it.status === 'error' && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-media__status err",
            title: it.error,
            children: "Failed \u2014 remove & retry"
          }), it.isPrimary && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-media__badge",
            children: "\u2605 Primary"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-media__order",
            children: i + 1
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input ap-media__alt",
          placeholder: "Alt text (accessibility / SEO)",
          value: it.alt || '',
          onChange: e => setAlt(it.id, e.target.value),
          onBlur: e => commitAlt(it.id, e.target.value),
          disabled: working || it.status === 'uploading'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-xs btn-light",
            disabled: working || it.isPrimary || !!it.status,
            onClick: () => setPrimary(it.id),
            children: "Set primary"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            ref: el => replaceInputs.current[it.id] = el,
            type: "file",
            accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
            hidden: true,
            onChange: e => {
              onReplaceFile(it.id, e.target.files?.[0]);
              e.target.value = '';
            }
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-xs btn-light",
            disabled: working || it.status === 'uploading',
            onClick: () => replaceInputs.current[it.id]?.click(),
            children: "Replace"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-xs btn-light ap-media__del",
            disabled: working,
            onClick: () => removeItem(it.id),
            children: "Delete"
          })]
        })]
      }, it.id))
    }), items.length > 1 && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      style: {
        marginTop: 10
      },
      children: "Drag thumbnails to reorder. The \u2605 primary image leads the gallery and represents the product everywhere else."
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "ap-media__import",
      children: !live ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: "Save the product first to import images from a source URL."
      }) : !importOpen ? /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        onClick: () => setImportOpen(true),
        children: ["Import product media", legacyCandidates.length ? ` · ${legacyCandidates.length} saved source image${legacyCandidates.length === 1 ? '' : 's'}` : ' from a source URL', "\u2026"]
      }) : /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-media__importbox",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__importhead",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: "Import product media"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-xs btn-light",
            onClick: () => {
              setImportOpen(false);
              setCandidates(null);
              setImportUrl('');
              setSelected(new Set());
            },
            children: "Close"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "Selected images are copied into our own Supabase Storage \u2014 third-party URLs are never hotlinked. Nothing is copied until you press Import."
        }), legacyCandidates.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__group",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "ap-media__grouphead",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: ["This product's saved source images (", legacyCandidates.length, ")"]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-xs btn-light",
              onClick: () => toggleAll(legacyCandidates),
              children: allChosen(legacyCandidates) ? 'Clear all' : 'Select all'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "ap-media__candidates",
            children: legacyCandidates.map(url => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
              type: "button",
              className: `ap-media__cand ${selected.has(url) ? 'is-sel' : ''}`,
              onClick: () => toggleSelect(url),
              title: url,
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("img", {
                src: url,
                alt: "",
                loading: "lazy"
              }), selected.has(url) && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "ap-media__cand-check",
                children: "\u2713"
              })]
            }, url))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__group",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "ap-media__grouphead",
            children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              children: "Discover from an official product page"
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "ap-media__importrow",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: importUrl,
              placeholder: "https://biosash.com/product/\u2026",
              onChange: e => setImportUrl(e.target.value),
              disabled: discovering || importing
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-sm",
              onClick: discover,
              disabled: discovering || importing || !importUrl.trim(),
              children: discovering ? 'Inspecting…' : 'Discover images'
            })]
          }), candidates && candidates.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "ap-media__grouphead",
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                children: [candidates.length, " found"]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "btn btn-xs btn-light",
                onClick: () => toggleAll(candidates.map(c => c.url)),
                children: allChosen(candidates.map(c => c.url)) ? 'Clear all' : 'Select all'
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
              className: "ap-media__candidates",
              children: candidates.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
                type: "button",
                className: `ap-media__cand ${selected.has(c.url) ? 'is-sel' : ''}`,
                onClick: () => toggleSelect(c.url),
                title: c.url,
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("img", {
                  src: c.url,
                  alt: "",
                  loading: "lazy"
                }), selected.has(c.url) && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "ap-media__cand-check",
                  children: "\u2713"
                })]
              }, c.url))
            })]
          })]
        }), importMsg && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          style: {
            color: 'var(--color-success, #2F855A)'
          },
          children: importMsg
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-media__importrow",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "hint",
            children: [selected.size, " selected"]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm",
            onClick: doImport,
            disabled: working || loading || selected.size === 0,
            children: importing ? 'Importing…' : `Import ${selected.size || ''} into our storage`
          })]
        })]
      })
    })]
  });
});
var MediaGallery$1 = MediaGallery;

const rowsFromSpecs = specs => {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return [];
  return Object.entries(specs).map(([key, value]) => ({
    key,
    value: String(value ?? '')
  }));
};
function Repeatable({
  rows,
  onChange,
  addLabel,
  render,
  emptyHint
}) {
  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-rep",
    children: [rows.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted adm-rep__empty",
      children: emptyHint
    }), rows.map((row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-rep__row",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-rep__fields",
        children: render(row, i)
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-rep__ctl",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-xs btn-light",
          onClick: () => move(i, -1),
          disabled: i === 0,
          "aria-label": "Move up",
          children: "\u2191"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-xs btn-light",
          onClick: () => move(i, 1),
          disabled: i === rows.length - 1,
          "aria-label": "Move down",
          children: "\u2193"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-xs btn-light",
          onClick: () => onChange(rows.filter((_, j) => j !== i)),
          "aria-label": "Remove",
          children: "\u2715"
        })]
      })]
    }, i)), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      type: "button",
      className: "btn btn-sm btn-light",
      onClick: () => onChange([...rows, {}]),
      children: addLabel
    })]
  });
}
function ContentEditor({
  values,
  onChange,
  product,
  brandOptions = []
}) {
  const [claimDraft, setClaimDraft] = reactExports.useState('');
  const set = (k, v) => onChange({
    ...values,
    [k]: v
  });
  const claims = Array.isArray(values.keyClaims) ? values.keyClaims : [];
  const benefits = Array.isArray(values.benefits) ? values.benefits : [];
  const ingredients = Array.isArray(values.ingredients) ? values.ingredients : [];
  const steps = Array.isArray(values.howToUse) ? values.howToUse : [];
  const specRows = reactExports.useMemo(() => rowsFromSpecs(values.specifications), [values.specifications]);

  // Coverage is computed from the FORM state, not the saved row, so ticking a
  // gap off updates as you type rather than after a save.
  const asProduct = {
    brand: values.brand,
    netContent: values.netContent,
    keyClaims: claims,
    benefits,
    ingredients,
    howToUse: steps,
    specifications: values.specifications
  };
  const errors = validateContent({
    key_claims: claims,
    benefits,
    ingredients,
    how_to_use: steps,
    specifications: values.specifications
  });
  const addClaim = () => {
    const t = claimDraft.trim();
    if (!t) return;
    if (!claims.includes(t)) set('keyClaims', [...claims, t]);
    setClaimDraft('');
  };
  const setSpecs = rows => {
    // Kept as rows in the editor so two blank rows can coexist while typing;
    // collapsed to an object on save by the shared normaliser.
    const obj = {};
    for (const r of rows) if (r.key?.trim()) obj[r.key.trim()] = String(r.value ?? '');
    set('specifications', obj);
  };
  const specAsRows = specRows.length ? specRows : [];
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Content coverage"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "muted",
        style: {
          marginTop: 0
        },
        children: "Each of these renders a section of the product page. An empty field hides its section."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-cov",
        children: CONTENT_FIELDS.map(f => {
          const on = fieldPopulated(asProduct, f);
          return /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: `adm-cov__pill ${on ? 'is-on' : 'is-off'}`,
            children: [on ? '●' : '○', " ", CONTENT_LABELS[f]]
          }, f);
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "muted adm-cov__meta",
        children: ["Source: ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: product?.contentSource || 'not set'
        }), product?.contentUpdatedAt ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [" \xB7 content last updated ", new Date(product.contentUpdatedAt).toLocaleString('en-IN')]
        }) : /*#__PURE__*/jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, {
          children: " \xB7 never edited"
        }), product?.slug && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [' · ', /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            href: `/product/${product.slug}`,
            target: "_blank",
            rel: "noreferrer",
            children: "Open the product page \u2197"
          })]
        })]
      }), errors.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner err",
        style: {
          marginTop: 10
        },
        children: errors.map(e => /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          children: e
        }, e))
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Identity"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Brand"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            list: "adm-brand-options",
            value: values.brand || '',
            onChange: e => set('brand', e.target.value),
            placeholder: "e.g. Biosash"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("datalist", {
            id: "adm-brand-options",
            children: brandOptions.map(b => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: b
            }, b))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Net content"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: values.netContent || '',
            onChange: e => set('netContent', e.target.value),
            placeholder: "200ml \xB7 60 tablets \xB7 100 g"
          })]
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Key claims"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "muted",
        style: {
          marginTop: 0
        },
        children: "Short badges shown under the title. Keep them factual and under 60 characters \u2014 a condition or disease name here reads as a treatment claim."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-tags",
        children: claims.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "adm-tag",
          children: [c, /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            onClick: () => set('keyClaims', claims.filter(x => x !== c)),
            "aria-label": `Remove ${c}`,
            children: "\u2715"
          })]
        }, c))
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-tags__add",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: claimDraft,
          onChange: e => setClaimDraft(e.target.value),
          onKeyDown: e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addClaim();
            }
          },
          placeholder: "Paraben Free"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: addClaim,
          children: "Add claim"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Benefits"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Repeatable, {
        rows: benefits,
        onChange: r => set('benefits', r),
        addLabel: "Add benefit",
        emptyHint: "No benefits yet \u2014 this section is hidden on the product page.",
        render: (row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "Title",
            value: row.title || '',
            onChange: e => set('benefits', benefits.map((b, j) => j === i ? {
              ...b,
              title: e.target.value
            } : b))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            className: "textarea",
            rows: 2,
            placeholder: "Description (optional)",
            value: row.description || '',
            onChange: e => set('benefits', benefits.map((b, j) => j === i ? {
              ...b,
              description: e.target.value
            } : b))
          })]
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Ingredients"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Repeatable, {
        rows: ingredients,
        onChange: r => set('ingredients', r),
        addLabel: "Add ingredient",
        emptyHint: "No ingredients yet \u2014 this section is hidden on the product page.",
        render: (row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "Name",
            value: row.name || '',
            onChange: e => set('ingredients', ingredients.map((x, j) => j === i ? {
              ...x,
              name: e.target.value
            } : x))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "One line about it (optional)",
            value: row.description || '',
            onChange: e => set('ingredients', ingredients.map((x, j) => j === i ? {
              ...x,
              description: e.target.value
            } : x))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "Image URL (optional, https only)",
            value: row.image_url || '',
            onChange: e => set('ingredients', ingredients.map((x, j) => j === i ? {
              ...x,
              image_url: e.target.value
            } : x))
          })]
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "How to use"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Repeatable, {
        rows: steps,
        onChange: r => set('howToUse', r),
        addLabel: "Add step",
        emptyHint: "No directions yet \u2014 this section is hidden on the product page.",
        render: (row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-rep__num",
            children: i + 1
          }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            className: "textarea",
            rows: 2,
            placeholder: "Step text",
            value: row.text || '',
            onChange: e => set('howToUse', steps.map((s, j) => j === i ? {
              ...s,
              text: e.target.value
            } : s))
          })]
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Specifications"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Repeatable, {
        rows: specAsRows,
        onChange: setSpecs,
        addLabel: "Add specification",
        emptyHint: "No specifications yet \u2014 this section is hidden on the product page.",
        render: (row, i) => /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "Label \u2014 e.g. Shelf life",
            value: row.key || '',
            onChange: e => setSpecs(specAsRows.map((x, j) => j === i ? {
              ...x,
              key: e.target.value
            } : x))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            placeholder: "Value \u2014 e.g. 24 months",
            value: row.value || '',
            onChange: e => setSpecs(specAsRows.map((x, j) => j === i ? {
              ...x,
              value: e.target.value
            } : x))
          })]
        })
      })]
    })]
  });
}

const DISCOUNT_TIERS = [0, 10, 15, 18, 20];
const empty = {
  name: '',
  slug: '',
  description: '',
  category: categories[0]?.slug || '',
  image: '',
  gallery: [],
  originalPrice: '',
  discountPercent: 10,
  form: '',
  inStock: true,
  permalink: '',
  isNew: false,
  isBestseller: false,
  isFeatured: false,
  rating: 0,
  reviewCount: 0,
  isActive: true,
  // Content columns (0025). null, not '' or [] — the save path treats an
  // absent value as "leave the column alone", and a new product genuinely
  // has no content rather than empty content.
  brand: null,
  netContent: null,
  keyClaims: null,
  benefits: null,
  ingredients: null,
  howToUse: null,
  specifications: null
};
function ProductForm() {
  const {
    dbId
  } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!dbId;
  const loadedUpdatedAt = reactExports.useRef(null);
  // Set when a save is refused as stale, so the error can offer a reload
  // rather than just describing the problem.
  const [staleConflict, setStaleConflict] = reactExports.useState(false);
  const [tab, setTab] = reactExports.useState('basics');
  const [loadedProduct, setLoadedProduct] = reactExports.useState(null);
  const [brandOptions, setBrandOptions] = reactExports.useState([]);
  const [values, setValues] = reactExports.useState(empty);
  const [loading, setLoading] = reactExports.useState(isEdit);
  const [saving, setSaving] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [customDiscount, setCustomDiscount] = reactExports.useState(false);
  const mediaRef = reactExports.useRef(null);

  // Surface a partial-upload warning carried over after creating a product.
  reactExports.useEffect(() => {
    if (location.state?.mediaWarning) setErr(location.state.mediaWarning);
  }, [location.state]);

  // The Media Gallery owns the images; it reports the current primary URL so the
  // product row's image_url (used by the grid, cart, wishlist, passport) stays
  // in sync. Blob previews from the New-Product staging flow are ignored — the
  // real URL is written by commitStaged() after the product row exists.
  // MUST be stable (useCallback): the gallery's load effect depends on this
  // identity; an inline function re-created every render caused an infinite
  // load→setState→render→load loop.
  const onPrimaryChange = reactExports.useCallback(url => {
    if (typeof url === 'string' && !url.startsWith('blob:')) setValues(s => s.image === url ? s : {
      ...s,
      image: url
    });
  }, []);
  reactExports.useEffect(() => {
    if (!isEdit) return;
    adminListProducts().then(list => {
      // products.id is a numeric Supabase column, so dbId on each product
      // is a JS number — but useParams() always returns route params as
      // strings, regardless of the underlying column type. Compare as
      // strings so this works whether dbId is numeric, text, or a UUID.
      const p = list.find(x => String(x.dbId) === String(dbId));
      if (!p) {
        setErr('Product not found.');
        setLoading(false);
        return;
      }
      // The row's updated_at as it was when this editor opened. It goes back
      // with the save so the write can be refused if anything moved in the
      // meantime — an import, another admin, the active toggle on the list
      // page. Held in a ref because it is not rendered and must not cause a
      // re-render when it changes after a successful save.
      loadedUpdatedAt.current = p.updatedAt || null;
      setValues({
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        image: p.image || '',
        gallery: p.gallery || [],
        originalPrice: p.originalPrice,
        discountPercent: p.discountPercent,
        form: p.form || '',
        inStock: p.inStock !== undefined ? p.inStock : p.stock > 0,
        permalink: p.permalink || '',
        isNew: p.isNew,
        isBestseller: p.isBestseller,
        isFeatured: p.isFeatured,
        rating: p.rating,
        reviewCount: p.reviewCount,
        isActive: p.isActive,
        brand: p.brand ?? null,
        netContent: p.netContent ?? null,
        keyClaims: p.keyClaims ?? null,
        benefits: p.benefits ?? null,
        ingredients: p.ingredients ?? null,
        howToUse: p.howToUse ?? null,
        specifications: p.specifications ?? null
      });
      setLoadedProduct(p);
      // Brand suggestions come from what the catalogue already uses, so the
      // spelling stays consistent without a fixed list to maintain.
      setBrandOptions([...new Set(list.map(x => x.brand).filter(Boolean))].sort());
      if (!DISCOUNT_TIERS.includes(p.discountPercent)) setCustomDiscount(true);
      setLoading(false);
    }).catch(e => {
      setErr(e.message || String(e));
      setLoading(false);
    });
  }, [dbId, isEdit]);
  const set = (k, v) => setValues(s => ({
    ...s,
    [k]: v
  }));
  const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const original = Number(values.originalPrice) || 0;
  const discount = Number(values.discountPercent) || 0;
  const salePrice = original > 0 ? Math.round(original * (1 - discount / 100)) : 0;
  async function onSubmit(e) {
    e.preventDefault();
    if (mediaRef.current?.isBusy?.()) {
      setErr('Wait for the current media operation to finish before saving.');
      return;
    }
    // The `min` attribute alone is a hint the browser can be talked out of.
    // A product saved at zero renders "Price coming soon" and can never be
    // bought — the server refuses the line at checkout — so refuse it here.
    if (!(original > 0)) {
      setErr('Enter an original price of at least ₹1 — a product with no price cannot be purchased.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim() || slugify(values.name),
        description: values.description,
        category: values.category,
        // Never persist a transient blob: preview as the image URL — the real
        // primary is written by the gallery (live) or commitStaged (new).
        image: values.image && !values.image.startsWith('blob:') ? values.image : '',
        gallery: values.gallery,
        originalPrice: original,
        discountPercent: discount,
        form: values.form,
        inStock: values.inStock,
        permalink: values.permalink,
        isNew: values.isNew,
        isBestseller: values.isBestseller,
        isFeatured: values.isFeatured,
        rating: Number(values.rating) || 0,
        reviewCount: Number(values.reviewCount) || 0,
        isActive: values.isActive,
        // Always sent, so clearing a field in the editor genuinely clears it.
        // Shapes are normalised in productToDbRow; this passes them straight
        // through rather than reimplementing the rules a second time.
        brand: values.brand,
        netContent: values.netContent,
        keyClaims: values.keyClaims,
        benefits: values.benefits,
        ingredients: values.ingredients,
        howToUse: values.howToUse,
        specifications: values.specifications
      };
      if (isEdit) {
        const saved = await adminUpdateProduct(dbId, payload, loadedUpdatedAt.current);
        // Adopt the new token so a second save in the same session is not
        // rejected against the value this save just superseded.
        loadedUpdatedAt.current = saved.updatedAt || null;
      } else {
        const created = await adminCreateProduct(payload);
        // Commit any images staged during creation against the new product id.
        // Partial upload failures don't roll back the product — the admin lands
        // on the live editor to retry just the failed images.
        if (mediaRef.current?.hasStaged?.()) {
          let result;
          try {
            result = await mediaRef.current.commitStaged(created.dbId);
          } catch (error) {
            result = {
              ok: false,
              primaryError: error.message || 'Could not finish media uploads.'
            };
          }
          if (!result?.ok) {
            navigate(`/admin/products/${created.dbId}/edit`, {
              state: {
                mediaWarning: `Product created; media needs attention. ${result?.created?.length || 0} image(s) saved. ${mediaFailureMessage(result || {})}`,
                mediaCleanupPending: result?.cleanupPending || []
              }
            });
            setSaving(false);
            return;
          }
        }
      }
      navigate('/admin/products');
    } catch (ex) {
      // A stale write is not a failure to report as a database error — it means
      // somebody else's edit is currently in the row and this save would have
      // erased it. Say that, and offer the reload.
      if (ex?.isStaleWrite) setStaleConflict(true);
      setErr(ex.message || String(ex));
      setSaving(false);
      return;
    }
    setSaving(false);
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: isEdit ? 'Edit product' : 'Add product'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: isEdit ? values.name : 'Create a new Sora Life product'
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        to: "/admin/products",
        className: "btn btn-outline btn-sm",
        children: "\u2190 Back to products"
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      children: [err, staleConflict && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        style: {
          marginLeft: 10
        },
        onClick: () => window.location.reload(),
        children: "Reload product"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: onSubmit,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-chipbar",
        role: "tablist",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          role: "tab",
          "aria-selected": tab === 'basics',
          className: `adm-chip ${tab === 'basics' ? 'active' : ''}`,
          onClick: () => setTab('basics'),
          children: "Basics, pricing & media"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          role: "tab",
          "aria-selected": tab === 'content',
          className: `adm-chip ${tab === 'content' ? 'active' : ''}`,
          onClick: () => setTab('content'),
          children: "Product page content"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        hidden: tab !== 'basics',
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "surface",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            children: "Basics"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Product name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              required: true,
              value: values.name,
              onChange: e => set('name', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Slug (URL)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: values.slug,
                onChange: e => set('slug', e.target.value),
                placeholder: "auto-generated from name"
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Category"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
                className: "select",
                value: values.category,
                onChange: e => set('category', e.target.value),
                children: categories.map(c => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: c.slug,
                  children: c.name
                }, c.slug))
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Description"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
              className: "textarea",
              value: values.description,
              onChange: e => set('description', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Size / form (e.g. \"100 ml\")"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: values.form,
              onChange: e => set('form', e.target.value)
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(MediaGallery$1, {
          ref: mediaRef,
          productId: isEdit ? Number(dbId) : null,
          productName: values.name,
          legacyGalleryUrls: values.gallery,
          initialCleanupPending: location.state?.mediaCleanupPending || [],
          onPrimaryChange: onPrimaryChange
        }, dbId || 'new'), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "surface",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            children: "Pricing"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Original price / MRP (\u20B9)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                type: "number",
                min: "1",
                step: "1",
                required: true,
                value: values.originalPrice,
                onChange: e => set('originalPrice', e.target.value)
              }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "hint",
                children: "Must be at least \u20B91. A product with no price cannot be purchased."
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Discount"
              }), !customDiscount ? /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
                className: "select",
                value: values.discountPercent,
                onChange: e => e.target.value === 'custom' ? setCustomDiscount(true) : set('discountPercent', Number(e.target.value)),
                children: [DISCOUNT_TIERS.map(d => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: d,
                  children: d === 0 ? 'No discount' : `${d}%`
                }, d)), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: "custom",
                  children: "Custom\u2026"
                })]
              }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                type: "number",
                min: "0",
                max: "90",
                value: values.discountPercent,
                onChange: e => set('discountPercent', Number(e.target.value))
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-preview-price",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "now",
              children: money(salePrice)
            }), discount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "was",
              children: money(original)
            }), discount > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              className: "off",
              children: [discount, "% OFF"]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "hint",
              children: "\u2014 live preview, calculated automatically"
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "surface",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            children: "Inventory & source"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Availability"
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-checkrow",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  type: "checkbox",
                  id: "f-instock",
                  checked: values.inStock,
                  onChange: e => set('inStock', e.target.checked)
                }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
                  htmlFor: "f-instock",
                  children: "In stock"
                })]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Official source URL"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: values.permalink,
                onChange: e => set('permalink', e.target.value)
              })]
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "surface",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            children: "Flags & visibility"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-checkrow",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              id: "f-new",
              checked: values.isNew,
              onChange: e => set('isNew', e.target.checked)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
              htmlFor: "f-new",
              children: "New arrival"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-checkrow",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              id: "f-best",
              checked: values.isBestseller,
              onChange: e => set('isBestseller', e.target.checked)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
              htmlFor: "f-best",
              children: "Bestseller"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-checkrow",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              id: "f-feat",
              checked: values.isFeatured,
              onChange: e => set('isFeatured', e.target.checked)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
              htmlFor: "f-feat",
              children: "Featured"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-checkrow",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              id: "f-active",
              checked: values.isActive,
              onChange: e => set('isActive', e.target.checked)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
              htmlFor: "f-active",
              children: "Active (visible on storefront)"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            style: {
              marginTop: 12
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Rating (0\u20135, demo value)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                type: "number",
                min: "0",
                max: "5",
                step: "0.1",
                value: values.rating,
                onChange: e => set('rating', e.target.value)
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Review count (demo value)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                type: "number",
                min: "0",
                value: values.reviewCount,
                onChange: e => set('reviewCount', e.target.value)
              })]
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        hidden: tab !== 'content',
        children: /*#__PURE__*/jsxRuntimeExports.jsx(ContentEditor, {
          values: values,
          onChange: setValues,
          product: loadedProduct,
          brandOptions: brandOptions
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: saving,
          children: saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          to: "/admin/products",
          className: "btn btn-outline",
          children: "Cancel"
        })]
      })]
    })]
  });
}

export { ProductForm as default };
//# sourceMappingURL=ProductForm.js.map
