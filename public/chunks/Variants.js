import { r as reactExports, i as adminListProducts, j as jsxRuntimeExports, s as money, a1 as adminListVariants, a2 as adminCreateVariant, a3 as adminUpdateVariant, a4 as adminSetVariantActive, a5 as adminDeleteVariant } from '../bundle.js';

const UNITS = ['ml', 'g', 'kg', 'l', 'capsules', 'tablets', 'sachets', 'pcs'];
const blank = {
  label: '',
  size: '',
  unit: 'ml',
  sku: '',
  mrp: '',
  sale_price: '',
  gst_rate: '',
  stock: '',
  is_active: true,
  sort_order: ''
};

// A variant row from the database, shaped for the form's text inputs.
function toForm(v) {
  return {
    label: v.label ?? '',
    size: v.size ?? '',
    unit: v.unit ?? 'ml',
    sku: v.sku ?? '',
    mrp: v.mrp ?? '',
    sale_price: v.sale_price ?? '',
    gst_rate: v.gst_rate ?? '',
    stock: v.stock ?? '',
    is_active: v.is_active !== false,
    sort_order: v.sort_order ?? ''
  };
}
function Variants() {
  const [products, setProducts] = reactExports.useState([]);
  const [productId, setProductId] = reactExports.useState('');
  const [variants, setVariants] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [editingId, setEditingId] = reactExports.useState(null); // null = none, 'new' = add form
  const [form, setForm] = reactExports.useState(blank);
  reactExports.useEffect(() => {
    adminListProducts().then(list => {
      const withDbId = list.filter(p => p.dbId != null);
      setProducts(withDbId);
      if (withDbId.length) setProductId(String(withDbId[0].dbId));
    }).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  const product = reactExports.useMemo(() => products.find(p => String(p.dbId) === String(productId)) || null, [products, productId]);
  async function reload(pid = productId) {
    if (!pid) {
      setVariants([]);
      return;
    }
    try {
      setVariants(await adminListVariants(pid));
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
      setVariants([]);
    }
  }
  reactExports.useEffect(() => {
    setEditingId(null);
    reload(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);
  const set = (k, v) => setForm(s => ({
    ...s,
    [k]: v
  }));
  function startAdd() {
    // Pre-fill the sort order after the current last variant so a new size
    // lands at the end of the selector rather than jumping to the front.
    const nextSort = variants.reduce((m, v) => Math.max(m, Number(v.sort_order) || 0), 0) + 1;
    setForm({
      ...blank,
      sort_order: nextSort,
      mrp: product?.originalPrice ?? ''
    });
    setEditingId('new');
  }
  function startEdit(v) {
    setForm(toForm(v));
    setEditingId(v.id);
  }
  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(m => m === text ? '' : m), 2500);
  }
  async function save(e) {
    e.preventDefault();
    if (!productId) return;
    setBusy(true);
    setErr('');
    try {
      if (editingId === 'new') await adminCreateVariant(productId, form);else await adminUpdateVariant(editingId, productId, form);
      setEditingId(null);
      await reload();
      flash('Saved.');
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  }
  async function toggleActive(v) {
    setBusy(true);
    try {
      await adminSetVariantActive(v.id, v.is_active === false);
      await reload();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(v) {
    const label = v.label || v.sku || `variant ${v.id}`;
    if (!window.confirm(`Delete ${label}? Past orders keep their stored price — only the selector changes.`)) return;
    setBusy(true);
    try {
      await adminDeleteVariant(v.id);
      await reload();
      flash('Variant deleted.');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // Live preview of the discount this variant's own numbers imply. Derived for
  // display only — the server recomputes the charge from mrp / sale_price.
  const fMrp = Number(form.mrp) || 0;
  const fPrice = Number(form.sale_price) || 0;
  const fOff = fMrp > 0 && fPrice > 0 && fPrice < fMrp ? Math.round((1 - fPrice / fMrp) * 100) : 0;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Variants"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Optional pack sizes with their own MRP and selling price."
        })]
      }), productId && !editingId && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        onClick: startAdd,
        disabled: busy,
        children: "Add variant"
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading products\u2026"
    }) : products.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No products yet."
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "v-product",
            children: "Product"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
            id: "v-product",
            className: "select",
            value: productId,
            onChange: e => setProductId(e.target.value),
            children: products.map(p => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: p.dbId,
              children: p.name
            }, p.dbId))
          })]
        }), product && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          style: {
            marginTop: 10
          },
          children: ["Base pricing (unchanged by this screen):", ' ', /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-price",
            children: money(product.salePrice ?? product.originalPrice)
          }), product.originalPrice > (product.salePrice ?? 0) && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [" \xB7 MRP ", /*#__PURE__*/jsxRuntimeExports.jsx("s", {
              children: money(product.originalPrice)
            })]
          }), ' ', "\xB7 ", product.discountPercent, "% off. A product with no active variants sells at this price."]
        })]
      }), editingId && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
        className: "surface",
        onSubmit: save,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: editingId === 'new' ? 'New variant' : 'Edit variant'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Label (shown to customers)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              required: true,
              placeholder: "750 ml",
              value: form.label,
              onChange: e => set('label', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "SKU"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              placeholder: "SL-B119-750ML",
              value: form.sku,
              onChange: e => set('sku', e.target.value)
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Size"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              min: "0",
              step: "any",
              placeholder: "750",
              value: form.size,
              onChange: e => set('size', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Unit"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
              className: "select",
              value: form.unit,
              onChange: e => set('unit', e.target.value),
              children: UNITS.map(u => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                value: u,
                children: u
              }, u))
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "MRP (\u20B9)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              min: "0",
              step: "1",
              required: true,
              value: form.mrp,
              onChange: e => set('mrp', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Selling price (\u20B9)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              min: "0",
              step: "1",
              required: true,
              value: form.sale_price,
              onChange: e => set('sale_price', e.target.value)
            })]
          })]
        }), fMrp > 0 && fPrice > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-preview-price",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "now",
            children: money(fPrice)
          }), fOff > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "was",
            children: money(fMrp)
          }), fOff > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "off",
            children: [fOff, "% OFF"]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "hint",
            children: "\u2014 what this variant will show on the product page"
          })]
        }), fPrice > fMrp && fMrp > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          style: {
            color: 'var(--price-mrp)'
          },
          children: "Selling price is above MRP \u2014 customers will see no discount."
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Stock"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              min: "0",
              step: "1",
              value: form.stock,
              onChange: e => set('stock', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Sort order"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              step: "1",
              value: form.sort_order,
              onChange: e => set('sort_order', e.target.value)
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "GST rate (%)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "0",
            max: "28",
            step: "0.01",
            placeholder: "Leave blank to use the store default",
            value: form.gst_rate,
            onChange: e => set('gst_rate', e.target.value)
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Blank means this variant follows the configured store GST rate. No rate is assumed."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-checkrow",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "checkbox",
            id: "v-active",
            checked: form.is_active,
            onChange: e => set('is_active', e.target.checked)
          }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
            htmlFor: "v-active",
            children: "Active (offered on the product page)"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 10,
            marginTop: 14
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn",
            type: "submit",
            disabled: busy,
            children: busy ? 'Saving…' : editingId === 'new' ? 'Create variant' : 'Save changes'
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline",
            type: "button",
            onClick: () => setEditingId(null),
            children: "Cancel"
          })]
        })]
      }), variants.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No variants for this product. It sells at its base price. Add a variant to offer pack sizes."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Label"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "SKU"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__amt",
                children: "MRP"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__amt",
                children: "Price"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__amt",
                children: "Off"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__qty",
                children: "Stock"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: variants.map(v => {
              const mrp = Number(v.mrp) || 0;
              const price = Number(v.sale_price) || 0;
              const off = mrp > 0 && price > 0 && price < mrp ? Math.round((1 - price / mrp) * 100) : 0;
              return /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                className: v.is_active === false ? 'is-muted' : '',
                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: v.label
                  }), v.size != null && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                    className: "hint",
                    style: {
                      display: 'block'
                    },
                    children: [v.size, " ", v.unit]
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  className: "adm-mono",
                  children: v.sku || '—'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  className: "adm-items__amt",
                  children: mrp ? /*#__PURE__*/jsxRuntimeExports.jsx("s", {
                    children: money(mrp)
                  }) : '—'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  className: "adm-items__amt adm-price",
                  children: price ? money(price) : '—'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  className: "adm-items__amt",
                  children: off ? `${off}%` : '—'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  className: "adm-items__qty",
                  children: v.stock ?? '—'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: `badge ${v.is_active === false ? 'badge-out' : 'badge-best'}`,
                    children: v.is_active === false ? 'Inactive' : 'Active'
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-rowacts",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                      className: "btn btn-sm btn-light",
                      onClick: () => startEdit(v),
                      disabled: busy,
                      children: "Edit"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                      className: "btn btn-sm btn-light",
                      onClick: () => toggleActive(v),
                      disabled: busy,
                      children: v.is_active === false ? 'Activate' : 'Deactivate'
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                      className: "btn btn-sm btn-light",
                      onClick: () => remove(v),
                      disabled: busy,
                      children: "Delete"
                    })]
                  })
                })]
              }, v.id);
            })
          })]
        })
      })]
    })]
  });
}

export { Variants as default };
//# sourceMappingURL=Variants.js.map
