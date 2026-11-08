import { r as reactExports, j as jsxRuntimeExports, bP as fetchReviewsForAdmin, bQ as fetchQuestionsForAdmin, bR as productHref, bS as fetchStockAlerts, bT as groupAlerts, bU as setReviewStatus, bV as answerQuestion, bW as rejectQuestion, bX as markAlertsNotified } from '../bundle.js';

const SECTIONS = [['reviews', 'Reviews'], ['questions', 'Questions'], ['alerts', 'Stock alerts']];
const card = {
  border: '1px solid #E4E8E1',
  padding: 14,
  background: '#fff'
};
const meta = {
  margin: 0,
  fontSize: 12,
  color: '#5F6D64'
};
function Tabs({
  items,
  value,
  onChange
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
    className: "adm-checkrow",
    role: "tablist",
    style: {
      gap: 8,
      margin: '12px 0'
    },
    children: items.map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      type: "button",
      role: "tab",
      "aria-selected": value === id,
      className: `btn btn-sm${value === id ? '' : ' btn-ghost'}`,
      onClick: () => onChange(id),
      children: label
    }, id))
  });
}
function ReviewsPane() {
  const [tab, setTab] = reactExports.useState('pending');
  const [rows, setRows] = reactExports.useState(null);
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    setRows(null);
    setError('');
    fetchReviewsForAdmin(tab).then(setRows, e => {
      setRows([]);
      setError(e?.message || 'Could not load reviews.');
    });
  }, [tab]);
  const act = async (id, status) => {
    try {
      await setReviewStatus(id, status);
      setRows(r => (r || []).filter(x => x.id !== id));
    } catch (e) {
      setError(e?.message || 'Could not update the review.');
    }
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      children: "Customers' reviews wait here until you approve them. Approved reviews show on the product page with their star rating."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Tabs, {
      items: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']],
      value: tab,
      onChange: setTab
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
        style: card,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: meta,
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
function QuestionsPane() {
  const [tab, setTab] = reactExports.useState('pending');
  const [rows, setRows] = reactExports.useState(null);
  const [error, setError] = reactExports.useState('');
  const [drafts, setDrafts] = reactExports.useState({});
  reactExports.useEffect(() => {
    setRows(null);
    setError('');
    fetchQuestionsForAdmin(tab).then(setRows, e => {
      setRows([]);
      setError(e?.message || 'Could not load questions.');
    });
  }, [tab]);
  const drop = id => setRows(r => (r || []).filter(x => x.id !== id));
  const publish = async q => {
    try {
      await answerQuestion(q.id, drafts[q.id] ?? q.answer);
      if (tab !== 'published') drop(q.id);
    } catch (e) {
      setError(e?.message || 'Could not publish the answer.');
    }
  };
  const reject = async id => {
    try {
      await rejectQuestion(id);
      drop(id);
    } catch (e) {
      setError(e?.message || 'Could not update the question.');
    }
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      children: "Questions customers ask on product pages. Write an answer and publish it: the question and your answer appear on that product's page."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Tabs, {
      items: [['pending', 'Waiting'], ['published', 'Published'], ['rejected', 'Rejected']],
      value: tab,
      onChange: setTab
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner error",
      children: error
    }), rows === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "adm-hint",
      children: ["No ", tab === 'pending' ? 'waiting' : tab, " questions."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      style: {
        display: 'grid',
        gap: 12
      },
      children: rows.map(q => /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
        style: card,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: meta,
          children: [productHref(q.product_key) ? /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            href: productHref(q.product_key),
            children: q.product_key
          }) : q.product_key, " \xB7 ", new Date(q.created_at).toLocaleString('en-IN'), " \xB7 ", q.author_name]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: {
            margin: '6px 0 10px',
            fontWeight: 600,
            whiteSpace: 'pre-wrap'
          },
          children: ["Q: ", q.question]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          style: {
            display: 'grid',
            gap: 4,
            fontSize: 13
          },
          children: ["Answer", /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            rows: 3,
            maxLength: 2000,
            value: drafts[q.id] ?? q.answer ?? '',
            onChange: e => setDrafts({
              ...drafts,
              [q.id]: e.target.value
            }),
            style: {
              width: '100%',
              padding: 8,
              font: 'inherit'
            }
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 8,
            marginTop: 8
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm",
            onClick: () => publish(q),
            disabled: !String(drafts[q.id] ?? q.answer ?? '').trim(),
            children: tab === 'published' ? 'Save answer' : 'Publish answer'
          }), tab !== 'rejected' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm btn-ghost",
            onClick: () => reject(q.id),
            children: "Reject"
          })]
        })]
      }, q.id))
    })]
  });
}
function AlertsPane() {
  const [tab, setTab] = reactExports.useState('open');
  const [rows, setRows] = reactExports.useState(null);
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    setRows(null);
    setError('');
    fetchStockAlerts(tab === 'open').then(setRows, e => {
      setRows([]);
      setError(e?.message || 'Could not load stock alerts.');
    });
  }, [tab]);
  const groups = groupAlerts(rows || []);
  const done = async g => {
    try {
      await markAlertsNotified(g.rows.map(r => r.id));
      setRows(r => (r || []).filter(x => !g.rows.some(y => y.id === x.id)));
    } catch (e) {
      setError(e?.message || 'Could not update.');
    }
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-hint",
      children: "Customers who asked to be told when an out-of-stock product is back. Restock it, email them (the addresses are listed, ready to copy), then mark the group notified."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Tabs, {
      items: [['open', 'Waiting'], ['done', 'Notified']],
      value: tab,
      onChange: setTab
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner error",
      children: error
    }), rows === null ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      children: "Loading\u2026"
    }) : groups.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
      className: "adm-hint",
      children: ["No ", tab === 'open' ? 'waiting' : 'notified', " alerts."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      style: {
        display: 'grid',
        gap: 12
      },
      children: groups.map(g => /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
        style: card,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: {
            margin: 0,
            fontWeight: 600
          },
          children: [g.product_name, g.choice ? ` — ${g.choice}` : '', " ", /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            style: {
              fontWeight: 400,
              color: '#5F6D64'
            },
            children: ["\xB7 ", g.rows.length, " ", g.rows.length === 1 ? 'person' : 'people']
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          style: meta,
          children: [productHref(g.product_key) ? /*#__PURE__*/jsxRuntimeExports.jsx("a", {
            href: productHref(g.product_key),
            children: g.product_key
          }) : g.product_key, " \xB7 latest ", new Date(g.rows[0].created_at).toLocaleString('en-IN')]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
          readOnly: true,
          rows: Math.min(4, g.rows.length),
          value: g.rows.map(r => r.email).join(', '),
          onFocus: e => e.target.select(),
          "aria-label": "Emails",
          style: {
            width: '100%',
            margin: '8px 0',
            padding: 8,
            font: '13px/1.4 monospace'
          }
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 8
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
            className: "btn btn-sm btn-ghost",
            href: `mailto:?bcc=${encodeURIComponent(g.rows.map(r => r.email).join(','))}&subject=${encodeURIComponent(`${g.product_name} is back in stock`)}`,
            children: "Email them"
          }), tab === 'open' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-sm",
            onClick: () => done(g),
            children: "Mark notified"
          })]
        })]
      }, g.key))
    })]
  });
}
function Reviews() {
  const [section, setSection] = reactExports.useState('reviews');
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
        children: "Reviews, questions & stock alerts"
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Tabs, {
      items: SECTIONS,
      value: section,
      onChange: setSection
    }), section === 'reviews' ? /*#__PURE__*/jsxRuntimeExports.jsx(ReviewsPane, {}) : section === 'questions' ? /*#__PURE__*/jsxRuntimeExports.jsx(QuestionsPane, {}) : /*#__PURE__*/jsxRuntimeExports.jsx(AlertsPane, {})]
  });
}

export { Reviews as default };
//# sourceMappingURL=Reviews.js.map
