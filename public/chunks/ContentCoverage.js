import { W as CONTENT_FIELDS, ac as normalizeContentPatch, Y as CONTENT_LABELS, r as reactExports, i as adminListProducts, ad as contentScore, j as jsxRuntimeExports, b as Link, $ as adminUpdateProduct } from '../bundle.js';

// ============================================================
// SORA LIFE — product content CSV round-trip
//
// Export every product's content fields, edit in a spreadsheet, import back.
// This is what makes filling in 124 products realistic; the per-product editor
// is for one at a time.
//
// The structured fields are JSON-encoded in their cells. That is uglier in a
// spreadsheet than one-column-per-benefit would be, but it round-trips
// exactly: a benefit whose description contains a comma, a newline or a quote
// survives, and there is no ambiguity about how many benefits a row has.
//
// Nothing here writes. Callers get a plan of what WOULD change and decide.
// ============================================================
const CSV_COLUMNS = ['id', 'slug', 'name', ...CONTENT_FIELDS];
const STRUCTURED = new Set(['key_claims', 'benefits', 'ingredients', 'how_to_use', 'specifications']);

// ---------- serialize ----------

const cell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const valueFor = (p, field) => {
  const v = {
    brand: p.brand,
    net_content: p.netContent ?? p.net_content,
    key_claims: p.keyClaims ?? p.key_claims,
    benefits: p.benefits,
    ingredients: p.ingredients,
    how_to_use: p.howToUse ?? p.how_to_use,
    specifications: p.specifications
  }[field];
  if (v === null || v === undefined) return '';
  return STRUCTURED.has(field) ? JSON.stringify(v) : String(v);
};
function productsToCsv(products) {
  const rows = [CSV_COLUMNS.join(',')];
  for (const p of products) {
    rows.push([cell(p.dbId ?? p.id), cell(p.slug), cell(p.name), ...CONTENT_FIELDS.map(f => cell(valueFor(p, f)))].join(','));
  }
  return `${rows.join('\n')}\n`;
}

// ---------- parse ----------

/** RFC4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, ''); // strip a spreadsheet BOM
  const rows = [];
  let row = [],
    cur = '',
    quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}
const isEmptyCell = v => String(v ?? '').trim() === '';

/**
 * Turn a parsed CSV into a per-product plan.
 *
 * EVERY row is validated before ANY row is reported as writable, and the
 * caller is expected to refuse the whole file if `errors` is non-empty for a
 * row it cares about — a half-applied content import is worse than none,
 * because there is no way to tell which half landed.
 *
 * A BLANK cell means "no opinion, leave it alone" — never "clear this field".
 * Clearing is a deliberate act and belongs in the per-product editor, not in
 * a spreadsheet where an accidentally deleted column would wipe the catalogue.
 */
function planImport(rowsText, products, {
  overwrite = false
} = {}) {
  const rows = parseCsv(rowsText);
  if (!rows.length) return {
    ok: false,
    reason: 'The file is empty.',
    changes: [],
    skipped: []
  };
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = name => header.indexOf(name);
  if (idx('slug') < 0 && idx('id') < 0) {
    return {
      ok: false,
      reason: 'The file needs a "slug" or "id" column to match products on.',
      changes: [],
      skipped: []
    };
  }
  const bySlug = new Map(products.map(p => [String(p.slug), p]));
  const byId = new Map(products.map(p => [String(p.dbId ?? p.id), p]));
  const present = CONTENT_FIELDS.filter(f => idx(f) >= 0);
  const changes = [],
    skipped = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const line = r + 1;
    const slug = idx('slug') >= 0 ? String(cells[idx('slug')] ?? '').trim() : '';
    const id = idx('id') >= 0 ? String(cells[idx('id')] ?? '').trim() : '';
    const product = bySlug.get(slug) || byId.get(id);
    if (!product) {
      skipped.push({
        line,
        slug: slug || id,
        reason: 'No product matches this slug or id.'
      });
      continue;
    }
    const patch = {},
      diffs = [],
      rowErrors = [];
    for (const field of present) {
      const raw = cells[idx(field)];
      if (isEmptyCell(raw)) continue; // no opinion

      let parsed;
      if (STRUCTURED.has(field)) {
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          rowErrors.push(`${CONTENT_LABELS[field]}: not valid JSON.`);
          continue;
        }
      } else {
        parsed = String(raw).trim();
      }
      patch[field] = parsed;
    }

    // Normalise once, then compare — so "same content, different key order"
    // is not reported as a change on a clean round-trip.
    const normalized = normalizeContentPatch(patch);
    for (const [field, next] of Object.entries(normalized)) {
      const currentRaw = valueFor(product, field);
      const nextRaw = STRUCTURED.has(field) ? JSON.stringify(next ?? null) : String(next ?? '');
      const currentCmp = currentRaw === '' && STRUCTURED.has(field) ? 'null' : currentRaw;
      if (nextRaw === currentCmp) continue; // identical, nothing to do

      const alreadyHas = currentRaw !== '';
      if (alreadyHas && !overwrite) {
        diffs.push({
          field,
          skipped: true,
          reason: 'already has a value (fill-only)',
          before: currentRaw,
          after: nextRaw
        });
        continue;
      }
      diffs.push({
        field,
        before: currentRaw,
        after: nextRaw
      });
    }
    if (rowErrors.length) {
      skipped.push({
        line,
        slug: product.slug,
        reason: rowErrors.join(' ')
      });
      continue;
    }
    const applying = diffs.filter(d => !d.skipped);
    if (!applying.length) continue;
    changes.push({
      line,
      dbId: product.dbId ?? product.id,
      slug: product.slug,
      name: product.name,
      diffs,
      patch: Object.fromEntries(applying.map(d => [d.field, normalized[d.field]]))
    });
  }
  return {
    ok: true,
    columns: present,
    changes,
    skipped
  };
}

const dbKeyToForm = {
  brand: 'brand',
  net_content: 'netContent',
  key_claims: 'keyClaims',
  benefits: 'benefits',
  ingredients: 'ingredients',
  how_to_use: 'howToUse',
  specifications: 'specifications'
};
function ContentCoverage() {
  const [products, setProducts] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [onlyActive, setOnlyActive] = reactExports.useState(true);
  const [plan, setPlan] = reactExports.useState(null);
  const [overwrite, setOverwrite] = reactExports.useState(false);
  const [fileText, setFileText] = reactExports.useState('');
  const [fileName, setFileName] = reactExports.useState('');
  const [applying, setApplying] = reactExports.useState(false);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await adminListProducts());
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  const scored = reactExports.useMemo(() => products.filter(p => onlyActive ? p.isActive : true).map(p => ({
    p,
    s: contentScore(p)
  })).sort((a, b) => a.s.count - b.s.count || a.p.name.localeCompare(b.p.name)), [products, onlyActive]);
  const totals = reactExports.useMemo(() => {
    const t = {};
    for (const f of CONTENT_FIELDS) t[f] = scored.filter(({
      p
    }) => contentScore(p).populated.includes(f)).length;
    return t;
  }, [scored]);
  function exportCsv() {
    const rows = scored.map(({
      p
    }) => p);
    const blob = new Blob([productsToCsv(rows)], {
      type: 'text/csv;charset=utf-8'
    });
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
    setPlan(planImport(text, products, {
      overwrite
    }));
    setMsg('');
  }

  // Re-plan when the overwrite toggle changes, so the preview always matches
  // the switch the admin is looking at.
  reactExports.useEffect(() => {
    if (fileText) setPlan(planImport(fileText, products, {
      overwrite
    }));
  }, [overwrite, fileText, products]);
  async function applyPlan() {
    if (!plan?.changes?.length) return;
    if (!window.confirm(`Apply content changes to ${plan.changes.length} product(s)?\n\n` + `${overwrite ? 'EXISTING VALUES WILL BE OVERWRITTEN.' : 'Fill-only: existing values are kept.'}\n\n` + 'Prices, stock and active status are never touched.')) return;
    setApplying(true);
    let ok = 0;
    const failed = [];
    for (const c of plan.changes) {
      // Written through adminUpdateProduct so these rows go down exactly the
      // same path as the editor: same normalisation, same updated_at stamp,
      // same stale-write precondition. A second write path for bulk edits is
      // how the two drift apart.
      const current = products.find(p => String(p.dbId) === String(c.dbId));
      if (!current) {
        failed.push(`${c.slug}: no longer in the catalogue`);
        continue;
      }
      const payload = {
        ...current
      };
      for (const [dbKey, value] of Object.entries(c.patch)) payload[dbKeyToForm[dbKey]] = value;
      try {
        await adminUpdateProduct(c.dbId, payload, current.updatedAt);
        ok += 1;
      } catch (ex) {
        failed.push(`${c.slug}: ${ex.isStaleWrite ? 'changed since the file was planned — re-export and retry' : ex.message || String(ex)}`);
      }
    }
    setApplying(false);
    setPlan(null);
    setFileText('');
    setFileName('');
    setMsg(`Updated ${ok} product(s).${failed.length ? ` ${failed.length} failed.` : ''}`);
    if (failed.length) setErr(failed.join(' · '));
    await load();
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Product content"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: [scored.length, " products \xB7 what each one is missing, worst first. Empty fields hide their section on the product page."]
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Coverage"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-cov",
        children: CONTENT_FIELDS.map(f => /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "adm-cov__pill",
          children: [CONTENT_LABELS[f], ": ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: totals[f]
          }), " / ", scored.length]
        }, f))
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "adm-cov__meta",
        style: {
          display: 'inline-flex',
          gap: 6,
          alignItems: 'center',
          marginTop: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          checked: onlyActive,
          onChange: e => setOnlyActive(e.target.checked)
        }), "Active products only"]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Bulk edit"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "muted",
        style: {
          marginTop: 0
        },
        children: "Export, edit in a spreadsheet, import back. Structured fields are JSON in their cell \u2014 leave a cell blank to say \u201Cno opinion\u201D; blank never clears a field."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-actions",
        style: {
          marginBottom: 12
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
          type: "button",
          className: "btn btn-sm",
          onClick: exportCsv,
          children: ["Export CSV (", scored.length, ")"]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "btn btn-sm btn-light",
          style: {
            cursor: 'pointer'
          },
          children: ["Choose CSV to import", /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "file",
            accept: ".csv,text/csv",
            onChange: onFile,
            style: {
              display: 'none'
            }
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "muted",
        style: {
          fontSize: 11
        },
        children: ["Columns: ", CSV_COLUMNS.join(', ')]
      }), plan && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-import",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
          children: ["Dry run \u2014 ", fileName]
        }), !plan.ok && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-banner err",
          children: plan.reason
        }), plan.ok && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
            style: {
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              margin: '10px 0'
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              checked: overwrite,
              onChange: e => setOverwrite(e.target.checked),
              style: {
                marginTop: 3
              }
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: "Overwrite existing values."
              }), /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "muted",
                children: "Off by default. With this off, a product that already has a value keeps it and the incoming value is skipped."
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
              children: plan.changes.length
            }), " product(s) would change", plan.skipped.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [" \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: plan.skipped.length
              }), " row(s) skipped"]
            })]
          }), plan.skipped.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-banner err",
            children: [plan.skipped.slice(0, 12).map(sk => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: ["Line ", sk.line, " (", sk.slug || '—', "): ", sk.reason]
            }, sk.line)), plan.skipped.length > 12 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: ["\u2026 and ", plan.skipped.length - 12, " more"]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-import__list",
            children: [plan.changes.slice(0, 40).map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-import__item",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: c.name
              }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "muted",
                children: ["(", c.slug, ")"]
              }), c.diffs.map(d => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: `adm-import__diff ${d.skipped ? 'is-skip' : ''}`,
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "adm-import__field",
                  children: CONTENT_LABELS[d.field]
                }), d.skipped ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                  className: "muted",
                  children: [" \u2014 kept, ", d.reason]
                }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-import__before",
                    children: d.before || '(empty)'
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    "aria-hidden": "true",
                    children: " \u2192 "
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-import__after",
                    children: d.after
                  })]
                })]
              }, d.field))]
            }, c.dbId)), plan.changes.length > 40 && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
              className: "muted",
              children: ["\u2026 and ", plan.changes.length - 40, " more products"]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-actions",
            style: {
              marginTop: 12
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-sm",
              onClick: applyPlan,
              disabled: applying || !plan.changes.length,
              children: applying ? 'Applying…' : `Apply to ${plan.changes.length} product(s)`
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-sm btn-light",
              onClick: () => {
                setPlan(null);
                setFileText('');
                setFileName('');
              },
              children: "Cancel"
            })]
          })]
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Work queue"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Product"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Fields"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Missing"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Source"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: scored.map(({
            p,
            s
          }) => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [p.name, !s.hasDescription && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge badge-out",
                style: {
                  marginLeft: 6
                },
                children: "no description"
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: s.count
              }), " / ", s.total]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              className: "muted",
              children: s.missing.map(f => CONTENT_LABELS[f]).join(', ') || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              className: "muted",
              children: p.contentSource || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                className: "btn btn-xs btn-light",
                to: `/admin/products/${p.dbId}/edit`,
                children: "Edit"
              })
            })]
          }, p.dbId))
        })]
      })]
    })]
  });
}

export { ContentCoverage as default };
//# sourceMappingURL=ContentCoverage.js.map
