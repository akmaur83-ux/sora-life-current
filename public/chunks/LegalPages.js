import { u as useParams, j as jsxRuntimeExports, L as LEGAL_PAGES, r as reactExports, a as adminGetSetting, l as legalKey, d as defaultLegalPage, n as normalizeLegalPage, b as Link, h as hasLegalContent, c as LegalUpdated, C as CONTACT_FIELDS, G as GRIEVANCE_FIELDS, v as validateLegalPage, e as adminSetSetting } from '../bundle.js';

function LegalPagesAdmin() {
  const {
    pageId
  } = useParams();
  return /*#__PURE__*/jsxRuntimeExports.jsx(LegalPagesEditor, {
    pageId: pageId
  }, pageId || 'overview');
}
function LegalPagesEditor({
  pageId
}) {
  const spec = LEGAL_PAGES.find(p => p.id === pageId);
  const [records, setRecords] = reactExports.useState({});
  const [form, setForm] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  const [loadFailed, setLoadFailed] = reactExports.useState(false);
  const [saving, setSaving] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [missing, setMissing] = reactExports.useState([]);
  reactExports.useEffect(() => {
    let live = true;
    Promise.all([adminGetSetting('contact'), adminGetSetting('branding'), ...LEGAL_PAGES.map(p => adminGetSetting(legalKey(p.id)))]).then(([contact, branding, ...values]) => {
      if (!live) return;
      const next = Object.fromEntries(LEGAL_PAGES.map((p, i) => [p.id, values[i] == null ? defaultLegalPage(p.id, contact || {}, branding?.siteName) : normalizeLegalPage(p.id, values[i])]));
      setRecords(next);
      setForm(spec ? next[spec.id] : null);
      setMissing(LEGAL_PAGES.filter((p, i) => values[i] == null).map(p => p.id));
    }).catch(e => {
      if (live) {
        setErr(e.message || String(e));
        setLoadFailed(true);
      }
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const next = {
        ...validateLegalPage(spec.id, form),
        updated_at: new Date().toISOString()
      };
      await adminSetSetting(legalKey(spec.id), next);
      // Confirm the stored value rather than marking a failed write as published.
      const stored = await adminGetSetting(legalKey(spec.id));
      if (!stored) throw new Error('The saved record could not be read back. Please reload before retrying.');
      const confirmed = normalizeLegalPage(spec.id, stored);
      setForm(confirmed);
      setRecords(r => ({
        ...r,
        [spec.id]: confirmed
      }));
      setMissing(m => m.filter(id => id !== spec.id));
      setMsg('Saved. The public page now uses this content.');
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  const field = (key, label, type = 'text') => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: 'legal-' + key,
      children: label
    }), type === 'textarea' ? /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
      id: 'legal-' + key,
      className: "textarea",
      rows: key === 'body' ? 24 : 3,
      maxLength: key === 'body' ? 60000 : 2000,
      value: form[key] || '',
      onChange: e => setForm(f => ({
        ...f,
        [key]: e.target.value
      }))
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      id: 'legal-' + key,
      className: "input",
      type: type,
      maxLength: key === 'title' ? 160 : 2000,
      value: form[key] || '',
      onChange: e => setForm(f => ({
        ...f,
        [key]: e.target.value
      }))
    })]
  }, key);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: spec ? spec.label : 'Legal Pages'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Edit the public policies and contact information."
        })]
      }), spec && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
        className: "btn btn-outline",
        href: '/' + spec.id,
        target: "_blank",
        rel: "noopener noreferrer",
        children: "Preview live page \u2197"
      })]
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading\u2026"
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner err",
        role: "alert",
        children: err
      }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner ok",
        role: "status",
        children: msg
      }), !loadFailed && missing.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner",
        children: "Some records have not been seeded. Current page content is preserved as a fallback. Apply the legal-pages SQL before publishing edits."
      }), !spec ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "surface",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "legal-admin-list",
          children: LEGAL_PAGES.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
              to: '/admin/legal-pages/' + p.id,
              children: p.label
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: [loadFailed ? 'Unavailable' : hasLegalContent(p.id, records[p.id]) ? 'Has content' : 'Empty', missing.includes(p.id) ? ' · fallback' : '']
            }), records[p.id] && /*#__PURE__*/jsxRuntimeExports.jsx(LegalUpdated, {
              page: records[p.id]
            })]
          }, p.id))
        })
      }) : form && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
        onSubmit: save,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "muted",
          children: ["Saved status: ", hasLegalContent(spec.id, records[spec.id]) ? 'Has content' : 'Empty', ". Empty pages remain reachable and show a short message."]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "muted",
          children: form.updated_at ? 'Last updated ' + new Date(form.updated_at).toLocaleString('en-IN') : 'Last updated: original content; no edits saved yet.'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
          disabled: saving || loadFailed || missing.includes(spec.id),
          className: "legal-admin-fields",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "surface",
            children: [field('title', 'Page heading'), field('intro', 'Introduction', 'textarea'), spec.kind === 'markdown' ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [field('body', 'Page content (markdown)', 'textarea'), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "hint",
                children: "Use #, ## or ### headings, - bullets, numbered lists and blank lines. Other formatting is displayed as plain text. HTML is never executed."
              })]
            }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [CONTACT_FIELDS.map(args => field(...args)), spec.id === 'grievance' && GRIEVANCE_FIELDS.map(args => field(...args))]
            })]
          }), spec.id === 'contact' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "surface",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
              children: "Common questions"
            }), (form.faqs || []).map((faq, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "legal-admin-faq",
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
                className: "label",
                htmlFor: 'faq-q-' + i,
                children: ["Question ", i + 1]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                id: 'faq-q-' + i,
                className: "input",
                value: faq.q,
                maxLength: 300,
                onChange: e => setForm(f => ({
                  ...f,
                  faqs: f.faqs.map((v, j) => j === i ? {
                    ...v,
                    q: e.target.value
                  } : v)
                }))
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
                className: "label",
                htmlFor: 'faq-a-' + i,
                children: ["Answer ", i + 1]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
                id: 'faq-a-' + i,
                className: "textarea",
                rows: 4,
                value: faq.a,
                maxLength: 4000,
                onChange: e => setForm(f => ({
                  ...f,
                  faqs: f.faqs.map((v, j) => j === i ? {
                    ...v,
                    a: e.target.value
                  } : v)
                }))
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
                type: "button",
                className: "btn btn-outline btn-sm",
                onClick: () => setForm(f => ({
                  ...f,
                  faqs: f.faqs.filter((_, j) => j !== i)
                })),
                children: ["Remove question ", i + 1]
              })]
            }, i)), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-outline",
              disabled: (form.faqs || []).length >= 30,
              onClick: () => setForm(f => ({
                ...f,
                faqs: [...(f.faqs || []), {
                  q: '',
                  a: ''
                }]
              })),
              children: "Add question"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-actions",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn",
              type: "submit",
              disabled: saving,
              children: saving ? 'Saving…' : 'Save page'
            }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
              to: "/admin/legal-pages",
              children: "All legal pages"
            })]
          })]
        })]
      })]
    })]
  });
}

export { LegalPagesAdmin as default };
//# sourceMappingURL=LegalPages.js.map
