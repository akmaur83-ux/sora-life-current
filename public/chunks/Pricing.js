import { r as reactExports, i as adminListProducts, j as jsxRuntimeExports, s as money, $ as adminUpdateProduct } from '../bundle.js';

const TIERS = [10, 15, 18, 20];
function Pricing() {
  const [products, setProducts] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [edits, setEdits] = reactExports.useState({});
  const [savingId, setSavingId] = reactExports.useState(null);
  const [err, setErr] = reactExports.useState('');
  reactExports.useEffect(() => {
    adminListProducts().then(setProducts).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  const editFor = p => edits[p.dbId] || {
    originalPrice: p.originalPrice,
    discountPercent: p.discountPercent
  };
  const setEdit = (p, patch) => setEdits(e => ({
    ...e,
    [p.dbId]: {
      ...editFor(p),
      ...patch
    }
  }));
  async function save(p) {
    const v = editFor(p);
    setSavingId(p.dbId);
    try {
      await adminUpdateProduct(p.dbId, {
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        image: p.image,
        gallery: p.gallery,
        originalPrice: Number(v.originalPrice) || 0,
        discountPercent: Number(v.discountPercent) || 0,
        form: p.form,
        stock: p.stock,
        permalink: p.permalink,
        isNew: p.isNew,
        isBestseller: p.isBestseller,
        isFeatured: p.isFeatured,
        rating: p.rating,
        reviewCount: p.reviewCount,
        isActive: p.isActive
      });
      setProducts(list => list.map(x => x.dbId === p.dbId ? {
        ...x,
        originalPrice: Number(v.originalPrice) || 0,
        discountPercent: Number(v.discountPercent) || 0
      } : x));
      setEdits(e => {
        const n = {
          ...e
        };
        delete n[p.dbId];
        return n;
      });
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSavingId(null);
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Pricing"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Bulk-edit MRP and promotional discounts. Sale price is calculated automatically."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading\u2026"
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Product"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "MRP (\u20B9)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Discount"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Sale price"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: products.map(p => {
            const v = editFor(p);
            const dirty = !!edits[p.dbId];
            const sale = Math.round((Number(v.originalPrice) || 0) * (1 - (Number(v.discountPercent) || 0) / 100));
            return /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  className: "adm-row-name",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-thumb",
                    children: p.image && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
                      src: p.image,
                      alt: ""
                    })
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: p.name
                  })]
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  className: "input",
                  style: {
                    width: 110
                  },
                  type: "number",
                  min: "0",
                  value: v.originalPrice,
                  onChange: e => setEdit(p, {
                    originalPrice: e.target.value
                  })
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
                  className: "select",
                  style: {
                    width: 130
                  },
                  value: v.discountPercent,
                  onChange: e => setEdit(p, {
                    discountPercent: Number(e.target.value)
                  }),
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
                    value: 0,
                    children: "No discount"
                  }), TIERS.map(t => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
                    value: t,
                    children: [t, "%"]
                  }, t)), !TIERS.includes(Number(v.discountPercent)) && Number(v.discountPercent) !== 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
                    value: v.discountPercent,
                    children: [v.discountPercent, "% (custom)"]
                  })]
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: money(sale)
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm",
                  disabled: !dirty || savingId === p.dbId,
                  onClick: () => save(p),
                  children: savingId === p.dbId ? 'Saving…' : 'Save'
                })
              })]
            }, p.dbId);
          })
        })]
      })
    })]
  });
}

export { Pricing as default };
//# sourceMappingURL=Pricing.js.map
