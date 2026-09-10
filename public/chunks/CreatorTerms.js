import { r as reactExports, a as adminGetSetting, j as jsxRuntimeExports, e as adminSetSetting } from '../bundle.js';

const EMPTY = {
  body: '',
  version: 1,
  updated_at: null
};
function CreatorTerms() {
  const [form, setForm] = reactExports.useState(EMPTY);
  const [loadedVersion, setLoadedVersion] = reactExports.useState(1);
  const [bumpVersion, setBumpVersion] = reactExports.useState(false);
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [msg, setMsg] = reactExports.useState('');
  const [err, setErr] = reactExports.useState('');
  reactExports.useEffect(() => {
    adminGetSetting('creator_terms').then(v => {
      if (!v) return; // migration not applied yet
      setForm({
        ...EMPTY,
        ...v
      });
      setLoadedVersion(Number(v.version) || 1);
    }).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const version = bumpVersion ? loadedVersion + 1 : loadedVersion;
      const next = {
        body: form.body || '',
        version,
        updated_at: new Date().toISOString()
      };
      await adminSetSetting('creator_terms', next);
      setForm(next);
      setLoadedVersion(version);
      setBumpVersion(false);
      setMsg(bumpVersion ? `Saved as version ${version}. Creators who accepted an earlier version will be asked to accept again.` : `Saved. Still version ${version}, so existing acceptances stand.`);
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  const published = (form.body || '').trim().length > 0;
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Creator terms"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "The terms creators read and accept. Markdown; shown on the Creator Programme page and at signup."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), !published && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner",
      children: "No terms published yet. While this is empty, creators see no terms section and the signup checkbox is not shown."
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Terms & conditions"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "creator-terms-body",
            children: "Terms (markdown)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            id: "creator-terms-body",
            className: "textarea",
            rows: 22,
            value: form.body || '',
            onChange: e => setForm(f => ({
              ...f,
              body: e.target.value
            })),
            placeholder: '## Creator Programme Terms\n\nWrite the terms here.'
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Version"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "muted",
          style: {
            marginTop: 0
          },
          children: ["Current version ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: loadedVersion
          }), form.updated_at ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [" \xB7 last updated ", new Date(form.updated_at).toLocaleString('en-IN')]
          }) : /*#__PURE__*/jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, {
            children: " \xB7 never published"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "field",
          style: {
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start'
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "checkbox",
            checked: bumpVersion,
            onChange: e => setBumpVersion(e.target.checked),
            style: {
              marginTop: 3
            }
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("strong", {
              children: ["This is a material change \u2014 publish as version ", loadedVersion + 1, "."]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "muted",
              children: "Every creator will be asked to accept the new version. Leave unticked for typos and formatting, which keep existing acceptances valid."
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-actions",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: saving,
          children: saving ? 'Saving…' : 'Save terms'
        })
      })]
    })]
  });
}

export { CreatorTerms as default };
//# sourceMappingURL=CreatorTerms.js.map
