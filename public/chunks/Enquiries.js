import { r as reactExports, s as supabase, j as jsxRuntimeExports, bY as ENQUIRY_KINDS } from '../bundle.js';
import { d as downloadCsv, t as toCsv } from './csv.js';

const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']];

/** Rows → those of a kind ('' = all) and status ('' = all), newest first. Pure. */
function filterEnquiries(rows, kind = '', status = '') {
  return (Array.isArray(rows) ? rows : []).filter(r => (!kind || r.kind === kind) && (!status || r.status === status)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** "Product requests" grouped: the same thing asked for by several people counts once, with how many. Pure. */
function requestTally(rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r.kind !== 'request' || !r.query) continue;
    const k = String(r.query).trim().toLowerCase();
    m.set(k, {
      query: m.get(k)?.query || r.query,
      n: (m.get(k)?.n || 0) + 1
    });
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.query.localeCompare(b.query));
}
const waHref = p => {
  const d = String(p || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : '';
};
const when = iso => iso ? new Date(iso).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit'
}) : '';
const box = {
  border: '1px solid #E4E8E1',
  background: '#fff',
  padding: 14
};
function Enquiries() {
  const [rows, setRows] = reactExports.useState(null);
  const [kind, setKind] = reactExports.useState('');
  const [status, setStatus] = reactExports.useState('new');
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    let live = true;
    supabase.from('enquiries').select('*').order('created_at', {
      ascending: false
    }).limit(1000).then(({
      data,
      error: e
    }) => {
      if (!live) return;
      if (e) {
        setError(e.message);
        setRows([]);
      } else setRows(data || []);
    });
    return () => {
      live = false;
    };
  }, []);
  const mark = async (r, next) => {
    const {
      error: e
    } = await supabase.from('enquiries').update({
      status: next
    }).eq('id', r.id);
    if (e) {
      setError(e.message);
      return;
    }
    setRows(list => list.map(x => x.id === r.id ? {
      ...x,
      status: next
    } : x));
  };
  const shown = filterEnquiries(rows, kind, status);
  const tally = requestTally(rows);
  const save = () => downloadCsv('sora-enquiries.csv', toCsv(shown, [['Date', r => String(r.created_at || '').slice(0, 10)], ['Kind', r => ENQUIRY_KINDS[r.kind] || r.kind], ['Status', r => r.status], ['Name', r => r.name], ['Business', r => r.business], ['Phone', r => r.phone], ['Email', r => r.email], ['City', r => r.city], ['Website', r => r.website], ['Product asked for', r => r.query], ['Store', r => r.store], ['Message', r => r.message]]));
  const count = k => (rows || []).filter(r => r.kind === k && r.status === 'new').length;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Enquiries"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: rows === null ? 'Loading…' : `${(rows || []).filter(r => r.status === 'new').length} new`
        })]
      }), shown.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-ghost",
        onClick: save,
        children: "Download CSV"
      })]
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner error",
      children: error
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-checkrow",
      style: {
        gap: 8,
        margin: '12px 0',
        flexWrap: 'wrap'
      },
      children: [[['', 'All'], ...Object.entries(ENQUIRY_KINDS)].map(([k, label]) => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        type: "button",
        className: `btn btn-sm${kind === k ? '' : ' btn-ghost'}`,
        "aria-pressed": kind === k,
        onClick: () => setKind(k),
        children: [label, k && count(k) ? ` (${count(k)})` : '']
      }, k || 'all')), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
        className: "input",
        style: {
          width: 'auto'
        },
        value: status,
        onChange: e => setStatus(e.target.value),
        "aria-label": "Status",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
          value: "",
          children: "Any status"
        }), STATUSES.map(([v, l]) => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
          value: v,
          children: l
        }, v))]
      })]
    }), tally.length > 0 && kind !== 'partner' && kind !== 'bulk' && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      style: {
        ...box,
        marginBottom: 14
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          margin: '0 0 6px',
          fontSize: 16
        },
        children: "Most requested products"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "adm-hint",
        style: {
          margin: '0 0 8px'
        },
        children: "All time, the same words counted once with how many asked."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        style: {
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8
        },
        children: tally.slice(0, 20).map(t => /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "badge badge-soft",
          children: [t.query, " \xB7 ", t.n]
        }, t.query))
      })]
    }), rows === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    }) : shown.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "Nothing here yet. Enquiries arrive from /sell and from searches that found nothing."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      style: {
        display: 'grid',
        gap: 10
      },
      children: shown.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
        style: box,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap'
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "badge badge-soft",
              children: ENQUIRY_KINDS[r.kind] || r.kind
            }), ' ', /*#__PURE__*/jsxRuntimeExports.jsx("b", {
              children: r.kind === 'request' ? `“${r.query}”` : r.business || r.name
            }), r.kind !== 'request' && r.business && r.name ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              style: {
                color: '#5F6D64'
              },
              children: [" \xB7 ", r.name]
            }) : null, r.city ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              style: {
                color: '#5F6D64'
              },
              children: [" \xB7 ", r.city]
            }) : null, r.store ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              style: {
                color: '#5F6D64'
              },
              children: [" \xB7 ", r.store]
            }) : null]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-hint",
            children: when(r.created_at)
          })]
        }), r.message && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          style: {
            margin: '8px 0',
            whiteSpace: 'pre-line'
          },
          children: r.message
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: 8
          },
          children: [r.phone && /*#__PURE__*/jsxRuntimeExports.jsxs("a", {
            className: "btn btn-sm btn-ghost",
            href: `tel:${r.phone}`,
            children: ["Call ", r.phone]
          }), r.phone && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            className: "btn btn-sm btn-ghost",
            href: waHref(r.phone),
            target: "_blank",
            rel: "noopener noreferrer",
            children: "WhatsApp"
          }), r.email && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            className: "btn btn-sm btn-ghost",
            href: `mailto:${r.email}`,
            children: r.email
          }), r.website && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-hint",
            children: r.website
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            style: {
              flex: 1
            }
          }), STATUSES.filter(([v]) => v !== r.status).map(([v, l]) => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
            type: "button",
            className: "btn btn-sm",
            onClick: () => mark(r, v),
            children: ["Mark ", l.toLowerCase()]
          }, v))]
        })]
      }, r.id))
    })]
  });
}

export { STATUSES, Enquiries as default, filterEnquiries, requestTally };
//# sourceMappingURL=Enquiries.js.map
