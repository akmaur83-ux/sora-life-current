import { r as reactExports, j as jsxRuntimeExports, b as Link, s as money, i as adminListProducts, t as adminSetProductActive, w as adminDeleteProduct, x as adminReorderProducts, y as categories } from '../bundle.js';

function Products() {
  const [products, setProducts] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [q, setQ] = reactExports.useState('');
  const [busyId, setBusyId] = reactExports.useState(null);
  const [err, setErr] = reactExports.useState('');
  async function load() {
    setLoading(true);
    try {
      setProducts(await adminListProducts());
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  const filtered = reactExports.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter(p => p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t) || p.slug.toLowerCase().includes(t));
  }, [products, q]);
  async function toggleActive(p) {
    setBusyId(p.dbId);
    try {
      await adminSetProductActive(p.dbId, !p.isActive);
      setProducts(list => list.map(x => x.dbId === p.dbId ? {
        ...x,
        isActive: !x.isActive
      } : x));
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusyId(null);
  }
  async function remove(p) {
    if (!window.confirm(`Permanently delete "${p.name}"? This cannot be undone. Use Disable instead if you just want to hide it.`)) return;
    setBusyId(p.dbId);
    try {
      await adminDeleteProduct(p.dbId);
      setProducts(list => list.filter(x => x.dbId !== p.dbId));
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusyId(null);
  }
  async function move(p, dir) {
    const idx = products.findIndex(x => x.dbId === p.dbId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= products.length) return;
    const next = [...products];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setProducts(next);
    try {
      await adminReorderProducts(next.map(x => x.dbId));
    } catch (e) {
      setErr(e.message || String(e));
    }
  }
  const catName = slug => categories.find(c => c.slug === slug)?.name || slug;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${products.length} products in the live catalog`
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        to: "/admin/products/new",
        className: "btn",
        children: "+ Add product"
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-toolbar",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "searchbox",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          placeholder: "Search products\u2026",
          value: q,
          onChange: e => setQ(e.target.value)
        })
      })
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading products\u2026"
    }) : filtered.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: products.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: ["No products yet. ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          to: "/admin",
          className: "inline-link",
          children: "Import the Biosash catalog"
        }), " or ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          to: "/admin/products/new",
          className: "inline-link",
          children: "add one manually"
        }), "."]
      }) : 'No products match your search.'
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Product"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Category"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Price"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Stock"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Flags"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Active"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: filtered.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            className: !p.isActive ? 'adm-disabled' : '',
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-row-name",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "adm-thumb",
                  children: p.image && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
                    src: p.image,
                    alt: ""
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: p.name
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    children: p.slug
                  })]
                })]
              })
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: catName(p.category)
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [money(p.discountPercent > 0 ? Math.round(p.originalPrice * (1 - p.discountPercent / 100)) : p.originalPrice), p.discountPercent > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "hint",
                style: {
                  display: 'block'
                },
                children: ["MRP ", money(p.originalPrice), " \xB7 ", p.discountPercent, "%"]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: p.stock > 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge",
                children: "In stock"
              }) : /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge badge-out",
                children: "Out of stock"
              })
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [p.isBestseller && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge badge-best",
                style: {
                  marginRight: 4
                },
                children: "Best"
              }), p.isNew && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge badge-new",
                style: {
                  marginRight: 4
                },
                children: "New"
              }), p.isFeatured && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "badge badge-soft",
                children: "Featured"
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: `switch ${p.isActive ? 'on' : ''}`,
                onClick: () => toggleActive(p),
                disabled: busyId === p.dbId,
                "aria-label": "Toggle active",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("i", {})
              })
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-actions",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-light",
                  onClick: () => move(p, -1),
                  title: "Move up",
                  children: "\u2191"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-light",
                  onClick: () => move(p, 1),
                  title: "Move down",
                  children: "\u2193"
                }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                  className: "btn btn-sm btn-light",
                  to: `/admin/products/${p.dbId}/edit`,
                  children: "Edit"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-ghost",
                  style: {
                    color: 'var(--color-sale)'
                  },
                  onClick: () => remove(p),
                  disabled: busyId === p.dbId,
                  children: "Delete"
                })]
              })
            })]
          }, p.dbId))
        })]
      })
    })]
  });
}

export { Products as default };
//# sourceMappingURL=Products.js.map
