import { r as reactExports, aQ as adminGetTheme, aR as sanitizeTheme, aS as TOKENS, aT as PRESET_LIST, j as jsxRuntimeExports, aU as GROUPS, aV as DEFAULT_THEME, aW as OVERLAY_SCALES, aX as TYPE_SCALES, aY as HEX_RE, aZ as adminSetTheme, a_ as overlayRgba } from '../bundle.js';

const upperHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : v;
const isValid = (tok, v) => tok.type === 'overlay' ? OVERLAY_SCALES.includes(v) : tok.type === 'scale' ? TYPE_SCALES.includes(v) : HEX_RE.test(v || '');

// All --st-* vars for a full theme, so the preview always reflects the working
// values exactly (defaults included).
function previewVars(theme) {
  const style = {};
  for (const t of TOKENS) {
    if (!t.css) continue;
    const val = t.type === 'overlay' ? overlayRgba(theme[t.key]) : theme[t.key];
    for (const cssVar of t.css) style[cssVar] = val;
  }
  return style;
}
function Appearance() {
  const [saved, setSaved] = reactExports.useState(null);
  const [working, setWorking] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [openGroup, setOpenGroup] = reactExports.useState('Homepage');
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    const t = await adminGetTheme();
    const clean = sanitizeTheme(t || DEFAULT_THEME);
    setSaved(clean);
    setWorking({
      ...clean
    });
    setLoading(false);
  }, []);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2600);
  }
  const dirty = reactExports.useMemo(() => working && saved && TOKENS.some(t => working[t.key] !== saved[t.key]), [working, saved]);
  const anyInvalid = reactExports.useMemo(() => working ? TOKENS.some(t => !isValid(t, working[t.key])) : false, [working]);
  const activePreset = reactExports.useMemo(() => {
    if (!working) return null;
    const hit = PRESET_LIST.find(p => TOKENS.every(t => p.theme[t.key] === working[t.key]));
    return hit ? hit.id : 'custom';
  }, [working]);
  const setToken = (key, value) => setWorking(w => ({
    ...w,
    [key]: value
  }));
  const resetToken = key => setToken(key, DEFAULT_THEME[key]);
  const applyPreset = p => {
    setWorking(sanitizeTheme(p.theme));
    setErr('');
    flash(`“${p.name}” loaded — review, then Save.`);
  };
  const cancel = () => {
    setWorking({
      ...saved
    });
    setErr('');
  };
  const resetAll = () => {
    setWorking({
      ...DEFAULT_THEME
    });
    setErr('');
    flash('Reset to SORA Classic — Save to apply.');
  };
  async function save() {
    const bad = TOKENS.find(t => !isValid(t, working[t.key]));
    if (bad) {
      setErr(`Invalid value for “${bad.label}”. Colors must be #RRGGBB.`);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await adminSetTheme(working);
      if (!res || res.ok === false) {
        setErr(res?.reason || 'Could not save.');
        setBusy(false);
        return;
      }
      const clean = sanitizeTheme(res.theme || working);
      setSaved(clean);
      setWorking({
        ...clean
      });
      flash('Storefront appearance saved.');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading || !working) return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
        children: "Storefront Appearance"
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading theme\u2026"
    })]
  });
  const tokensByGroup = g => TOKENS.filter(t => t.group === g);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Storefront Appearance"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: ["Customize the storefront theme without touching code. ", dirty ? /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            className: "ap-dirty",
            children: "\u25CF Unsaved changes"
          }) : 'All changes saved.']
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-head-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm btn-light",
          onClick: cancel,
          disabled: busy || !dirty,
          children: "Cancel"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: save,
          disabled: busy || !dirty || anyInvalid,
          title: anyInvalid ? 'Fix invalid colors first' : '',
          children: busy ? 'Saving…' : 'Save Changes'
        })]
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface ap-presets",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "ap-presets__label",
        children: "Preset"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-presets__row",
        children: [PRESET_LIST.map(p => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: `ap-preset ${activePreset === p.id ? 'active' : ''}`,
          onClick: () => applyPreset(p),
          children: p.name
        }, p.id)), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: `ap-preset is-custom ${activePreset === 'custom' ? 'active' : ''}`,
          children: "Custom"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-xs btn-light ap-resetall",
        onClick: resetAll,
        children: "Reset entire theme"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-layout",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "ap-controls",
        children: GROUPS.map(g => /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
          className: `surface ap-group ${openGroup === g ? 'is-open' : ''}`,
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
            className: "ap-group__head",
            onClick: () => setOpenGroup(o => o === g ? '' : g),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
              children: g
            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: "ap-group__chev",
              children: openGroup === g ? '−' : '+'
            })]
          }), openGroup === g && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "ap-group__body",
            children: tokensByGroup(g).map(t => /*#__PURE__*/jsxRuntimeExports.jsx(ThemeControl, {
              tok: t,
              value: working[t.key],
              isDefault: working[t.key] === DEFAULT_THEME[t.key],
              onChange: v => setToken(t.key, v),
              onReset: () => resetToken(t.key)
            }, t.key))
          })]
        }, g))
      }), /*#__PURE__*/jsxRuntimeExports.jsx("aside", {
        className: "ap-preview-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-preview-sticky",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
            className: "ap-preview-title",
            children: "Live preview"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(StorefrontPreview, {
            theme: working
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            style: {
              marginTop: 10
            },
            children: "Preview reflects unsaved edits. The real storefront updates only after you Save."
          })]
        })
      })]
    })]
  });
}
function ThemeControl({
  tok,
  value,
  isDefault,
  onChange,
  onReset
}) {
  if (tok.type === 'scale' || tok.type === 'overlay') {
    const opts = tok.type === 'scale' ? TYPE_SCALES : OVERLAY_SCALES;
    return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-row",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "ap-row__label",
        children: [tok.label, !isDefault && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-changed",
          title: "changed from default"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "ap-seg",
        children: opts.map(o => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: value === o ? 'active' : '',
          onClick: () => onChange(o),
          children: o
        }, o))
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "ap-reset",
        title: "Reset to default",
        onClick: onReset,
        disabled: isDefault,
        children: "\u21BA"
      })]
    });
  }
  const validHex = HEX_RE.test(value || '');
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "ap-row",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
      className: "ap-row__label",
      children: [tok.label, !isDefault && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "ap-changed",
        title: "changed from default"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "ap-swatch",
      style: {
        background: validHex ? value : 'transparent'
      },
      "aria-hidden": true
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "color",
      className: "ap-color",
      value: validHex ? value : '#000000',
      onChange: e => onChange(upperHex(e.target.value)),
      "aria-label": tok.label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "text",
      className: `ap-hex ${validHex ? '' : 'is-bad'}`,
      value: value,
      maxLength: 7,
      spellCheck: false,
      onChange: e => {
        let v = e.target.value.trim();
        if (v && !v.startsWith('#')) v = `#${v}`;
        onChange(upperHex(v));
      }
    }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      type: "button",
      className: "ap-reset",
      title: "Reset to default",
      onClick: onReset,
      disabled: isDefault,
      children: "\u21BA"
    })]
  });
}

// A compact, representative slice of the storefront driven entirely by the
// working theme's --st-* vars (set on the container), so it mirrors real output.
function StorefrontPreview({
  theme
}) {
  const style = previewVars(theme);
  const cats = ['Wellness', 'Hair Care', 'Skin Care', 'Juices'];
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "ap-pv",
    style: style,
    "data-heading-scale": theme.heading_scale,
    "data-body-scale": theme.body_scale,
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-pv__annbar",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "ap-pv__annbar-acc",
        children: "\u2726"
      }), " FREE STANDARD SHIPPING"]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-pv__hdr",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
        children: "SORA LIFE"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("nav", {
        children: "Wellness \xB7 Skin \xB7 Hair"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "ap-pv__hdr-ic",
        children: "\u2661 \u2315 \u26EC"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "ap-pv__cats",
      children: cats.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-pv__cat",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-pv__circle"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-pv__cat-name",
          children: c
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-pv__cat-view",
          children: "View all"
        })]
      }, c))
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-pv__cardrow",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-pv__card",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-pv__card-media",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-pv__badge-sale",
            children: "20% OFF"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-pv__badge-new",
            children: "New"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "ap-pv__card-body",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "ap-pv__pname",
            children: "Sea Buckthorn Juice"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "ap-pv__price",
            children: ["\u20B91,800 ", /*#__PURE__*/jsxRuntimeExports.jsx("s", {
              className: "ap-pv__mrp",
              children: "\u20B92,500"
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "ap-pv__btns",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-pv__btn-primary",
          children: "Add to cart"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "ap-pv__btn-secondary",
          children: "Quick view"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "ap-pv__footer",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
        children: "\xA9 SORA LIFE"
      }), " ", /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "ap-pv__footer-acc",
        children: "Wellness \xB7 Support"
      })]
    })]
  });
}

export { Appearance as default };
//# sourceMappingURL=Appearance.js.map
