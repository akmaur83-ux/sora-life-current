import { r as reactExports, s as supabase, j as jsxRuntimeExports, t as money } from '../bundle.js';
import { d as downloadCsv, t as toCsv } from './csv.js';

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];

/** search_log rows → { top, zero }: each { q, store, n }, most searched first. Pure. */
function summariseSearches(rows) {
  const top = new Map();
  const zero = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = `${r.store}|${r.q}`;
    const into = Number(r.results) > 0 ? top : zero;
    into.set(k, {
      q: r.q,
      store: r.store,
      n: (into.get(k)?.n || 0) + 1
    });
  }
  const sort = m => [...m.values()].sort((a, b) => b.n - a.n || a.q.localeCompare(b.q));
  // A query that found results at least once is not "nothing found".
  const found = new Set([...top.keys()]);
  return {
    top: sort(top),
    zero: sort(zero).filter(z => !found.has(`${z.store}|${z.q}`))
  };
}

/** Paid orders → best sellers by units: { name, units, revenue }. Pure. */
function bestSellers(orders) {
  const m = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o.payment_status !== 'paid') continue;
    for (const l of Array.isArray(o.items) ? o.items : []) {
      const name = String(l?.name || '').trim();
      if (!name) continue;
      const cur = m.get(name) || {
        name,
        units: 0,
        revenue: 0
      };
      cur.units += Number(l.qty) || 0;
      cur.revenue += Number(l.line_total) || (Number(l.unit_price) || 0) * (Number(l.qty) || 0);
      m.set(name, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

/**
 * Paid orders → sales by brand: { brand, units, revenue, orders }, biggest takings first.
 * `brandOf(line)` names a line's brand ('' when unknown → "Other"). Pure.
 */
function salesByBrand(orders, brandOf) {
  const m = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o.payment_status !== 'paid') continue;
    const seen = new Set();
    for (const l of Array.isArray(o.items) ? o.items : []) {
      const brand = String(brandOf(l) || '').trim() || 'Other';
      const cur = m.get(brand) || {
        brand,
        units: 0,
        revenue: 0,
        orders: 0
      };
      cur.units += Number(l.qty) || 0;
      cur.revenue += Number(l.line_total) || (Number(l.unit_price) || 0) * (Number(l.qty) || 0);
      if (!seen.has(brand)) {
        cur.orders += 1;
        seen.add(brand);
      }
      m.set(brand, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue || a.brand.localeCompare(b.brand));
}

/** The brand lookup for order lines: catalogue lines by their product, wellness lines by theirs, Biosash lines by their id. Pure. */
function lineBrand(catalogueBrands, wellnessBrands) {
  return l => {
    const id = String(l?.product_id ?? '');
    if (l?.catalogue) return catalogueBrands[id] || '';
    return wellnessBrands[id] || (l?.biosash_id ? 'Biosash' : '');
  };
}

/** Live products out of stock or at 1–`low` left → { out, low }, each { name, store, brand, stock }. Pure. */
function stockWatch(rows, low = 3) {
  const live = (Array.isArray(rows) ? rows : []).filter(r => r && r.is_active !== false);
  const pick = r => ({
    name: r.name,
    store: r.store || 'wellness',
    brand: r.brand || '',
    stock: Number(r.stock) || 0
  });
  return {
    out: live.filter(r => (Number(r.stock) || 0) <= 0).map(pick).sort((a, b) => a.name.localeCompare(b.name)),
    low: live.filter(r => Number(r.stock) >= 1 && Number(r.stock) <= low).map(pick).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
  };
}

/** product_views rows → { store, slug, n }, most viewed first. Pure. */
function topViewed(rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.slug || !r?.store) continue;
    const k = `${r.store}/${r.slug}`;
    m.set(k, {
      store: r.store,
      slug: r.slug,
      n: (m.get(k)?.n || 0) + 1
    });
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug));
}
const productHref = (store, slug) => store === 'fashion' ? `/fashion/p/${slug}` : store === 'homeliving' ? `/homeliving/p/${slug}` : `/product/${slug}`;

/** Stock watch → CSV: out of stock first, then 1–3 left (round 17, 2026-11-20). Pure. */
const stockCsv = w => toCsv([...(w?.out || []).map(r => ({
  ...r,
  state: 'Out of stock'
})), ...(w?.low || []).map(r => ({
  ...r,
  state: 'Running low'
}))], [['State', r => r.state], ['Product', r => r.name], ['Store', r => r.store], ['Brand', r => r.brand], ['Left', r => r.stock]]);

/**
 * Photo check (round 18, 2026-11-20): partners' pictures live on their own servers and
 * can disappear. Loads each live product's main picture the way a shopper's browser
 * would (an <img>, so any site's pictures can be checked) and lists the ones that do
 * not load. `load(url)` resolves true/false; at most `parallel` at a time.
 */
async function checkPhotos(rows, load, parallel = 12, onProgress = () => {}) {
  const list = (Array.isArray(rows) ? rows : []).filter(r => Array.isArray(r.images) && r.images[0]);
  const bad = [];
  let done = 0;
  const q = [...list];
  await Promise.all(Array.from({
    length: parallel
  }, async () => {
    while (q.length) {
      const r = q.shift();
      if (!(await load(r.images[0]))) bad.push({
        name: r.name,
        store: r.store,
        brand: r.brand || '',
        slug: r.slug,
        url: r.images[0]
      });
      done += 1;
      onProgress(done, list.length);
    }
  }));
  return bad.sort((a, b) => a.name.localeCompare(b.name));
}
const loadImage = url => new Promise(res => {
  const i = new Image();
  const t = setTimeout(() => res(false), 15000);
  i.onload = () => {
    clearTimeout(t);
    res(i.naturalWidth > 0);
  };
  i.onerror = () => {
    clearTimeout(t);
    res(false);
  };
  i.src = url;
});
const STORE = {
  wellness: 'Wellness',
  fashion: 'Fashion',
  homeliving: 'Home & Living',
  grocery: 'Grocery'
};
const box = {
  border: '1px solid #E4E8E1',
  background: '#fff',
  padding: 14
};
function List({
  title,
  hint,
  rows,
  render,
  empty
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    style: box,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      style: {
        margin: '0 0 4px',
        fontSize: 16
      },
      children: title
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      style: {
        margin: '0 0 10px'
      },
      children: hint
    }), rows === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      children: empty
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
      style: {
        margin: 0,
        paddingLeft: 20,
        display: 'grid',
        gap: 6
      },
      children: rows.slice(0, 25).map(render)
    })]
  });
}
function Insights() {
  const [days, setDays] = reactExports.useState(7);
  const [searches, setSearches] = reactExports.useState(null);
  const [sellers, setSellers] = reactExports.useState(null);
  const [brands, setBrands] = reactExports.useState(null);
  const [stock, setStock] = reactExports.useState(null);
  const [viewed, setViewed] = reactExports.useState(null);
  const [photos, setPhotos] = reactExports.useState({
    state: 'idle',
    done: 0,
    total: 0,
    bad: []
  });
  const runPhotoCheck = async () => {
    setPhotos({
      state: 'running',
      done: 0,
      total: 0,
      bad: []
    });
    const {
      data
    } = await supabase.from('catalogue_products').select('name, store, brand, slug, images').eq('is_active', true).limit(5000);
    const bad = await checkPhotos(data || [], loadImage, 12, (done, total) => setPhotos(p => ({
      ...p,
      done,
      total
    })));
    setPhotos({
      state: 'done',
      done: (data || []).length,
      total: (data || []).length,
      bad
    });
  };
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    let live = true;
    setSearches(null);
    setSellers(null);
    setBrands(null);
    setViewed(null);
    setError('');
    supabase.from('product_views').select('store, slug').gte('created_at', since).limit(20000).then(async ({
      data,
      error: e
    }) => {
      if (!live) return;
      if (e) {
        setViewed([]);
        return;
      }
      const top = topViewed(data).slice(0, 25);
      const cat = top.filter(t => t.store !== 'wellness').map(t => t.slug);
      const well = top.filter(t => t.store === 'wellness').map(t => t.slug);
      const [c, w] = await Promise.all([cat.length ? supabase.from('catalogue_products').select('slug, store, name').in('slug', cat) : {
        data: []
      }, well.length ? supabase.from('products').select('slug, name').in('slug', well) : {
        data: []
      }]);
      if (!live) return;
      const names = new Map([...(c.data || []).map(r => [`${r.store}/${r.slug}`, r.name]), ...(w.data || []).map(r => [`wellness/${r.slug}`, r.name])]);
      setViewed(top.map(t => ({
        ...t,
        name: names.get(`${t.store}/${t.slug}`) || t.slug
      })));
    }, () => {
      if (live) setViewed([]);
    });
    const since = new Date(Date.now() - days * 86400e3).toISOString();
    supabase.from('search_log').select('q, store, results').gte('created_at', since).order('created_at', {
      ascending: false
    }).limit(5000).then(({
      data,
      error: e
    }) => {
      if (!live) return;
      if (e) {
        setError(e.message);
        setSearches({
          top: [],
          zero: []
        });
      } else setSearches(summariseSearches(data));
    });
    supabase.from('orders').select('items, payment_status, created_at').eq('payment_status', 'paid').gte('created_at', since).limit(2000).then(async ({
      data,
      error: e
    }) => {
      if (!live) return;
      if (e) {
        setError(e.message);
        setSellers([]);
        setBrands([]);
        return;
      }
      setSellers(bestSellers(data));
      // Each line's brand, from the product it was (catalogue or wellness).
      const lines = (data || []).flatMap(o => Array.isArray(o.items) ? o.items : []);
      const cat = [...new Set(lines.filter(l => l.catalogue && l.product_id).map(l => String(l.product_id)))];
      const well = [...new Set(lines.filter(l => !l.catalogue && l.product_id).map(l => String(l.product_id)))];
      const [c, w] = await Promise.all([cat.length ? supabase.from('catalogue_products').select('id, brand').in('id', cat) : {
        data: []
      }, well.length ? supabase.from('products').select('id, brand').in('id', well) : {
        data: []
      }]);
      if (!live) return;
      const map = r => Object.fromEntries((r?.data || []).map(x => [String(x.id), x.brand || '']));
      setBrands(salesByBrand(data, lineBrand(map(c), map(w))));
    });
    return () => {
      live = false;
    };
  }, [days]);

  // Stock watch: every store, live products only; the same whatever the period.
  reactExports.useEffect(() => {
    let live = true;
    Promise.all([supabase.from('catalogue_products').select('name, store, brand, stock, is_active').eq('is_active', true).lte('stock', 3).limit(1000), supabase.from('products').select('name, brand, stock, is_active').lte('stock', 3).limit(1000)]).then(([c, w]) => {
      if (!live) return;
      const rows = [...(c.data || []), ...(w.data || []).map(r => ({
        ...r,
        store: 'wellness'
      }))];
      setStock(stockWatch(rows));
    }, () => {
      if (live) setStock({
        out: [],
        low: []
      });
    });
    return () => {
      live = false;
    };
  }, []);
  const saveBrands = () => downloadCsv(`sora-sales-by-brand-${days}-days.csv`, toCsv(brands || [], [['Brand', r => r.brand], ['Orders', r => r.orders], ['Units', r => r.units], ['Takings (INR)', r => Math.round(r.revenue * 100) / 100]]));
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
        children: "Insights"
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-checkrow",
      role: "tablist",
      style: {
        gap: 8,
        margin: '12px 0'
      },
      children: RANGES.map(([d, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        role: "tab",
        "aria-selected": days === d,
        className: `btn btn-sm${days === d ? '' : ' btn-ghost'}`,
        onClick: () => setDays(d),
        children: label
      }, d))
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner error",
      children: error
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      style: {
        display: 'grid',
        gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: "Top searches",
        hint: "What shoppers typed, and found something.",
        rows: searches?.top ?? null,
        empty: "No searches yet in this period.",
        render: r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.q
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", STORE[r.store], " \xB7 ", r.n, "\xD7"]
          })]
        }, `${r.store}|${r.q}`)
      }), /*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: "Searched, nothing found",
        hint: "Demand you are not meeting yet: stock it, or add these words to the right products.",
        rows: searches?.zero ?? null,
        empty: "Nothing went unfound in this period.",
        render: r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.q
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", STORE[r.store], " \xB7 ", r.n, "\xD7"]
          })]
        }, `${r.store}|${r.q}`)
      }), /*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: "Best sellers",
        hint: "Units sold in paid orders.",
        rows: sellers,
        empty: "No paid orders in this period.",
        render: r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.name
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", r.units, " sold \xB7 ", money(r.revenue)]
          })]
        }, r.name)
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
        style: box,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            style: {
              margin: '0 0 4px',
              fontSize: 16
            },
            children: "Sales by brand"
          }), brands?.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm btn-ghost",
            onClick: saveBrands,
            children: "Download CSV"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "adm-hint",
          style: {
            margin: '0 0 10px'
          },
          children: "Paid orders in the period, by the brand of each item: for settling with partners. Takings at the price charged, after discounts."
        }), brands === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Loading\u2026"
        }) : brands.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "adm-hint",
          children: "No paid orders in this period."
        }) : /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          style: {
            fontSize: 14
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Brand"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Orders"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Units"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Takings"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: brands.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("b", {
                  children: r.brand
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: r.orders
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: r.units
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: money(r.revenue)
              })]
            }, r.brand))
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: "Most viewed",
        hint: "Product pages opened most in the period: once per product, per browser, per day.",
        rows: viewed,
        empty: "No product views recorded in this period yet.",
        render: r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
            href: productHref(r.store, r.slug),
            target: "_blank",
            rel: "noopener noreferrer",
            children: /*#__PURE__*/jsxRuntimeExports.jsx("b", {
              children: r.name
            })
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", STORE[r.store] || r.store, " \xB7 ", r.n, " views"]
          })]
        }, `${r.store}/${r.slug}`)
      }), stock && stock.out.length + stock.low.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
        style: {
          ...box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm-hint",
          children: "Out of stock and running low, every store, as a spreadsheet (round 17)."
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-ghost",
          onClick: () => downloadCsv('sora-stock-watch.csv', stockCsv(stock)),
          children: "Download stock CSV"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
        style: box,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          style: {
            margin: '0 0 4px',
            fontSize: 16
          },
          children: "Photo check"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "adm-hint",
          style: {
            margin: '0 0 10px'
          },
          children: "Partners\u2019 pictures live on their own servers and can disappear. This loads every live product\u2019s main picture and lists any that do not open."
        }), photos.state === 'idle' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm",
          onClick: runPhotoCheck,
          children: "Check product photos"
        }), photos.state === 'running' && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: ["Checking\u2026 ", photos.done, " of ", photos.total || '…']
        }), photos.state === 'done' && (photos.bad.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: ["All ", photos.total, " main pictures open. ", /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm btn-ghost",
            onClick: runPhotoCheck,
            children: "Check again"
          })]
        }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
              children: photos.bad.length
            }), " of ", photos.total, " do not open \u2014 replace their pictures in the store catalogue:"]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
            style: {
              margin: 0,
              paddingLeft: 20,
              display: 'grid',
              gap: 6
            },
            children: photos.bad.slice(0, 50).map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
                href: productHref(r.store, r.slug),
                target: "_blank",
                rel: "noopener noreferrer",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("b", {
                  children: r.name
                })
              }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                style: {
                  color: '#5F6D64'
                },
                children: ["\xB7 ", STORE[r.store] || r.store, r.brand ? ` · ${r.brand}` : '']
              })]
            }, `${r.store}/${r.slug}`))
          })]
        }))]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: `Out of stock${stock ? ` (${stock.out.length})` : ''}`,
        hint: "Live products with none left: restock them, or hide them from the shop.",
        rows: stock?.out ?? null,
        empty: "Nothing is out of stock.",
        render: (r, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.name
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", STORE[r.store] || r.store, r.brand ? ` · ${r.brand}` : '']
          })]
        }, `${r.store}|${r.name}|${i}`)
      }), /*#__PURE__*/jsxRuntimeExports.jsx(List, {
        title: `Running low${stock ? ` (${stock.low.length})` : ''}`,
        hint: "Live products with 1\u20133 left, fewest first.",
        rows: stock?.low ?? null,
        empty: "Nothing is running low.",
        render: (r, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.name
          }), " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              color: '#5F6D64'
            },
            children: ["\xB7 ", r.stock, " left \xB7 ", STORE[r.store] || r.store, r.brand ? ` · ${r.brand}` : '']
          })]
        }, `${r.store}|${r.name}|${i}`)
      })]
    })]
  });
}

export { RANGES, bestSellers, checkPhotos, Insights as default, lineBrand, productHref, salesByBrand, stockCsv, stockWatch, summariseSearches, topViewed };
//# sourceMappingURL=Insights.js.map
