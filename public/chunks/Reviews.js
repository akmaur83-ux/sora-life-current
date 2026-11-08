import { r as reactExports, j as jsxRuntimeExports, bP as fetchReviewsForAdmin, bQ as setReviewStatus } from '../bundle.js';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
function Reviews() {
  const [tab, setTab] = reactExports.useState('pending');
  const [rows, setRows] = reactExports.useState(null);
  const [error, setError] = reactExports.useState('');
  const load = status => {
    setRows(null);
    setError('');
    fetchReviewsForAdmin(status).then(setRows, e => {
      setRows([]);
      setError(e?.message || 'Could not load reviews.');
    });
  };
  reactExports.useEffect(() => {
    load(tab);
  }, [tab]);
  const act = async (id, status) => {
    try {
      await setReviewStatus(id, status);
      setRows(r => (r || []).filter(x => x.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not update the review.');
    }
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
        children: "Reviews"
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      children: "Customers' reviews wait here until you approve them. Approved reviews show on the product page with their star rating."
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-checkrow",
      role: "tablist",
      style: {
        gap: 8,
        margin: '12px 0'
      },
      children: TABS.map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        role: "tab",
        "aria-selected": tab === id,
        className: `btn btn-sm${tab === id ? '' : ' btn-ghost'}`,
        onClick: () => setTab(id),
        children: label
      }, id))
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner error",
      children: error
    }), rows === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "adm-hint",
      children: ["No ", tab, " reviews."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      style: {
        display: 'grid',
        gap: 12
      },
      children: rows.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
        style: {
          border: '1px solid #E4E8E1',
          padding: 14,
          background: '#fff'
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: {
            margin: 0,
            fontSize: 12,
            color: '#5F6D64'
          },
          children: [r.product_key, " \xB7 ", new Date(r.created_at).toLocaleString('en-IN')]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: {
            margin: '6px 0'
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("b", {
            children: ['★'.repeat(r.rating), '☆'.repeat(5 - r.rating)]
          }), " ", r.title && /*#__PURE__*/jsxRuntimeExports.jsx("b", {
            children: r.title
          }), " \u2014 ", r.author_name]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          style: {
            margin: '0 0 10px',
            whiteSpace: 'pre-wrap'
          },
          children: r.body
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 8
          },
          children: [tab !== 'approved' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm",
            onClick: () => act(r.id, 'approved'),
            children: "Approve"
          }), tab !== 'rejected' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm btn-ghost",
            onClick: () => act(r.id, 'rejected'),
            children: "Reject"
          })]
        })]
      }, r.id))
    })]
  });
}

export { Reviews as default };
//# sourceMappingURL=Reviews.js.map
