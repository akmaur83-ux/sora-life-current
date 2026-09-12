import { r as reactExports, j as jsxRuntimeExports, k as adminListCategories, o as adminSeedDefaultCategories, a$ as adminUpsertCategory, b0 as adminDeleteCategory } from '../bundle.js';

const TONES = ['forest', 'lime', 'amber', 'clay', 'moss', 'plum', 'rose', 'honey', 'teal', 'sky'];
const empty = {
  slug: '',
  name: '',
  tagline: '',
  blurb: '',
  tone: 'forest',
  image_url: '',
  is_active: true,
  sort_order: 0
};
function Categories() {
  const [list, setList] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [editing, setEditing] = reactExports.useState(null); // category object or 'new'
  const [form, setForm] = reactExports.useState(empty);
  const [err, setErr] = reactExports.useState('');
  const [saving, setSaving] = reactExports.useState(false);
  async function load() {
    setLoading(true);
    try {
      setList(await adminListCategories());
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  async function seedDefaults() {
    setSaving(true);
    try {
      await adminSeedDefaultCategories();
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
    setSaving(false);
  }
  function startEdit(cat) {
    setForm(cat ? {
      ...cat
    } : empty);
    setEditing(cat || 'new');
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await adminUpsertCategory(form);
      setEditing(null);
      await load();
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  async function remove(cat) {
    if (!window.confirm(`Delete category "${cat.name}"? Products keep their category text but this entry disappears from admin/homepage lists.`)) return;
    try {
      await adminDeleteCategory(cat.id);
      await load();
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Categories"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${list.length} categories`
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 8
        },
        children: [list.length === 0 && !loading && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline btn-sm",
          onClick: seedDefaults,
          disabled: saving,
          children: "Seed the 8 default categories"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: () => startEdit(null),
          children: "+ Add category"
        })]
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), editing && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface pad-lg",
      onSubmit: save,
      style: {
        marginBottom: 20,
        maxWidth: 640
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          fontFamily: 'var(--font-display)',
          marginBottom: 14
        },
        children: editing === 'new' ? 'New category' : `Edit "${editing.name}"`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Name"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            required: true,
            value: form.name,
            onChange: e => setForm(f => ({
              ...f,
              name: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Slug"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.slug,
            onChange: e => setForm(f => ({
              ...f,
              slug: e.target.value
            })),
            placeholder: "auto from name"
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Tagline"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: form.tagline,
          onChange: e => setForm(f => ({
            ...f,
            tagline: e.target.value
          }))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Description / blurb"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
          className: "textarea",
          value: form.blurb,
          onChange: e => setForm(f => ({
            ...f,
            blurb: e.target.value
          }))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Tone"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
            className: "select",
            value: form.tone,
            onChange: e => setForm(f => ({
              ...f,
              tone: e.target.value
            })),
            children: TONES.map(t => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: t,
              children: t
            }, t))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Image URL (optional)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.image_url || '',
            onChange: e => setForm(f => ({
              ...f,
              image_url: e.target.value
            }))
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "cat-active",
          checked: form.is_active !== false,
          onChange: e => setForm(f => ({
            ...f,
            is_active: e.target.checked
          }))
        }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
          htmlFor: "cat-active",
          children: "Active"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          marginTop: 14
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          disabled: saving,
          children: saving ? 'Saving…' : 'Save'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          onClick: () => setEditing(null),
          children: "Cancel"
        })]
      })]
    }), !loading && list.length === 0 && !editing && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No categories yet. Seed the defaults above, or add one manually."
    }), list.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Slug"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Tagline"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Active"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: list.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: c.name
              })
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: c.slug
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: c.tagline
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: c.is_active ? 'Yes' : 'No'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-actions",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-light",
                  onClick: () => startEdit(c),
                  children: "Edit"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-ghost",
                  style: {
                    color: 'var(--color-sale)'
                  },
                  onClick: () => remove(c),
                  children: "Delete"
                })]
              })
            })]
          }, c.id))
        })]
      })
    })]
  });
}

export { Categories as default };
//# sourceMappingURL=Categories.js.map
