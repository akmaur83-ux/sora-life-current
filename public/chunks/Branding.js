import { r as reactExports, a as adminGetSetting, j as jsxRuntimeExports, cc as uploadImage, f as adminSetSetting } from '../bundle.js';

function Branding() {
  const [form, setForm] = reactExports.useState({
    logo_url: '',
    site_name: '',
    tagline: '',
    primary_color: '#1E3A2F',
    accent_color: '#E8B04B',
    favicon_url: ''
  });
  const [loading, setLoading] = reactExports.useState(true);
  // Set when the saved branding could not be read. The form then stays hidden:
  // its defaults are not the live branding, and saving them would replace it.
  const [loadErr, setLoadErr] = reactExports.useState('');
  const [saving, setSaving] = reactExports.useState(false);
  const [uploading, setUploading] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [err, setErr] = reactExports.useState('');
  reactExports.useEffect(() => {
    adminGetSetting('branding').then(v => {
      if (v) setForm(f => ({
        ...f,
        ...v
      }));
    }).catch(e => setLoadErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  const set = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  async function onFile(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      set(field, await uploadImage(file, 'branding'));
    } catch (ex) {
      setErr('Upload failed: ' + (ex.message || String(ex)));
    }
    setUploading('');
  }
  async function save(e) {
    e.preventDefault();
    if (loadErr) return;
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      await adminSetSetting('branding', form);
      setMsg('Saved. Reload the storefront to see the change (it applies at page load).');
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Branding"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Logo, site name, tagline and favicon."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), loadErr && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      role: "alert",
      children: ["The saved branding could not be loaded (", loadErr, "). It can't be edited until it loads, so the default logo and name can't be saved over the live ones. Reload the page to try again."]
    }), !loadErr && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Logo"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start'
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "adm-thumb-lg",
            style: {
              background: '#fff'
            },
            children: form.logo_url && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
              src: form.logo_url,
              alt: ""
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            style: {
              flex: 1
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Upload logo (transparent PNG recommended)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                type: "file",
                accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
                onChange: e => onFile(e, 'logo_url'),
                disabled: !!uploading
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Or paste logo URL"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: form.logo_url || '',
                onChange: e => set('logo_url', e.target.value)
              })]
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Wordmark & tagline"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Site name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: form.site_name,
              onChange: e => set('site_name', e.target.value)
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Tagline"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: form.tagline,
              onChange: e => set('tagline', e.target.value)
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Brand colors"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "muted",
          children: "Set in Appearance (Primary brand color and Accent): the storefront takes its colors from there, not from this page."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Favicon"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 16,
            alignItems: 'center'
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "adm-thumb-lg",
            style: {
              width: 48,
              height: 48
            },
            children: form.favicon_url && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
              src: form.favicon_url,
              alt: ""
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "file",
            accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
            onChange: e => onFile(e, 'favicon_url'),
            disabled: !!uploading
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        type: "submit",
        disabled: saving,
        children: saving ? 'Saving…' : 'Save branding'
      })]
    })]
  });
}

export { Branding as default };
//# sourceMappingURL=Branding.js.map
