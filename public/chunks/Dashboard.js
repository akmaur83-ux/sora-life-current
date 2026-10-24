import { r as reactExports, j as jsxRuntimeExports, c as Link, k as adminListProducts, m as adminListCategories, o as adminSeedDefaultCategories, p as adminImportBiosashCatalog } from '../bundle.js';

function Dashboard() {
  const [loading, setLoading] = reactExports.useState(true);
  // null = not known. A failed read is not an empty catalogue, so it must
  // never look like one: the import offer below needs a list that loaded.
  const [products, setProducts] = reactExports.useState(null);
  const [categories, setCategories] = reactExports.useState(null);
  const [loadErr, setLoadErr] = reactExports.useState('');
  const [importing, setImporting] = reactExports.useState(false);
  const [importMsg, setImportMsg] = reactExports.useState(null); // { ok, text }
  const [progress, setProgress] = reactExports.useState(null);
  async function load() {
    setLoading(true);
    const [p, c] = await Promise.allSettled([adminListProducts(), adminListCategories()]);
    setProducts(p.status === 'fulfilled' ? p.value : null);
    setCategories(c.status === 'fulfilled' ? c.value : null);
    setLoadErr([p, c].filter(r => r.status === 'rejected').map(r => r.reason?.message || String(r.reason)).join(' · '));
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  async function runImport() {
    if (!window.confirm('Import the 149 bundled Biosash products into the live catalogue?\n\n' + 'They are added as active products with no prices set; price them on the Pricing page. ' + 'Default categories are added where missing. Nothing already in the catalogue is changed.')) return;
    setImporting(true);
    setImportMsg(null);
    try {
      await adminSeedDefaultCategories();
      const {
        added,
        total
      } = await adminImportBiosashCatalog((done, total) => setProgress({
        done,
        total
      }));
      setImportMsg({
        ok: true,
        text: `Added ${added} of the ${total} bundled Biosash products` + (added < total ? `; the other ${total - added} were already in the catalogue and were left as they are` : '') + '. Default categories seeded where missing.'
      });
      await load();
    } catch (e) {
      setImportMsg({
        ok: false,
        text: 'Import failed: ' + (e.message || String(e))
      });
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }
  const active = products ? products.filter(p => p.isActive).length : 0;
  const count = (list, n) => loading || !list ? '—' : n;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Dashboard"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Overview of your Sora Lifestyle storefront data."
        })]
      })
    }), loadErr && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: ["The catalogue could not be loaded (", loadErr, "). Figures shown as \u2014 are unknown until it loads. Reload the page to try again."]
    }), importMsg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: `adm-banner ${importMsg.ok ? 'ok' : 'err'}`,
      children: importMsg.text
    }), !loading && products && products.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner info",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "The live product catalog is empty."
      }), " The storefront is currently showing the built-in 149-product Biosash catalog as a fallback. Click below to import it into Supabase \u2014 after that, this dashboard (and the public site) will manage products from here.", /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        style: {
          marginTop: 12
        },
        children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: runImport,
          disabled: importing,
          children: importing ? progress ? `Importing… ${progress.done}/${progress.total}` : 'Importing…' : 'Import 149 Biosash products'
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__stats",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: count(products, products?.length)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Products"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: count(products, active)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Active products"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: count(categories, categories?.length)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Categories"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface pad-lg",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          marginBottom: 14
        },
        children: "Quick links"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap'
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/products/new",
          children: "+ Add product"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/products",
          children: "Manage products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/categories",
          children: "Manage categories"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/branding",
          children: "Branding"
        })]
      })]
    })]
  });
}

export { Dashboard as default };
//# sourceMappingURL=Dashboard.js.map
