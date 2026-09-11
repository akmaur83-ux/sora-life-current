import { r as reactExports, b5 as normalizePromo, j as jsxRuntimeExports, b6 as PromoPoster, b7 as PromoOfferCard, b8 as adminListPromotions, b9 as adminUpsertPromotion, ba as adminDeletePromotion, bb as adminSetPromotionActive, bc as adminReorderPromotions, bd as uploadPromoImage } from '../bundle.js';

const THEME_OPTIONS = [['forest', 'Forest'], ['cream', 'Warm Cream'], ['orange', 'Orange Accent'], ['dark', 'Dark Luxe'], ['minimal', 'Minimal']];
const PLACEMENT_OPTIONS = [['home', 'Homepage'], ['pdp', 'Product page'], ['cart', 'Cart']];
const EMPTY = {
  type: 'poster',
  title: '',
  subtitle: '',
  coupon_code: '',
  cta_text: '',
  cta_url: '',
  badge_text: '',
  image_url: '',
  desktop_image_url: '',
  theme_variant: 'forest',
  text_align: 'left',
  placements: ['home'],
  is_active: true,
  starts_at: '',
  ends_at: '',
  sort_order: 0
};

// ISO <-> <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time)
const toLocalInput = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = v => v ? new Date(v).toISOString() : null;
function Promotions() {
  const [list, setList] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [editing, setEditing] = reactExports.useState(null); // 'new' | row | null
  const [form, setForm] = reactExports.useState(EMPTY);
  const [saving, setSaving] = reactExports.useState(false);
  const [uploading, setUploading] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [notMigrated, setNotMigrated] = reactExports.useState(false);
  async function load() {
    setLoading(true);
    setErr('');
    try {
      setList(await adminListPromotions());
      setNotMigrated(false);
    } catch (e) {
      const msg = e.message || String(e);
      if (/does not exist yet/i.test(msg)) {
        setNotMigrated(true);
        setList([]);
      } else setErr(msg);
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  const set = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  const togglePlacement = p => setForm(f => ({
    ...f,
    placements: f.placements.includes(p) ? f.placements.filter(x => x !== p) : [...f.placements, p]
  }));
  function startEdit(row) {
    if (row) {
      setForm({
        ...EMPTY,
        ...row,
        coupon_code: row.coupon_code || '',
        cta_text: row.cta_text || '',
        cta_url: row.cta_url || '',
        badge_text: row.badge_text || '',
        image_url: row.image_url || '',
        desktop_image_url: row.desktop_image_url || '',
        placements: Array.isArray(row.placements) ? row.placements : [],
        starts_at: toLocalInput(row.starts_at),
        ends_at: toLocalInput(row.ends_at)
      });
      setEditing(row);
    } else {
      setForm({
        ...EMPTY,
        sort_order: list.length
      });
      setEditing('new');
    }
    setErr('');
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await adminUpsertPromotion({
        ...form,
        id: editing === 'new' ? undefined : editing.id,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        sort_order: Number(form.sort_order) || 0
      });
      setEditing(null);
      await load();
    } catch (ex) {
      if (ex.savedPromotion) {
        setEditing(null);
        await load();
      }
      // A saved replacement can still need old-image cleanup. Show that warning
      // after reload, which otherwise clears the error banner.
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  async function remove(row) {
    if (!window.confirm(`Delete promotion "${row.title || 'untitled'}" and its uploaded promo image (unless shared with another promotion)?`)) return;
    try {
      await adminDeletePromotion(row.id);
      await load();
    } catch (ex) {
      if (ex.imageRemoved) await load();
      setErr(ex.message || String(ex));
    }
  }
  async function toggleActive(row) {
    try {
      await adminSetPromotionActive(row.id, !row.is_active);
      await load();
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  }
  async function move(row, dir) {
    const idx = list.findIndex(x => x.id === row.id);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    try {
      await adminReorderPromotions(next.map(x => x.id));
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  }

  // One handler for both artwork fields; `field` names the column it fills.
  async function onImage(e, field = 'image_url') {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      set(field, await uploadPromoImage(file));
    } catch (ex) {
      setErr('Upload failed: ' + (ex.message || String(ex)));
    }
    setUploading(false);
  }
  const preview = normalizePromo({
    ...form
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Promotions"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: [loading ? 'Loading…' : `${list.length} promotion${list.length === 1 ? '' : 's'}`, " \xB7 posters & offer cards for Home, PDP and Cart"]
        })]
      }), !notMigrated && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-sm",
        onClick: () => startEdit(null),
        children: "+ New promotion"
      })]
    }), notMigrated && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner info",
      children: ["The ", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
        children: "promotions"
      }), " table has not been created yet. Run", ' ', /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "supabase/migrations/0017_promotions.sql"
      }), " in the Supabase SQL editor, then reload this page. The storefront keeps working without it."]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      role: "alert",
      children: err
    }), editing && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface pad-lg",
      onSubmit: save,
      style: {
        marginBottom: 20,
        maxWidth: 760
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          fontFamily: 'var(--font-display)',
          marginBottom: 14
        },
        children: editing === 'new' ? 'New promotion' : `Edit "${editing.title || 'untitled'}"`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Type"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: form.type,
            onChange: e => set('type', e.target.value),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "poster",
              children: "Poster (large visual card)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "offer",
              children: "Compact offer card"
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Visual style"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
            className: "select",
            value: form.theme_variant,
            onChange: e => set('theme_variant', e.target.value),
            children: THEME_OPTIONS.map(([v, l]) => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: v,
              children: l
            }, v))
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Title"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            required: true,
            value: form.title,
            onChange: e => set('title', e.target.value),
            maxLength: 160,
            "aria-describedby": "promo-display-notice"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Badge text (optional)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.badge_text,
            onChange: e => set('badge_text', e.target.value),
            placeholder: "Limited time",
            maxLength: 40,
            "aria-describedby": "promo-display-notice"
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Subtitle"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: form.subtitle,
          onChange: e => set('subtitle', e.target.value),
          maxLength: 320,
          "aria-describedby": "promo-display-notice"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-banner info",
        id: "promo-display-notice",
        role: "note",
        style: {
          color: 'var(--forest-800)'
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: "Display & copy only."
        }), ' ', "Promotions created here do not automatically change checkout totals. Only publish discount claims that are fulfilled by an approved checkout offer."]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Coupon code (display / copy only \u2014 not applied at checkout)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.coupon_code,
            onChange: e => set('coupon_code', e.target.value.toUpperCase()),
            placeholder: "Approved offer code",
            maxLength: 40,
            "aria-describedby": "promo-display-notice"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Text alignment"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: form.text_align,
            onChange: e => set('text_align', e.target.value),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "left",
              children: "Left"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "center",
              children: "Center"
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "CTA button text (optional)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.cta_text,
            onChange: e => set('cta_text', e.target.value),
            placeholder: "Explore SORA LIFE",
            maxLength: 60
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "CTA link (internal path or https URL)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.cta_url,
            onChange: e => set('cta_url', e.target.value),
            placeholder: "/shop",
            maxLength: 500
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Image (optional \u2014 poster art or offer icon; mobile and default)"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "file",
          accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
          onChange: e => onImage(e, 'image_url'),
          disabled: uploading
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          style: {
            marginTop: 8
          },
          value: form.image_url,
          onChange: e => set('image_url', e.target.value),
          placeholder: "or paste an image URL"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "adm-hint",
          children: "Shown on phones and tablets, and on every screen when no desktop image is set."
        }), uploading && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          children: "Uploading\u2026"
        })]
      }), form.type === 'poster' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Desktop image (1024px and wider) \u2014 optional"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "file",
          accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
          onChange: e => onImage(e, 'desktop_image_url'),
          disabled: uploading
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          style: {
            marginTop: 8
          },
          value: form.desktop_image_url,
          onChange: e => set('desktop_image_url', e.target.value),
          placeholder: "or paste an image URL \u2014 leave empty to use the mobile image"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "adm-hint",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: "Recommended 1200 \xD7 500."
          }), " A landscape crop for wide screens; the browser downloads only the image it needs for the screen it is on."]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Show on"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          style: {
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap'
          },
          children: PLACEMENT_OPTIONS.map(([v, l]) => /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
            className: "adm-checkrow",
            style: {
              padding: 0
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              type: "checkbox",
              checked: form.placements.includes(v),
              onChange: () => togglePlacement(v)
            }), l]
          }, v))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid3",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Starts at (optional)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "datetime-local",
            value: form.starts_at,
            onChange: e => set('starts_at', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Ends at (optional)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "datetime-local",
            value: form.ends_at,
            onChange: e => set('ends_at', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Sort order"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            value: form.sort_order,
            onChange: e => set('sort_order', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "promo-active",
          checked: form.is_active !== false,
          onChange: e => set('is_active', e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
          htmlFor: "promo-active",
          children: "Active (visible on the storefront while within its date window)"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        style: {
          marginTop: 12
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Live preview"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-promo-preview",
          children: preview.type === 'poster' ? /*#__PURE__*/jsxRuntimeExports.jsx(PromoPoster, {
            promo: preview
          }) : /*#__PURE__*/jsxRuntimeExports.jsx(PromoOfferCard, {
            promo: preview
          })
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          marginTop: 16
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          disabled: saving || uploading,
          children: saving ? 'Saving…' : 'Save promotion'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          onClick: () => setEditing(null),
          children: "Cancel"
        })]
      })]
    }), !loading && !notMigrated && list.length === 0 && !editing && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No promotions yet. Create one to show posters and offer cards on the storefront."
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-slide-list",
      children: list.map(p => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-slide-card",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-slide-thumb",
          style: {
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-400)'
          },
          children: p.image_url ? /*#__PURE__*/jsxRuntimeExports.jsx("img", {
            src: p.image_url,
            alt: ""
          }) : /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            style: {
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            },
            children: p.type
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: p.title || 'Untitled'
          }), ' ', !p.is_active && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "badge badge-out",
            children: "Hidden"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "hint",
            children: [p.type, " \xB7 ", p.theme_variant, p.coupon_code ? ` · code ${p.coupon_code}` : '', p.cta_url ? ` · → ${p.cta_url}` : '']
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-promo-chips",
            style: {
              marginTop: 6
            },
            children: [(p.placements || []).length ? p.placements.map(pl => /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "adm-promo-chip",
              children: pl
            }, pl)) : /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "hint",
              children: "no placement"
            }), p.ends_at && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              className: "adm-promo-chip",
              style: {
                background: 'var(--honey-100)',
                color: 'var(--honey-700)'
              },
              children: ["ends ", new Date(p.ends_at).toLocaleDateString()]
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => move(p, -1),
            "aria-label": "Move up",
            children: "\u2191"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => move(p, 1),
            "aria-label": "Move down",
            children: "\u2193"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => toggleActive(p),
            children: p.is_active ? 'Disable' : 'Enable'
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => startEdit(p),
            children: "Edit"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-ghost",
            style: {
              color: 'var(--color-sale)'
            },
            onClick: () => remove(p),
            children: "Delete"
          })]
        })]
      }, p.id))
    })]
  });
}

export { Promotions as default };
//# sourceMappingURL=Promotions.js.map
