import { r as reactExports, j as jsxRuntimeExports, b as Link, i as adminListProducts, k as adminListCategories, m as adminListHeroSlides, o as adminSeedDefaultCategories, p as adminSeedDefaultHeroSlides, q as adminImportBiosashCatalog } from '../bundle.js';

function Dashboard() {
  const [loading, setLoading] = reactExports.useState(true);
  const [products, setProducts] = reactExports.useState([]);
  const [categories, setCategories] = reactExports.useState([]);
  const [slides, setSlides] = reactExports.useState([]);
  const [importing, setImporting] = reactExports.useState(false);
  const [importMsg, setImportMsg] = reactExports.useState('');
  const [progress, setProgress] = reactExports.useState(null);
  async function load() {
    setLoading(true);
    const [p, c, h] = await Promise.all([adminListProducts().catch(() => []), adminListCategories().catch(() => []), adminListHeroSlides().catch(() => [])]);
    setProducts(p);
    setCategories(c);
    setSlides(h);
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  async function runImport() {
    setImporting(true);
    setImportMsg('');
    try {
      await adminSeedDefaultCategories();
      await adminSeedDefaultHeroSlides();
      const n = await adminImportBiosashCatalog((done, total) => setProgress({
        done,
        total
      }));
      setImportMsg(`Imported/updated ${n} real Biosash products, seeded default categories and hero slides.`);
      await load();
    } catch (e) {
      setImportMsg('Import failed: ' + (e.message || String(e)));
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }
  const active = products.filter(p => p.isActive).length;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Dashboard"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Overview of your Sora Life storefront data."
        })]
      })
    }), !loading && products.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
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
      }), importMsg && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        style: {
          marginTop: 10
        },
        children: importMsg
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__stats",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: loading ? '—' : products.length
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Products"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: loading ? '—' : active
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Active products"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: loading ? '—' : categories.length
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Categories"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__stat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: loading ? '—' : slides.length
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          children: "Hero slides"
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
          to: "/admin/hero-slides",
          children: "Manage hero slides"
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
