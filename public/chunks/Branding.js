import { r as reactExports, a as adminGetSetting, j as jsxRuntimeExports, b8 as uploadImage, e as adminSetSetting } from '../bundle.js';

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
    }).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
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
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      await adminSetSetting('branding', form);
      setMsg('Saved. Reload the storefront to see logo/color changes (they apply at page load).');
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
          children: "Logo, site name, tagline, favicon and brand colors."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
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
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Primary color"
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              style: {
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              },
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
                type: "color",
                value: form.primary_color,
                onChange: e => set('primary_color', e.target.value),
                style: {
                  width: 44,
                  height: 40,
                  border: 'none',
                  background: 'none'
                }
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: form.primary_color,
                onChange: e => set('primary_color', e.target.value)
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Accent color"
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              style: {
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              },
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
                type: "color",
                value: form.accent_color,
                onChange: e => set('accent_color', e.target.value),
                style: {
                  width: 44,
                  height: 40,
                  border: 'none',
                  background: 'none'
                }
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: form.accent_color,
                onChange: e => set('accent_color', e.target.value)
              })]
            })]
          })]
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
